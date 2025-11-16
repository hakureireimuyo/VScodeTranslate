// src/translation/openai.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse,TranslationConfig } from '../types';

export class OpenAITranslationService extends BaseTranslationService {
    public readonly name = 'openai';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            const response = await this.httpRequest(
                `${this.config.baseURL}/v1/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`
                    },
                    body: {
                        model: this.config.model || 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: this.buildSystemPrompt() },
                            { role: 'user', content: this.buildUserMessage(request) }
                        ],
                        temperature: 0.1,
                        max_tokens: 2000
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
        } // 修复第39行代码示例（translate 方法中的 catch 块）：
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`OpenAI翻译失败: ${message}`);
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
                    model: this.config.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: this.buildSystemPrompt() },
                        { role: 'user', content: this.buildUserMessage(request) }
                    ],
                    temperature: 0.1,
                    max_tokens: 2000,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            yield* this.processStreamResponse(response);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`OpenAI流式翻译失败: ${message}`);
        }
    }

    validateConfig(config: TranslationConfig): boolean {
        return !!(config.apiKey && config.baseURL);
    }
}