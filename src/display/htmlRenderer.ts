// src/display/htmlRenderer.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class HtmlRenderer {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * 生成基础HTML页面
     */
    public generateBaseHtml(): string {
        try {
            // 获取HTML模板路径
            const templatePath = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'display', 'templates', 'main.html');
            const templateContent = fs.readFileSync(templatePath.fsPath, 'utf-8');

            // 注入样式
            const cssUri = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'display', 'styles', 'main.css');
            const cssContent = fs.readFileSync(cssUri.fsPath, 'utf-8');

            // 注入脚本
            const scriptUri = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'display', 'scripts', 'main.js');
            const scriptContent = fs.readFileSync(scriptUri.fsPath, 'utf-8');

            // 替换占位符
            return templateContent
                .replace('<style id="main-style"></style>', `<style>${cssContent}</style>`)
                .replace('<script id="main-script"></script>', `<script>${scriptContent}</script>`);
        } catch (error) {
            throw new Error(`Failed to load HTML template: ${error}`);
        }
    }

    /**
     * 生成错误页面
     */
    public generateErrorHtml(errorMessage: string): string {
        try {
            const templatePath = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'display', 'templates', 'error.html');
            let templateContent = fs.readFileSync(templatePath.fsPath, 'utf-8');
            
            // 注入样式
            const cssUri = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'display', 'styles', 'error.css');
            const cssContent = fs.readFileSync(cssUri.fsPath, 'utf-8');
            
            templateContent = templateContent.replace('${style}', cssContent);
            templateContent = templateContent.replace('${errorMessage}', errorMessage);
            
            return templateContent;
        } catch (error) {
            return `<!DOCTYPE html>
                <html>
                <body>
                    <div style="color: red;">Error: ${errorMessage}</div>
                </body>
                </html>`;
        }
    }
    /**
     * 生成加载界面HTML
     */
    public generateLoadingHtml(): string {
        return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>文档翻译</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                margin: 0;
                padding: 20px;
            }
            .loading-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
            }
            .loading-text {
                margin-top: 16px;
                font-size: 14px;
                color: var(--vscode-descriptionForeground);
            }
            .spinner {
                border: 2px solid var(--vscode-progressBar-background);
                border-top: 2px solid var(--vscode-progressBar-background);
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                border-top-color: var(--vscode-progressBar-foreground);
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="loading-container">
            <div class="spinner"></div>
            <div class="loading-text">欢迎使用本插件,开启后鼠标悬浮在类/函数上即可使用</div>
        </div>
    </body>
    </html>
        `;
    }
}