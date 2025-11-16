// src/translation/aliyun.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse,TranslationConfig } from '../types';

export class AliyunTranslationService extends BaseTranslationService {
    public readonly name = 'aliyun';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            // 使用OpenAI兼容接口
            const response = await this.httpRequest(
                `${this.config.baseURL}/v1/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'X-Secret-Key': this.config.secretKey || ''
                    },
                    body: {
                        model: this.config.model || 'qwen-turbo',
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
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`阿里云翻译失败: ${message}`);
        }
    }

    async *translateStream(request: TranslationRequest): AsyncIterable<string> {
        try {
            const response = await fetch(`${this.config.baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'X-Secret-Key': this.config.secretKey || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'qwen-turbo',
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
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`阿里云流式翻译失败: ${message}`);
        }
    }

    validateConfig(config: TranslationConfig): boolean {
        return !!(config.apiKey && config.baseURL);
    }

    
}