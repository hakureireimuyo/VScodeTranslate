// translationdata.ts
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { DataStats } from './models';

export class TranslationDataManager {
  private db?: sqlite3.Database;
  private dbPath: string;
  private isInitialized: boolean = false;

  constructor(private storagePath: string) {
    this.dbPath = path.join(storagePath, 'vscode_translate_data.db');
  }

  // 初始化数据库
  async initialize(): Promise<void> {
    if (this.isInitialized) { return; }
    const setupPragma = () => {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) {
            return reject(new Error('数据库实例未定义'));
            }

            const pragmas = [
            'PRAGMA journal_mode = WAL;',
            'PRAGMA synchronous = NORMAL;',
            'PRAGMA data_size = -10000;', // 10MB缓存
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
        };

    // 确保存储目录存在
    if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
            reject(new Error(`无法打开数据库: ${err.message}`));
            return;
        }

        try {
            await setupPragma();
            await this.createTables();
            this.isInitialized = true;
            resolve();
        } catch (pragmaErr) {
            reject(pragmaErr);
        }
        });
    });
    }

    //createTables 方法
    private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
        // 分别创建表和索引
        const createTableSQL = `
        CREATE TABLE IF NOT EXISTS translation_data (
            hash TEXT PRIMARY KEY,
            original_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            create_time INTEGER NOT NULL,
            last_access_time INTEGER NOT NULL,
            access_count INTEGER DEFAULT 0
        )
        `;

        const createIndexSQLs = [
        'CREATE INDEX IF NOT EXISTS idx_hash ON translation_data (hash)',
        'CREATE INDEX IF NOT EXISTS idx_last_access ON translation_data (last_access_time)',
        'CREATE INDEX IF NOT EXISTS idx_create_time ON translation_data (create_time)'
        ];

        if (!this.db) {
        return reject(new Error('数据库实例未定义'));
        }

        // 先创建表
        this.db.run(createTableSQL, (err) => {
        if (err) {
            reject(new Error(`创建表失败: ${err.message}`));
            return;
        }

        // 然后创建索引
        let indexCount = 0;
        const totalIndexes = createIndexSQLs.length;
        
        createIndexSQLs.forEach(sql => {
            this.db!.run(sql, (indexErr) => {
            indexCount++;
            if (indexErr) {
                console.warn(`创建索引时警告: ${indexErr.message}`);
            }
            
            // 当所有索引都处理完后resolve
            if (indexCount === totalIndexes) {
                resolve();
            }
            });
        });

        // 如果没有索引需要创建，直接resolve
        if (totalIndexes === 0) {
            resolve();
        }
        });
    });
    }

  // 生成文本哈希
  generateHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  // 存储翻译结果
  async setTranslation(originalText: string, translatedText: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('缓存管理器未初始化');
    }

    const hash = this.generateHash(originalText);
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO translation_data 
        (hash, original_text, translated_text, create_time, last_access_time, access_count)
        VALUES (?, ?, ?, COALESCE((SELECT create_time FROM translation_data WHERE hash = ?), ?), ?, 
                COALESCE((SELECT access_count + 1 FROM translation_data WHERE hash = ?), 1))
      `;
        if (!this.db) {
            return reject(new Error('数据库实例未定义'));
        }

        this.db.run(sql, [hash, originalText, translatedText, hash, now, now, hash], function(err) {
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
  async cleanupExpireddata(retentionDays: number = 60): Promise<number> {
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

  // 获取缓存统计信息
  async getdataStats(): Promise<DataStats> {
    if (!this.isInitialized) {
      throw new Error('缓存管理器未初始化');
    }

    return new Promise((resolve, reject) => {
      const statsQueries = [
        'SELECT COUNT(*) as count FROM translation_data',
        'SELECT SUM(access_count) as total_access FROM translation_data',
        'SELECT MIN(create_time) as oldest FROM translation_data',
        'SELECT SUM(pgsize) as size FROM dbstat WHERE name = \'translation_data\''
      ];

      Promise.all(statsQueries.map(query => 
        new Promise<number>((res, rej) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }
            this.db.get(query, (err, row: any) => {
                if (err) {rej(err);}
                else {res(Object.values(row)[0] as number || 0);}
            });
        })
      )).then(([totalRecords, totalAccessCount, oldestRecordTime, databaseSize]) => {
        resolve({
          totalRecords,
          totalAccessCount,
          oldestRecordTime,
          databaseSize
        });
      }).catch(reject);
    });
  }
  // 关闭数据库连接
    async close(): Promise<void> {
    if (this.db) {
        return new Promise((resolve, reject) => {
        this.db!.close((err) => {
            if (err) {
            console.error('关闭数据库时出错:', err);
            reject(err);
            } else {
            this.isInitialized = false;
            resolve();
            }
        });
        });
    }
    }
}