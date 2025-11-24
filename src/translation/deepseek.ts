import { TranslationService, TranslationRequest, TranslationResponse, TranslationConfig } from '../types';
import { BaseTranslationService } from './basetranslationservice';
import * as vscode from 'vscode';

export class DeepSeekTranslationService extends BaseTranslationService {
    public readonly name: string = 'DeepSeek';
    
    private readonly baseUrl: string = 'https://api.deepseek.com';
    private readonly chatModel: string = 'deepseek-chat';

    constructor(config: TranslationConfig, context: vscode.ExtensionContext) {
        super(config, context);
    }

    /**
     * 实现非流式翻译
     */
    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            const apiKey = this.config.apiKey;
            if (!apiKey) {
                throw new Error('DeepSeek API Key 未配置');
            }

            const response = await this.httpRequest(
                `${this.baseUrl}/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: {
                        model: this.chatModel,
                        messages: [
                            {
                                role: 'system',
                                content: this.buildSystemPrompt()
                            },
                            {
                                role: 'user',
                                content: this.buildUserMessage(request)
                            }
                        ],
                        stream: false,
                        temperature: 0.3, // 较低的temperature保证翻译的准确性
                        max_tokens: 4000 // 根据实际需要调整
                    },
                    timeout: this.config.timeout || 30000
                }
            );

            // 提取翻译结果
            const translatedText = response.choices?.[0]?.message?.content;
            if (!translatedText) {
                throw new Error('API响应格式异常，无法获取翻译结果');
            }

            return {
                translatedText: translatedText.trim(),
                service: this.name,
            };

        } catch (error) {
            return {
                translatedText: '',
                service: this.name,
            };
        }
    }

    /**
     * 实现流式翻译
     */
    async *translateStream(request: TranslationRequest): AsyncIterable<string> {
        const apiKey = this.config.apiKey;
        if (!apiKey) {
            throw new Error('DeepSeek API Key 未配置');
        }

        const controller = new AbortController();
        const timeout = this.config.timeout || 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: this.chatModel,
                    messages: [
                        {
                            role: 'system',
                            content: this.buildSystemPrompt()
                        },
                        {
                            role: 'user',
                            content: this.buildUserMessage(request)
                        }
                    ],
                    stream: true,
                    temperature: 0.3,
                    max_tokens: 4000
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }

            // 使用父类的流式处理逻辑
            yield* this.processStreamResponse(response);

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`请求超时 (${timeout}ms)`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * 验证配置
     */
    validateConfig(config: TranslationConfig): boolean {
        return !!(config.apiKey && config.apiKey.trim().length > 0);
    }

    /**
     * 重写流式内容提取方法，适配DeepSeek API格式
     */
    protected extractContentFromStream(data: any): string {
        // DeepSeek API流式响应格式与OpenAI兼容
        return data.choices?.[0]?.delta?.content || '';
    }
}