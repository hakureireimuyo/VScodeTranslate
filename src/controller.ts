// src/controller.ts
import * as vscode from 'vscode';
import { TranslationTaskManager } from './task';
import { TextSegmenter } from './utils';
import { HoverDisplay, WebviewPanel } from './display';
import { TranslationDatabase } from './data';
import { TextSegment, TranslationData } from './types';

export class LogicController implements vscode.Disposable {
  private textSegmenter: TextSegmenter;
  private isEnabled: boolean = true;
  private useWebviewPanel: boolean = false;
  private webviewPanel: WebviewPanel | undefined;
  
  // 防抖相关
  private debounceTimeout: NodeJS.Timeout | null = null;
  private lastHoverPositionKey: string = '';
  private lastHoverTime: number = 0;
  private readonly DEBOUNCE_DELAY: number = 300; // 300ms 防抖延迟
  private readonly POSITION_THRESHOLD: number = 1000; // 1秒内相同位置视为重复
  
  constructor(
    private taskManager: TranslationTaskManager,
    private databaseService: TranslationDatabase,
    private context: vscode.ExtensionContext
  ) {
    this.textSegmenter = new TextSegmenter();
    this.loadConfiguration();
    
    // 监听翻译任务完成事件
    this.taskManager.onTranslationComplete((updatedTranslations: TranslationData[]) => {
      this.handleTranslationComplete(updatedTranslations);
    });
    
    // 监听翻译任务错误事件
    this.taskManager.onTranslationError((errorInfo: {taskId: string, error: Error}) => {
      console.error('Translation task error:', errorInfo.error);
        vscode.window.showErrorMessage(`翻译任务失败: ${errorInfo.error.message}`);
      
      // 如果使用Webview面板，可以通知面板显示错误状态
      if (this.useWebviewPanel && this.webviewPanel) {
        this.webviewPanel.showError(errorInfo.error.message);
      }
    });
    // 新增：监听单个翻译完成事件
    this.taskManager.onPartialTranslationComplete((updatedTranslation: TranslationData) => {
    this.handleSingleTranslationComplete(updatedTranslation);
  });
  }
  
  private loadConfiguration() {
    const config = vscode.workspace.getConfiguration('VScodeTranslator');
    this.isEnabled = config.get<boolean>('enabled', true);
    this.useWebviewPanel = config.get<boolean>('useWebviewPanel', false);
  }
  
  public async handleHover(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // 生成位置标识键
    const positionKey = `${document.fileName}:${position.line}:${position.character}`;
    const currentTime = Date.now();
    
    // 添加调试输出
    console.log('[VSCode Translator] 悬停事件触发', {
      fileName: document.fileName,
      languageId: document.languageId,
      position: position,
      positionKey: positionKey
    });
    
    // 防抖检查 - 如果是相同位置且时间间隔很短，则忽略
    if (this.isDuplicateHover(positionKey, currentTime)) {
      console.log('[VSCode Translator] 检测到重复悬停事件，跳过处理');
      return null;
    }
    
    // 更新最后悬停位置和时间
    this.lastHoverPositionKey = positionKey;
    this.lastHoverTime = currentTime;
    
    if (!this.isEnabled) {
      console.log('[VSCode Translator] 插件已禁用，跳过悬停处理');
      return null;
    }
    
    try {
      // 1. 获取原始文档文本
      const rawText = await this.extractDocumentationText(document, position);
      console.log('[VSCode Translator] 提取的原始文本:', rawText);
      
      if (!rawText) {
        console.log('[VSCode Translator] 未检测到有效文本，跳过处理');
        return null;
      }
      
      // 2. 分割为语义段落
      const segments = this.textSegmenter.segmentText(rawText);
      console.log('[VSCode Translator] 分割为语义段落:', segments);
      // 3. 检查缓存并准备翻译任务
      const cachedResults = await this.prepareTranslationData(segments);
      console.log('[VSCode Translator] 缓存查询结果:', cachedResults);
      
      // 4. 根据显示模式处理
      if (this.useWebviewPanel) {
        console.log('[VSCode Translator] 使用Webview模式显示');
        return this.handleWebviewDisplay(cachedResults);
      } else {
        console.log('[VSCode Translator] 使用Hover模式显示');
        return this.handleHoverDisplay(cachedResults);
      }
    } catch (error) {
      console.error('[VSCode Translator] 悬停处理出错:', error);
      return null;
    }
  }
  
  /**
   * 检查是否为重复悬停事件
   */
  private isDuplicateHover(positionKey: string, currentTime: number): boolean {
    // 如果位置相同且时间间隔小于阈值，则视为重复
    return this.lastHoverPositionKey === positionKey && 
           (currentTime - this.lastHoverTime) < this.POSITION_THRESHOLD;
  }
  
