// src/cache/__test__/cache_test.ts
import * as fs from 'fs';
import * as path from 'path';
import { TranslationCacheManager } from '../data';

async function runTests() {
    console.log('🚀 开始测试 TranslationCacheManager...\n');
    
    // 创建临时目录用于测试
    const tempDir = path.join(__dirname, 'test-temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    let cacheManager: TranslationCacheManager | null = null;
    
    try {
        // 初始化缓存管理器
        console.log('1. 初始化缓存管理器...');
        cacheManager = new TranslationCacheManager(tempDir);
        await cacheManager.initialize();
        console.log('✅ 缓存管理器初始化成功\n');
        
        // 测试单个翻译存储和获取
        console.log('2. 测试单个翻译存储和获取...');
        const originalText = 'Hello, world!';
        const translatedText = '你好，世界！';
        
        await cacheManager.setTranslation(originalText, translatedText);
        console.log('✅ 翻译已存储');
        
        const retrievedText = await cacheManager.getTranslation(originalText);
        console.log(`🔍 查询结果: ${retrievedText}`);
        console.log(`✅ 单个翻译测试${retrievedText === translatedText ? '通过' : '失败'}\n`);
        
        // 测试批量翻译获取
        console.log('3. 测试批量翻译获取...');
        const texts = [
            'Good morning',
            'How are you?',
            'Thank you very much',
            'See you later'
        ];
        
        const translations = [
            '早上好',
            '你好吗？',
            '非常感谢',
            '再见'
        ];
        
        // 存储多个翻译
        for (let i = 0; i < texts.length; i++) {
            await cacheManager.setTranslation(texts[i], translations[i]);
        }
        console.log('✅ 多个翻译已存储');
        
        // 批量获取
        const batchResults = await cacheManager.getTranslationsBatch(texts);
        console.log(`🔍 批量查询返回 ${batchResults.size} 条结果:`);
        batchResults.forEach((value, key) => {
            console.log(`   "${key}" => "${value}"`);
        });
        console.log('✅ 批量翻译测试完成\n');
        
        // 测试缓存统计信息
        console.log('4. 测试缓存统计信息...');
        const stats = await cacheManager.getCacheStats();
        console.log('📊 缓存统计信息:');
        console.log(`   总记录数: ${stats.totalRecords}`);
        console.log(`   总访问次数: ${stats.totalAccessCount}`);
        console.log(`   最早记录时间: ${stats.oldestRecordTime ? new Date(stats.oldestRecordTime) : 'N/A'}`);
        console.log(`   数据库大小: ${stats.databaseSize || 0} 字节`);
        console.log('✅ 统计信息测试完成\n');
        
        // 测试重复存储（应该更新而不是新增）
        console.log('5. 测试重复存储...');
        const updatedTranslation = '你好，世界！(更新版)';
        await cacheManager.setTranslation(originalText, updatedTranslation);
        
        const updatedRetrievedText = await cacheManager.getTranslation(originalText);
        console.log(`🔍 更新后查询结果: ${updatedRetrievedText}`);
        console.log(`✅ 重复存储测试${updatedRetrievedText === updatedTranslation ? '通过' : '失败'}\n`);
        
        // 再次检查统计信息
        console.log('6. 检查更新后的统计信息...');
        const updatedStats = await cacheManager.getCacheStats();
        console.log('📊 更新后的缓存统计信息:');
        console.log(`   总记录数: ${updatedStats.totalRecords}`);
        console.log(`   总访问次数: ${updatedStats.totalAccessCount}`);
        console.log('✅ 统计信息一致性检查完成\n');
        
        // 测试清理过期缓存（这里我们使用1天作为保留期进行测试）
        console.log('7. 测试清理过期缓存...');
        const deletedCount = await cacheManager.cleanupExpiredCache(1);
        console.log(`🗑️  清理了 ${deletedCount} 条过期记录`);
        console.log('✅ 缓存清理测试完成\n');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    } finally {
        // 关闭数据库连接
        if (cacheManager) {
            try {
                console.log('8. 关闭数据库连接...');
                await cacheManager.close();
                console.log('✅ 数据库连接已关闭\n');
            } catch (closeError) {
                console.error('⚠️  关闭数据库时出错:', closeError);
            }
        }
        
        // 清理临时文件
        try {
            // 等待一点时间确保文件解锁
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const dbFile = path.join(tempDir, 'translation_cache.db');
            if (fs.existsSync(dbFile)) {
                fs.unlinkSync(dbFile);
            }
            const walFile = dbFile + '-wal';
            if (fs.existsSync(walFile)) {
                fs.unlinkSync(walFile);
            }
            const shmFile = dbFile + '-shm';
            if (fs.existsSync(shmFile)) {
                fs.unlinkSync(shmFile);
            }
            fs.rmdirSync(tempDir);
            console.log('🧹 临时文件已清理');
        } catch (cleanupError) {
            console.warn('⚠️  清理临时文件时出错:', cleanupError);
        }
    }
    
    console.log('🎉 测试流程结束！');
}

// 直接运行测试
runTests().catch(console.error);