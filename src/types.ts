// src/types.ts

/** 简化翻译请求接口 */
export interface TranslationRequest {
    originalText: string;
}

/** 翻译响应接口 */
export interface TranslationResponse {
    translatedText: string;
    service: string;
}

/** 翻译服务接口 */
export interface TranslationService {
    readonly name: string;
    
    // 非流式翻译
    translate(request: TranslationRequest): Promise<TranslationResponse>;
    
    // 流式翻译
    translateStream(request: TranslationRequest): AsyncIterable<string>;
    
    validateConfig(config: TranslationConfig): boolean;
}

/** 翻译服务配置 */
export interface TranslationConfig {
    serviceProvider: string;
    url: string;
    apiKey: string;
    secretKey?: string;
    model?: string;
    timeout?: number;
}
/**
 * 键值对配置记录
 */
export interface SimpleConfigRecord {
  key: string;
  value: string;
  updatedAt: number;
}

/**
 * 译文段落数据结构定义
 */
export interface TranslationData {
  hash: string;
  type: 'code' | 'text';
  language: string;
  originalText: string;
  translatedText: string;
  createTime: number;
  lastAccessTime: number;
  accessCount: number;
}
/**
 * 数据库统计数据结构定义
 */
export interface DataStats {
  totalRecords: number;
  totalAccessCount: number;
  oldestRecordTime: number;
  databaseSize: number;
}

/**
 * 文本切割为段落的数据结构定义
 */
export interface TextSegment {
  type: 'code' | 'text';
  content: string;
  language: string;
}

