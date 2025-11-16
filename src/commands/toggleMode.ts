// src/commands/toggleMode.ts
import * as vscode from 'vscode';
import { PluginContext } from '../types';

export function registerToggleModeCommand(context: PluginContext): vscode.Disposable {
    return vscode.commands.registerCommand('VScodeTranslator.toggleMode', () => {
        context.state.showTranslated = !context.state.showTranslated;
        
        if (context.state.globalContext) {
            context.state.globalContext.globalState.update(
                'showTranslated', 
                context.state.showTranslated
            );
        }
        
        vscode.window.showInformationMessage(
            `🐾 Hover 模式已切换为：${context.state.showTranslated ? '显示译文' : '显示原文'}`
        );
    });
}

