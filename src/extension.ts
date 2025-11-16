// src/extension.ts
import * as vscode from 'vscode';
import { PluginState, PluginContext, TranslationConfig } from './types';
import { initializeCache, flushCache, clearAllCache } from './cache';
import { ConfigManager,getStartupDelay,getGlobalConfig } from './config';
import { TranslationServiceFactory } from './translation/TranslationServiceFactory';
import { createHoverProvider } from './hover/provider';
import { registerAllCommands } from './commands';
import { DisplayMode } from './constants';

/**
 * 插件全局状态
 */
const pluginState: PluginState = {
    isInsideHover: false,
    showTranslated: true,
    translationCache: new Map(),
    translating: new Set(),
};

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
    try {
        // 初始化配置管理器
        const configManager = ConfigManager.getInstance();
        const config = configManager.getConfig();
        
        // 验证配置
        const validation = configManager.validateConfig();
        if (!validation.isValid) {
            vscode.window.showWarningMessage(
                `悬浮翻译插件配置不完整: ${validation.errors.join('; ')}。请在设置中配置相关参数。`
            );
        }
            
        // 初始化插件上下文
        const pluginContext: PluginContext = {
            state: pluginState,
            config,
            globalContext: context,
            displayMode: DisplayMode.TranslatedOnly,
        };

        // 初始化翻译服务工厂
        TranslationServiceFactory.getInstance(context);
        
        // 初始化缓存
        initializeCache(context, pluginState);

        // 获取启动延迟配置
        const startupDelay = getStartupDelay();
        console.log(`🐾 VScodeTranslator: 插件将在 ${startupDelay}ms 后启动`);

        // 延迟启动以提升VSCode启动性能
        setTimeout(() => {
            initializeExtension(context, pluginContext);
        }, startupDelay);
        
    } catch (error) {
        console.error('🐾 VScodeTranslator: 插件激活失败', error);
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`悬浮翻译插件激活失败: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`悬浮翻译插件激活失败: ${String(error)}`);
        }
    }
}

/**
 * 初始化扩展功能
 */
function initializeExtension(context: vscode.ExtensionContext, pluginContext: PluginContext) {
    try {
        // 每次初始化时重新获取最新配置
        const configManager = ConfigManager.getInstance();
        const config = configManager.getConfig(); // 重新获取配置
        
        // 更新插件上下文中的配置
        pluginContext.config = config;
        
        // 验证配置
        const validation = configManager.validateConfig();
        if (!validation.isValid) {
            vscode.window.showWarningMessage(
                `悬浮翻译插件配置不完整: ${validation.errors.join('; ')}。请在设置中配置相关参数。`
            );
        }

        // 注册悬浮提示提供者
        const hoverProvider = vscode.languages.registerHoverProvider(
            { scheme: 'file', language: '*' }, // 支持所有语言文件
            createHoverProvider(pluginContext)
        );

        // 注册所有命令
        const commandDisposables = registerAllCommands(pluginContext);

        // 注册配置变化监听器
        const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(handleConfigChange(pluginContext));

        // 将所有订阅添加到上下文
        context.subscriptions.push(
            hoverProvider,
            configChangeDisposable,
            ...commandDisposables
        );

        console.log('🐾 VScodeTranslator: 插件已成功启动');
        console.log('🐾 Current service provider:', config.serviceProvider);
        
        // 显示启动通知（仅第一次）
        showStartupNotification(pluginContext);

        // 清空缓存的调试信息,仅开发使用,发布模式会注释掉
        clearAllCache(pluginContext.state);
        
        
    } catch (error) {
        console.error('🐾 VScodeTranslator: 扩展初始化失败', error);
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`悬浮翻译扩展初始化失败: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`悬浮翻译扩展初始化失败: ${String(error)}`);
        }
    }
}

/**
 * 处理配置变化
 */
