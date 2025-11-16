// src/markdown/MarkdownRenderer.ts
import * as vscode from 'vscode';
import { PluginContext, ParagraphTranslation } from '../types';
import { DisplayMode } from '../constants';
import { TranslationServiceFactory } from '../translation/TranslationServiceFactory';
import { setCachedTranslation } from '../cache';

/**
 * 构建Markdown内容 - 按段落处理
 */
export async function buildMarkdownContent(
    paragraphTranslations: ParagraphTranslation[],
    encodedText: string,
    context: PluginContext,
    factory: TranslationServiceFactory
): Promise<vscode.MarkdownString> {
    console.log(`🐾 buildMarkdownContent: 开始构建Markdown内容，段落数: ${paragraphTranslations.length}`);
    
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    // 关键修复：启用主题图标支持
    md.supportThemeIcons = true;
    
    const config = vscode.workspace.getConfiguration('VScodeTranslator');
    const isEnabled = config.get<boolean>('enabled', true);
    const displayMode = context.displayMode || DisplayMode.SideBySide;
    
    console.log(`🐾 buildMarkdownContent: 构建参数 - isEnabled: ${isEnabled}, displayMode: ${displayMode}`);

    // 如果未开启翻译，只显示原文
    if (!isEnabled) {
        console.log('🐾 buildMarkdownContent: 插件未启用，只显示原文');
        for (let i = 0; i < paragraphTranslations.length; i++) {
            const paragraph = paragraphTranslations[i];
            if (i > 0) {
                md.appendMarkdown('\n\n');
            }
            md.appendMarkdown(escapeMarkdown(paragraph.original));
        }
        return md;
    }
    
    // 根据显示模式处理内容
    switch (displayMode) {
        case DisplayMode.SideBySide:
            console.log('🐾 buildMarkdownContent: 使用对照模式渲染');
            await renderSideBySideMode(md, paragraphTranslations, context, factory);
            break;
            
        case DisplayMode.TranslatedOnly:
            console.log('🐾 buildMarkdownContent: 使用仅译文模式渲染');
            await renderTranslatedOnlyMode(md, paragraphTranslations, context, factory);
            break;
            
        default:
            console.log('🐾 buildMarkdownContent: 使用默认对照模式渲染');
            await renderSideBySideMode(md, paragraphTranslations, context, factory);
            break;
    }

    // 启动串行翻译队列（只在有未翻译段落时）
    startSerialTranslation(paragraphTranslations, context, factory);
    
    console.log('🐾 buildMarkdownContent: Markdown内容构建完成');
    return md;
}

/**
 * 渲染对照模式：原文-译文交替显示
 */
async function renderSideBySideMode(
    md: vscode.MarkdownString,
    paragraphTranslations: ParagraphTranslation[],
    context: PluginContext,
    factory: TranslationServiceFactory
): Promise<void> {
    console.log(`🐾 renderSideBySideMode: 开始渲染对照模式，段落数: ${paragraphTranslations.length}`);
    
    for (let i = 0; i < paragraphTranslations.length; i++) {
        const paragraph = paragraphTranslations[i];
        console.log(`🐾 renderSideBySideMode: 渲染段落 ${i+1}/${paragraphTranslations.length} - Hash: ${paragraph.hash.substring(0, 8)}...`);
        
        // 添加段落分隔（非第一个段落）
        if (i > 0) {
            md.appendMarkdown('\n\n---\n\n');
        }
        
        // 处理空行
        if (paragraph.original.trim() === '') {
            md.appendMarkdown('&nbsp;');
            continue;
        }
        
        // 显示原文
        md.appendMarkdown('**🌍 原文**:\n\n');
        md.appendMarkdown('```\n' + escapeMarkdown(paragraph.original) + '\n```\n\n');
        
        // 显示译文
        md.appendMarkdown('**🔤 译文**:\n\n');
        await renderTranslatedContent(md, paragraph, context, factory);
    }
    
    console.log('🐾 renderSideBySideMode: 对照模式渲染完成');
}

