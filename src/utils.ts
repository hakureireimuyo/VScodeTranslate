// src/utils.ts
import { TextSegment } from './types';

export class TextSegmenter {
    public segmentText(text: string): TextSegment[] {
      const segments: TextSegment[] = [];
      const lines = text.split('\n');
      let currentSegment: string[] = [];
      let currentType: 'code' | 'text' = 'text';
      let inCodeBlock = false;
      let codeLanguage = '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 检查是否进入或退出代码块
        if (trimmedLine.startsWith('```')) {
          // 如果当前有未保存的段落，先保存
          if (currentSegment.length > 0) {
            const segment = this.createSegment(currentSegment, currentType, codeLanguage);
            if (segment.content.trim()) { // 避免空内容段落
              segments.push(segment);
            }
            currentSegment = [];
          }
          
          inCodeBlock = !inCodeBlock;
          currentType = 'code';
          
          // 提取代码语言标记
          if (inCodeBlock) {
            codeLanguage = trimmedLine.substring(3).trim(); // 提取 ``` 后面的语言标识
          } else {
            codeLanguage = '';
            currentType = 'text';
          }
          
          // 如果这是代码块的结束标记，保存整个代码块段落
          if (!inCodeBlock) {
            // 移除代码块标记行，只保留实际代码内容
            if (currentSegment.length > 2) { // 至少有开始标记、内容、结束标记
              // 关键修改：去除开始和结束标记行
              const codeContent = currentSegment.slice(1, -1); // 去除开始和结束标记行
              const segment = this.createSegment(codeContent, 'code', codeLanguage);
              if (segment.content.trim()) { // 避免空内容段落
                segments.push(segment);
              }
            }
            currentSegment = [];
            currentType = 'text';
          }
          continue;
        }
        
        // 处理代码块内的行
        if (inCodeBlock) {
          currentSegment.push(line);
          continue;
        }
        
        // 处理普通文本行
        // 检查当前行是否以结束符号结尾且后跟换行符（即自然段落边界）
        const isEndOfParagraph = currentSegment.length > 0 && 
                                /[.!?。！？;；…]$/.test(currentSegment[currentSegment.length - 1].trim());
        
        // 如果当前段落为空，直接添加当前行
        if (currentSegment.length === 0) {
          currentSegment.push(line);
          continue;
        }
        
        // 检查当前段落长度是否已达到200字符
        const currentLength = currentSegment.join('\n').length;
        
        // 如果达到200字符且当前是自然段落边界（以结束符号结尾后换行），则分割段落
        if (currentLength >= 200 && isEndOfParagraph) {
          const segment = this.createSegment(currentSegment, currentType, codeLanguage);
          if (segment.content.trim()) {
            segments.push(segment);
          }
          currentSegment = [line];
        } else {
          // 未达到200字符或不是自然段落边界，继续累积
          currentSegment.push(line);
        }
      }
      
      // 保存最后一段
      if (currentSegment.length > 0) {
        // 特别处理最后一段是代码块的情况
        if (inCodeBlock && currentSegment.length > 1) {
          // 如果仍在代码块中，移除开始标记行
          const codeContent = currentSegment.slice(1); // 去除开始标记行
          const segment = this.createSegment(codeContent, 'code', codeLanguage);
          if (segment.content.trim()) { // 避免空内容段落
            segments.push(segment);
          }
        } else {
          const segment = this.createSegment(currentSegment, currentType, codeLanguage);
          if (segment.content.trim()) { // 避免空内容段落
            segments.push(segment);
          }
        }
      }
      
      return segments;
    }
  
  private createSegment(lines: string[], type: 'code' | 'text', language: string = ''): TextSegment {
    // 对于代码段，确保去除任何剩余的代码块标记
    let processedLines = lines;
    if (type === 'code') {
      // 过滤掉可能残留的代码块标记行
      processedLines = lines.filter(line => !line.trim().startsWith('```'));
    }
    
    return {
      type,
      content: processedLines.join('\n'),
      language: language || (type === 'code' ? 'unknown' : '')
    };
  }
}