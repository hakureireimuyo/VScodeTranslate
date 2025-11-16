// src/commands/index.ts
import * as vscode from 'vscode';
import { PluginContext } from '../types';
import { registerToggleModeCommand } from './toggleMode';
import { registerTranslationCommands } from './retranslate';

export function registerAllCommands(context: PluginContext): vscode.Disposable[] {
    return [
        registerToggleModeCommand(context),
        ...registerTranslationCommands(context)
    ];
}