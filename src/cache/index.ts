import * as vscode from 'vscode';
import { CacheEntry, PluginState } from '../types';
import { CACHE_EXPIRE_TIME, DEBOUNCE_DELAY } from '../constants';

/** 防抖保存定时器 */
let saveTimeout: NodeJS.Timeout | null = null;

/**
 * 初始化缓存
 */
export function initializeCache(context: vscode.ExtensionContext, state: PluginState): void {
    const savedCache = context.globalState.get<Record<string, CacheEntry>>('translationCache', {});
    state.translationCache = new Map(Object.entries(savedCache));
    state.globalContext = context;
    state.showTranslated = context.globalState.get('showTranslated', true);
}

/**
 * 检查缓存是否有效
 */
export function isValidCache(entry: CacheEntry): boolean {
    return Date.now() - entry.time < CACHE_EXPIRE_TIME;
}

/**
 * 获取缓存内容
 */
export function getCachedTranslation(hash: string, state: PluginState): string | null {
    const cached = state.translationCache.get(hash);
    return cached && isValidCache(cached) ? cached.text : null;
}

/**
 * 获取多个缓存内容（支持前缀匹配，用于行级缓存）
 */
export function getMultipleCachedTranslations(prefix: string, state: PluginState): Map<string, string> {
    const results = new Map<string, string>();
    for (const [key, entry] of state.translationCache.entries()) {
        if (key.startsWith(prefix) && isValidCache(entry)) {
            results.set(key, entry.text);
        }
    }
    return results;
}

/**
 * 设置缓存内容
 */
export function setCachedTranslation(
    hash: string, 
    original: string, 
    text: string, 
    state: PluginState
): void {
    state.translationCache.set(hash, {
        original,
        text,
        time: Date.now()
    });
    saveCacheDebounced(state);
}

/**
 * 批量设置缓存内容
 */
export function setMultipleCachedTranslations(
    entries: { hash: string; original: string; text: string }[],
    state: PluginState
): void {
    for (const { hash, original, text } of entries) {
        state.translationCache.set(hash, {
            original,
            text,
            time: Date.now()
        });
    }
    saveCacheDebounced(state);
}

/**
 * 删除缓存
 */
export function deleteCache(hash: string, state: PluginState): void {
    state.translationCache.delete(hash);
    saveCacheDebounced(state);
}

/**
 * 批量删除缓存（支持前缀匹配，用于清理行级缓存）
 */
export function deleteMultipleCaches(prefix: string, state: PluginState): void {
    for (const key of state.translationCache.keys()) {
        if (key.startsWith(prefix)) {
            state.translationCache.delete(key);
        }
    }
    saveCacheDebounced(state);
}

/**
 * 清理过期缓存
 */
export function cleanupExpiredCache(state: PluginState): number {
    let count = 0;
    for (const [key, entry] of state.translationCache.entries()) {
        if (!isValidCache(entry)) {
            state.translationCache.delete(key);
            count++;
        }
    }
    if (count > 0) {
        saveCacheDebounced(state);
    }
    return count;
}

/**
 * 延迟保存缓存（防抖）
 */
function saveCacheDebounced(state: PluginState): void {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
        
    saveTimeout = setTimeout(async () => {
        if (!state.globalContext) {
            return;
        }
        
        await state.globalContext.globalState.update(
            'translationCache', 
            Object.fromEntries(state.translationCache)
        );
    }, DEBOUNCE_DELAY);
}

/**
 * 立即保存缓存（用于插件停用时）
 */
export function flushCache(state: PluginState): void {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    
    if (state.globalContext) {
        state.globalContext.globalState.update(
            'translationCache', 
            Object.fromEntries(state.translationCache)
        );
    }
}


/**
 * 清空所有缓存（用于开发测试）
 */
export function clearAllCache(state: PluginState): void {
    // 1. 清空内存中的缓存Map
    state.translationCache.clear();
    
    // 2. 取消挂起的保存操作
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    
    // 3. 清空持久化存储
    if (state.globalContext) {
        // 立即清空全局状态中的缓存数据
        state.globalContext.globalState.update('translationCache', {});
        
        // 可选：重置其他相关状态
        state.globalContext.globalState.update('showTranslated', true);
        state.showTranslated = true;
    }
    
    console.log('✅ 所有缓存已清空');
}

/**
 * 批量清空指定前缀的缓存（增强版）
 */
export function clearCacheByPrefix(prefix: string, state: PluginState): number {
    let count = 0;
    
    for (const key of state.translationCache.keys()) {
        if (key.startsWith(prefix)) {
            state.translationCache.delete(key);
            count++;
        }
    }
    
    if (count > 0) {
        console.log(`✅ 已清空 ${count} 个以 "${prefix}" 开头的缓存`);
        saveCacheDebounced(state);
    }
    
    return count;
}

/**
 * 获取缓存统计信息（增强版）
 */
export function getCacheStats(state: PluginState): { 
    total: number; 
    expired: number; 
    valid: number;
} {
    let expired = 0;
    let valid = 0;
    
    for (const entry of state.translationCache.values()) {
        if (isValidCache(entry)) {
            valid++;
        } else {
            expired++;
        }
    }
    
    return {
        total: state.translationCache.size,
        expired,
        valid
    };
}