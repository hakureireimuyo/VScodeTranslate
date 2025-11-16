// src/translation/baidu.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse, TranslationConfig } from '../types';

export class BaiduTranslationService extends BaseTranslationService {
    public readonly name = 'baidu';
    
    // 百度百舸平台API端点
    private readonly DEFAULT_URL = 'https://aistudio.baidu.com/llm/lmapi/v3/chat/completions';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            const systemPrompt = this.buildSystemPrompt();
            const userMessage = this.buildUserMessage(request);
            
            const url = this.config.url || this.DEFAULT_URL;
            
            // 添加调试日志
            console.log('Baidu API Request:', {
                url,
                model: this.config.model || 'qwen3-32b',
                hasApiKey: !!this.config.apiKey
            });
            
            const response = await this.httpRequest(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    model: this.config.model || 'qwen3-32b',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    stream: false,
                    temperature: 0.7,
                    top_p: 0.8,
                    max_completion_tokens: 8192,
                    extra_body: {
                        penalty_score: 1,
                        enable_thinking: true
                    }
                }
            });

            // 检查API错误
            if (response.error_code) {
                throw new Error(`百度模型API错误: ${response.error_code} - ${response.error_msg}`);
            }

            const translatedText = response.choices[0]?.message?.content?.trim();
            if (!translatedText) {
                throw new Error('翻译结果为空');
            }

            return {
                translatedText,
                service: this.name
            };
        } catch (error) {
            // 更详细地记录错误信息
            console.error('Baidu translation error:', error);
            if (error instanceof Error) {
                throw new Error(`百度翻译失败: ${error.message}`);
            }
            throw new Error('百度翻译失败: 未知错误');
        }
    }

    async *translateStream(request: TranslationRequest): AsyncIterable<string> {
        try {
            const url = this.config.url || this.DEFAULT_URL;
            
            // 使用基类构建的固定中文翻译提示词
            const systemPrompt = this.buildSystemPrompt();
            const userMessage = this.buildUserMessage(request);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'qwen3-32b',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    stream: true,
                    temperature: 0.7,
                    top_p: 0.8,
                    max_completion_tokens: 8192,
                    extra_body: {
                        penalty_score: 1,
                        enable_thinking: true
                    }
                })
            });

            if (!response.ok) {
                const errorData: any = await response.json().catch(() => ({}));
                const errorMsg = errorData?.error_msg || response.statusText;
                throw new Error(`HTTP ${response.status}: ${errorMsg}`);
            }

            // 使用基类的流式响应处理方法
            yield* this.processStreamResponse(response);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`百度流式翻译失败: ${error.message}`);
            }
            throw new Error('百度流式翻译失败: 未知错误');
        }
    }

    validateConfig(config: TranslationConfig): boolean {
        // apiKey是必需的
        return !!config.apiKey;
    }

    /**
     * 重写提取内容方法，适配百度API的响应格式
     */
    protected extractContentFromStream(data: any): string {
        // 百度API的流式响应格式
        return data.choices?.[0]?.delta?.content || '';
    }
}