  private async extractDocumentationText(document: vscode.TextDocument, position: vscode.Position): Promise<string | null> {
    console.log('[VSCode Translator] 调用VSCode内置悬停提供器获取文档内容');
    
    try {
      // 调用VSCode内置的悬停提供器获取原始悬停内容
      const originalHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        document.uri,
        position
      );
      
      if (originalHovers && originalHovers.length > 0) {
        console.log('[VSCode Translator] 成功获取原始悬浮内容');
        
        // 提取所有悬停内容的文本
        const documentationText = extractHoverText(originalHovers);

        return documentationText || null;
      } else {
        console.log('[VSCode Translator] 未获取到原始悬浮内容');
        return null;
      }
    } catch (error) {
      console.error('[VSCode Translator] 获取原始悬浮内容时出错:', error);
      return null;
    }
  }
  
  /**
   * 从数据库中获取缓存数据并构建数据列表
   */
  private async prepareTranslationData(segments: TextSegment[]): Promise<TranslationData[]> {
      const cachedResults: TranslationData[] = [];
      for (const segment of segments) {
        const hash = this.databaseService.generateHash(segment.content);
        // console.log('[VSCode Translator] 生成hash:', { content: segment.content, hash });

        const cached = await this.databaseService.getByHash(hash);
        if (cached) {
          console.log('[VSCode Translator] 找到缓存数据:', cached);
          cachedResults.push(cached);
        }
        else {
          console.log('[VSCode Translator] 未找到缓存，创建新条目');
          // 未缓存的段落列表
          const temp:TranslationData = {
            hash: hash,
            type: segment.type,
            language: segment.language,
            originalText: segment.content,
            translatedText: '',
            createTime: Date.now(),
            lastAccessTime: Date.now(),
            accessCount: 0
          };

          cachedResults.push(temp);
        }
      }
    
    return cachedResults;
  }
  
  private async handleHoverDisplay(
    cachedResults: TranslationData[]
  ): Promise<vscode.Hover> {
    console.log('[VSCode Translator] 处理Hover显示');
    
    // 每次使用时创建新的HoverDisplay实例
    const hoverDisplay = new HoverDisplay();
    
    // 提交需要翻译的任务
    const translationsToProcess = cachedResults.filter(t => !t.translatedText);
    // console.log('[VSCode Translator] 需要翻译的项目数:', translationsToProcess.length);
    
    if (translationsToProcess.length > 0) {
      //console.log('[VSCode Translator] 创建翻译任务');
      this.taskManager.createTranslationTask(translationsToProcess);
    }

    const markdown = hoverDisplay.generateMarkdown(cachedResults);
    console.log('[VSCode Translator] 生成Hover内容');
    
    return new vscode.Hover(markdown);
  }
  
  private async handleWebviewDisplay(
    cachedResults: TranslationData[]
  ): Promise<vscode.Hover | null> {
    console.log('[VSCode Translator] 处理Webview显示');
    
    // 创建或更新Webview面板
    if (!this.webviewPanel) {
      this.webviewPanel = new WebviewPanel(this.context); 
    }
    
    this.webviewPanel.createOrUpdatePanel(cachedResults);
    
    // 提交需要翻译的任务
    const translationsToProcess = cachedResults.filter(t => !t.translatedText);
    console.log('[VSCode Translator] Webview模式下需要翻译的项目数:', translationsToProcess.length);
    
    if (translationsToProcess.length > 0) {
      console.log('[VSCode Translator] Webview模式下创建翻译任务');
      this.taskManager.createTranslationTask(translationsToProcess);
    }
    
    // Webview模式下悬停显示原版窗口
    console.log('[VSCode Translator] Webview模式返回null');
    return null;
  }
  
  /**
   * 处理翻译完成事件
   * 注意：翻译任务模块已将结果存储到数据库，此处只需更新界面显示
   */
  private handleTranslationComplete(updatedTranslations: TranslationData[]): void {
    console.log('[VSCode Translator] 接收到翻译完成事件', updatedTranslations.length);
    
    // 如果使用Webview面板，则更新面板内容
    if (this.useWebviewPanel && this.webviewPanel) {
      console.log('[VSCode Translator] 更新Webview面板');
      // 使用更新单个翻译项的方法，提高效率
      updatedTranslations.forEach(translation => {
        this.webviewPanel!.updateSingleTranslation(translation);
      });
    }
    
    console.log(`[VSCode Translator] 翻译完成处理结束，共${updatedTranslations.length}个项目`);
  }

  // 新增方法处理单个翻译完成
  private handleSingleTranslationComplete(updatedTranslation: TranslationData): void {
    console.log('[VSCode Translator] 单个翻译完成', updatedTranslation.hash);
    
    // 如果使用Webview面板，则更新面板内容
    if (this.useWebviewPanel && this.webviewPanel) {
      console.log('[VSCode Translator] 更新Webview面板单项');
      this.webviewPanel.updateSingleTranslation(updatedTranslation);
    }
    
    // 如果将来也要更新Hover显示，也可以在这里处理
  }
  public onConfigChange() {
    console.log('[VSCode Translator] 配置发生变更');
    const oldUseWebviewPanel = this.useWebviewPanel;
    this.loadConfiguration();
    
    // 如果配置改变导致显示模式变化，处理相关逻辑
    if (oldUseWebviewPanel !== this.useWebviewPanel) {
      if (!this.useWebviewPanel && this.webviewPanel) {
        // 切换到Hover模式时，释放Webview资源
        this.webviewPanel.dispose();
        this.webviewPanel = undefined;
      }
    }
  }
  
  public dispose() {
    console.log('[VSCode Translator] 释放LogicController资源');
    
    // 清理防抖定时器
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
    }
  }
}

/**
 * 提取悬浮文本
 */
function extractHoverText(hovers: vscode.Hover[]): string {
    return hovers
        .map(h => h.contents.map(c => {
            const content = (c as vscode.MarkdownString).value ?? String(c);
            // 过滤掉HTML注释
            return content.replace(/<!--.*?-->/g, '').trim();
        }).join('\n'))
        .join('\n\n')
        .trim();
}