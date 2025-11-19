// src/data/config.ts
import * as sqlite3 from 'sqlite3';
import { TranslationConfig } from '../types';
import { DatabaseManager } from '../data';

export class ConfigDatabase {
    private db: sqlite3.Database | null = null;
    private isInitialized: boolean = false;
    private static readonly ACTIVE_SERVICE_PROVIDER_KEY = 'activeServiceProvider';

    constructor(databaseManager: DatabaseManager) {
        if (databaseManager.isReady()) {
            this.db = databaseManager.getDatabase();
            this.isInitialized = true;
        }
    }

    /**
     * 初始化配置表结构
     */
    async initializeTables(): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            // 创建简单配置表（键值对）
            const createSimpleConfigTableSQL = `
                CREATE TABLE IF NOT EXISTS simple_config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    timeout INTEGER NOT NULL
                )
            `;

            // 创建服务配置表
            const createServiceConfigTableSQL = `
                CREATE TABLE IF NOT EXISTS service_config (
                    service_provider TEXT PRIMARY KEY,
                    url TEXT,
                    api_key TEXT,
                    secret_key TEXT,
                    model TEXT,
                    timeout INTEGER NOT NULL
                )
            `;

            this.db.serialize(() => {
                this.db!.run(createSimpleConfigTableSQL, (err) => {
                    if (err) {
                        return reject(new Error(`创建简单配置表失败: ${err.message}`));
                    }
                    
                    this.db!.run(createServiceConfigTableSQL, (err) => {
                        if (err) {
                            return reject(new Error(`创建服务配置表失败: ${err.message}`));
                        }
                        resolve();
                    });
                });
            });
        });
    }

    /**
     * 设置简单配置项
     */
    async setSimpleConfig(key: string, value: string): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const sql = `
                INSERT OR REPLACE INTO simple_config (key, value, timeout)
                VALUES (?, ?, ?)
            `;

            this.db.run(sql, [key, value, Date.now()], (err) => {
                if (err) {
                    reject(new Error(`设置配置项失败: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * 获取简单配置项
     */
    async getSimpleConfig(key: string): Promise<string | null> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const sql = `SELECT value FROM simple_config WHERE key = ?`;
            
            this.db.get(sql, [key], (err, row: any) => {
                if (err) {
                    reject(new Error(`获取配置项失败: ${err.message}`));
                    return;
                }

                resolve(row ? row.value : null);
            });
        });
    }

    /**
     * 设置服务配置
     */
    async setServiceConfig(config: Omit<TranslationConfig, 'updatedAt'>): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const sql = `
                INSERT OR REPLACE INTO service_config 
                (service_provider, url, api_key, secret_key, model, timeout)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            this.db.run(
                sql, 
                [
                    config.serviceProvider,
                    config.url,
                    config.apiKey,
                    config.secretKey || '',
                    config.model,
                    Date.now()
                ], 
                (err) => {
                    if (err) {
                        reject(new Error(`设置服务配置失败: ${err.message}`));
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    /**
     * 获取服务配置
     */
    async getServiceConfig(serviceProvider: string): Promise<TranslationConfig | null> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const sql = `
                SELECT service_provider, url, api_key, secret_key, model, timeout 
                FROM service_config 
                WHERE service_provider = ?`
            ;
            
            this.db.get(sql, [serviceProvider], (err, row: any) => {
                if (err) {
                    reject(new Error(`获取服务配置失败: ${err.message}`));
                    return;
                }

                if (row) {
                    resolve({
                        serviceProvider: row.service_provider,
                        url: row.url,
                        apiKey: row.api_key,
                        secretKey: row.secret_key,
                        model: row.model,
                        timeout: row.timeout
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * 获取所有服务配置
     */
    async getAllServiceConfigs(): Promise<TranslationConfig[]> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const sql = `
                SELECT service_provider, url, api_key, secret_key, model, timeout 
                FROM service_config
            `;
            
            this.db.all(sql, [], (err, rows: any[]) => {
                if (err) {
                    reject(new Error(`获取所有服务配置失败: ${err.message}`));
                    return;
                }

                const configs: TranslationConfig[] = rows.map(row => ({
                    serviceProvider: row.service_provider,
                    url: row.url,
                    apiKey: row.api_key,
                    secretKey: row.secret_key,
                    model: row.model,
                    updatedAt: row.timeout
                }));

                resolve(configs);
            });
        });
    }

    /**
     * 删除服务配置
     */
    async deleteServiceConfig(serviceProvider: string): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const sql = `DELETE FROM service_config WHERE service_provider = ?`;
            
            this.db.run(sql, [serviceProvider], (err) => {
                if (err) {
                    reject(new Error(`删除服务配置失败: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    
    /**
     * 获取数据库中存储的活动服务提供者
     */
    async getActiveServiceProvider(): Promise<string> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        try {
            const activeProvider = await this.getSimpleConfig(ConfigDatabase.ACTIVE_SERVICE_PROVIDER_KEY);
            return activeProvider || 'aliyun'; // 默认使用 aliyun
        } catch (error) {
            console.error('获取活动服务提供者失败:', error);
            return 'aliyun'; // 出错时返回默认值
        }
    }

    /**
     * 设置活动服务提供者
     */
    async setActiveServiceProvider(serviceProvider: string): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        try {
            await this.setSimpleConfig(ConfigDatabase.ACTIVE_SERVICE_PROVIDER_KEY, serviceProvider);
        } catch (error) {
            console.error('设置活动服务提供者失败:', error);
            throw error;
        }
    }

    /**
     * 获取活动服务提供者的配置（默认行为）
     */
    async getActiveServiceConfig(): Promise<TranslationConfig | null> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        try {
            // 获取当前活动的服务提供者
            const activeProvider = await this.getActiveServiceProvider();
            
            // 获取该服务提供者的配置
            return await this.getServiceConfig(activeProvider);
        } catch (error) {
            console.error('获取活动服务配置失败:', error);
            return null;
        }
    }
    
    /**
     * 获取所有简单配置项
     */
    async getAllSimpleConfigs(): Promise<{key: string, value: string}[]> {
        if (!this.isInitialized) {
            throw new Error('配置数据库未初始化');
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('数据库实例未定义'));
            }

            const sql = `SELECT key, value FROM simple_config`;
            
            this.db.all(sql, [], (err, rows: any[]) => {
                if (err) {
                    reject(new Error(`获取所有简单配置失败: ${err.message}`));
                    return;
                }

                resolve(rows);
            });
        });
    }
}