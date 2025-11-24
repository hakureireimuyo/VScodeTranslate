// src/translation/kimi.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse, TranslationConfig } from '../types';

export class KimiTranslationService extends BaseTranslationService {
    public readonly name = 'kimi';
    
    // Kimi API端点
    private readonly DEFAULT_URL = 'https://api.moonshot.cn/v1/chat/completions';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            const systemPrompt = this.buildSystemPrompt();
            const userMessage = this.buildUserMessage(request);
            
            const url = this.config.url || this.DEFAULT_URL;
            
            console.log('Kimi API Request:', {
                url,
                model: this.config.model || 'kimi-k2-turbo-preview',
                hasApiKey: !!this.config.apiKey
            });
            
            const response = await this.httpRequest(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    model: this.config.model || 'kimi-k2-turbo-preview',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    stream: false,
                    temperature: 0.3,  // Kimi推荐较低的temperature用于翻译任务
                    max_tokens: 8192
                }
            });

            // 检查API错误
            if (response.error) {
                throw new Error(`Kimi API错误: ${response.error.message || response.error.code}`);
            }

            const translatedText = response.choices?.[0]?.message?.content?.trim();
            if (!translatedText) {
                throw new Error('翻译结果为空');
            }

            return {
                translatedText,
                service: this.name
            };
        } catch (error) {
            console.error('Kimi translation error:', error);
            if (error instanceof Error) {
                throw new Error(`Kimi翻译失败: ${error.message}`);
            }
            throw new Error('Kimi翻译失败: 未知错误');
        }
    }

    async *translateStream(request: TranslationRequest): AsyncIterable<string> {
        try {
            const url = this.config.url || this.DEFAULT_URL;
            
            const systemPrompt = this.buildSystemPrompt();
            const userMessage = this.buildUserMessage(request);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'kimi-k2-turbo-preview',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    stream: true,
                    temperature: 0.3,
                    max_tokens: 8192
                })
            });

            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error?.message || errorMsg;
                } catch (e) {
                    // 忽略JSON解析错误
                }
                throw new Error(errorMsg);
            }

            yield* this.processStreamResponse(response);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Kimi流式翻译失败: ${error.message}`);
            }
            throw new Error('Kimi流式翻译失败: 未知错误');
        }
    }

    validateConfig(config: TranslationConfig): boolean {
        // apiKey是必需的
        return !!config.apiKey;
    }

    /**
     * 重写提取内容方法，适配Kimi API的流式响应格式
     * Kimi API流式响应格式与OpenAI兼容
     */
    protected extractContentFromStream(data: any): string {
        return data.choices?.[0]?.delta?.content || '';
    }

}