/**
 * 渲染只显示译文模式
 */
async function renderTranslatedOnlyMode(
    md: vscode.MarkdownString,
    paragraphTranslations: ParagraphTranslation[],
    context: PluginContext,
    factory: TranslationServiceFactory
): Promise<void> {
    console.log(`🐾 renderTranslatedOnlyMode: 开始渲染仅译文模式，段落数: ${paragraphTranslations.length}`);
    
    for (let i = 0; i < paragraphTranslations.length; i++) {
        const paragraph = paragraphTranslations[i];
        console.log(`🐾 renderTranslatedOnlyMode: 渲染段落 ${i+1}/${paragraphTranslations.length} - Hash: ${paragraph.hash.substring(0, 8)}...`);
        
        // 添加段落分隔（非第一个段落）
        if (i > 0) {
            md.appendMarkdown('\n\n');
        }
        
        // 处理空行
        if (paragraph.original.trim() === '') {
            md.appendMarkdown('&nbsp;');
            continue;
        }
        
        // 只显示译文内容（不显示原文）
        await renderTranslatedContent(md, paragraph, context, factory);
    }
    
    console.log('🐾 renderTranslatedOnlyMode: 仅译文模式渲染完成');
}

/**
 * 清理翻译内容中的HTML注释和原始标记
 */
function cleanTranslatedContent(content: string): string {
    if (!content) {return '';}
    
    // 移除所有可能干扰Markdown渲染的原始标记
    return content
        .replace(/<!--\s*moduleHash:\w+\s*-->/g, '')
        .replace(/moduleHash:\w+/g, '')
        .replace(/<!--.*?-->/gs, '')
        .trim();
}
/**
 * 渲染译文内容
 */
async function renderTranslatedContent(
    md: vscode.MarkdownString,
    paragraph: ParagraphTranslation,
    context: PluginContext,
    factory: TranslationServiceFactory
): Promise<void> {
    console.log(`🐾 renderTranslatedContent: 渲染译文内容 - Hash: ${paragraph.hash.substring(0, 8)}..., ` +
               `HasTranslation: ${!!paragraph.translated}, HasError: ${!!paragraph.error}, IsTranslating: ${paragraph.isTranslating}`);
               
    if (paragraph.translated) {
        // // 显示已翻译内容（先清理HTML注释）
        console.log(`🐾 renderTranslatedContent: 显示已翻译内容`);
        // const cleanedContent = cleanTranslatedContent(paragraph.translated);
        md.appendMarkdown(paragraph.translated);
        
        // 修改：使用正确的Codicon语法，确保有适当的间距
        //const commandUri = `command:VScodeTranslator.retranslateParagraph?${encodeURIComponent(JSON.stringify([paragraph.hash]))}`;
        //md.appendMarkdown(`  [$(refresh)](${commandUri} "重新翻译此段落")`);
        
    } else if (paragraph.error) {
        // 显示错误信息
        console.log(`🐾 renderTranslatedContent: 显示错误信息`);
        md.appendMarkdown(`❌ **翻译错误**: ${paragraph.error}`);
        
        // 修改：使用正确的Codicon语法
        // const commandUri = `command:VScodeTranslator.retranslateParagraph?${encodeURIComponent(JSON.stringify([paragraph.hash]))}`;
        // md.appendMarkdown(`  [$(refresh)](${commandUri} "重试")`);
        
    } else if (!paragraph.isTranslating && !context.state.translating.has(paragraph.hash)) {
        // 只有在没有正在翻译且之前没有翻译过的情况下才显示翻译中状态并触发翻译
        console.log(`🐾 renderTranslatedContent: 显示翻译中状态并启动翻译`);
        
        // 修改：使用正确的旋转Codicon图标
        md.appendMarkdown('$(sync~spin) 翻译中...');
        
        // 启动段落翻译
        console.log(`🐾 renderTranslatedContent: 启动段落翻译`);
        startParagraphTranslation(paragraph, context, factory);
        
    } else if (paragraph.isTranslating || context.state.translating.has(paragraph.hash)) {
        // 显示翻译中状态但不触发新的翻译
        console.log(`🐾 renderTranslatedContent: 段落已在翻译中`);
        
        // 修改：使用正确的旋转Codicon图标
        md.appendMarkdown('$(sync~spin) **翻译中...**');
    }
}

