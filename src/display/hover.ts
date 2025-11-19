// src/display/hover.ts

import * as vscode from 'vscode';
import { TranslationData } from '../types';

export class HoverDisplay {

  public generateMarkdown(translations: TranslationData[]): vscode.MarkdownString {
    const markdownString = new vscode.MarkdownString();
    // 获取显示模式配置
    const displayMode = vscode.workspace.getConfiguration('VScodeTranslator').get<string>('displayMode', 'sidebyside');
    // 根据配置决定是否显示原文
    const showOriginalText = displayMode !== 'translatedonly';
    
    translations.forEach(translation => {
      if (translation.type === 'code') {
        // 直接显示代码块
        markdownString.appendCodeblock(translation.originalText,translation.language);
        console.log(translation.originalText);
        console.log(translation.language);
      } else {
        // 对于文本，根据配置决定是否显示原文
        if (showOriginalText) {
          markdownString.appendMarkdown(translation.originalText + '\n\n');
        }
        markdownString.appendMarkdown(translation.translatedText + '\n\n');
      }
      // markdownString.appendMarkdown('---\n\n');
    });
    
    markdownString.isTrusted = true;
    return markdownString;
  }
}