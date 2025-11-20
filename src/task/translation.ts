// src/task/translation.ts

import { EventEmitter, languages } from 'vscode';
import { TranslationService, TranslationData } from '../types';
import { TranslationDatabase } from '../data';
import { TranslationRequest } from '../types';

export class TranslationTaskManager {
  private pendingTasks: Map<string, { translations: TranslationData[]; cancel: () => void }> = new Map();
  private runningTasks: Set<string> = new Set();
  private maxConcurrency: number = 3;
  private activeTranslations: Map<string, AbortController> = new Map();
  
  // 使用Set存储所有未完成任务中的哈希值
  private pendingHashes: Set<string> = new Set();

  private _onPartialTranslationComplete = new EventEmitter<TranslationData>();
  public readonly onPartialTranslationComplete = this._onPartialTranslationComplete.event;

  private _onTranslationComplete = new EventEmitter<TranslationData[]>();
  public readonly onTranslationComplete = this._onTranslationComplete.event;
  
  private _onTranslationError = new EventEmitter<{taskId: string, error: Error}>();
  public readonly onTranslationError = this._onTranslationError.event;
  
  constructor(
    private translationServiceFactory: () => TranslationService,
    private databaseService: TranslationDatabase
  ) {}
  
  public async createTranslationTask(translations: TranslationData[]): Promise<void> {
    const taskId = this.generateTaskId();
    
    // 检查是否有重复的哈希值
    const hasNewHashes = translations.some(t => !this.pendingHashes.has(t.hash));
    
    // 如果有新的哈希值，取消所有待处理任务
    if (hasNewHashes) {
      this.cancelPendingTasks();
      // 清空哈希集合
      this.pendingHashes.clear();
    }
    
    // 将新的哈希值添加到集合中
    translations.forEach(t => this.pendingHashes.add(t.hash));
    
    const cancelController = new AbortController();
    this.activeTranslations.set(taskId, cancelController);
    
    this.pendingTasks.set(taskId, {
      translations,
      cancel: () => {
        cancelController.abort();
        this.activeTranslations.delete(taskId);
        // 从哈希集合中移除这些哈希值
        translations.forEach(t => this.pendingHashes.delete(t.hash));
      }
    });
    
    // 延迟执行以避免频繁请求
    setTimeout(() => this.executeTask(taskId, translations, cancelController.signal), 100);
  }
  
  private async executeTask(
    taskId: string, 
    translations: TranslationData[], 
    signal: AbortSignal
  ): Promise<void> {
    // 检查任务是否已被取消
    if (signal.aborted) {
      this.pendingTasks.delete(taskId);
      return;
    }
    
    // 移除待处理任务并添加到运行中任务
    this.pendingTasks.delete(taskId);
    this.runningTasks.add(taskId);
    
    try {
      // 控制并发数量
      while (this.runningTasks.size > this.maxConcurrency) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (signal.aborted) {
          this.runningTasks.delete(taskId);
          return;
        }
      }
      
      if (signal.aborted) {
        this.runningTasks.delete(taskId);
        return;
      }
      
      // 处理每个翻译项（只有译文为空的才需要处理）
      for (const translation of translations) {
        // 检查是否已取消
        if (signal.aborted) {
          break;
        }
        
        // 如果译文不为空，说明是从缓存中获取的,跳过处理即可
        if (translation.translatedText) {
          continue;
        }
        
        // 如果是代码类型，不需要翻译服务，直接将原文作为译文
        if (translation.type === 'code') {
          // 保存到数据库，原文即译文
          console.log(`保存代码块到数据库，原文：${translation.originalText}`);
          await this.databaseService.setTranslation(
            translation.originalText, 
            translation.originalText, // 原文作为译文
            translation.type,
            translation.language
          );
          
          // 更新翻译数据
          const updatedTranslation: TranslationData = {
            ...translation,
            translatedText: translation.originalText
          };
          //updatedTranslations.push(updatedTranslation);
          this._onPartialTranslationComplete.fire(updatedTranslation); // 立即发送更新
          continue;
        }
        
        // 创建翻译请求
        const request: TranslationRequest = {
          originalText: translation.originalText
        };
        
        try {
          // 执行翻译
          const service = this.translationServiceFactory();
          const response = await service.translate(request);

          // 保存到数据
          await this.databaseService.setTranslation(
            translation.originalText, 
            response.translatedText, 
            translation.type,
            translation.language
          );
          
          // 更新翻译数据
          const updatedTranslation: TranslationData = {
            ...translation,
            translatedText: response.translatedText
          };
          this._onPartialTranslationComplete.fire(updatedTranslation); // 立即发送更新
        } catch (error) {
          if (signal.aborted) {
            break;
          }
          throw error;
        }
      }
      
      // 发送完成事件，携带更新后的翻译数据
      if (!signal.aborted) {
        //this._onTranslationComplete.fire(updatedTranslations);
        this._onTranslationComplete.fire([]);
      }
    } catch (error) {
      if (!signal.aborted) {
        this._onTranslationError.fire({ taskId, error: error as Error });
      }
    } finally {
      // 清理任务
      this.runningTasks.delete(taskId);
      this.activeTranslations.delete(taskId);
      
      // 从哈希集合中移除这些哈希值
      translations.forEach(t => this.pendingHashes.delete(t.hash));
    }
  }
  
  public cancelPendingTasks(): void {
    // 取消所有待处理和正在运行的任务
    for (const [id, task] of this.pendingTasks.entries()) {
      task.cancel();
    }
    
    for (const [id, controller] of this.activeTranslations.entries()) {
      controller.abort();
    }
    
    this.pendingTasks.clear();
    this.runningTasks.clear();
    this.activeTranslations.clear();
    this.pendingHashes.clear();
  }
  
  public getPendingTaskCount(): number {
    return this.pendingTasks.size;
  }
  
  public getRunningTaskCount(): number {
    return this.runningTasks.size;
  }
  
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}