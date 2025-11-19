import { TranslationService, TranslationRequest, TranslationResponse, TranslationConfig } from '../types';
import * as vscode from 'vscode';

export abstract class BaseTranslationService implements TranslationService {
    public abstract readonly name: string;
    
    protected config: TranslationConfig;
    protected context: vscode.ExtensionContext;

    constructor(config: TranslationConfig, context: vscode.ExtensionContext) {
        this.config = config;
        this.context = context;
    }

    abstract translate(request: TranslationRequest): Promise<TranslationResponse>;
    abstract translateStream(request: TranslationRequest): AsyncIterable<string>;
    abstract validateConfig(config: TranslationConfig): boolean;
    /**
     * 内置统一提示词 - 固定翻译为中文
     */
    protected buildSystemPrompt(): string {
        return `你是一名专业的代码文档翻译专家，请将用户提供的文本准确、流畅地翻译成中文。翻译要求：
1. 保持专业术语的准确性
2. 符合中文表达习惯
3. 保持原文的语气和风格以及格式,标点符号不用进行转换
4. 如果原文是代码或技术术语，则保持原文
5. 代码块内的内容保持不变

只需返回翻译结果，不要添加任何解释或额外内容。`;
    }

    /**
     * 构建用户消息
     */
    protected buildUserMessage(request: TranslationRequest): string {
        return `请翻译以下内容：\n\n"${request.originalText}"`;
    }

    /**
     * 通用HTTP请求方法
     */
    protected async httpRequest(
        url: string, 
        options: {
            method?: string;
            headers?: Record<string, string>;
            body?: any;
            timeout?: number;
        }
    ): Promise<any> {
        const controller = new AbortController();
        const timeout = this.config.timeout || 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method: options.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: controller.signal
            });

            if (!response.ok) {
                // 尝试解析错误响应体以获取详细错误信息
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (typeof errorData === 'object' && errorData !== null) {
                        if ('error_msg' in errorData && typeof errorData.error_msg === 'string') {
                            errorMessage = `HTTP ${response.status}: ${errorData.error_msg}`;
                        } else if ('message' in errorData && typeof errorData.message === 'string') {
                            errorMessage = `HTTP ${response.status}: ${errorData.message}`;
                        }
                    }
                } catch (e) {
                    // 如果无法解析JSON，则使用默认错误消息
                    const errorText = await response.text().catch(() => '');
                    if (errorText) {
                        errorMessage = `HTTP ${response.status}: ${errorText}`;
                    }
                }
                throw new Error(errorMessage);
            }

            return await response.json();
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
     * 处理流式响应
     */
    protected async *processStreamResponse(response: Response): AsyncIterable<string> {
        if (!response.body) {
            throw new Error('响应体为空');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) { break; };

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const text = line.slice(6);
                        if (text === '[DONE]') {break;};
                        
                        try {
                            const data = JSON.parse(text);
                            const content = this.extractContentFromStream(data);
                            if (content) {
                                yield content;
                            }
                        } catch (e) {
                            // 忽略JSON解析错误，继续处理下一行
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * 从流式数据中提取内容（子类可重写）
     */
    protected extractContentFromStream(data: any): string {
        // 默认实现，子类可根据具体API响应格式重写
        return data.choices?.[0]?.delta?.content || 
               data.content || 
               data.message?.content || 
               '';
    }
}