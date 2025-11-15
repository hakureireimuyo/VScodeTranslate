// src/commands/retranslate.ts
import * as vscode from 'vscode';
import { PluginContext } from '../types';
import { retranslateText } from '../translation/translator';

export function registerRetranslateCommand(context: PluginContext): vscode.Disposable {
    return vscode.commands.registerCommand('hoverTranslator.retranslate', async (encodedText: string) => {
        if (!encodedText) return;
        
        const originalText = Buffer.from(encodedText, 'base64').toString('utf-8');
        await retranslateText(originalText, context);
        
        vscode.commands.executeCommand('editor.action.showHover').catch(() => {});
    });
}
