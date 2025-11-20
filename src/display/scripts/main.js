(function() {
    const vscode = acquireVsCodeApi();
    let currentDisplayMode = 'sidebyside';
    let currentTranslations = [];
    let translationElementsMap = new Map();

    // 通知扩展Webview已准备就绪
    window.addEventListener('load', () => {
        vscode.postMessage({ command: 'ready' });
    });

    // 监听来自扩展的消息
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateData':
                handleUpdateData(message);
                break;
            case 'updateSingle':
                handleUpdateSingle(message);
                break;
            case 'showError':
                showError(message.errorMessage);
                break;
            case 'clearError':
                hideError();
                break;
        }
    });

    /**
     * 处理全量数据更新
     */
    function handleUpdateData(message) {
        try {
            currentDisplayMode = message.displayMode;
            currentTranslations = message.translationData || [];
            translationElementsMap.clear();
            
            // 重新渲染工作界面（确保界面是最新的）
            renderWorkingInterface();
            hideError();
        } catch (error) {
            console.error('处理数据更新时出错:', error);
            showError('数据更新失败: ' + error.message);
        }
    }
    /**
     * 渲染工作界面（修复版）
     */
    function renderWorkingInterface() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            console.error('找不到 content-area 元素');
            return;
        }
        
        try {
            renderAllContent();
        } catch (error) {
            console.error('渲染界面时出错:', error);
            showError('界面渲染失败，请刷新页面重试');
        }
    }


    /**
     * 处理单个翻译项更新
     */
    function handleUpdateSingle(message) {
        try {
            const translation = message.translation;
            console.log('[前端] 收到单个翻译更新:', translation.hash);
            
            // 更新内存中的数据
            const index = currentTranslations.findIndex(item => item.hash === translation.hash);
            if (index >= 0) {
                currentTranslations[index] = { ...currentTranslations[index], ...translation };
            } else {
                currentTranslations.push(translation);
            }
            
            // 局部刷新
            updateSingleTranslationElement(translation);
            hideError();
        } catch (error) {
            console.error('处理单个翻译更新时出错:', error);
            showError('翻译更新失败: ' + error.message);
        }
    }

    /**
     * 渲染所有内容
     */
    function renderAllContent() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            console.error('找不到 content-area 元素');
            return;
        }
        
        translationElementsMap.clear(); // 清空之前的元素映射
        
        if (currentDisplayMode === 'sidebyside') {
            contentArea.innerHTML = `
                <div class="toolbar">
                    <div class="toolbar-title">文档翻译</div>
                    <button class="refresh-all-btn" onclick="refreshAll()">刷新全部</button>
                </div>
                <div class="side-by-side-container">
                    <div class="original-column">
                        <h3>原文</h3>
                        <div class="original-content">${renderOriginalContent()}</div>
                    </div>
                    <div class="translated-column">
                        <h3>译文</h3>
                        <div class="translated-content">${renderTranslatedContent()}</div>
                    </div>
                </div>
            `;
        } else {
            contentArea.innerHTML = `
                <div class="toolbar">
                    <div class="toolbar-title">文档翻译</div>
                    <button class="refresh-all-btn" onclick="refreshAll()">刷新全部</button>
                </div>
                <div class="translated-only-container">
                    <h3>译文</h3>
                    <div class="translated-content">${renderTranslatedContent()}</div>
                </div>
            `;
        }
    }

    /**
     * 渲染原文内容（分段渲染，支持局部刷新）
     */
    function renderOriginalContent() {
        if (!currentTranslations || currentTranslations.length === 0) {
            return '<div class="no-content">暂无原文内容</div>';
        }
        
        let html = '';
        currentTranslations.forEach((translation, index) => {
            const elementId = `original-${translation.hash}`;
            html += `
                <div id="${elementId}" class="translation-segment" data-hash="${translation.hash}">
                    <div class="segment-content">${escapeHtml(translation.originalText)}</div>
                </div>
            `;
        });
        
        return html;
    }

    /**
     * 渲染译文内容
     */
    function renderTranslatedContent() {
        if (!currentTranslations || currentTranslations.length === 0) {
            return '<div class="no-content">暂无译文内容</div>';
        }
        
        let html = '';
        currentTranslations.forEach((translation) => {
            const elementId = `translated-${translation.hash}`;
            const translatedHtml = markdownToHtml(translation.translatedText || '翻译中...');
            
            html += `
                <div id="${elementId}" class="translation-segment" data-hash="${translation.hash}">
                    <div class="segment-content">${translatedHtml}</div>
                </div>
            `;
        });
        
        return html;
    }

    /**
     * 更新单个翻译项的DOM元素
     */
    function updateSingleTranslationElement(translation) {
        try {
            // 更新译文部分
            const translatedElement = document.getElementById(`translated-${translation.hash}`);
            if (translatedElement) {
                const translatedHtml = markdownToHtml(translation.translatedText || '翻译中...');
                const contentElement = translatedElement.querySelector('.segment-content');
                if (contentElement) {
                    contentElement.innerHTML = translatedHtml;
                    console.log('[前端] 已局部更新译文:', translation.hash);
                }
            } else {
                // 如果元素不存在，插入新元素
                insertNewTranslationElement(translation);
            }
            
            // 如果是并排模式，更新原文部分
            if (currentDisplayMode === 'sidebyside') {
                const originalElement = document.getElementById(`original-${translation.hash}`);
                if (!originalElement) {
                    insertNewOriginalElement(translation);
                }
            }
        } catch (error) {
            console.error('更新单个翻译元素时出错:', error);
            showError('更新翻译内容时出错');
        }
    }

    /**
     * 插入新的译文元素
     */
    function insertNewTranslationElement(translation) {
        const container = document.querySelector('.translated-content');
        if (!container) { 
            console.warn('未找到译文容器');
            return; 
        }
        
        try {
            const translatedHtml = markdownToHtml(translation.translatedText || '翻译中...');
            const newElement = document.createElement('div');
            newElement.id = `translated-${translation.hash}`;
            newElement.className = 'translation-segment';
            newElement.dataset.hash = translation.hash;
            newElement.innerHTML = `<div class="segment-content">${translatedHtml}</div>`;
            
            container.appendChild(newElement);
            console.log('[前端] 已插入新译文元素:', translation.hash);
        } catch (error) {
            console.error('插入译文元素时出错:', error);
        }
    }

    /**
     * 插入新的原文元素
     */
    function insertNewOriginalElement(translation) {
        const container = document.querySelector('.original-content');
        if (!container) { 
            console.warn('未找到原文容器');
            return; 
        }
        
        try {
            const newElement = document.createElement('div');
            newElement.id = `original-${translation.hash}`;
            newElement.className = 'translation-segment';
            newElement.dataset.hash = translation.hash;
            newElement.innerHTML = `<div class="segment-content">${escapeHtml(translation.originalText)}</div>`;
            
            container.appendChild(newElement);
            console.log('[前端] 已插入新原文元素:', translation.hash);
        } catch (error) {
            console.error('插入原文元素时出错:', error);
        }
    }

    /**
     * Markdown转HTML函数
     */
    /**
 * Markdown转HTML函数（改进版）
 */
