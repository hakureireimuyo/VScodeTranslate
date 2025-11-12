import * as vscode from 'vscode'
import { createHash } from 'crypto'

/** 防止递归触发 Hover 的锁 */
let isInsideHover = false

/** 缓存条目 */
interface CacheEntry {
	/** 原文 */
	original: string
	/** 翻译或错误提示 */
	text: string
	/** 缓存时间戳 */
	time: number
}

/** 翻译缓存 Map：hash -> CacheEntry */
let translationCache = new Map<string, CacheEntry>()

/** 当前显示模式：true 显示翻译，false 显示原文 */
let showTranslated = true

/** 全局 ExtensionContext，用于持久化缓存 */
let globalContext: vscode.ExtensionContext

/** 缓存过期时间（默认 30 天） */
const CACHE_EXPIRE_TIME = 30 * 24 * 60 * 60 * 1000

/** 防抖保存定时器 */
let saveTimeout: NodeJS.Timeout | null = null

/** 正在翻译中的文本集合（防止并发重复请求） */
let translating = new Set<string>()

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
	globalContext = context

	const config = vscode.workspace.getConfiguration('hoverTranslator')
	const startupDelay = config.get<number>('startupDelay', 5000)
	console.log(`🐾 hoverTranslator: 插件将在 ${startupDelay} ms 后启动 HoverProvider`)

	setTimeout(() => {
		// 从 globalState 恢复缓存
		const savedCache = context.globalState.get<Record<string, CacheEntry>>('translationCache', {})
		translationCache = new Map(Object.entries(savedCache))

		/** Hover Provider */
		const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file' }, {
			async provideHover(document, position) {
				if (isInsideHover) return
				isInsideHover = true

				try {
					// 获取原始 Hover 内容
					const originalHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
						'vscode.executeHoverProvider',
						document.uri,
						position
					)
					if (!originalHovers || originalHovers.length === 0) return

					// 提取文本
					const originalText = originalHovers
						.map(h => h.contents.map(c => (c as vscode.MarkdownString).value ?? String(c)).join('\n'))
						.join('\n\n')

					const hash = md5(originalText)
					const encodedText = Buffer.from(originalText, 'utf-8').toString('base64')

					const cached = translationCache.get(hash)
					const hasValidCache = !!(cached && (Date.now() - cached.time < CACHE_EXPIRE_TIME))

					// 构建悬浮 Markdown
					const md = new vscode.MarkdownString(undefined, true)
					md.isTrusted = true

					if (showTranslated) {
						md.appendMarkdown(
							`✨ **悬浮文档翻译** &nbsp;&nbsp;&nbsp;&nbsp;👉&nbsp;&nbsp;[禁用翻译](command:hoverTranslator.toggleMode)&nbsp;|&nbsp;` +
							`[重新翻译](command:hoverTranslator.retranslate?${encodeURIComponent(JSON.stringify([encodedText]))})`
						)
					} else {
						md.appendMarkdown(
							`✨ **悬浮文档翻译** &nbsp;&nbsp;&nbsp;&nbsp;👉&nbsp;&nbsp;[开启翻译](command:hoverTranslator.toggleMode)`
						)
						return new vscode.Hover(md)
					}

					// ✅ 有缓存则直接展示
					if (hasValidCache) {
						if (showTranslated) md.appendMarkdown('\n\n' + cached!.text)
					} else {
						// 没有缓存：显示占位提示
						md.appendMarkdown('\n\n⌛ **翻译中，请稍候...**')

						// 后台异步翻译（不阻塞 Hover）
						if (!translating.has(hash)) {
							translating.add(hash)

							translateText(originalText).then(translated => {
								translating.delete(hash)

								// 无论成功失败，都缓存结果
								translationCache.set(hash, {
									original: originalText,
									text: translated,
									time: Date.now()
								})
								saveCacheDebounced()
							}).catch(err => {
								translating.delete(hash)
								console.error('Background translate failed:', err)
								const errorText = `❌ **翻译异常**：${String(err)}`
								translationCache.set(hash, { original: originalText, text: errorText, time: Date.now() })
								saveCacheDebounced()
								setTimeout(() => {
									(vscode.commands.executeCommand('editor.action.showHover') as Promise<unknown>)
										.catch(() => { })
								}, 80)
							})
						}
					}

					return new vscode.Hover(md)
				} catch (err) {
					console.error('Hover translation failed:', err)
					vscode.window.showErrorMessage(`Hover 翻译失败：${String(err)}`)
				} finally {
					isInsideHover = false
				}
			}
		})

		/** 切换显示模式 */
		const toggleMode = vscode.commands.registerCommand('hoverTranslator.toggleMode', () => {
			showTranslated = !showTranslated
			vscode.window.showInformationMessage(`🐾 Hover 模式已切换为：${showTranslated ? '显示译文' : '显示原文'}`)
		})

		/** 重新翻译命令 */
		const retranslate = vscode.commands.registerCommand('hoverTranslator.retranslate', async (encodedText: string) => {
			if (!encodedText) return
			const originalText = Buffer.from(encodedText, 'base64').toString('utf-8')
			await retranslateText(originalText);
			(vscode.commands.executeCommand('editor.action.showHover') as Promise<unknown>).catch(() => { })
		})

		context.subscriptions.push(hoverProvider, toggleMode, retranslate)
		console.log('🐾 hoverTranslator: 插件已启动')
	}, startupDelay)
}

