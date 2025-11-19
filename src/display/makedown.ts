import * as vscode from 'vscode';

export class MarkdownRenderer {
  private cssStyles: string = '';
  
  constructor(cssStyles?: string) {
    if (cssStyles) {
      this.cssStyles = cssStyles;
    }
  }
  
  /**
   * 将Markdown文本转换为HTML
   * @param markdown Markdown格式的文本
   * @returns HTML格式的文本
   */
  public render(markdown: string): string {
    let html = this.escapeHtml(markdown);
    
    // 处理代码块
    html = this.processCodeBlocks(html);
    
    // 处理行内代码
    html = this.processInlineCode(html);
    
    // 处理粗体
    html = this.processBold(html);
    
    // 处理斜体
    html = this.processItalic(html);
    
    // 处理删除线
    html = this.processStrikethrough(html);
    
    // 处理链接
    html = this.processLinks(html);
    
    // 处理图片
    html = this.processImages(html);
    
    // 处理标题
    html = this.processHeaders(html);
    
    // 处理无序列表
    html = this.processUnorderedLists(html);
    
    // 处理有序列表
    html = this.processOrderedLists(html);
    
    // 处理引用块
    html = this.processBlockquotes(html);
    
    // 处理水平线
    html = this.processHorizontalRules(html);
    
    // 处理段落
    html = this.processParagraphs(html);
    
    // 添加换行支持
    html = html.replace(/\n/g, '<br>');
    
    return this.wrapInHtmlDocument(html);
  }
  
  /**
   * 更新CSS样式
   * @param cssStyles 新的CSS样式
   */
  public updateStyles(cssStyles: string): void {
    this.cssStyles = cssStyles;
  }
  
  /**
   * 包装成完整的HTML文档
   * @param bodyContent HTML主体内容
   * @returns 完整的HTML文档
   */
  private wrapInHtmlDocument(bodyContent: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20px;
        }
        ${this.cssStyles}
    </style>
</head>
<body>
    ${bodyContent}
</body>
</html>`;
  }
  
  /**
   * 转义HTML特殊字符
   * @param text 原始文本
   * @returns 转义后的文本
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  /**
   * 处理代码块
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processCodeBlocks(text: string): string {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    return text.replace(codeBlockRegex, (match, language, code) => {
      const lang = language || 'plaintext';
      return `<pre><code class="language-${lang}">${this.escapeHtml(code.trim())}</code></pre>`;
    });
  }
  
  /**
   * 处理行内代码
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processInlineCode(text: string): string {
    const inlineCodeRegex = /`([^`]+)`/g;
    return text.replace(inlineCodeRegex, '<code>$1</code>');
  }
  
  /**
   * 处理粗体文本
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processBold(text: string): string {
    // 处理 **bold** 格式
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // 处理 __bold__ 格式
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    return text;
  }
  
  /**
   * 处理斜体文本
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processItalic(text: string): string {
    // 处理 *italic* 格式
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // 处理 _italic_ 格式
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    return text;
  }
  
  /**
   * 处理删除线文本
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processStrikethrough(text: string): string {
    return text.replace(/~~(.*?)~~/g, '<del>$1</del>');
  }
  
  /**
   * 处理链接
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processLinks(text: string): string {
    // 处理 [text](url) 格式
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }
  
  /**
   * 处理图片
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processImages(text: string): string {
    // 处理 ![alt](url) 格式
    return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  }
  
  /**
   * 处理标题
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processHeaders(text: string): string {
    // 处理 # Header 格式 (h1 to h6)
    text = text.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
    text = text.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
    text = text.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    return text;
  }
  
  /**
   * 处理无序列表
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processUnorderedLists(text: string): string {
    const lines = text.split('\n');
    let inList = false;
    let result = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^[\*\-\+] /.test(line)) {
        if (!inList) {
          result += '<ul>\n';
          inList = true;
        }
        result += `<li>${line.substring(2)}</li>\n`;
      } else {
        if (inList) {
          result += '</ul>\n';
          inList = false;
        }
        result += line + '\n';
      }
    }
    
    if (inList) {
      result += '</ul>\n';
    }
    
    return result;
  }
  
  /**
   * 处理有序列表
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processOrderedLists(text: string): string {
    const lines = text.split('\n');
    let inList = false;
    let result = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d+\. /.test(line)) {
        if (!inList) {
          result += '<ol>\n';
          inList = true;
        }
        result += `<li>${line.replace(/^\d+\.\s*/, '')}</li>\n`;
      } else {
        if (inList) {
          result += '</ol>\n';
          inList = false;
        }
        result += line + '\n';
      }
    }
    
    if (inList) {
      result += '</ol>\n';
    }
    
    return result;
  }
  
  /**
   * 处理引用块
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processBlockquotes(text: string): string {
    const lines = text.split('\n');
    let inQuote = false;
    let result = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^>/.test(line)) {
        if (!inQuote) {
          result += '<blockquote>\n';
          inQuote = true;
        }
        result += `${line.substring(1)}\n`;
      } else {
        if (inQuote) {
          result += '</blockquote>\n';
          inQuote = false;
        }
        result += line + '\n';
      }
    }
    
    if (inQuote) {
      result += '</blockquote>\n';
    }
    
    return result;
  }
  
  /**
   * 处理水平线
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processHorizontalRules(text: string): string {
    return text.replace(/^-{3,}$|^_{3,}$|^\*{3,}$/gm, '<hr>');
  }
  
  /**
   * 处理段落
   * @param text 文本内容
   * @returns 处理后的文本
   */
  private processParagraphs(text: string): string {
    const lines = text.split('\n\n');
    return lines.map(line => {
      // 如果行不是HTML标签开头，则包装在<p>标签中
      if (!/^<\/?[\w\s="/.':;#-\/\?]+>/i.test(line.trim())) {
        return `<p>${line}</p>`;
      }
      return line;
    }).join('\n\n');
  }
}