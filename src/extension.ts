import * as vscode from 'vscode'

let isInsideHover = false
const translationCache = new Map<string, string>()
let showTranslated = true
let statusBarItem: vscode.StatusBarItem

export function activate(context: vscode.ExtensionContext) {
	/** 初始化 StatusBar 按钮 */
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
	updateStatusBar()
	statusBarItem.show()
	statusBarItem.command = 'hoverTranslator.toggleMode'

	/** Hover Provider */
	const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file' }, {
		async provideHover(document, position, token) {
			if (isInsideHover) return
			isInsideHover = true

			try {
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
				const displayText = showTranslated ? translatedText : originalText

				const md = new vscode.MarkdownString(undefined, true)
				md.isTrusted = true

				// === 顶部按钮行 ===
				const encodedText = Buffer.from(originalText, 'utf-8').toString('base64')
				const modeLabel = showTranslated ? '显示原文' : '显示翻译'
				md.appendMarkdown(
					'🐾 悬浮文档翻译&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' +
					`[${modeLabel}](command:hoverTranslator.toggleMode)` +
					` | ` +
					`[重新翻译](command:hoverTranslator.retranslate?${encodeURIComponent(JSON.stringify([encodedText]))})`
				)
				md.appendMarkdown('\n\n---\n') // 按钮和内容分隔线

				// Hover 内容
				md.appendMarkdown(displayText)

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
		updateStatusBar()
		vscode.window.showInformationMessage(`🐾 Hover 模式已切换为：${showTranslated ? '显示翻译' : '显示原文'}`)
	})

	/** 重新翻译命令 */
	const retranslate = vscode.commands.registerCommand('hoverTranslator.retranslate', async (encodedText: string) => {
		if (!encodedText) return
		const originalText = Buffer.from(encodedText, 'base64').toString('utf-8')
		translationCache.delete(originalText)
		const translated = await translateText(originalText)
		translationCache.set(originalText, translated)
		vscode.window.showInformationMessage('🐾 已重新翻译当前 Hover 内容～')
	})

	context.subscriptions.push(hoverProvider, toggleMode, retranslate, statusBarItem)
}

function updateStatusBar() {
	statusBarItem.text = showTranslated ? '🐾 显示原文' : '🐾 显示翻译'
	statusBarItem.tooltip = '点击切换 Hover 显示模式'
}

async function getTranslatedText(text: string): Promise<string> {
	const cached = translationCache.get(text)
	if (cached) return cached
	const translated = await translateText(text)
	translationCache.set(text, translated)
	return translated
}

function getTranslationConfig() {
	const config = vscode.workspace.getConfiguration('hoverTranslator')
	return {
		baseURL: config.get<string>('baseURL', ''),
		apiKey: config.get<string>('apiKey', ''),
		model: config.get<string>('model', 'gpt-4o-mini'),
		promptTemplate: config.get<string>('promptTemplate', '请将以下文本翻译为中文：\n${content}')
	}
}

async function getFetch() {
	const mod = await import('node-fetch')
	return mod.default
}

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

export function deactivate() {
	statusBarItem?.dispose()
}
