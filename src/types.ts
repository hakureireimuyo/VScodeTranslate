// src/types.ts
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
    url: string;
    apiKey: string;
    secretKey?: string;
    model?: string;
    timeout?: number;
}

/** 全局配置接口 */
export interface GlobalConfig {
    enabled: boolean;
    displayMode: string;
}

/** 插件全局状态 */
export interface PluginState {
    isInsideHover: boolean;
    showTranslated: boolean;
    translationCache: Map<string, CacheEntry>;
    translating: Set<string>;
    globalContext?: vscode.ExtensionContext;
}

import { DisplayMode } from './constants';
import { Semaphore } from './semaphore';

/** 模块化后的插件上下文 */
export interface PluginContext {
    state: PluginState;
    config: TranslationConfig;
    displayMode: DisplayMode;
    globalContext?: vscode.ExtensionContext;
    translationSemaphore?: Semaphore;
}

/**
 * 段落翻译结果接口
 */
export interface ParagraphTranslation {
    original: string;
    translated?: string;
    hash: string;
    isTranslating: boolean;
    error?: string;
}