function markdownToHtml(text) {
    if (!text) { return ''; }
    
    let html = escapeHtml(text);
    
    // 处理代码块（需要最先处理）
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const languageClass = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${languageClass}>${escapeHtml(code.trim())}</code></pre>`;
    });
    
    // 处理内联代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理粗体
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // 处理斜体（放在粗体之后避免冲突）
    html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
    
    // 处理链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 处理引用（独立行）
    html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // 处理水平线
    html = html.replace(/^---$/gm, '<hr>');
    
    // 处理标题
    html = html.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // 处理无序列表项
    html = html.replace(/^\s*[-*+] (.*$)/gm, '<li>$1</li>');
    
    // 处理有序列表项
    html = html.replace(/^\s*\d+\. (.*$)/gm, '<li>$1</li>');
    
    // 包装连续的列表项
    html = html.replace(/(<li>.*<\/li>)+/gs, (match) => {
        // 判断是有序还是无序列表
        const isOrdered = /^\s*\d+\./m.test(match);
        const tagName = isOrdered ? 'ol' : 'ul';
        return `<${tagName}>${match}</${tagName}>`;
    });
    
    // 将换行转换为<br>
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

    /**
     * 显示错误信息
     */
    function showError(errorMessage) {
        const errorArea = document.getElementById('error-area');
        if (errorArea) {
            errorArea.innerHTML = `
                <div class="error-message">
                    <i class="codicon codicon-error"></i>
                    <strong>错误:</strong> ${escapeHtml(errorMessage)}
                </div>
            `;
            errorArea.style.display = 'block';
        }
    }

    /**
     * 隐藏错误信息
     */
    function hideError() {
        const errorArea = document.getElementById('error-area');
        if (errorArea) {
            errorArea.style.display = 'none';
        }
    }

    /**
     * 重新翻译指定项
     */
    function refreshTranslation(hash) {
        vscode.postMessage({ 
            command: 'refreshTranslation', 
            hash: hash 
        });
    }

    /**
     * 重新翻译整个文档
     */
    function refreshAll() {
        vscode.postMessage({ 
            command: 'refreshAll' 
        });
    }
    function escapeHtml(text) {
        if (text === null) {return '';}
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 添加键盘快捷键支持
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'r') {
            event.preventDefault();
            refreshAll();
        }
    });

    // 将函数暴露给全局作用域
    window.refreshTranslation = refreshTranslation;
    window.refreshAll = refreshAll;
})();