import * as vscode from 'vscode';
import { TranslationConfig } from '../types';
import { CONFIG_KEYS, DEFAULT_STARTUP_DELAY } from '../constants';

/**
 * 获取翻译配置
 */
export function getTranslationConfig(): TranslationConfig {
    const config = vscode.workspace.getConfiguration('hoverTranslator');
    return {
        baseURL: config.get<string>(CONFIG_KEYS.BASE_URL, ''),
        apiKey: config.get<string>(CONFIG_KEYS.API_KEY, ''),
        model: config.get<string>(CONFIG_KEYS.MODEL, ''),
        promptTemplate: config.get<string>(CONFIG_KEYS.PROMPT_TEMPLATE, 
            '请将以下文本翻译为中文：\n${content}')
    };
}

/**
 * 获取启动延迟配置
 */
export function getStartupDelay(): number {
    const config = vscode.workspace.getConfiguration('hoverTranslator');
    return config.get<number>(CONFIG_KEYS.STARTUP_DELAY, DEFAULT_STARTUP_DELAY);
}