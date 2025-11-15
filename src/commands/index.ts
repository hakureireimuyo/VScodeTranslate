// src/commands/index.ts
import * as vscode from 'vscode';
import { PluginContext } from '../types';
import { registerToggleModeCommand } from './toggleMode';
import { registerRetranslateCommand } from './retranslate';

export function registerAllCommands(context: PluginContext): vscode.Disposable[] {
    return [
        registerToggleModeCommand(context),
        registerRetranslateCommand(context)
    ];
}