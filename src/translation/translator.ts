import { createHash } from 'crypto';
import { PluginContext } from '../types';

/**
 * 计算 MD5 哈希
 */
export function md5(str: string): string {
    return createHash('md5').update(str, 'utf-8').digest('hex');
}

/**
 * 翻译文本
 */
export async function translateText(text: string, context: PluginContext): Promise<string> {
    const { config } = context;
    const { baseURL, apiKey, model, promptTemplate } = config;

    // 基础配置检查
    if (!baseURL || !apiKey) {
        return '❌ **未配置翻译接口**\n请在 `hoverTranslator` 设置中填写 `baseURL` 与 `apiKey`。';
    }

    const prompt = promptTemplate.replace('{text}', text);

    try {
        const res = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: '你是一个编程语言专家，能准确识别声明语法结构并判断其复杂度' },
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!res.ok) {
            return `❌ **翻译请求失败（HTTP ${res.status}）**`;
        }

        const data: any = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        
        if (!content) {
            return '⚠️ **翻译服务未返回结果**，请检查模型或请求格式。';
        }
        
        return content;
    } catch (err) {
        return `❌ **翻译失败**：${String(err)}`;
    }
    
}

/**
 * 强制重新翻译
 */
export async function retranslateText(originalText: string, context: PluginContext): Promise<string> {
    const hash = md5(originalText);
    
    // 删除旧缓存
    context.state.translationCache.delete(hash);
    
    // 重新翻译
    const translated = await translateText(originalText, context);
    
    // 更新缓存
    context.state.translationCache.set(hash, { 
        original: originalText, 
        text: translated, 
        time: Date.now() 
    });
    
    return translated;
}