function handleConfigChange(pluginContext: PluginContext): (e: vscode.ConfigurationChangeEvent) => any {
    return (e: vscode.ConfigurationChangeEvent) => {
        if (e.affectsConfiguration('VScodeTranslator')) {
            try {
                // 重要：重新获取配置管理器实例并获取最新配置
                const configManager = ConfigManager.getInstance();
                const newConfig = configManager.getConfig();
                
                // 记录变更前后的服务提供商
                const oldProvider = pluginContext.config.serviceProvider;
                const newProvider = newConfig.serviceProvider;
                
                console.log(`🐾 Config changed - Service provider: ${oldProvider} -> ${newProvider}`);
                
                // 更新插件上下文配置
                pluginContext.config = newConfig;
                
                // 处理服务提供商变更
                if (e.affectsConfiguration('VScodeTranslator.serviceProvider')) {
                    handleServiceProviderChange(pluginContext, newConfig);
                }
                
                // 处理API密钥相关配置变更
                if (e.affectsConfiguration('VScodeTranslator.apiKey') || 
                    e.affectsConfiguration('VScodeTranslator.baseURL')) {
                    handleCredentialChange(pluginContext);
                }
                
                // 处理启用状态变更
                if (e.affectsConfiguration('VScodeTranslator.enabled')) {
                    handleEnableStatusChange(pluginContext);
                }
                
                console.log('🐾 VScodeTranslator: 配置已更新');
                vscode.window.setStatusBarMessage('🔄 翻译配置已更新', 3000);
                
            } catch (error) {
                console.error('🐾 VScodeTranslator: 配置更新失败', error);
            }
        }
    };
}

/**
 * 处理服务提供商变更
 */
function handleServiceProviderChange(pluginContext: PluginContext, newConfig: TranslationConfig): void {
    const oldProvider = pluginContext.config.serviceProvider;
    const newProvider = newConfig.serviceProvider;
    
    console.log(`🐾 VScodeTranslator: 服务提供商变更 ${oldProvider} -> ${newProvider}`);
    
    // 清理旧服务的缓存和状态
    pluginContext.state.translating.clear();
    
    // 显示服务切换通知
    vscode.window.showInformationMessage(
        `翻译服务已切换: ${oldProvider} → ${newProvider}`,
        { modal: false }
    );
    
    // 强制刷新所有悬停提示
    setTimeout(() => {
        vscode.commands.executeCommand('editor.action.showHover');
    }, 500);
}

/**
 * 处理凭证配置变更
 */
function handleCredentialChange(pluginContext: PluginContext): void {
    // 清理缓存，因为API密钥变更可能需要重新认证
    pluginContext.state.translationCache.clear();
    
    vscode.window.showInformationMessage(
        '翻译API配置已更新，缓存已清除',
        { modal: false }
    );
}

/**
 * 显示启动通知
 */
function showStartupNotification(pluginContext: PluginContext): void {
    // 只在第一次启动时显示
    const hasShownNotification = pluginContext.globalContext?.globalState.get<boolean>('hasShownStartupNotification');
    
    if (!hasShownNotification) {
        const config = pluginContext.config;
        const serviceName = config.serviceProvider.toUpperCase();
        
        vscode.window.showInformationMessage(
            `悬浮翻译插件已启动 - 使用 ${serviceName} 服务`,
            '查看设置',
            '知道了'
        ).then(selection => {
            if (selection === '查看设置') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'VScodeTranslator');
            }
        });
        
        // 标记已显示过通知
        pluginContext.globalContext?.globalState.update('hasShownStartupNotification', true);
    }
}

/**
 * 插件停用时的清理工作
 */
export function deactivate() {
    try {
        // 清理缓存到持久化存储
        flushCache(pluginState);
        
        console.log('🐾 VScodeTranslator: 插件已停用');
    } catch (error) {
        console.error('🐾 VScodeTranslator: 插件停用过程中发生错误', error);
    }
}

/**
 * 处理启用状态变更
 */
function handleEnableStatusChange(pluginContext: PluginContext): void {
    const globalConfig = getGlobalConfig();
    const isEnabled = globalConfig.enabled;
    
    console.log(`🐾 VScodeTranslator: 插件启用状态变更为 ${isEnabled ? '启用' : '禁用'}`);
    
    // 显示状态变更通知
    vscode.window.showInformationMessage(
        `悬浮翻译插件已${isEnabled ? '启用' : '禁用'}`,
        { modal: false }
    );
    
    // 强制刷新悬停提示以应用新的启用状态
    setTimeout(() => {
        vscode.commands.executeCommand('editor.action.showHover');
    }, 500);
}
