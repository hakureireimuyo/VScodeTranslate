import * as vscode from 'vscode'
import { createHash } from 'crypto'

/** 防止递归触发 Hover 的锁 */
let isInsideHover = false

/** 缓存条目 */
interface CacheEntry {
	original: string
	text: string
	time: number
}

/** 翻译缓存 Map：hash -> CacheEntry */
let translationCache = new Map<string, CacheEntry>()

/** 当前显示模式：true 显示翻译，false 显示原文 */
let showTranslated = true

/** 全局 ExtensionContext，用于持久化缓存 */
let globalContext: vscode.ExtensionContext

/** 缓存过期时间：毫秒，默认 30 天 */
const CACHE_EXPIRE_TIME = 30 * 24 * 60 * 60 * 1000

/** 延迟保存缓存的防抖定时器 */
let saveTimeout: NodeJS.Timeout | null = null

/** 正在翻译的文本 Hash 集合（防止并发重复翻译） */
let translating = new Set<string>()

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
	globalContext = context

	// 获取用户配置的首次启动延迟时间（毫秒），默认 5000ms
	const config = vscode.workspace.getConfiguration('hoverTranslator')
	const startupDelay = config.get<number>('startupDelay', 5000)

	console.log(`🐾 hoverTranslator: 插件将在 ${startupDelay} ms 后启动 HoverProvider`)

	setTimeout(() => {
		// 初始化缓存（从 globalState 恢复）
		const savedCache = context.globalState.get<Record<string, CacheEntry>>('translationCache', {})
		translationCache = new Map(Object.entries(savedCache))

		/** Hover Provider */
		const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file' }, {
			async provideHover(document, position) {
				// 简单的递归保护
				if (isInsideHover) return
				isInsideHover = true

				try {
					// 获取原生 Hover（语言服务等给出的内容）
					const originalHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
						'vscode.executeHoverProvider',
						document.uri,
						position
					)
					if (!originalHovers || originalHovers.length === 0) return

					// 合并原始 Hover 内容为纯文本
					const originalText = originalHovers
						.map(h => h.contents.map(c => (c as vscode.MarkdownString).value ?? String(c)).join('\n'))
						.join('\n\n')

					// 预先计算 hash & 编码供按钮使用
					const hash = md5(originalText)
					const encodedText = Buffer.from(originalText, 'utf-8').toString('base64')

					// 尝试从缓存获取翻译（并验证是否过期）
					const cached = translationCache.get(hash)
					const hasValidCache = !!(cached && (Date.now() - cached.time < CACHE_EXPIRE_TIME))

					// 构造 MarkdownString（立即显示）
					const md = new vscode.MarkdownString(undefined, true)
					md.isTrusted = true

					// 顶部按钮行 —— **立刻显示**（不依赖翻译完成）
					const modeLabel = showTranslated ? '显示原文' : '显示译文'
					md.appendMarkdown(
						`✨ **悬浮文档翻译** &nbsp;&nbsp;👉&nbsp;&nbsp;[${modeLabel}](command:hoverTranslator.toggleMode)&nbsp;` +
						`[重新翻译](command:hoverTranslator.retranslate?${encodeURIComponent(JSON.stringify([encodedText]))})`
					)

					// 如果已经有有效缓存，则根据用户配置显示翻译或原文
					if (hasValidCache) {
						if (showTranslated) {
							md.appendMarkdown('\n\n' + cached!.text)
						}
					} else {
						// 未命中缓存：先显示占位（提示“正在翻译...”），并在后台发起翻译
						md.appendMarkdown(' *⌛ 翻译中 ···*') // 占位文本

						// 如果当前文本没有在翻译队列中，则启动后台翻译（不阻塞 Hover 返回）
						if (!translating.has(hash)) {
							translating.add(hash)
							// 后台异步执行翻译，不 await（这样能立刻返回 hover）
							translateText(originalText).then(translated => {
								translating.delete(hash)
								// 只有在翻译成功的情况下写入缓存（与原逻辑一致）
								if (translated && !translated.startsWith('(翻译失败')) {
									translationCache.set(hash, { original: originalText, text: translated, time: Date.now() })
									saveCacheDebounced()
								}
								// 强制重新打开 Hover 来刷新显示（触发 provideHover 再次执行）
								// 放到微任务中，确保当前 provideHover 的 finally 已经把 isInsideHover 置 false
								setTimeout(() => {
									(vscode.commands.executeCommand('editor.action.showHover') as Promise<unknown>).catch(() => { /* 忽略 */ })
								}, 50)
							}).catch(err => {
								translating.delete(hash)
								console.error('Background translate failed:', err)
							})
						}
					}

					// 立即返回 hover（无论翻译是否完成，按钮均可见）
					return new vscode.Hover(md)
				} catch (err) {
					console.error('Hover translation failed:', err)
					vscode.window.showErrorMessage(`Hover 翻译失败：${String(err)}`)
				} finally {
					isInsideHover = false
				}
			}
		})

		/** 切换模式命令 */
		const toggleMode = vscode.commands.registerCommand('hoverTranslator.toggleMode', () => {
			showTranslated = !showTranslated
			vscode.window.showInformationMessage(`🐾 Hover 模式已切换为：${showTranslated ? '显示译文' : '显示原文'}`)
		})

		/**
		 * 重新翻译命令（由按钮触发）
		 * @param encodedText base64 编码的原文
		 */
		const retranslate = vscode.commands.registerCommand('hoverTranslator.retranslate', async (encodedText: string) => {
			if (!encodedText) return
			const originalText = Buffer.from(encodedText, 'base64').toString('utf-8')
			// 直接发起强制重新翻译（会覆盖缓存），并在完成后强制刷新 hover
			await (retranslateText(originalText) as Promise<unknown>);
			// 重新显示 hover，让 provider 读取新缓存并渲染翻译结果
			(vscode.commands.executeCommand('editor.action.showHover') as Promise<unknown>).catch(() => { })
			vscode.window.showInformationMessage('🐾 已重新翻译当前 Hover 内容～')
		})

		context.subscriptions.push(hoverProvider, toggleMode, retranslate)
		console.log('🐾 hoverTranslator: 插件已启动')
	}, startupDelay)
}

