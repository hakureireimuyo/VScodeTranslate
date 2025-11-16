// src/translation/baidu.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse,TranslationConfig } from '../types';

export class BaiduTranslationService extends BaseTranslationService {
    public readonly name = 'baidu';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            // 使用OpenAI兼容接口
            const response = await this.httpRequest(
                `${this.config.baseURL}/v1/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`
                    },
                    body: {
                        model: this.config.model || 'ernie-3.5-8k',
                        messages: [
                            { role: 'system', content: this.buildSystemPrompt() },
                            { role: 'user', content: this.buildUserMessage(request) }
                        ],
                        temperature: 0.1
                    }
                }
            );

            const translatedText = response.choices[0]?.message?.content?.trim();
            if (!translatedText) {
                throw new Error('翻译结果为空');
            }

            return {
                translatedText,
                service: this.name
            };
        } catch (error) {
        if (error instanceof Error) {
            throw new Error(`百度翻译失败: ${error.message}`);
        }
        throw new Error('百度翻译失败: 未知错误');
    }
    }

    async *translateStream(request: TranslationRequest): AsyncIterable<string> {
        try {
            const response = await fetch(`${this.config.baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'ernie-3.5-8k',
                    messages: [
                        { role: 'system', content: this.buildSystemPrompt() },
                        { role: 'user', content: this.buildUserMessage(request) }
                    ],
                    temperature: 0.1,
                    stream: true
                })
            });

            yield* this.processStreamResponse(response);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`百度流式翻译失败: ${error.message}`);
            }
            throw new Error('百度流式翻译失败: 未知错误');
        }
    }

    validateConfig(config: TranslationConfig): boolean {
        return !!(config.apiKey && config.baseURL);
    }
}