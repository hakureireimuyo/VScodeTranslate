// src/commands/config.ts
import * as vscode from 'vscode';
import { ConfigManager } from '../config/config';
import { ConfigDatabase } from '../data/config';

/**
 * 注册配置相关命令
 * @param context 扩展上下文
 * @param configManager 配置管理器
 * @param configDB 配置数据库
 */
export function registerConfigCommands(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  configDB: ConfigDatabase
): void {
  console.log('[VSCode Translator] 注册配置相关命令...');

  // 设置简单配置项命令
  const setConfigCommand = vscode.commands.registerCommand('VScodeTranslator.setConfig', async () => {
    console.log('[VSCode Translator] 执行设置配置命令');
    const key = await vscode.window.showInputBox({ prompt: '请输入配置键名' });
    if (!key) {
      console.log('[VSCode Translator] 用户取消了键名输入');
      return;
    }

    const value = await vscode.window.showInputBox({ prompt: '请输入配置值' });
    if (value === undefined) {
      console.log('[VSCode Translator] 用户取消了值输入');
      return;
    }

    try {
      await configDB.setSimpleConfig(key, value);
      console.log(`[VSCode Translator] 配置项 "${key}" 已保存，值为 "${value}"`);
      vscode.window.showInformationMessage(`配置项 "${key}" 已保存`);
    } catch (error) {
      console.error('[VSCode Translator] 保存配置失败:', error);
      vscode.window.showErrorMessage('保存配置失败: ' + error);
    }
  });

  // 获取简单配置项命令
  const getConfigCommand = vscode.commands.registerCommand('VScodeTranslator.getConfig', async () => {
    console.log('[VSCode Translator] 执行获取配置命令');
    const key = await vscode.window.showInputBox({ prompt: '请输入要查询的配置键名' });
    if (!key) {
      console.log('[VSCode Translator] 用户取消了键名输入');
      return;
    }

    try {
      const value = await configDB.getSimpleConfig(key);
      if (value !== null) {
        console.log(`[VSCode Translator] 查询到配置项 "${key}" 的值为 "${value}"`);
        vscode.window.showInformationMessage(`${key}: ${value}`);
      } else {
        console.log(`[VSCode Translator] 未找到配置项 "${key}"`);
        vscode.window.showWarningMessage(`未找到配置项 "${key}"`);
      }
    } catch (error) {
      console.error('[VSCode Translator] 查询配置失败:', error);
      vscode.window.showErrorMessage('查询配置失败: ' + error);
    }
  });

  // 切换服务提供商命令
  const switchServiceCommand = vscode.commands.registerCommand('VScodeTranslator.switchService', async () => {
    console.log('[VSCode Translator] 执行切换服务提供商命令');
    const services = ['openai', 'baidu', 'aliyun', 'zhipu', 'local'];
    const selectedService = await vscode.window.showQuickPick(services, {
      placeHolder: '请选择要切换到的服务提供商'
    });

    if (!selectedService) {
      console.log('[VSCode Translator] 用户取消了服务选择');
      return;
    }

    try {
      await configManager.switchService(selectedService);
      const newConfig = configManager.getActiveConfig();
      console.log(`[VSCode Translator] 成功切换到服务提供商: ${selectedService}`, newConfig);
      vscode.window.showInformationMessage(`已切换到 ${selectedService} 服务`);
    } catch (error) {
      console.error('[VSCode Translator] 切换服务提供商失败:', error);
      vscode.window.showErrorMessage('切换服务提供商失败: ' + error);
    }
  });

  // 显示当前配置命令
  const showCurrentConfigCommand = vscode.commands.registerCommand('VScodeTranslator.showCurrentConfig', async () => {
    console.log('[VSCode Translator] 执行显示当前配置命令');
    try {
      const currentConfig = configManager.getActiveConfig();
      const configStr = JSON.stringify(currentConfig, null, 2);
      console.log('[VSCode Translator] 当前配置详情:', configStr);

      // 在输出面板中显示配置信息
      const outputChannel = vscode.window.createOutputChannel("VSCode Translator");
      outputChannel.appendLine("当前配置详情:");
      outputChannel.appendLine(configStr);
      outputChannel.show();
    } catch (error) {
      console.error('[VSCode Translator] 显示当前配置失败:', error);
      vscode.window.showErrorMessage('显示当前配置失败: ' + error);
    }
  });

  // 显示数据库中所有配置命令
  const showAllDatabaseConfigsCommand = vscode.commands.registerCommand('VScodeTranslator.showAllDatabaseConfigs', async () => {
    console.log('[VSCode Translator] 执行显示数据库中所有配置命令');
    try {
      // 获取所有服务配置
      const allServiceConfigs = await configDB.getAllServiceConfigs();

      // 获取活动服务提供商
      const activeServiceProvider = await configDB.getSimpleConfig('activeServiceProvider') || 'openai';

      // 在输出面板中显示所有配置信息
      const outputChannel = vscode.window.createOutputChannel("VSCode Translator");
      outputChannel.appendLine("=== 数据库中存储的所有配置 ===");
      outputChannel.appendLine(`活动服务提供商: ${activeServiceProvider}`);
      outputChannel.appendLine("");
      outputChannel.appendLine("服务配置:");

      if (allServiceConfigs.length === 0) {
        outputChannel.appendLine("  暂无服务配置");
      } else {
        for (const config of allServiceConfigs) {
          outputChannel.appendLine("  " + JSON.stringify(config, null, 2));
          outputChannel.appendLine("  ---");
        }
      }

      // 获取所有简单配置项
      outputChannel.appendLine("");
      outputChannel.appendLine("简单配置项:");

      // 通过 configDB 获取所有简单配置项
      const allSimpleConfigs = await getAllSimpleConfigs(configDB);

      if (allSimpleConfigs.length === 0) {
        outputChannel.appendLine("  暂无简单配置项");
      } else {
        for (const config of allSimpleConfigs) {
          outputChannel.appendLine(`  ${config.key}: ${config.value}`);
        }
      }

      outputChannel.show();
      console.log('[VSCode Translator] 数据库配置详情已显示在输出面板');
    } catch (error) {
      console.error('[VSCode Translator] 显示数据库配置失败:', error);
      vscode.window.showErrorMessage('显示数据库配置失败: ' + error);
    }
  });

  // 将命令注册到上下文中以便自动清理
  context.subscriptions.push(setConfigCommand);
  context.subscriptions.push(getConfigCommand);
  context.subscriptions.push(switchServiceCommand);
  context.subscriptions.push(showCurrentConfigCommand);
  context.subscriptions.push(showAllDatabaseConfigsCommand);

  console.log('[VSCode Translator] 配置命令注册完成');
}

/**
 * 获取所有简单配置项
 * @param configDB 配置数据库实例
 * @returns 所有简单配置项的数组
 */
async function getAllSimpleConfigs(configDB: ConfigDatabase): Promise<{key: string, value: string}[]> {
  // 这里我们需要通过扩展 ConfigDatabase 类来支持获取所有简单配置项
  // 由于目前 ConfigDatabase 类没有提供这个方法，我们暂时返回空数组
  // 在后续可以扩展 ConfigDatabase 类来支持这个功能
  return [];
}