// src/config/index.ts
import * as vscode from 'vscode';
import { TranslationConfig } from '../types';
import { CONFIG_KEYS, DEFAULT_STARTUP_DELAY } from '../constants';

/**
 * 获取启动延迟配置
 */
export function getStartupDelay(): number {
    const config = vscode.workspace.getConfiguration('hoverTranslator');
    return config.get<number>(CONFIG_KEYS.STARTUP_DELAY, DEFAULT_STARTUP_DELAY);
}


/**
 * 配置管理器
 */

export class ConfigManager {
    private static instance: ConfigManager;
    private config: TranslationConfig;

    private constructor() {
        this.config = this.loadConfig();
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * 加载翻译配置
     */
    public loadConfig(): TranslationConfig {
        const config = vscode.workspace.getConfiguration('hoverTranslator');
        
        return {
            serviceProvider: config.get<string>('serviceProvider', 'openai'),
            baseURL: config.get<string>('baseURL', ''),
            apiKey: config.get<string>('apiKey', ''),
            secretKey: config.get<string>('secretKey', ''),
            model: config.get<string>('model', 'gpt-3.5-turbo'),
            timeout: config.get<number>('timeout', 30000),
        };
    }

    /**
     * 获取当前配置
     */
    public getConfig(): TranslationConfig {
        return { ...this.config };
    }

    /**
     * 验证配置完整性
     */
    public validateConfig(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        const config = this.config;

        if (!config.serviceProvider) {
            errors.push('未配置翻译服务提供商');
        }

        if (!config.apiKey) {
            errors.push('API密钥不能为空');
        }

        if (config.serviceProvider === 'openai' && !config.baseURL) {
            errors.push('OpenAI服务需要配置Base URL');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 更新配置
     */
    public updateConfig(updates: Partial<TranslationConfig>): void {
        this.config = { ...this.config, ...updates };
    }
}