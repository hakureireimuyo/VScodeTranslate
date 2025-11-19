// src/translation/TranslationServiceFactory.ts
import { TranslationService, TranslationConfig, TranslationRequest, TranslationResponse } from '../types';
import { OpenAITranslationService } from './openai';
import { AliyunTranslationService } from './aliyun';
import { BaiduTranslationService } from './baidu';
import {ZhipuTranslationService} from './zhipu';
import * as vscode from 'vscode';

export class TranslationServiceFactory {
    private static instance: TranslationServiceFactory;
    private serviceRegistry: Map<string, new (config: TranslationConfig, context: vscode.ExtensionContext) => TranslationService> = new Map();
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeRegistry();
    }

    public static getInstance(context?: vscode.ExtensionContext): TranslationServiceFactory {
        if (!TranslationServiceFactory.instance && context) {
            TranslationServiceFactory.instance = new TranslationServiceFactory(context);
        }
        return TranslationServiceFactory.instance;
    }

    private initializeRegistry(): void {
        this.serviceRegistry.set('openai', OpenAITranslationService);
        this.serviceRegistry.set('aliyun', AliyunTranslationService);
        this.serviceRegistry.set('baidu', BaiduTranslationService);
        this.serviceRegistry.set('zhipu', ZhipuTranslationService);
        console.log('🐾 TranslationServiceFactory: 服务注册表初始化完成，已注册服务:', Array.from(this.serviceRegistry.keys()));
    }

    /**
     * 创建翻译服务实例
     */
    public createService(config: TranslationConfig): TranslationService {
        // console.log(`🐾 TranslationServiceFactory: 正在创建服务实例 - ${config.serviceProvider}`);
        
        const ServiceClass = this.serviceRegistry.get(config.serviceProvider);
        if (!ServiceClass) {
            const errorMsg = `不支持的翻译服务: ${config.serviceProvider}`;
            console.error(`🐾 TranslationServiceFactory: ${errorMsg}`);
            throw new Error(errorMsg);
        }

        try {
            const service = new ServiceClass(config, this.context);
            // console.log(`🐾 TranslationServiceFactory: 成功创建服务实例 - ${config.serviceProvider}`);
            
            if (!service.validateConfig(config)) {
                const errorMsg = `服务 ${config.serviceProvider} 配置验证失败`;
                console.error(`🐾 TranslationServiceFactory: ${errorMsg}`);
                throw new Error(errorMsg);
            }
            
            // console.log(`🐾 TranslationServiceFactory: 服务配置验证通过 - ${config.serviceProvider}`);
            return service;
        } catch (error) {
            console.error(`🐾 TranslationServiceFactory: 创建服务实例失败 - ${config.serviceProvider}`, error);
            throw error;
        }
    }

    /**
     * 获取可用的服务列表
     */
    public getAvailableServices(): string[] {
        const services = Array.from(this.serviceRegistry.keys());
        console.log(`🐾 TranslationServiceFactory: 获取可用服务列表`, services);
        return services;
    }

    /**
     * 执行翻译（仅使用当前选择的服务，不进行降级）
     */
    public async translate(
        request: TranslationRequest,
        serviceName: string,
        config: TranslationConfig
    ): Promise<TranslationResponse> {
        // console.log(`🐾 TranslationServiceFactory: 开始翻译请求`, {
        //     serviceName: serviceName,
        //     textLength: request.originalText.length,
        //     textPreview: request.originalText.substring(0, 50) + (request.originalText.length > 50 ? '...' : '')
        // });
        
        try {
            const serviceConfig = { ...config, serviceProvider: serviceName };
            const service = this.createService(serviceConfig);
            
            // console.log(`🐾 TranslationServiceFactory: 调用服务翻译方法 - ${serviceName}`);
            const result = await service.translate(request);
            
            // console.log(`🐾 TranslationServiceFactory: 翻译完成 - ${serviceName}`, {
            //     translatedTextLength: result.translatedText.length,
            //     translatedTextPreview: result.translatedText.substring(0, 50) + (result.translatedText.length > 50 ? '...' : '')
            // });
            
            return result;
        } catch (error) {
            if (error instanceof Error) {
                console.error(`🐾 TranslationServiceFactory: 服务 ${serviceName} 翻译失败:`, error.message, error.stack);
                throw new Error(`翻译服务 ${serviceName} 失败: ${error.message}`);
            } else {
                console.error(`🐾 TranslationServiceFactory: 服务 ${serviceName} 翻译失败:`, String(error));
                throw new Error(`翻译服务 ${serviceName} 失败: ${String(error)}`);
            }
        }
    }

    /**
     * 执行流式翻译（仅使用当前选择的服务，不进行降级）
     */
    public async *translateStream(
        request: TranslationRequest,
        serviceName: string,
        config: TranslationConfig
    ): AsyncIterable<string> {
        // console.log(`🐾 TranslationServiceFactory: 开始流式翻译请求`, {
        //     serviceName: serviceName,
        //     textLength: request.originalText.length,
        //     textPreview: request.originalText.substring(0, 50) + (request.originalText.length > 50 ? '...' : '')
        // });
        
        try {
            const serviceConfig = { ...config, serviceProvider: serviceName };
            const service = this.createService(serviceConfig);
            
            // console.log(`🐾 TranslationServiceFactory: 调用服务流式翻译方法 - ${serviceName}`);
            let chunkCount = 0;
            
            for await (const chunk of service.translateStream(request)) {
                chunkCount++;
                // console.log(`🐾 TranslationServiceFactory: 接收到流式翻译数据块 ${chunkCount}`, {
                //     chunkLength: chunk.length,
                //     chunkPreview: chunk.substring(0, 50) + (chunk.length > 50 ? '...' : '')
                // });
                yield chunk;
            }
            
            // console.log(`🐾 TranslationServiceFactory: 流式翻译完成 - ${serviceName}`, {
            //     totalChunks: chunkCount
            // });
        } catch (error) {
            if (error instanceof Error) {
                console.error(`🐾 TranslationServiceFactory: 流式翻译服务 ${serviceName} 失败:`, error.message, error.stack);
                throw new Error(`流式翻译服务 ${serviceName} 失败: ${error.message}`);
            } else {
                console.error(`🐾 TranslationServiceFactory: 流式翻译服务 ${serviceName} 失败:`, String(error));
                throw new Error(`流式翻译服务 ${serviceName} 失败: ${String(error)}`);
            }
        }
    }
}