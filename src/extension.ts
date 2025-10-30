import * as vscode from 'vscode'
import { createHash } from 'crypto'

/** 防止递归触发 Hover 的锁 */
let isInsideHover = false
/** 翻译缓存 Map（内存）：hash -> { text: 翻译结果, time: 时间戳 } */
let translationCache = new Map<string, { text: string; time: number }>()
/** 当前显示模式：true 显示翻译，false 显示原文 */
let showTranslated = true
/** 全局 ExtensionContext，用于持久化缓存 */
let globalContext: vscode.ExtensionContext
/** 原文到 MD5 的映射（用于重新翻译） */
let originalToHash = new Map<string, string>()
/** 缓存过期时间：毫秒，默认 7 天 */
const CACHE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
	globalContext = context

	// 初始化缓存
	const savedCache = context.globalState.get<Record<string, { text: string; time: number }>>('translationCache', {})
	translationCache = new Map(Object.entries(savedCache))

	// 初始化原文映射
	const savedOriginalMap = context.globalState.get<Record<string, string>>('originalToHash', {})
	originalToHash = new Map(Object.entries(savedOriginalMap))

	/** Hover Provider */
	const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file' }, {
		async provideHover(document, position, token) {
			if (isInsideHover) return
			isInsideHover = true

			try {
				// 获取原生 Hover
				const originalHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
					'vscode.executeHoverProvider',
					document.uri,
					position
				)
				if (!originalHovers || originalHovers.length === 0) return

				const originalText = originalHovers
					.map(h => h.contents.map(c => (c as vscode.MarkdownString).value ?? String(c)).join('\n'))
					.join('\n\n')

				const translatedText = await getTranslatedText(originalText)

				const md = new vscode.MarkdownString(undefined, true)
				md.isTrusted = true

				// 顶部按钮行
				const encodedText = Buffer.from(originalText, 'utf-8').toString('base64')
				const modeLabel = showTranslated ? '显示原文' : '显示译文'

				md.appendMarkdown(
					`[${modeLabel}](command:hoverTranslator.toggleMode)&nbsp;` +
					`[重新翻译](command:hoverTranslator.retranslate?${encodeURIComponent(JSON.stringify([encodedText]))})`
				)

				// 仅在显示翻译时显示翻译内容
				if (showTranslated) {
					md.appendMarkdown('\n\n' + translatedText)
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

	/** 切换模式命令 */
	const toggleMode = vscode.commands.registerCommand('hoverTranslator.toggleMode', () => {
		showTranslated = !showTranslated
		vscode.window.showInformationMessage(`🐾 Hover 模式已切换为：${showTranslated ? '显示译文' : '显示原文'}`)
	})

	/** 重新翻译命令 */
	const retranslate = vscode.commands.registerCommand('hoverTranslator.retranslate', async (encodedText: string) => {
		if (!encodedText) return
		const originalText = Buffer.from(encodedText, 'base64').toString('utf-8')
		const hash = md5(originalText)
		translationCache.delete(hash)
		originalToHash.delete(originalText)
		await saveCache()
		const translated = await translateText(originalText)
		if (translated && !translated.startsWith('(翻译失败')) {
			translationCache.set(hash, { text: translated, time: Date.now() })
			originalToHash.set(originalText, hash)
			await saveCache()
			vscode.window.showInformationMessage('🐾 已重新翻译当前 Hover 内容～')
		}
	})

	context.subscriptions.push(hoverProvider, toggleMode, retranslate)
}

/**
 * 获取翻译文本（带缓存和过期机制）
 */
async function getTranslatedText(text: string): Promise<string> {
	const hash = md5(text)
	const cached = translationCache.get(hash)

	// 检查缓存是否存在且未过期
	if (cached && Date.now() - cached.time < CACHE_EXPIRE_TIME) {
		return cached.text
	}

	// 调用翻译接口
	const translated = await translateText(text)
	if (translated && !translated.startsWith('(翻译失败')) {
		translationCache.set(hash, { text: translated, time: Date.now() })
		originalToHash.set(text, hash)
		await saveCache()
	}

	return translated
}

/**
 * 将缓存持久化到 globalState
 */
async function saveCache() {
	if (!globalContext) return
	await globalContext.globalState.update('translationCache', Object.fromEntries(translationCache))
	await globalContext.globalState.update('originalToHash', Object.fromEntries(originalToHash))
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
 * 动态导入 fetch
 */
async function getFetch() {
	const mod = await import('node-fetch')
	return mod.default
}

/**
 * 调用翻译接口
 */
async function translateText(text: string): Promise<string> {
	const { baseURL, apiKey, model, promptTemplate } = getTranslationConfig()
	if (!baseURL || !apiKey) return '(未配置翻译接口)'

	const fetch = await getFetch()
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
					{ role: 'system', content: 'You are a translation assistant.' },
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
 */
function md5(str: string): string {
	return createHash('md5').update(str, 'utf-8').digest('hex')
}

/**
 * 插件停用
 */
export function deactivate() { }
