/// src/types.ts
import * as vscode from 'vscode';

/** 缓存条目接口 */
export interface CacheEntry {
    original: string;
    text: string;
    time: number;
}

/** 简化翻译请求接口 - 只保留原文 */
export interface TranslationRequest {
    originalText: string;
}

/** 简化翻译响应接口 */
export interface TranslationResponse {
    translatedText: string;
    service: string;
}

/** 简化翻译服务接口 */
export interface ITranslationService {
    readonly name: string;
    
    // 非流式翻译
    translate(request: TranslationRequest): Promise<TranslationResponse>;
    
    // 流式翻译
    translateStream(request: TranslationRequest): AsyncIterable<string>;
    
    validateConfig(config: TranslationConfig): boolean;
}

/** 简化翻译配置 - 移除提示词模板等复杂配置 */
export interface TranslationConfig {
    serviceProvider: string;
    baseURL: string;
    apiKey: string;
    secretKey?: string;
    model?: string;
    timeout?: number;
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
    globalContext?: vscode.ExtensionContext;
}

