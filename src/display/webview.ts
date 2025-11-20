// src/display/webview.ts
import * as vscode from 'vscode';
import { TranslationData } from '../types';
import { HtmlRenderer } from './htmlRenderer';

export class WebviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private htmlRenderer: HtmlRenderer;
  private currentTranslationData: TranslationData[] = [];
  
  constructor(context: vscode.ExtensionContext) {
    this.htmlRenderer = new HtmlRenderer(context);
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
          this.handleWebviewMessage(message);
        },
        undefined,
        []
      );
      
      // 初始化Webview内容
      this.initializeWebview();
    } else {
      // 如果面板已存在，发送全量更新
      this.sendTranslationData();
    }
  }
  
  /**
   * 处理来自Webview的消息
   */
  private handleWebviewMessage(message: any): void {
    switch (message.command) {
        case 'ready':
            // Webview准备就绪，发送初始数据
            this.sendTranslationData();
            break;
        case 'refreshTranslation':
            // 重新翻译指定项
            this.refreshTranslation(message.hash);
            break;
        case 'refreshAll':
            // 刷新所有翻译
            this.refreshAllTranslations();
            break;
    }
}
  
  /**
   * 初始化Webview内容
   */
  private initializeWebview(): void {
    if (!this.panel) { return; }
    
    try {
      this.panel.webview.html = this.htmlRenderer.generateBaseHtml();
    } catch (error) {
        // 如果加载界面生成失败，显示错误页面
        this.panel.webview.html = this.htmlRenderer.generateErrorHtml(
            `初始化Webview失败: ${error instanceof Error ? error.message : String(error)}`
        );
    }
  }
  
  /**
   * 发送翻译数据到Webview
   */
  private sendTranslationData(): void {
    if (!this.panel) { return; }
    
    const config = vscode.workspace.getConfiguration('VScodeTranslator');
    const displayMode = config.get<string>('displayMode', 'sidebyside');
    
    this.panel.webview.postMessage({
      command: 'updateData',
      displayMode: displayMode,
      translationData: this.currentTranslationData
    });
  }
  
  
  /**
   * 重新翻译指定项
   */
  private refreshTranslation(hash: string): void {
    // 这里可以触发重新翻译的逻辑
    // 暂时只是模拟更新
    const translation = this.currentTranslationData.find(item => item.hash === hash);
    if (translation) {
      // 模拟重新翻译
      translation.translatedText = `重新翻译`;
      this.sendSingleTranslationUpdate(translation);
    }
  }
  
  /**
   * 刷新所有翻译
   */
  private refreshAllTranslations(): void {
    // 触发所有项的重新翻译
    this.currentTranslationData.forEach(translation => {
      translation.translatedText = `刷新翻译`;
    });
    this.sendTranslationData();
  }
  
  /**
   * 动态更新翻译结果
   */
  public updateTranslationResults(newData: TranslationData[]): void {
      const updatedHashes: string[] = [];
      
      newData.forEach(newItem => {
          const index = this.currentTranslationData.findIndex(
              item => item.hash === newItem.hash
          );
          if (index >= 0) {
              this.currentTranslationData[index] = { 
                  ...this.currentTranslationData[index], 
                  ...newItem 
              };
              updatedHashes.push(newItem.hash);
              
              // 立即发送单个更新，而不是等待批量处理
              this.sendSingleTranslationUpdate(this.currentTranslationData[index]);
          } else {
              this.currentTranslationData.push(newItem);
              updatedHashes.push(newItem.hash);
              this.sendSingleTranslationUpdate(newItem);
          }
      });
  }

  /**
   * 发送单个翻译项的更新（确保立即发送）
   */
private sendSingleTranslationUpdate(translation: TranslationData): void {
    if (!this.panel) { return; }
    
    const config = vscode.workspace.getConfiguration('VScodeTranslator');
    const displayMode = config.get<string>('displayMode', 'sidebyside');
    
    // 直接发送消息
    this.panel.webview.postMessage({
        command: 'updateSingle',
        displayMode: displayMode,
        translation: translation
    });
}
  
  /**
   * 更新单个翻译项
   */
  public updateSingleTranslation(translation: TranslationData): void {
    console.log('[Webview] 接收单个翻译更新:', translation.hash);
    
    const index = this.currentTranslationData.findIndex(
        item => item.hash === translation.hash
    );
    
    if (index >= 0) {
        this.currentTranslationData[index] = { 
            ...this.currentTranslationData[index], 
            ...translation 
        };
        console.log('[Webview] 更新现有翻译项');
    } else {
        this.currentTranslationData.push(translation);
        console.log('[Webview] 添加新翻译项');
    }
    
    this.sendSingleTranslationUpdate(translation);
    console.log('[Webview] 已发送更新消息到前端');
}
  
  /**
   * 显示错误信息
   */
  public showError(errorMessage: string): void {
    if (!this.panel) { return; }
    
    this.panel.webview.postMessage({
      command: 'showError',
      errorMessage: errorMessage
    });
  }
  
  /**
   * 清除错误信息
   */
  public clearError(): void {
    if (!this.panel) { return; }
    
    this.panel.webview.postMessage({
      command: 'clearError'
    });
  }
  
  /**
   * 检查面板是否可见
   */
  public isVisible(): boolean {
    return this.panel !== undefined;
  }
  
  /**
   * 显示面板
   */
  public reveal(): void {
    if (this.panel) {
      this.panel.reveal();
    }
  }
  
  public dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }
}