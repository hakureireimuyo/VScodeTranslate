// src/display/webview.ts
import * as vscode from 'vscode';
import { TranslationData } from '../types';
import { MarkdownRenderer } from './makedown';

export class WebviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private markdownRenderer: MarkdownRenderer;
  private currentTranslationData: TranslationData[] = [];
  
  constructor() {
    this.markdownRenderer = new MarkdownRenderer();
  }
  
  public createOrUpdatePanel(initialData: TranslationData[] = []): void {
    this.currentTranslationData = initialData;
    
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'translationView',
        '文档翻译',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: []
        }
      );
      
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
      
      // 处理来自webview的消息
      this.panel.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'refresh':
              this.updatePanelContent();
              return;
          }
        },
        undefined,
        []
      );
    }
    
    this.updatePanelContent();
  }
  
  /**
   * 动态更新翻译结果
   * @param newData 新的翻译数据
   */
  public updateTranslationResults(newData: TranslationData[]): void {
    // 合并新数据
    newData.forEach(newItem => {
      const index = this.currentTranslationData.findIndex(
        item => item.hash === newItem.hash
      );
      if (index >= 0) {
        // 如果找到相同hash的项，则更新该项
        this.currentTranslationData[index] = { ...this.currentTranslationData[index], ...newItem };
      } else {
        // 如果没有找到，则添加新项
        this.currentTranslationData.push(newItem);
      }
    });
    
    this.updatePanelContent();
  }
  
  /**
   * 更新单个翻译项
   * @param translation 更新的翻译数据
   */
  public updateSingleTranslation(translation: TranslationData): void {
    const index = this.currentTranslationData.findIndex(
      item => item.hash === translation.hash
    );
    
    if (index >= 0) {
      // 更新现有项
      this.currentTranslationData[index] = { ...this.currentTranslationData[index], ...translation };
    } else {
      // 添加新项
      this.currentTranslationData.push(translation);
    }
    
    this.updatePanelContent();
  }
  
  public updatePanelContent(): void {
    if (!this.panel) { return; }
    
    const config = vscode.workspace.getConfiguration('VScodeTranslator');
    const displayMode = config.get<string>('displayMode', 'sidebyside');
    
    const html = this.generateHtml(displayMode);
    this.panel.webview.html = html;
  }
  
  private generateHtml(displayMode: string): string {
    const style = this.getCssStyle();
    
    let contentHtml = '';
    if (displayMode === 'sidebyside') {
      contentHtml = this.generateSideBySideHtml();
    } else {
      contentHtml = this.generateTranslatedOnlyHtml();
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${style}</style>
      </head>
      <body>
        <div class="translation-container">
          ${contentHtml}
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          
          // 定期检查更新
          setInterval(() => {
            vscode.postMessage({ command: 'refresh' });
          }, 5000);
          
          // 监听来自扩展的消息
          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
              case 'updateContent':
                // 可以在这里处理特定的更新指令
                break;
            }
          });
        </script>
      </body>
      </html>
    `;
  }
  
  private generateSideBySideHtml(): string {
    return this.currentTranslationData.map((data, index) => {
      // 简单判断内容类型，实际可根据内容特征进一步细化
      const type = data.originalText.trim().startsWith('```') || 
                   data.originalText.includes('function') ||
                   data.originalText.includes('class') ? 'code' : 'text';
      
      const originalHtml = this.markdownRenderer.render(data.originalText);
      const translatedHtml = data.translatedText ? 
        this.markdownRenderer.render(data.translatedText) : 
        '<em>翻译中...</em>';
      
      return `
        <div class="segment" data-hash="${data.hash}">
          <div class="original">
            <h4>原文:</h4>
            ${originalHtml}
          </div>
          <div class="translated">
            <h4>译文:</h4>
            ${translatedHtml}
          </div>
        </div>
      `;
    }).join('');
  }
  
  private generateTranslatedOnlyHtml(): string {
    return this.currentTranslationData.map(data => {
      // 简单判断内容类型
      const type = data.originalText.trim().startsWith('```') || 
                   data.originalText.includes('function') ||
                   data.originalText.includes('class') ? 'code' : 'text';
      
      const translatedHtml = data.translatedText ? 
        this.markdownRenderer.render(data.translatedText) : 
        '<em>翻译中...</em>';
      
      return `
        <div class="translated-only" data-hash="${data.hash}">
          ${translatedHtml}
        </div>
      `;
    }).join('');
  }
  
  private getCssStyle(): string {
    return `
      .translation-container { 
      font-family: var(--vscode-font-family); 
      padding: 10px;
      color: var(--vscode-editor-foreground); /* 使用 VS Code 主题前景色 */
      background-color: var(--vscode-editor-background); /* 背景色适配主题 */
      font-size: 14px;
      line-height: 1.5;
    }
      .segment { 
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 20px; 
        margin-bottom: 20px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        padding: 10px;
      }
      .segment h4 {
        margin-top: 0;
        margin-bottom: 8px;
      }

      .segment p,
      .segment div {
        margin-top: 0;
        margin-bottom: 8px;
      }

      .segment pre {
        margin-top: 8px;
        margin-bottom: 8px;
      }
      .original, .translated { 
        border: 1px solid var(--vscode-panel-border); 
        padding: 10px; 
        border-radius: 4px;
      }
      code { 
        background: var(--vscode-textCodeBlock-background); 
        padding: 2px 4px; 
        border-radius: 2px;
      }
      pre code { 
        display: block; 
        padding: 10px; 
        overflow-x: auto;
      }
      .updating {
        opacity: 0.7;
      }
    `;
  }
  
  public dispose(): void {
    this.panel?.dispose();
  }
}