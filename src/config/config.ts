// src/config/ConfigManager.ts
import * as vscode from 'vscode';
import { ConfigDatabase } from '../data';
import {TranslationConfig} from '../types';

/**
 * 配置管理器类
 */
export class ConfigManager implements vscode.Disposable {
  private static instance: ConfigManager;
  
  private activeConfig: TranslationConfig;
  private configDb: ConfigDatabase;
  
  // 事件订阅
  private disposables: vscode.Disposable[] = [];
  private _onConfigChange = new vscode.EventEmitter<void>();
  public readonly onConfigChange = this._onConfigChange.event;

  constructor(configDb: ConfigDatabase) {
    this.configDb = configDb;
    
    // 初始化默认配置
    this.activeConfig = {
      serviceProvider: 'openai',
      url: '',
      apiKey: '',
      model: 'gpt-3.5-turbo'
    };
    
    // 订阅配置变化
    this.subscribeToConfigChanges();
  }

  /**
   * 获取配置管理器单例实例
   */
  public static async getInstance(configDb: ConfigDatabase): Promise<ConfigManager> {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configDb);
      // 加载当前活动配置
      await ConfigManager.instance.loadActiveConfig();
    }
    return ConfigManager.instance;
  }

  /**
   * 加载当前活动配置
   */
  private async loadActiveConfig(): Promise<void> {
    try {
      // 从数据库获取当前活动的服务提供商
      const activeServiceProvider = await this.configDb.getSimpleConfig('activeServiceProvider');
      const serviceProvider = (activeServiceProvider || 'openai');
      
      // 加载该服务提供商的配置
      const serviceConfig = await this.configDb.getServiceConfig(serviceProvider);
      
      if (serviceConfig) {
        this.activeConfig = {
          serviceProvider: serviceConfig.serviceProvider,
          url: serviceConfig.url,
          apiKey: serviceConfig.apiKey,
          secretKey: serviceConfig.secretKey,
          model: serviceConfig.model
        };
      } else {
        // 如果数据库中没有配置，则使用默认配置
        this.activeConfig = this.getDefaultConfig(serviceProvider);
      }
    } catch (err) {
      console.warn('加载活动配置时出错:', err);
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(serviceProvider: string): TranslationConfig {
    const defaults: Record<string, TranslationConfig> = {
      aliyun: {
        serviceProvider: 'aliyun',
        url: '',
        apiKey: '',
        secretKey: '',
        model: ''
      },
      baidu: {
        serviceProvider: 'baidu',
        url: '',
        apiKey: '',
        secretKey: '',
        model: ''
      },
      openai: {
        serviceProvider: 'openai',
        url: '',
        apiKey: '',
        model: 'gpt-3.5-turbo'
      },
      zhipu: {
        serviceProvider: 'zhipu',
        url: '',
        apiKey: '',
        model: ''
      },
      local: {
        serviceProvider: 'local',
        url: '',
        apiKey: '',
        model: ''
      }
    };
    
    return defaults[serviceProvider];
  }

  /**
   * 订阅配置变化事件
   */
  private subscribeToConfigChanges(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('VScodeTranslator')) {
        await this.handleConfigChange();
      }
    });
    
    this.disposables.push(disposable);
  }

  /**
   * 处理配置变化
   */
  private async handleConfigChange(): Promise<void> {
    // 从VSCode设置中读取配置并更新当前配置
    const config = vscode.workspace.getConfiguration('VScodeTranslator');
    
    // 更新当前活动配置
    this.activeConfig.url = config.get<string>('url', '');
    this.activeConfig.apiKey = config.get<string>('apiKey', '');
    this.activeConfig.model = config.get<string>('model', 
      this.activeConfig.serviceProvider === 'openai' ? 'gpt-3.5-turbo' : '');
    
    if ('secretKey' in this.activeConfig) {
      (this.activeConfig as any).secretKey = config.get<string>('secretKey', '');
    }
    
    // 保存到数据库
    await this.saveActiveConfig();
    
    // 触发配置变更事件
    this._onConfigChange.fire();
  }

  /**
   * 切换服务提供商
   */
  public async switchService(serviceProvider: string): Promise<void> {
    // 保存当前配置
    await this.saveActiveConfig();
    
    // 加载新服务提供商的配置
    const serviceConfig = await this.configDb.getServiceConfig(serviceProvider);
    
    if (serviceConfig) {
      this.activeConfig = {
        serviceProvider: serviceConfig.serviceProvider,
        url: serviceConfig.url,
        apiKey: serviceConfig.apiKey,
        secretKey: serviceConfig.secretKey,
        model: serviceConfig.model
      };
    } else {
      // 如果数据库中没有配置，则使用默认配置
      this.activeConfig = this.getDefaultConfig(serviceProvider);
    }
    
    // 更新活动服务提供商记录
    await this.configDb.setSimpleConfig('activeServiceProvider', serviceProvider);
    
    // 触发配置变更事件
    this._onConfigChange.fire();
  }

  /**
   * 保存当前活动配置到数据库
   */
  private async saveActiveConfig(): Promise<void> {
    try {
      await this.configDb.setServiceConfig({
        serviceProvider: this.activeConfig.serviceProvider,
        url: this.activeConfig.url,
        apiKey: this.activeConfig.apiKey,
        secretKey: (this.activeConfig as any).secretKey || '',
        model: this.activeConfig.model
      });
    } catch (err) {
      console.error('保存活动配置时出错:', err);
    }
  }

  /**
   * 获取当前活动配置
   */
  public getActiveConfig(): TranslationConfig {
    return { ...this.activeConfig };
  }

  /**
   * 更新当前配置
   */
  public async updateActiveConfig(updates: Partial<TranslationConfig>): Promise<void> {
    this.activeConfig = { ...this.activeConfig, ...updates };
    await this.saveActiveConfig();
    this._onConfigChange.fire();
  }

  /**
   * 获取特定服务的配置
   */
  public async getServiceConfig(serviceProvider: string): Promise<TranslationConfig | null> {
    const serviceConfig = await this.configDb.getServiceConfig(serviceProvider);
    
    if (!serviceConfig) {
      return null;
    }
    
    return {
      serviceProvider: serviceConfig.serviceProvider,
      url: serviceConfig.url,
      apiKey: serviceConfig.apiKey,
      secretKey: serviceConfig.secretKey,
      model: serviceConfig.model
    };
  }

  /**
   * 更新特定服务的配置
   */
  public async updateServiceConfig(
    serviceProvider: string, 
    config: Partial<TranslationConfig>
  ): Promise<void> {
    // 获取现有配置或默认配置
    let existingConfig = await this.getServiceConfig(serviceProvider);
    if (!existingConfig) {
      existingConfig = this.getDefaultConfig(serviceProvider);
    }
    
    // 合并更新
    const updatedConfig: TranslationConfig = {
      ...existingConfig,
      ...config
    };
    
    // 保存到数据库
    await this.configDb.setServiceConfig({
      serviceProvider: updatedConfig.serviceProvider,
      url: updatedConfig.url,
      apiKey: updatedConfig.apiKey,
      secretKey: (updatedConfig as any).secretKey || '',
      model: updatedConfig.model
    });
    
    // 如果更新的是当前活动服务，则同步更新活动配置
    if (this.activeConfig.serviceProvider === serviceProvider) {
      this.activeConfig = { ...updatedConfig };
      this._onConfigChange.fire();
    }
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this._onConfigChange.dispose();
  }
}