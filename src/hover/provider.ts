// src/hover-provider.ts
import * as vscode from 'vscode';
import { PluginContext } from '../types';
import { getCachedTranslation, setCachedTranslation } from '../cache';
import { TranslationServiceFactory } from '../translation/TranslationServiceFactory';
import { md5 } from '../signature';

/**
 * 创建悬浮提示提供者
 */
export function createHoverProvider(context: PluginContext): vscode.HoverProvider {
    // 初始化翻译服务工厂
    const translationFactory = TranslationServiceFactory.getInstance(context.globalContext!);
    
    return {
        async provideHover(document: vscode.TextDocument, position: vscode.Position) {
            if (context.state.isInsideHover) {
                return;
            }
            context.state.isInsideHover = true;

            try {
                const originalHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    document.uri,
                    position
                );

                if (!originalHovers || originalHovers.length === 0) {
                    return;
                }

                const originalText = extractHoverText(originalHovers);
                const hash = md5(originalText);
                const encodedText = Buffer.from(originalText, 'utf-8').toString('base64');

                const md = buildMarkdownContent(originalText, hash, encodedText, context, translationFactory);
                return new vscode.Hover(md);

            } catch (err) {
                console.error('Hover translation failed:', err);
                vscode.window.showErrorMessage(`Hover 翻译失败：${String(err)}`);
            } finally {
                context.state.isInsideHover = false;
            }
        }
    };
}

/**
 * 提取悬浮文本
 */
function extractHoverText(hovers: vscode.Hover[]): string {
    return hovers
        .map(h => h.contents.map(c => 
            (c as vscode.MarkdownString).value ?? String(c)
        ).join('\n'))
        .join('\n\n');
}

/**
 * 构建Markdown内容
 */
function buildMarkdownContent(
    originalText: string, 
    hash: string, 
    encodedText: string, 
    context: PluginContext,
    factory: TranslationServiceFactory
): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;

    // 构建标题和操作按钮
    buildHeader(md, context.state.showTranslated, encodedText);

    if (!context.state.showTranslated) {
        return md;
    }

    // 检查缓存
    const cachedText = getCachedTranslation(hash, context.state);
    if (cachedText) {
        md.appendMarkdown('\n\n' + cachedText);
    } else {
        md.appendMarkdown('\n\n⌛ **翻译中，请稍候...**');
        startBackgroundTranslation(originalText, hash, context, factory);
    }

    return md;
}

/**
 * 构建标题和操作按钮
 */
function buildHeader(md: vscode.MarkdownString, showTranslated: boolean, encodedText: string): void {
    if (showTranslated) {
        md.appendMarkdown(
            `✨ **悬浮文档翻译** &nbsp;&nbsp;&nbsp;&nbsp;👉&nbsp;&nbsp;[禁用翻译](command:hoverTranslator.toggleMode)&nbsp;|&nbsp;` +
            `[重新翻译](command:hoverTranslator.retranslate?${encodeURIComponent(JSON.stringify([encodedText]))})`
        );
    } else {
        md.appendMarkdown(
            `✨ **悬浮文档翻译** &nbsp;&nbsp;&nbsp;&nbsp;👉&nbsp;&nbsp;[开启翻译](command:hoverTranslator.toggleMode)`
        );
    }
}

/**
 * 启动后台翻译 - 使用工厂模式
 */
function startBackgroundTranslation(
    originalText: string, 
    hash: string, 
    context: PluginContext,
    factory: TranslationServiceFactory
): void {
    if (context.state.translating.has(hash)) {
        return;
    }
    
    context.state.translating.add(hash);

    // 使用工厂模式进行翻译
    translateWithFactory(originalText, hash, context, factory)
        .then(translated => {
            context.state.translating.delete(hash);
            setCachedTranslation(hash, originalText, translated, context.state);
            triggerHoverRefresh();
        })
        .catch(err => {
            context.state.translating.delete(hash);
            console.error('Background translate failed:', err);
            
            const errorText = `❌ **翻译异常**：${String(err.message || err)}`;
            setCachedTranslation(hash, originalText, errorText, context.state);
            triggerHoverRefresh();
        });
}

/**
 * 使用工厂模式进行翻译
 */
async function translateWithFactory(
    originalText: string,
    hash: string,
    context: PluginContext,
    factory: TranslationServiceFactory
): Promise<string> {
    try {
        const config = context.config;
        
        // 构建翻译请求
        const request = {
            originalText: originalText
        };

        // 使用工厂进行翻译（带降级机制）
        const fallbackServices = factory.getAvailableServices()
            .filter(service => service !== config.serviceProvider)
            .slice(0, 2); // 最多使用2个备用服务

        const result = await factory.translateWithFallback(
            request,
            config.serviceProvider,
            fallbackServices,
            config
        );

        return result.translatedText;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`翻译服务不可用: ${errorMessage}`);
    }
}

/**
 * 触发悬浮提示刷新
 */
function triggerHoverRefresh(): void {
    setTimeout(() => {
        vscode.commands.executeCommand('editor.action.showHover').then(undefined, () => {});
    }, 80);
}