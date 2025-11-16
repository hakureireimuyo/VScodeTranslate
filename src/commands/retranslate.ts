// src/commands/translation-commands.ts
import * as vscode from 'vscode';
import { PluginContext } from '../types';
import { TranslationServiceFactory } from '../translation/TranslationServiceFactory';
import { setCachedTranslation, getCachedTranslation } from '../cache';
import { md5 } from '../signature';

/**
 * 注册翻译相关命令
 */
export function registerTranslationCommands(context: PluginContext): vscode.Disposable[] {
    const factory = TranslationServiceFactory.getInstance(context.globalContext!);
    
    return [
        // 切换翻译模式命令
        vscode.commands.registerCommand('hoverTranslator.toggleMode', () => {
            context.state.showTranslated = !context.state.showTranslated;
            vscode.window.showInformationMessage(
                `悬浮翻译已${context.state.showTranslated ? '开启' : '关闭'}`
            );
            triggerHoverRefresh();
        }),

        // 重新翻译命令
        vscode.commands.registerCommand('hoverTranslator.retranslate', async (encodedText: string) => {
            try {
                const originalText = Buffer.from(encodedText, 'base64').toString('utf-8');
                const hash = md5(originalText);
                
                // 清除缓存，强制重新翻译
                context.state.translationCache.delete(hash);
                context.state.translating.delete(hash);
                
                vscode.window.setStatusBarMessage('🔄 重新翻译中...', 2000);
                triggerHoverRefresh();
                
            } catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`重新翻译失败: ${error.message}`);
                } else {
                    vscode.window.showErrorMessage('重新翻译失败: 未知错误');
                }
            }
        }),

        // 手动翻译选中文本命令
        vscode.commands.registerCommand('hoverTranslator.translateSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('没有活动的文本编辑器');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection).trim();
            
            if (!selectedText) {
                vscode.window.showWarningMessage('请先选择要翻译的文本');
                return;
            }

            await executeManualTranslation(selectedText, context, factory);
        }),

        // 切换翻译服务命令
        vscode.commands.registerCommand('hoverTranslator.switchService', async () => {
            await switchTranslationService(context, factory);
        })
    ];
}

/**
 * 执行手动翻译
 */
async function executeManualTranslation(
    text: string, 
    context: PluginContext, 
    factory: TranslationServiceFactory
): Promise<void> {
    const config = context.config;
    
    try {
        // 显示进度通知
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "翻译中...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            
            const request = { originalText: text };
            const fallbackServices = factory.getAvailableServices()
                .filter(service => service !== config.serviceProvider);

            const result = await factory.translateWithFallback(
                request,
                config.serviceProvider,
                fallbackServices,
                config
            );

            progress.report({ increment: 100 });
            
            // 显示翻译结果
            await showTranslationResult(text, result.translatedText, result.service);
        });
        
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('翻译失败: 未知错误');
        }
    }
}

/**
 * 显示翻译结果
 */
async function showTranslationResult(originalText: string, translatedText: string, service: string): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'translationResult',
        '翻译结果',
        vscode.ViewColumn.Beside,
        {}
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { padding: 20px; font-family: var(--vscode-font-family); }
                .original { background: var(--vscode-textBlockQuote-background); padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                .translated { background: var(--vscode-input-background); padding: 15px; border-radius: 5px; }
                .service { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="original">
                <strong>原文:</strong><br>${originalText}
            </div>
            <div class="translated">
                <strong>翻译结果:</strong><br>${translatedText}
            </div>
            <div class="service">翻译服务: ${service}</div>
        </body>
        </html>
    `;
}

/**
 * 切换翻译服务
 */
async function switchTranslationService(
    context: PluginContext, 
    factory: TranslationServiceFactory
): Promise<void> {
    const availableServices = factory.getAvailableServices();
    const currentService = context.config.serviceProvider;
    
    const selectedService = await vscode.window.showQuickPick(availableServices, {
        placeHolder: `当前服务: ${currentService}`,
        title: '选择翻译服务'
    });
    
    if (selectedService) {
        context.config.serviceProvider = selectedService;
        
        // 更新配置
        const configuration = vscode.workspace.getConfiguration('hoverTranslator');
        await configuration.update('serviceProvider', selectedService, true);
        
        vscode.window.showInformationMessage(`已切换到 ${selectedService} 翻译服务`);
        
        // 清除缓存，确保使用新服务重新翻译
        context.state.translationCache.clear();
        context.state.translating.clear();
        
        triggerHoverRefresh();
    }
}

/**
 * 触发悬浮提示刷新
 */
function triggerHoverRefresh(): void {
    setTimeout(() => {
        vscode.commands.executeCommand('editor.action.showHover');
    }, 100);
}