/**
 * 启动单个段落的翻译任务（用于延迟触发）
 */
function startParagraphTranslation(
    paragraph: ParagraphTranslation,
    context: PluginContext,
    factory: TranslationServiceFactory
): void {
    console.log(`🐾 startParagraphTranslation: 启动段落翻译任务 - Hash: ${paragraph.hash.substring(0, 8)}...`);

    // 添加到翻译队列并标记为正在翻译
    translationQueue.pendingParagraphs.push(paragraph);
    paragraph.isTranslating = true;
    context.state.translating.add(paragraph.hash);

    // 如果队列未处理，则开始处理
    if (!translationQueue.isProcessing) {
        processTranslationQueue(context, factory);
    }
}

async function translateSingleParagraph(
    text: string,
    hash: string,
    context: PluginContext,
    factory: TranslationServiceFactory
): Promise<string> {
    console.log(`🐾 translateSingleParagraph: 开始翻译单个段落 - Hash: ${hash.substring(0, 8)}..., 文本长度: ${text.length}`);
    
    try {
        const config = context.config;
        console.log(`🐾 translateSingleParagraph: 使用翻译配置 - ServiceProvider: ${config.serviceProvider}, Model: ${config.model}`);
        
        const request = {
            originalText: text
        };

        const result = await factory.translate(
            request,
            config.serviceProvider,
            config
        );
        
        console.log(`🐾 translateSingleParagraph: 翻译完成 - Hash: ${hash.substring(0, 8)}..., 结果长度: ${result.translatedText.length}`);
        return result.translatedText;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`🐾 translateSingleParagraph: 翻译失败 - Hash: ${hash.substring(0, 8)}...`, error);
        throw new Error(`段落翻译失败: ${errorMessage}`);
    }
}

/**
 * 触发悬浮提示刷新
 */
let refreshCooldown = false;
let refreshCount = 0;
const MAX_REFRESH_COUNT = 10; // 最大刷新次数限制

/**
 * 触发悬浮提示刷新
 */
function triggerHoverRefresh(): void {
    console.log('🐾 triggerHoverRefresh: 触发悬浮提示刷新');
    
    // 冷却期保护
    if (refreshCooldown) {
        console.log('🐾 triggerHoverRefresh: 处于冷却期，跳过刷新');
        return;
    }
    
    // 刷新次数限制
    if (refreshCount >= MAX_REFRESH_COUNT) {
        console.log('🐾 triggerHoverRefresh: 达到最大刷新次数限制，跳过刷新');
        return;
    }
    
    refreshCount++;
    
    // 设置冷却期
    refreshCooldown = true;
    
    // 使用防抖机制，避免频繁刷新
    if (triggerHoverRefresh.timeoutId) {
        console.log('🐾 triggerHoverRefresh: 清除之前的刷新定时器');
        clearTimeout(triggerHoverRefresh.timeoutId);
    }
    
    triggerHoverRefresh.timeoutId = setTimeout(() => {
        console.log('🐾 triggerHoverRefresh: 执行刷新命令');
        // 执行刷新命令
        vscode.commands.executeCommand('editor.action.showHover')
        .then(() => {
            console.log('🐾 triggerHoverRefresh: 悬浮提示刷新成功');
        }, (error) => {
            console.error('🐾 triggerHoverRefresh: 刷新悬浮提示失败', error);
        })
        .then(() => {
            // 模拟 finally 行为
            setTimeout(() => {
                refreshCooldown = false;
                console.log('🐾 triggerHoverRefresh: 冷却期结束');
            }, 1000); // 1秒冷却期
        });
    }, 500); // 500ms 防抖延迟
    
    // 重置计数器定时器
    setTimeout(() => {
        refreshCount = 0;
        console.log('🐾 triggerHoverRefresh: 刷新计数器重置');
    }, 5000); // 5秒后重置计数器
}

