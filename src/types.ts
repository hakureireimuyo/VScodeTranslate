import * as vscode from 'vscode';

/** 缓存条目接口 */
export interface CacheEntry {
    original: string;
    text: string;
    time: number;
}

/** 翻译配置接口 */
export interface TranslationConfig {
    baseURL: string;
    apiKey: string;
    model: string;
    promptTemplate: string;
}

/** 插件全局状态 */
export interface PluginState {
    isInsideHover: boolean;
    showTranslated: boolean;
    translationCache: Map<string, CacheEntry>;
    translating: Set<string>;
    globalContext?: vscode.ExtensionContext;
}

/** 模块化后的插件上下文 */
export interface PluginContext {
    state: PluginState;
    config: TranslationConfig;
}