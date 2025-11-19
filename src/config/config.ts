// src/config/ConfigManager.ts
import * as vscode from 'vscode';
import { ConfigDatabase } from '../data';
import { TranslationConfig } from '../types';

/**
 * 配置管理器类 - 改进版本
 * 主要修复：循环触发、数据同步一致性、错误处理
 */
export class ConfigManager implements vscode.Disposable {
  private static instance: ConfigManager;
  
  private activeConfig: TranslationConfig;
  private configDb: ConfigDatabase;
  private disposables: vscode.Disposable[] = [];
  private _onConfigChange = new vscode.EventEmitter<void>();
  public readonly onConfigChange = this._onConfigChange.event;

  // 新增：防循环触发标志
  private isUpdatingVSCodeConfig = false;
  // 新增：配置变更防抖处理
  private configChangeDebounceTimer: NodeJS.Timeout | undefined;

  constructor(configDb: ConfigDatabase) {
    this.configDb = configDb;
    
    // 初始化默认配置
    this.activeConfig = {
      serviceProvider: 'openai',
      url: '',
      apiKey: '',
      model: '',
      secretKey: ''
    };
    
    // 订阅配置变化（添加防抖）
    this.subscribeToConfigChanges();
  }

  /**
   * 获取配置管理器单例实例
   */
  public static async getInstance(configDb: ConfigDatabase): Promise<ConfigManager> {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configDb);
      await ConfigManager.instance.loadActiveConfig();
    }
    return ConfigManager.instance;
  }

  /**
   * 加载当前活动配置
   */
  private async loadActiveConfig(): Promise<void> {
    try {
      const activeServiceProvider = await this.configDb.getActiveServiceProvider();
      const serviceConfig = await this.configDb.getActiveServiceConfig();
      
      if (serviceConfig) {
        this.activeConfig = {
          serviceProvider: serviceConfig.serviceProvider,
          url: serviceConfig.url || '',
          apiKey: serviceConfig.apiKey || '',
          secretKey: serviceConfig.secretKey || '',
          model: serviceConfig.model || ''
        };
      } else {
        this.activeConfig = this.getDefaultConfig(activeServiceProvider);
      }
      
      console.log(`[VSCode Translator][ConfigManager] 活动配置加载完成: ${this.activeConfig.serviceProvider}`);
    } catch (err) {
      console.error('[VSCode Translator][ConfigManager] 加载活动配置时出错:', err);
      // 使用默认配置作为降级方案
      this.activeConfig = this.getDefaultConfig('openai');
    }
  }

  /**
   * 订阅配置变化事件（添加防抖机制）
   */
  private subscribeToConfigChanges(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('VScodeTranslator')) {
        console.log('[VSCode Translator][ConfigManager] 检测到 VScodeTranslator 配置变化');
        
        // 防抖处理：避免频繁变更
        if (this.configChangeDebounceTimer) {
          clearTimeout(this.configChangeDebounceTimer);
        }
        
        this.configChangeDebounceTimer = setTimeout(async () => {
          await this.handleConfigChange();
        }, 300); // 300ms防抖
      }
    });
    
    this.disposables.push(disposable);
  }

  /**
   * 处理配置变化（核心改进）
   */
  private async handleConfigChange(): Promise<void> {
    // 防止循环触发
    if (this.isUpdatingVSCodeConfig) {
      console.log('[VSCode Translator][ConfigManager] 忽略由自身触发的配置变更');
      return;
    }
    
    console.log('[VSCode Translator][ConfigManager] 开始处理配置变更');
    
    try {
      const config = vscode.workspace.getConfiguration('VScodeTranslator');
      const newServiceProvider = config.get<string>('serviceProvider', 'openai');
      
      console.log(`[VSCode Translator][ConfigManager] 当前服务: ${this.activeConfig.serviceProvider}, 新服务: ${newServiceProvider}`);
      
      if (this.activeConfig.serviceProvider !== newServiceProvider) {
        // 服务提供商切换
        await this.switchService(newServiceProvider);
      } else {
        // 同一服务提供商，仅更新配置参数
        await this.updateServiceParameters(config);
      }
    } catch (error) {
      console.error('[VSCode Translator][ConfigManager] 处理配置变更时出错:', error);
    }
  }

  /**
   * 更新服务参数（改进版本）
   */
  private async updateServiceParameters(config: vscode.WorkspaceConfiguration): Promise<void> {
    console.log('[VSCode Translator][ConfigManager] 更新服务参数');
    
    const updatedConfig = {
      url: config.get<string>('url', ''),
      apiKey: config.get<string>('apiKey', ''),
      model: config.get<string>('model', ''),
      secretKey: config.get<string>('secretKey', ''),
    };
    
    // 验证配置完整性
    if (!this.validateConfig(updatedConfig)) {
      console.warn('[VSCode Translator][ConfigManager] 配置验证失败，跳过更新');
      return;
    }
    
    // 检查配置是否实际发生变化
    if (this.isConfigChanged(updatedConfig)) {
      console.log('[VSCode Translator][ConfigManager] 检测到配置参数变化，开始更新');
      
      // 更新内存配置
      Object.assign(this.activeConfig, updatedConfig);
      
      // 保存到数据库
      await this.saveActiveConfig();
      
      console.log('[VSCode Translator][ConfigManager] 服务参数更新完成');
      
      // 触发配置变更事件
      this._onConfigChange.fire();
    } else {
      console.log('[VSCode Translator][ConfigManager] 配置参数无实际变化，跳过更新');
    }
  }

  /**
   * 切换服务提供商（重大改进）
   */
  public async switchService(serviceProvider: string): Promise<void> {
    console.log(`[VSCode Translator][ConfigManager] 开始切换服务提供商: ${this.activeConfig.serviceProvider} -> ${serviceProvider}`);
    
    // 设置防循环标志
    this.isUpdatingVSCodeConfig = true;
    
    try {
      // 1. 保存当前服务配置到数据库
      console.log('[VSCode Translator][ConfigManager] 保存当前服务配置');
      await this.saveActiveConfig();
      
      // 2. 更新数据库中的活动服务提供商
      console.log(`[VSCode Translator][ConfigManager] 更新数据库活动服务提供商为: ${serviceProvider}`);
      await this.configDb.setActiveServiceProvider(serviceProvider);
      
      // 3. 从数据库加载新服务提供商的配置
      console.log(`[VSCode Translator][ConfigManager] 从数据库加载 ${serviceProvider} 配置`);
      const serviceConfig = await this.configDb.getServiceConfig(serviceProvider);
      
      if (serviceConfig) {
        console.log(`[VSCode Translator][ConfigManager] 使用数据库中 ${serviceProvider} 的配置`);
        this.activeConfig = {
          serviceProvider: serviceConfig.serviceProvider,
          url: serviceConfig.url || '',
          apiKey: serviceConfig.apiKey || '',
          secretKey: serviceConfig.secretKey || '',
          model: serviceConfig.model || ''
        };
      } else {
        console.log(`[VSCode Translator][ConfigManager] ${serviceProvider} 无存储配置，使用默认配置`);
        this.activeConfig = this.getDefaultConfig(serviceProvider);
      }
      
      console.log('[VSCode Translator][ConfigManager] 切换后内存配置:', {
        serviceProvider: this.activeConfig.serviceProvider,
        url: this.activeConfig.url ? '***' : '空',
        apiKey: this.activeConfig.apiKey ? '***' : '空',
        model: this.activeConfig.model || '空'
      });
      
      // 4. 检查VSCode设置是否需要同步
      if (!this.isConfigInSyncWithVSCode()) {
        console.log('[VSCode Translator][ConfigManager] VSCode设置与数据库不同步，开始同步');
        await this.syncToVSCode();
      } else {
        console.log('[VSCode Translator][ConfigManager] VSCode设置已同步，跳过更新');
      }
      
      // 5. 触发配置变更事件
      this._onConfigChange.fire();
      console.log('[VSCode Translator][ConfigManager] 服务切换完成');
      
    } catch (error) {
      console.error(`[VSCode Translator][ConfigManager] 切换服务提供商失败: ${serviceProvider}`, error);
      throw new Error(`切换服务提供商失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // 确保防循环标志被重置
      this.isUpdatingVSCodeConfig = false;
    }
  }

  /**
   * 检查VSCode设置是否与内存配置同步
   */
  private isConfigInSyncWithVSCode(): boolean {
    const vsConfig = vscode.workspace.getConfiguration('VScodeTranslator');
    
    return (
      vsConfig.get('serviceProvider') === this.activeConfig.serviceProvider &&
      vsConfig.get('url') === (this.activeConfig.url || '') &&
      vsConfig.get('apiKey') === (this.activeConfig.apiKey || '') &&
      vsConfig.get('model') === (this.activeConfig.model || '') &&
      vsConfig.get('secretKey') === (this.activeConfig.secretKey || '')
    );
  }

  /**
   * 同步内存配置到VSCode设置
   */
  private async syncToVSCode(): Promise<void> {
    console.log('[VSCode Translator][ConfigManager] 开始同步配置到VSCode');
    
    try {
      const config = vscode.workspace.getConfiguration('VScodeTranslator');
      
      // 批量更新配置项，减少事件触发
      const updatePromises = [
        config.update('serviceProvider', this.activeConfig.serviceProvider, vscode.ConfigurationTarget.Global),
        config.update('url', this.activeConfig.url || '', vscode.ConfigurationTarget.Global),
        config.update('apiKey', this.activeConfig.apiKey || '', vscode.ConfigurationTarget.Global),
        config.update('model', this.activeConfig.model || '', vscode.ConfigurationTarget.Global),
        config.update('secretKey', this.activeConfig.secretKey || '', vscode.ConfigurationTarget.Global)
      ];
      
      await Promise.all(updatePromises);
      console.log('[VSCode Translator][ConfigManager] VSCode设置同步完成');
    } catch (error) {
      console.error('[VSCode Translator][ConfigManager] 同步配置到VSCode失败:', error);
      throw error;
    }
  }

  /**
   * 检查配置是否实际发生变化
   */
  private isConfigChanged(newConfig: Partial<TranslationConfig>): boolean {
    return (
      newConfig.url !== this.activeConfig.url ||
      newConfig.apiKey !== this.activeConfig.apiKey ||
      newConfig.model !== this.activeConfig.model ||
      newConfig.secretKey !== this.activeConfig.secretKey
    );
  }

  /**
   * 验证配置完整性
   */
  private validateConfig(config: Partial<TranslationConfig>): boolean {
    //暂时不验证配置
    return true;
  }

  /**
   * 保存当前活动配置到数据库
   */
  private async saveActiveConfig(): Promise<void> {
    try {
      await this.configDb.setServiceConfig({
        serviceProvider: this.activeConfig.serviceProvider,
        url: this.activeConfig.url || '',
        apiKey: this.activeConfig.apiKey || '',
        secretKey: this.activeConfig.secretKey || '',
        model: this.activeConfig.model || ''
      });
      console.log(`[VSCode Translator][ConfigManager] 配置已保存到数据库: ${this.activeConfig.serviceProvider}`);
    } catch (err) {
      console.error('[VSCode Translator][ConfigManager] 保存活动配置时出错:', err);
      throw err;
    }
  }

  // ========== 公共方法 ==========

  /**
   * 强制同步数据库配置到VSCode设置
   */
  public async syncDatabaseToVSCode(): Promise<void> {
    console.log('[VSCode Translator][ConfigManager] 开始强制同步：数据库 → VSCode');
    
    this.isUpdatingVSCodeConfig = true;
    try {
      // 重新加载数据库配置确保数据最新
      await this.loadActiveConfig();
      
      // 同步到VSCode
      await this.syncToVSCode();
      
      console.log('[VSCode Translator][ConfigManager] 强制同步完成');
    } finally {
      this.isUpdatingVSCodeConfig = false;
    }
  }

  /**
   * 强制同步VSCode设置到数据库
   */
  public async syncVSCodeToDatabase(): Promise<void> {
    console.log('[VSCode Translator][ConfigManager] 开始强制同步：VSCode → 数据库');
    
    const config = vscode.workspace.getConfiguration('VScodeTranslator');
    const newServiceProvider = config.get<string>('serviceProvider', 'openai');
    
    if (this.activeConfig.serviceProvider !== newServiceProvider) {
      await this.switchService(newServiceProvider);
    } else {
      await this.updateServiceParameters(config);
    }
    
    console.log('[VSCode Translator][ConfigManager] 强制同步完成');
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
    if (!this.validateConfig(updates)) {
      throw new Error('配置验证失败');
    }
    
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
      url: serviceConfig.url || '',
      apiKey: serviceConfig.apiKey || '',
      secretKey: serviceConfig.secretKey || '',
      model: serviceConfig.model || ''
    };
  }

  /**
   * 更新特定服务的配置
   */
  public async updateServiceConfig(
    serviceProvider: string, 
    config: Partial<TranslationConfig>
  ): Promise<void> {
    if (!this.validateConfig(config)) {
      throw new Error('配置验证失败');
    }
    
    let existingConfig = await this.getServiceConfig(serviceProvider);
    if (!existingConfig) {
      existingConfig = this.getDefaultConfig(serviceProvider);
    }
    
    const updatedConfig: TranslationConfig = {
      ...existingConfig,
      ...config
    };
    
    await this.configDb.setServiceConfig({
      serviceProvider: updatedConfig.serviceProvider,
      url: updatedConfig.url || '',
      apiKey: updatedConfig.apiKey || '',
      secretKey: updatedConfig.secretKey || '',
      model: updatedConfig.model || ''
    });
    
    if (this.activeConfig.serviceProvider === serviceProvider) {
      this.activeConfig = { ...updatedConfig };
      this._onConfigChange.fire();
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
        model: '',
        secretKey: ''
      },
      zhipu: {
        serviceProvider: 'zhipu',
        url: '',
        apiKey: '',
        model: '',
        secretKey: ''
      },
      local: {
        serviceProvider: 'local',
        url: '',
        apiKey: '',
        model: '',
        secretKey: ''
      }
    };
    
    return defaults[serviceProvider] || {
      serviceProvider: serviceProvider,
      url: '',
      apiKey: '',
      secretKey: '',
      model: ''
    };
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    if (this.configChangeDebounceTimer) {
      clearTimeout(this.configChangeDebounceTimer);
    }
    
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this._onConfigChange.dispose();
    
    console.log('[VSCode Translator][ConfigManager] 资源已释放');
  }
}