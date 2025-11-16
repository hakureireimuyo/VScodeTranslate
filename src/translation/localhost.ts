// src/translation/localhost.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse, TranslationConfig } from '../types';

export class LocalhostTranslationService extends BaseTranslationService {
    public readonly name = 'localhost';
    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            // 优先使用用户配置的完整URL没用默认URL
            const url = this.config.url;
            
            if (!url) {
                throw new Error('请配置本地服务地址');
            }

            const response = await this.httpRequest(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    model: this.config.model || 'local-model',
                    messages: [
                        { role: 'system', content: this.buildSystemPrompt() },
                        { role: 'user', content: this.buildUserMessage(request) }
                    ],
                    temperature: 0.1,
                    max_tokens: 2000
                }
            });

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
            throw new Error(`本地服务翻译失败: ${message}`);
        }
    }

    async *translateStream(request: TranslationRequest): AsyncIterable<string> {
        try {
            const url = this.config.url;

            if (!url) {
                throw new Error('请配置本地服务地址');
            }
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'local-model',
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
            throw new Error(`本地服务流式翻译失败: ${message}`);
        }
    }

    validateConfig(config: TranslationConfig): boolean {
        // apiKey可选，本地服务可能不需要认证
        return true;
    }
}