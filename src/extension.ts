import * as vscode from 'vscode';
import { PluginState, PluginContext } from './types';
import { initializeCache, flushCache } from './cache';
import { getTranslationConfig, getStartupDelay } from './config';
import { createHoverProvider } from './hover/provider';
import { registerAllCommands } from './commands/index';

/**
 * 插件全局状态
 */
const pluginState: PluginState = {
    isInsideHover: false,
    showTranslated: true,
    translationCache: new Map(),
    translating: new Set()
};

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
    // 初始化配置和缓存
    initializeCache(context, pluginState);
    const config = getTranslationConfig();
    
    const pluginContext: PluginContext = {
        state: pluginState,
        config
    };

    const startupDelay = getStartupDelay();
    console.log(`🐾 hoverTranslator: 插件将在 ${startupDelay} ms 后启动 HoverProvider`);

    setTimeout(() => {
        // 注册悬浮提供者
        const hoverProvider = vscode.languages.registerHoverProvider(
            { scheme: 'file' }, 
            createHoverProvider(pluginContext)
        );

        // 注册所有命令
        const commands = registerAllCommands(pluginContext);

        // 将所有订阅添加到上下文
        context.subscriptions.push(hoverProvider, ...commands);
        console.log('🐾 hoverTranslator: 插件已启动');
    }, startupDelay);
}

/**
 * 插件停用
 */
export function deactivate() {
    flushCache(pluginState);
}