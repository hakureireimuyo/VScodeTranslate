// src/translation/aliyun.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse, TranslationConfig } from '../types';

export class AliyunTranslationService extends BaseTranslationService {
    public readonly name = 'aliyun';
    
    // 内置固定请求URL
    private readonly DEFAULT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            // 优先使用用户配置的完整URL，否则使用默认URL
            const url = this.config.url || this.DEFAULT_URL;
            
            // 使用OpenAI兼容接口
            const response = await this.httpRequest(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    model: this.config.model || 'qwen-turbo',
                    messages: [
                        { role: 'system', content: this.buildSystemPrompt() },
                        { role: 'user', content: this.buildUserMessage(request) }
                    ],
                    temperature: 0.1
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
            throw new Error(`阿里云翻译失败: ${message}`);
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
        // apikey是必需的，url可选（有默认值）
        return !!config.apiKey;
    }
}