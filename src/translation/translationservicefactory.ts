// src/translation/TranslationServiceFactory.ts
import { ITranslationService, TranslationConfig, TranslationRequest, TranslationResponse } from '../types';
import { OpenAITranslationService } from '../translation/openai';
import { AliyunTranslationService } from '../translation/aliyun';
import { BaiduTranslationService } from '../translation/baidu';
import * as vscode from 'vscode';

export class TranslationServiceFactory {
    private static instance: TranslationServiceFactory;
    private serviceRegistry: Map<string, new (config: TranslationConfig, context: vscode.ExtensionContext) => ITranslationService> = new Map();
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
    }

    /**
     * 创建翻译服务实例
     */
    public createService(config: TranslationConfig): ITranslationService {
        const ServiceClass = this.serviceRegistry.get(config.serviceProvider);
        if (!ServiceClass) {
            throw new Error(`不支持的翻译服务: ${config.serviceProvider}`);
        }

        const service = new ServiceClass(config, this.context);
        if (!service.validateConfig(config)) {
            throw new Error(`服务 ${config.serviceProvider} 配置验证失败`);
        }

        return service;
    }

    /**
     * 获取可用的服务列表
     */
    public getAvailableServices(): string[] {
        return Array.from(this.serviceRegistry.keys());
    }

    /**
     * 执行翻译（自动降级）
     */
    public async translateWithFallback(
        request: TranslationRequest,
        primaryService: string,
        fallbackServices: string[] = [],
        config: TranslationConfig
    ): Promise<TranslationResponse> {
        const servicesToTry = [primaryService, ...fallbackServices];
        
        for (const serviceName of servicesToTry) {
            try {
                const serviceConfig = { ...config, serviceProvider: serviceName };
                const service = this.createService(serviceConfig);
                
                return await service.translate(request);
            } catch (error) {
                if (error instanceof Error) {
                console.warn(`服务 ${serviceName} 翻译失败:`, error.message);
            } else {
                console.warn(`服务 ${serviceName} 翻译失败:`, String(error));
            }
                
                if (serviceName === servicesToTry[servicesToTry.length - 1]) {
                    throw error;
                }
            }
        }
        
        throw new Error('所有翻译服务均失败');
    }

    /**
     * 执行流式翻译
     */
    public async *translateStream(
        request: TranslationRequest,
        serviceName: string,
        config: TranslationConfig
    ): AsyncIterable<string> {
        const serviceConfig = { ...config, serviceProvider: serviceName };
        const service = this.createService(serviceConfig);
        
        yield* service.translateStream(request);
    }
}