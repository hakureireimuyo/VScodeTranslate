// src/data/data.ts
import * as sqlite3 from 'sqlite3';
import * as crypto from 'crypto';
import { DataStats } from '../types';
import { DatabaseManager } from './database';
import { TranslationData } from '../types';

export class TranslationDatabase {
    private db: sqlite3.Database | null = null;
    private isInitialized: boolean = false;

    constructor(databaseManager: DatabaseManager) {
        if (databaseManager.isReady()) {
            this.db = databaseManager.getDatabase();
            this.isInitialized = true;
        }
    }

    // 修改初始化表结构方法
    async initializeTables(): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('数据管理器未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            // 修改创建翻译数据表的SQL，添加type字段
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS translation_data (
                    hash TEXT PRIMARY KEY,
                    type TEXT NOT NULL DEFAULT 'text',
                    language TEXT NOT NULL DEFAULT '',
                    original_text TEXT NOT NULL,
                    translated_text TEXT NOT NULL,
                    create_time INTEGER NOT NULL,
                    last_access_time INTEGER NOT NULL,
                    access_count INTEGER DEFAULT 0
                )
            `;

            this.db.run(createTableSQL, (err) => {
                if (err) {
                    reject(new Error(`创建翻译数据表失败: ${err.message}`));
                    return;
                }

                // 创建索引
                this.createIndexes()
                    .then(resolve)
                    .catch(reject);
            });
        });
    }

    // 创建索引
    private async createIndexes(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_hash ON translation_data (hash)',
                'CREATE INDEX IF NOT EXISTS idx_last_access ON translation_data (last_access_time)',
                'CREATE INDEX IF NOT EXISTS idx_create_time ON translation_data (create_time)'
            ];

            let completed = 0;
            const total = indexes.length;

            if (total === 0) {
                resolve();
                return;
            }

            indexes.forEach(sql => {
                this.db!.run(sql, (err) => {
                    completed++;
                    if (err) {
                        console.warn(`创建索引时警告: ${err.message}`);
                    }
                    
                    if (completed === total) {
                        resolve();
                    }
                });
            });
        });
    }

    // 生成文本哈希
    generateHash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    // 存储翻译结果
    async setTranslation(
        originalText: string, 
        translatedText: string, 
        type: 'code' | 'text' = 'text',
        language: string = ''
    ): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('缓存管理器未初始化');
        }
        console.log('当前保存的type和language:', type,language);
        const hash = this.generateHash(originalText);
        const now = Date.now();

        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO translation_data 
                (hash, type, language, original_text, translated_text, create_time, last_access_time, access_count)
                VALUES (?, ?, ?, ?, ?, COALESCE((SELECT create_time FROM translation_data WHERE hash = ?), ?), ?, 
                        COALESCE((SELECT access_count + 1 FROM translation_data WHERE hash = ?), 1))
            `;
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            this.db.run(sql, [
                hash, type, language, originalText, translatedText, hash, now, now, hash
            ], function(err) {
                if (err) {
                    reject(new Error(`存储翻译失败: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }

    // 获取翻译结果
    async getTranslation(originalText: string): Promise<string | null> {
        if (!this.isInitialized) {
            throw new Error('缓存管理器未初始化');
        }

        const hash = this.generateHash(originalText);

        return new Promise((resolve, reject) => {
            // 先更新访问时间和计数
            const updateSQL = `
                UPDATE translation_data 
                SET last_access_time = ?, access_count = access_count + 1 
                WHERE hash = ?
            `;
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }
            this.db.run(updateSQL, [Date.now(), hash], (updateErr) => {
                if (updateErr) {
                    reject(new Error(`更新访问记录失败: ${updateErr.message}`));
                    return;
                }

                // 然后查询翻译结果
                const selectSQL = `SELECT translated_text FROM translation_data WHERE hash = ?`;
                
                if (!this.db) {
                    return reject(new Error('数据库实例未定义'));
                }
                this.db.get(selectSQL, [hash], (selectErr, row: any) => {
                    if (selectErr) {
                        reject(new Error(`查询翻译失败: ${selectErr.message}`));
                        return;
                    }

                    if (row) {
                        resolve(row.translated_text);
                    } else {
                        resolve(null);
                    }
                });
            });
        });
    }

    // 批量获取翻译结果
    async getTranslationsBatch(originalTexts: string[]): Promise<Map<string, string>> {
        if (!this.isInitialized) {
            throw new Error('缓存管理器未初始化');
        }

        const results = new Map<string, string>();
        const now = Date.now();
        const hashes = originalTexts.map(text => this.generateHash(text));

        // 批量更新访问时间
        const updatePlaceholders = hashes.map(() => '?').join(',');
        const updateSQL = `
            UPDATE translation_data 
            SET last_access_time = ?, access_count = access_count + 1 
            WHERE hash IN (${updatePlaceholders})
        `;
        
        await new Promise<void>((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }
            this.db.run(updateSQL, [now, ...hashes], (err) => {
                if (err) {reject(err);}
                else {resolve();}
            });
        });

        // 批量查询
        const selectPlaceholders = hashes.map(() => '?').join(',');
        const selectSQL = `
            SELECT hash, translated_text FROM translation_data 
            WHERE hash IN (${selectPlaceholders})
        `;

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }
            this.db.all(selectSQL, hashes, (err, rows: any[]) => {
                if (err) {
                    reject(new Error(`批量查询失败: ${err.message}`));
                    return;
                }

                // 将结果转换为Map（哈希 -> 翻译文本）
                const hashToTextMap = new Map<string, string>();
                rows.forEach(row => {
                    hashToTextMap.set(row.hash, row.translated_text);
                });

                // 将哈希映射回原始文本
                originalTexts.forEach((text, index) => {
                    const hash = hashes[index];
                    const translated = hashToTextMap.get(hash);
                    if (translated) {
                        results.set(text, translated);
                    }
                });

                resolve(results);
            });
        });
    }

    // 清理过期缓存（60天以上未访问）
    async cleanupExpiredData(retentionDays: number = 60): Promise<number> {
        if (!this.isInitialized) {
            throw new Error('缓存管理器未初始化');
        }

        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM translation_data WHERE last_access_time < ?`;
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }
            this.db.run(sql, [cutoffTime], function(err) {
                if (err) {
                    reject(new Error(`清理缓存失败: ${err.message}`));
                    return;
                }
                resolve(this.changes); // 返回删除的记录数
            });
        });
    }

    // 通过哈希值查找翻译数据
    async getByHash(hash: string): Promise<TranslationData | null> {
        if (!this.isInitialized) {
            throw new Error('缓存管理器未初始化');
        }

        return new Promise((resolve, reject) => {
            // 先更新访问时间和计数
            const updateSQL = `
                UPDATE translation_data 
                SET last_access_time = ?, access_count = access_count + 1 
                WHERE hash = ?
            `;
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }
            this.db.run(updateSQL, [Date.now(), hash], (updateErr) => {
                if (updateErr) {
                    reject(new Error(`更新访问记录失败: ${updateErr.message}`));
                    return;
                }

                // 然后查询翻译结果
                const selectSQL = `SELECT original_text, translated_text,type, language, create_time, last_access_time, access_count 
                        FROM translation_data WHERE hash = ?`;
                
                if (!this.db) {
                    return reject(new Error('数据库实例未定义'));
                }
                
                this.db.get(selectSQL, [hash], (selectErr, row: any) => {
                    if (selectErr) {
                        reject(new Error(`通过哈希查询翻译失败: ${selectErr.message}`));
                        return;
                    }

                    if (row) {
                        resolve({
                            hash: hash,
                            type: row.type || 'text',
                            language: row.language || '',
                            originalText: row.original_text,
                            translatedText: row.translated_text,
                            createTime: row.create_time,
                            lastAccessTime: row.last_access_time,
                            accessCount: row.access_count
                        });
                    } else {
                        resolve(null);
                    }
                });
            });
        });
    }

    // 获取缓存统计信息
    async getDataStats(): Promise<DataStats> {
        if (!this.isInitialized) {
            throw new Error('缓存管理器未初始化');
        }

        return new Promise((resolve, reject) => {
            const statsQueries = [
                'SELECT COUNT(*) as count FROM translation_data',
                'SELECT SUM(access_count) as total_access FROM translation_data',
                'SELECT MIN(create_time) as oldest FROM translation_data',
                // 增加获取数据库大小的 SQL（假设 SQLite 数据库文件路径已知）
                'PRAGMA page_count',
                'PRAGMA page_size'
            ];

            Promise.all(statsQueries.map(query => 
                new Promise<any>((res, rej) => {
                    if (!this.db) {
                        return rej(new Error('数据库实例未定义'));
                    }
                    this.db.get(query, (err, row: any) => {
                        if (err) {rej(err);}
                        else {res(row);}
                    });
                })
            )).then(([countRow, accessRow, oldestRow, pageCountRow, pageSizeRow]) => {
                const totalRecords = countRow.count || 0;
                const totalAccessCount = accessRow.total_access || 0;
                const oldestRecordTime = oldestRow.oldest || 0;

                // 计算数据库大小（单位：字节）
                const pageCount = pageCountRow['page_count'] || 0;
                const pageSize = pageSizeRow['page_size'] || 0;
                const databaseSize = pageCount * pageSize;

                resolve({
                    totalRecords,
                    totalAccessCount,
                    oldestRecordTime,
                    databaseSize
                });
            }).catch(reject);
        });
    }
    // 添加清除全部数据的方法
    async clearAllData(): Promise<number> {
        if (!this.isInitialized) {
            throw new Error('缓存管理器未初始化');
        }

        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM translation_data`;
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }
            this.db.run(sql, function(err) {
                if (err) {
                    reject(new Error(`清空数据失败: ${err.message}`));
                    return;
                }
                resolve(this.changes); // 返回删除的记录数
            });
        });
    }
}