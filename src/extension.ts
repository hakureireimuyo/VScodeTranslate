// src/extension.ts
import * as vscode from 'vscode';
import { DatabaseManager } from './data/database';
import { TranslationDatabase } from './data/translation';
import { ConfigDatabase } from './data/config';
import { ConfigManager } from './config/config';
import { registerConfigCommands } from './commands';
import { LogicController } from './controller';
import { TranslationTaskManager } from './task';
import { TranslationServiceFactory } from './translation/TranslationServiceFactory';

let logicController: LogicController;
let taskManager: TranslationTaskManager;

let databaseManager: DatabaseManager;
let translationDB: TranslationDatabase;
let configDB: ConfigDatabase;
let configManager: ConfigManager;

export async function activate(context: vscode.ExtensionContext) {
    console.log('[VSCode Translator] 插件开始激活...');

    // 初始化数据库管理器
    console.log('[VSCode Translator] 开始初始化数据库管理器...');
    databaseManager = new DatabaseManager(context);
    try {
        await databaseManager.initialize();
        console.log('[VSCode Translator] 数据库初始化成功');
    } catch (error) {
        console.error('[VSCode Translator] 数据库初始化失败:', error);
        vscode.window.showErrorMessage('数据库初始化失败: ' + error);
        return;
    }

    // 初始化翻译数据管理器
    console.log('[VSCode Translator] 开始初始化翻译数据表...');
    translationDB = new TranslationDatabase(databaseManager);
    try {
        await translationDB.initializeTables();
        console.log('[VSCode Translator] 翻译数据表初始化成功');
        await translationDB.clearAllData();
    } catch (error) {
        console.error('[VSCode Translator] 翻译数据表初始化失败:', error);
        vscode.window.showErrorMessage('翻译数据表初始化失败: ' + error);
        return;
    }

    // 初始化配置数据管理器
    console.log('[VSCode Translator] 开始初始化配置数据表...');
    configDB = new ConfigDatabase(databaseManager);
    try {
        await configDB.initializeTables();
        console.log('[VSCode Translator] 配置数据表初始化成功');
    } catch (error) {
        console.error('[VSCode Translator] 配置数据表初始化失败:', error);
        vscode.window.showErrorMessage('配置数据表初始化失败: ' + error);
        return;
    }

    // 初始化配置管理器
    console.log('[VSCode Translator] 开始初始化配置管理器...');
    try {
        configManager = await ConfigManager.getInstance(configDB);
        console.log('[VSCode Translator] 配置管理器初始化成功');
        
        // 输出当前活动配置
        const activeConfig = configManager.getActiveConfig();
        console.log('[VSCode Translator] 当前活动配置:', activeConfig);
    } catch (error) {
        console.error('[VSCode Translator] 配置管理器初始化失败:', error);
        vscode.window.showErrorMessage('配置管理器初始化失败: ' + error);
        return;
    }

    // 初始化翻译服务工厂
    const translationServiceFactory = () => {
        const activeConfig = configManager.getActiveConfig();
        if (!activeConfig) {
            throw new Error('没有配置有效的翻译服务');
        }
        return TranslationServiceFactory.getInstance(context).createService(activeConfig);
    };

    // 初始化任务管理器
    console.log('[VSCode Translator] 开始初始化任务管理器...');
    taskManager = new TranslationTaskManager(translationServiceFactory, translationDB);
    console.log('[VSCode Translator] 任务管理器初始化成功');

    // 初始化逻辑控制器
    console.log('[VSCode Translator] 开始初始化逻辑控制器...');
    logicController = new LogicController(taskManager, translationDB,context);
    console.log('[VSCode Translator] 逻辑控制器初始化成功');

    // 注册配置相关命令
    registerConfigCommands(context, configManager, configDB);

    // 注册悬停提供器
    console.log('[VSCode Translator] 开始注册悬停提供器...');
    const hoverProviderDisposable = vscode.languages.registerHoverProvider(
        '*', // 对所有语言生效
        {
            provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
                return logicController.handleHover(document, position, token);
            }
        }
    );
    
    // 将悬停提供器添加到上下文订阅中
    context.subscriptions.push(hoverProviderDisposable);
    console.log('[VSCode Translator] 悬停提供器注册成功');

    // 注册配置变更监听器
    const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('VScodeTranslator')) {
            logicController.onConfigChange();
        }
    });
    context.subscriptions.push(configChangeListener);

    console.log('[VSCode Translator] 插件激活完成，准备就绪');
}

export async function deactivate() {
    console.log('[VSCode Translator] 插件开始停用...');

    // 释放逻辑控制器资源
    if (logicController) {
        logicController.dispose();
        console.log('[VSCode Translator] 逻辑控制器资源已释放');
    }

    // 释放配置管理器资源
    if (configManager) {
        configManager.dispose();
        console.log('[VSCode Translator] 配置管理器资源已释放');
    }

    // 插件停用时关闭数据库连接
    if (databaseManager) {
        try {
            await databaseManager.close();
            console.log('[VSCode Translator] 数据库连接已关闭');
        } catch (error) {
            console.error('[VSCode Translator] 关闭数据库连接失败:', error);
        }
    }

    console.log('[VSCode Translator] 插件停用完成');
}