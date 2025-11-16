// src/hover/HoverProvider.ts
import * as vscode from 'vscode';
import { PluginContext } from '../types';
import { setCachedTranslation } from '../cache';
import { TranslationServiceFactory } from '../translation/TranslationServiceFactory';
import { DisplayMode } from '../constants';
import { splitIntoParagraphs, generateParagraphTranslations } from './TextProcessor';
import { buildMarkdownContent } from './MarkdownRenderer';

// 为防抖函数添加类型声明
declare global {
    interface Function {
        timeoutId?: NodeJS.Timeout;
    }
}

/**
 * 创建悬浮提示提供者
 */
export function createHoverProvider(context: PluginContext): vscode.HoverProvider {
    const translationFactory = TranslationServiceFactory.getInstance(context.globalContext!);
    
    // 初始化显示模式
    if (!context.displayMode) {
        context.displayMode = DisplayMode.SideBySide;
    }
    
    // 添加一个标志来防止递归调用
    let isProcessing = false;
    
    console.log('🐾 HoverProvider: 创建悬浮提示提供者');
    
    return {
        async provideHover(document: vscode.TextDocument, position: vscode.Position) {
            // 防止递归调用
            if (isProcessing) {
                console.log('🐾 HoverProvider: 检测到递归调用，跳过处理');
                return;
            }
            
            isProcessing = true;
            
            try {
                console.log(`🐾 HoverProvider: 接收到悬浮提示请求`, {
                    fileName: document.fileName,
                    position: `${position.line}:${position.character}`
                });
                
                const config = vscode.workspace.getConfiguration('VScodeTranslator');
                const isEnabled = config.get<boolean>('enabled', true);
                console.log(`🐾 HoverProvider: 当前插件启用状态: ${isEnabled}`);

                // 如果未启用翻译，直接返回原始hover内容
                if (!isEnabled) {
                    console.log('🐾 HoverProvider: 插件未启用，返回原始悬浮内容');
                    const originalHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                        'vscode.executeHoverProvider',
                        document.uri,
                        position
                    );
                    
                    if (originalHovers && originalHovers.length > 0) {
                        console.log('🐾 HoverProvider: 成功获取原始悬浮内容');
                        return originalHovers[0];
                    }
                    console.log('🐾 HoverProvider: 未获取到原始悬浮内容');
                    return;
                }

                console.log('🐾 HoverProvider: 获取原始悬浮内容');
                const originalHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    document.uri,
                    position
                );

                if (!originalHovers || originalHovers.length === 0) {
                    console.log('🐾 HoverProvider: 未获取到原始悬浮内容，返回空');
                    return;
                }

                const originalText = extractHoverText(originalHovers);
                console.log(`🐾 HoverProvider: 提取原始文本，长度: ${originalText.length}`);
                
                // 按自然段分割文本
                const paragraphs = splitIntoParagraphs(originalText);
                console.log(`🐾 HoverProvider: 分割为 ${paragraphs.length} 个段落`);
                
                // 为每个段落生成唯一标识和翻译状态
                const paragraphTranslations = generateParagraphTranslations(paragraphs, context.state);

                const encodedText = Buffer.from(originalText, 'utf-8').toString('base64');
                console.log(`🐾 HoverProvider: 构建Markdown内容`);
                
                const md = await buildMarkdownContent(
                    paragraphTranslations, 
                    encodedText, 
                    context, 
                    translationFactory
                );
                
                console.log('🐾 HoverProvider: 成功构建悬浮内容');
                return new vscode.Hover(md);

            } catch (err) {
                console.error('🐾 HoverProvider: 悬浮翻译失败', err);
                vscode.window.showErrorMessage(`Hover 翻译失败：${String(err)}`);
            } finally {
                isProcessing = false;
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