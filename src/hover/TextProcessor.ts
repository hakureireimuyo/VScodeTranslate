// src/hover/TextProcessor.ts
import { ParagraphTranslation } from '../types';
import { md5 } from '../signature';
import { PluginState } from '../types';
import { getCachedTranslation } from '../cache';

/**
 * 简易智能分块算法
 * 目标：接近200字符时在换行处分割，代码块保持完整
 */
export function smartChunking(text: string, targetSize: number = 200): string[] {
    if (!text || !text.trim()) {
        return [text];
    }
    
    const chunks: string[] = [];
    let currentChunk = '';
    let inCodeBlock = false;
    
    // 按行处理
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // 1. 代码块开始/结束检测
        if (trimmedLine.startsWith('```')) {
            if (!inCodeBlock) {
                // 开始代码块：如果当前块已达标，先分割
                if (currentChunk.length >= targetSize) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
                inCodeBlock = true;
                currentChunk += (currentChunk ? '\n' : '') + line;
            } else {
                // 结束代码块
                inCodeBlock = false;
                currentChunk += '\n' + line;
                // 代码块结束立即分割
                chunks.push(currentChunk);
                currentChunk = '';
            }
            continue;
        }
        
        // 2. 添加当前行
        const newChunk = currentChunk ? currentChunk + '\n' + line : line;
        
        // 3. 分割条件判断
        if (currentChunk.length >= targetSize) {
            // 已达标：在代码块或空行处分割
            if (inCodeBlock) {
                // 代码块内：继续累积，保持代码块完整
                currentChunk = newChunk;
            } else if (trimmedLine === '') {
                // 空行：在此处分割
                chunks.push(currentChunk);
                currentChunk = line;
            } else {
                // 普通行：继续累积
                currentChunk = newChunk;
            }
        } else {
            // 未达标：继续累积
            currentChunk = newChunk;
        }
    }
    
    // 处理最后剩余的内容
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
}
/**
 * 分割超长单行文本
 */
function splitOversizedLine(line: string, maxLength: number): string[] {
    if (line.length <= maxLength) {
        return [line];
    }
    
    const chunks: string[] = [];
    let startPos = 0;
    
    while (startPos < line.length) {
        let endPos = Math.min(startPos + maxLength, line.length);
        
        // 如果不在行尾，寻找合适的分割点
        if (endPos < line.length) {
            // 优先在句子边界处分割
            const sentenceBoundaries = ['.', '。', '!', '！', '?', '？', ';', '；'];
            let boundaryFound = false;
            
            // 向后寻找分割点
            for (let i = endPos; i > startPos + maxLength * 0.7; i--) {
                if (sentenceBoundaries.includes(line[i]) || line[i] === ' ') {
                    endPos = i + 1;
                    boundaryFound = true;
                    break;
                }
            }
            
            // 如果没找到合适边界，向前寻找
            if (!boundaryFound) {
                for (let i = endPos; i < Math.min(startPos + maxLength * 1.2, line.length); i++) {
                    if (line[i] === ' ') {
                        endPos = i;
                        break;
                    }
                }
            }
        }
        
        const chunk = line.substring(startPos, endPos).trim();
        if (chunk) {
            chunks.push(chunk);
        }
        
        startPos = endPos;
    }
    
    return chunks;
}


/**
 * 智能分割文本为自然段 - 简化版本
 */
export function splitIntoParagraphs(text: string): string[] {
    console.log(`🐾 splitIntoParagraphs: 开始分割文本，长度: ${text.length}`);
    
    if (!text.trim()) {
        console.log('🐾 splitIntoParagraphs: 文本为空，返回原文本');
        return [text];
    }
    
    // 使用简易智能分块算法
    const chunks = smartChunking(text, 200);
    
    console.log(`🐾 splitIntoParagraphs: 分割为 ${chunks.length} 个段落`);
    
    // 打印分块统计信息
    chunks.forEach((chunk, index) => {
        console.log(`🐾 段落 ${index + 1}: ${chunk.length} 字符`);
        if (chunk.includes('```')) {
            console.log(`🐾 段落 ${index + 1} 包含代码块`);
        }
    });
    
    return chunks;
}

/**
 * 为段落生成翻译状态
 */
export function generateParagraphTranslations(paragraphs: string[], context: PluginState): ParagraphTranslation[] {
    const paragraphTranslations: ParagraphTranslation[] = [];
    
    // 为每个段落生成唯一标识和翻译状态
    for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
            paragraphTranslations.push({
                original: paragraph,
                hash: md5(paragraph),
                isTranslating: false
            });
            continue;
        }
        
        const hash = md5(paragraph);
        const cachedTranslation = getCachedTranslation(hash, context);
        const isTranslating = context.translating.has(hash);
        
        paragraphTranslations.push({
            original: paragraph,
            translated: cachedTranslation || undefined,
            hash: hash,
            isTranslating: isTranslating
        });
        
        console.log(`🐾 HoverProvider: 段落处理 - Hash: ${hash.substring(0, 8)}..., ` +
                   `HasCache: ${!!cachedTranslation}, IsTranslating: ${isTranslating}`);
    }
    
    return paragraphTranslations;
}