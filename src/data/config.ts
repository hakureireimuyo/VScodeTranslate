// src/config/ConfigDatabase.ts
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {TranslationConfig} from '../types';

export class ConfigDatabase {
  private db?: sqlite3.Database;
  private isInitialized: boolean = false;
  private dbPath: string;
  constructor(private storagePath: string) {
      this.dbPath = path.join(storagePath, 'vscode_translate_data.db');
    }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          reject(new Error(`无法打开配置数据库: ${err.message}`));
          return;
        }

        try {
          await this.createTables();
          this.isInitialized = true;
          resolve();
        } catch (createErr) {
          reject(createErr);
        }
      });
    });
  }

  /**
   * 创建配置表
   */
  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('数据库实例未定义'));
      }

      // 创建简单配置表（键值对）
      const createSimpleConfigTableSQL = `
        CREATE TABLE IF NOT EXISTS simple_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
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
          updated_at INTEGER NOT NULL
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
        INSERT OR REPLACE INTO simple_config (key, value, updated_at)
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
        (service_provider, url, api_key, secret_key, model, updated_at)
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
        SELECT service_provider, url, api_key, secret_key, model, updated_at 
        FROM service_config 
        WHERE service_provider = ?
      `;
      
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
            timeout: row.updated_at
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
        SELECT service_provider, url, api_key, secret_key, model, updated_at 
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
          updatedAt: row.updated_at
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
            resolve();
          }
        });
      });
    }
  }
}