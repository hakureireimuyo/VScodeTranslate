// src/translation/qianfan.ts
import { BaseTranslationService } from './basetranslationservice';
import { TranslationRequest, TranslationResponse, TranslationConfig } from '../types';

export class QianfanTranslationService extends BaseTranslationService {
    public readonly name = 'qianfan';
    
    // 百度千帆平台API端点
    private readonly DEFAULT_URL = 'https://qianfan.baidubce.com/v2/chat/completions';

    async translate(request: TranslationRequest): Promise<TranslationResponse> {
        try {
            const systemPrompt = this.buildSystemPrompt();
            const userMessage = this.buildUserMessage(request);
            
            const url = this.config.url || this.DEFAULT_URL;
            
            // 添加调试日志
            console.log('Qianfan API Request:', {
                url,
                model: this.config.model || 'deepseek-v3.1-250821',
                hasApiKey: !!this.config.apiKey
            });
            
            const response = await this.httpRequest(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    model: this.config.model || 'deepseek-v3.1-250821',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    stream: false,
                    temperature: 0.1,  // 翻译任务需要较低的随机性
                    top_p: 0.8,
                    max_tokens: 4000  // 千帆API使用max_tokens而非max_completion_tokens
                }
            });

            // 检查API错误 - 千帆API的错误格式可能不同
            if (response.error_code || response.code) {
                const errorCode = response.error_code || response.code;
                const errorMsg = response.error_msg || response.message;
                throw new Error(`千帆API错误: ${errorCode} - ${errorMsg}`);
            }

            // 千帆API响应格式适配
            const translatedText = response.choices?.[0]?.message?.content?.trim() || 
                                 response.result?.trim();
            
            if (!translatedText) {
                throw new Error('翻译结果为空');
            }

            return {
                translatedText,
                service: this.name
            };
        } catch (error) {
            console.error('Qianfan translation error:', error);
            if (error instanceof Error) {
                throw new Error(`千帆翻译失败: ${error.message}`);
            }
            throw new Error('千帆翻译失败: 未知错误');
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
                    model: this.config.model || 'deepseek-v3.1-250821',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    stream: true,
                    temperature: 0.1,
                    top_p: 0.8,
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error_msg || errorData.message || errorMsg;
                } catch (e) {
                    // 忽略JSON解析错误，使用默认错误信息
                }
                throw new Error(errorMsg);
            }

            yield* this.processStreamResponse(response);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`千帆流式翻译失败: ${error.message}`);
            }
            throw new Error('千帆流式翻译失败: 未知错误');
        }
    }

    validateConfig(config: TranslationConfig): boolean {
        // apiKey是必需的，千帆使用Bearer Token认证[1,3](@ref)
        return !!config.apiKey;
    }

    /**
     * 重写提取内容方法，适配千帆API的流式响应格式
     * 千帆API流式响应格式与OpenAI兼容[1,3](@ref)
     */
    protected extractContentFromStream(data: any): string {
        // 千帆API流式响应格式[1](@ref)
        return data.choices?.[0]?.delta?.content || 
               data.content || 
               '';
    }
}