/**
 * 获取翻译文本（缓存 + 过期 + 懒惰清理）
 * @param text 要翻译的原文
 * @returns 翻译结果（或错误/提示信息）
 */
async function getTranslatedText(text: string): Promise<string> {
	const hash = md5(text)
	const cached = translationCache.get(hash)

	if (cached) {
		if (Date.now() - cached.time < CACHE_EXPIRE_TIME) {
			return cached.text
		} else {
			translationCache.delete(hash) // 过期就删除
		}
	}

	const translated = await translateText(text)
	if (translated && !translated.startsWith('(翻译失败')) {
		translationCache.set(hash, { original: text, text: translated, time: Date.now() })
		saveCacheDebounced()
	}

	return translated
}

/**
 * 重新翻译（强制刷新缓存并返回）
 * @param originalText 原文
 */
async function retranslateText(originalText: string) {
	const hash = md5(originalText)
	translationCache.delete(hash)
	const translated = await translateText(originalText)
	if (translated && !translated.startsWith('(翻译失败')) {
		translationCache.set(hash, { original: originalText, text: translated, time: Date.now() })
		saveCacheDebounced()
	}
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
 * 获取配置
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
 * 调用翻译接口
 * @param text 原文
 * @returns 翻译文本或错误说明
 */
async function translateText(text: string): Promise<string> {
	const { baseURL, apiKey, model, promptTemplate } = getTranslationConfig()
	if (!baseURL || !apiKey) return '(未配置翻译接口)'

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
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		const data: any = await res.json()
		return data.choices?.[0]?.message?.content?.trim() || '(未返回翻译结果)'
	} catch (err) {
		console.error('Translate error:', err)
		return `(翻译失败：${String(err)})`
	}
}

/**
 * 计算 MD5
 * @param str 输入字符串
 * @returns hex MD5 值
 */
function md5(str: string): string {
	return createHash('md5').update(str, 'utf-8').digest('hex')
}

/**
 * 插件停用
 */
export function deactivate() { }
