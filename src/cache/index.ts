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
 * 删除缓存
 */
export function deleteCache(hash: string, state: PluginState): void {
    state.translationCache.delete(hash);
    saveCacheDebounced(state);
}

/**
 * 延迟保存缓存（防抖）
 */
function saveCacheDebounced(state: PluginState): void {
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
        if (!state.globalContext) return;
        
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