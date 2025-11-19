// src/data/database.ts
import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class DatabaseManager {
    private db: sqlite3.Database | null = null;
    private isInitialized: boolean = false;
    private dbPath: string;

    constructor(context: vscode.ExtensionContext) {
        const storagePath = context.globalStoragePath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        this.dbPath = path.join(storagePath, 'vscode_translate.db');
    }

    /**
     * 初始化数据库连接
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(new Error(`无法打开数据库: ${err.message}`));
                    return;
                }

                // 设置数据库性能优化参数
                this.setupPragmas()
                    .then(() => {
                        this.isInitialized = true;
                        resolve();
                    })
                    .catch(reject);
            });
        });
    }

    /**
     * 设置数据库性能参数
     */
    private async setupPragmas(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const pragmas = [
                'PRAGMA journal_mode = WAL;',
                'PRAGMA synchronous = NORMAL;',
                'PRAGMA cache_size = -10000;', // 10MB缓存
                'PRAGMA temp_store = MEMORY;'
            ];

            let index = 0;
            const runNextPragma = () => {
                if (index >= pragmas.length) {
                    resolve();
                    return;
                }
                this.db!.run(pragmas[index++], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        runNextPragma();
                    }
                });
            };

            runNextPragma();
        });
    }

    /**
     * 获取数据库实例
     */
    getDatabase(): sqlite3.Database {
        if (!this.db) {
            throw new Error('数据库未初始化');
        }
        return this.db;
    }

    /**
     * 检查数据库是否已初始化
     */
    isReady(): boolean {
        return this.isInitialized && this.db !== null;
    }

    /**
     * 关闭数据库连接
     */
    async close(): Promise<void> {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db!.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.isInitialized = false;
                        this.db = null;
                        resolve();
                    }
                });
            });
        }
    }
}