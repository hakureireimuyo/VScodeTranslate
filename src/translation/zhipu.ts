// src/translation/zhipu.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse, TranslationConfig } from '../types';

export class ZhipuTranslationService extends BaseTranslationService {
    public readonly name = 'zhipu';
    
    // 内置完整URL路径
    private readonly DEFAULT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            // 优先使用用户配置的完整URL，否则使用默认URL
            const url = this.config.url || this.DEFAULT_URL;
            
            const response = await this.httpRequest(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    model: this.config.model || 'glm-4.5-flash',
                    messages: [
                        { role: 'system', content: this.buildSystemPrompt() },
                        { role: 'user', content: this.buildUserMessage(request) }
                    ],
                    temperature: 0.1,
                    max_tokens: 4096
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
            throw new Error(`智谱AI翻译失败: ${message}`);
        }
    }

    async *translateStream(request: TranslationRequest): AsyncIterable<string> {
        try {
            // 优先使用用户配置的完整URL，否则使用默认URL
            const url = this.config.url || this.DEFAULT_URL;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'glm-4.5-flash',
                    messages: [
                        { role: 'system', content: this.buildSystemPrompt() },
                        { role: 'user', content: this.buildUserMessage(request) }
                    ],
                    temperature: 0.1,
                    max_tokens: 4096,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            yield* this.processStreamResponse(response);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`智谱AI流式翻译失败: ${message}`);
        }
    }

    validateConfig(config: TranslationConfig): boolean {
        // apiKey是必需的，url可选（有默认值）
        return !!config.apiKey;
    }
}