/**
 * 转义Markdown特殊字符
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// 全局翻译队列状态
interface TranslationQueue {
    isProcessing: boolean;
    pendingParagraphs: ParagraphTranslation[];
}

// 全局翻译队列
const translationQueue: TranslationQueue = {
    isProcessing: false,
    pendingParagraphs: []
};

/**
 * 启动串行翻译队列
 */
function startSerialTranslation(
    paragraphTranslations: ParagraphTranslation[],
    context: PluginContext,
    factory: TranslationServiceFactory
): void {
    console.log('🐾 startSerialTranslation: 检查翻译队列');
    
    // 过滤出需要翻译的段落（没有翻译结果、没有错误、不在翻译中）
    const paragraphsToTranslate = paragraphTranslations.filter(p => 
        p.original.trim() !== '' && 
        !p.translated && 
        !p.error && 
        !p.isTranslating &&
        !context.state.translating.has(p.hash)
    );
    
    if (paragraphsToTranslate.length === 0) {
        console.log('🐾 startSerialTranslation: 没有需要翻译的段落');
        return;
    }
    
    console.log(`🐾 startSerialTranslation: 找到 ${paragraphsToTranslate.length} 个需要翻译的段落`);
    
    // 将需要翻译的段落添加到队列
    translationQueue.pendingParagraphs.push(...paragraphsToTranslate);
    
    // 标记这些段落为翻译中状态（但还没有开始实际翻译）
    paragraphsToTranslate.forEach(p => {
        p.isTranslating = true;
        context.state.translating.add(p.hash);
    });
    
    // 如果队列没有在处理，开始处理
    if (!translationQueue.isProcessing) {
        processTranslationQueue(context, factory);
    }
}

/**
 * 处理翻译队列（串行）
 */
async function processTranslationQueue(
    context: PluginContext,
    factory: TranslationServiceFactory
): Promise<void> {
    if (translationQueue.isProcessing || translationQueue.pendingParagraphs.length === 0) {
        return;
    }
    
    translationQueue.isProcessing = true;
    console.log(`🐾 processTranslationQueue: 开始处理队列，剩余 ${translationQueue.pendingParagraphs.length} 个段落`);
    
    while (translationQueue.pendingParagraphs.length > 0) {
        const paragraph = translationQueue.pendingParagraphs[0]; // 总是取第一个
        
        console.log(`🐾 processTranslationQueue: 开始翻译段落 - Hash: ${paragraph.hash.substring(0, 8)}...`);
        
        try {
            // 执行翻译
            const translatedText = await translateSingleParagraph(
                paragraph.original, 
                paragraph.hash, 
                context, 
                factory
            );
            
            console.log(`🐾 processTranslationQueue: 段落翻译成功 - Hash: ${paragraph.hash.substring(0, 8)}...`);
            
            // 更新段落状态
            paragraph.isTranslating = false;
            paragraph.translated = translatedText;
            context.state.translating.delete(paragraph.hash);
            setCachedTranslation(paragraph.hash, paragraph.original, translatedText, context.state);
            
            // 触发悬浮窗口刷新
            triggerHoverRefresh();
            
        } catch (error) {
            console.error(`🐾 processTranslationQueue: 段落翻译失败 - Hash: ${paragraph.hash.substring(0, 8)}...`, error);
            
            // 更新错误状态
            paragraph.isTranslating = false;
            paragraph.error = error instanceof Error ? error.message : String(error);
            context.state.translating.delete(paragraph.hash);
            
            // 触发悬浮窗口刷新显示错误
            triggerHoverRefresh();
        }
        
        // 从队列中移除已处理的段落（无论成功还是失败）
        translationQueue.pendingParagraphs.shift();
        
        // 添加短暂延迟，避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    translationQueue.isProcessing = false;
    console.log('🐾 processTranslationQueue: 队列处理完成');
}