/**
 * 强制重新翻译（覆盖缓存）
 */
async function retranslateText(originalText: string) {
	const hash = md5(originalText)
	translationCache.delete(hash)
	const translated = await translateText(originalText)
	translationCache.set(hash, { original: originalText, text: translated, time: Date.now() })
	saveCacheDebounced()
}

/**
 * 延迟保存缓存（防抖）
 */
function saveCacheDebounced() {
	if (saveTimeout) clearTimeout(saveTimeout)
	saveTimeout = setTimeout(async () => {
		if (!globalContext) return
		await globalContext.globalState.update('translationCache', Object.fromEntries(translationCache))
	}, 500)
}

/**
 * 获取插件配置
 */
function getTranslationConfig() {
	const config = vscode.workspace.getConfiguration('hoverTranslator')
	return {
		baseURL: config.get<string>('baseURL', ''),
		apiKey: config.get<string>('apiKey', ''),
		model: config.get<string>('model', ''),
		promptTemplate: config.get<string>('promptTemplate', '请将以下文本翻译为中文：\n${content}')
	}
}

/**
 * 翻译函数（含错误提示）
 */
async function translateText(text: string): Promise<string> {
	const { baseURL, apiKey, model, promptTemplate } = getTranslationConfig()

	// ⚠️ 基础配置检查
	if (!baseURL || !apiKey) {
		return '❌ **未配置翻译接口**\n请在 `hoverTranslator` 设置中填写 `baseURL` 与 `apiKey`。'
	}

	const prompt = promptTemplate.replace('${content}', text)

	try {
		const res = await fetch(`${baseURL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: 'system', content: '你是一个编程语言专家，能准确识别声明语法结构并判断其复杂度' },
					{ role: 'user', content: prompt }
				]
			})
		})

		if (!res.ok) {
			const msg = `❌ **翻译请求失败（HTTP ${res.status}）**`
			return msg
		}

		const data: any = await res.json()
		const content = data.choices?.[0]?.message?.content?.trim()
		if (!content) {
			return '⚠️ **翻译服务未返回结果**，请检查模型或请求格式。'
		}
		vscode.window.showInformationMessage('🐾 翻译完成，请重新悬停以查看翻译结果～')
		return content
	} catch (err) {
		return `❌ **翻译失败**：${String(err)}`
	}
}

/**
 * 计算 MD5
 */
function md5(str: string): string {
	return createHash('md5').update(str, 'utf-8').digest('hex')
}

/**
 * 插件停用
 */
export function deactivate() { }
