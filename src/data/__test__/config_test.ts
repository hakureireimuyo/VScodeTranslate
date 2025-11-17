// testConfigDatabase.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigDatabase } from '../config';
import { TranslationConfig } from '../../types';

async function testConfigDatabase() {
  // 创建临时目录用于测试
  const tempDir = path.join(os.tmpdir(), 'config_test_' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  
  console.log('测试目录:', tempDir);
  
  try {
    // 初始化数据库
    const configDb = new ConfigDatabase(tempDir);
    await configDb.initialize();
    
    console.log('\n=== 测试简单键值对配置 ===');
    
    // 设置简单配置项
    await configDb.setSimpleConfig('activeServiceProvider', 'openai');
    await configDb.setSimpleConfig('lastUsedVersion', '1.0.0');
    await configDb.setSimpleConfig('enableLogging', 'true');
    
    // 获取简单配置项
    const activeProvider = await configDb.getSimpleConfig('activeServiceProvider');
    const lastVersion = await configDb.getSimpleConfig('lastUsedVersion');
    const enableLogging = await configDb.getSimpleConfig('enableLogging');
    
    console.log('activeServiceProvider:', activeProvider); // 输出: openai
    console.log('lastUsedVersion:', lastVersion); // 输出: 1.0.0
    console.log('enableLogging:', enableLogging); // 输出: true
    
    console.log('\n=== 测试服务商配置 ===');
    
    // 创建不同服务商的配置
    const openaiConfig: Omit<TranslationConfig, 'updatedAt'> = {
      serviceProvider: 'openai',
      url: 'https://api.openai.com/v1',
      apiKey: 'sk-xxx',
      model: 'gpt-3.5-turbo'
    };
    
    const aliyunConfig: Omit<TranslationConfig, 'updatedAt'> = {
      serviceProvider: 'aliyun',
      url: 'https://dashscope.aliyuncs.com/api/v1',
      apiKey: 'aliyun-key',
      secretKey: 'aliyun-secret',
      model: 'qwen-turbo'
    };
    
    const baiduConfig: Omit<TranslationConfig, 'updatedAt'> = {
      serviceProvider: 'baidu',
      url: 'https://aip.baidubce.com/rpc/2.0/mt/texttrans/v1',
      apiKey: 'baidu-api-key',
      secretKey: 'baidu-secret-key',
      model: 'baidu-translator'
    };
    
    // 保存服务商配置
    await configDb.setServiceConfig(openaiConfig);
    await configDb.setServiceConfig(aliyunConfig);
    await configDb.setServiceConfig(baiduConfig);
    
    console.log('已保存三个服务商的配置');
    
    // 获取特定服务商配置
    const retrievedOpenaiConfig = await configDb.getServiceConfig('openai');
    const retrievedAliyunConfig = await configDb.getServiceConfig('aliyun');
    const retrievedBaiduConfig = await configDb.getServiceConfig('baidu');
    
    console.log('\nOpenAI 配置:');
    console.log(retrievedOpenaiConfig);
    
    console.log('\n阿里云配置:');
    console.log(retrievedAliyunConfig);
    
    console.log('\n百度配置:');
    console.log(retrievedBaiduConfig);
    
    // 获取所有服务商配置
    const allConfigs = await configDb.getAllServiceConfigs();
    console.log('\n所有服务商配置数量:', allConfigs.length);
    
    // 测试更新配置
    console.log('\n=== 测试配置更新 ===');
    const updatedOpenaiConfig: Omit<TranslationConfig, 'updatedAt'> = {
      ...openaiConfig,
      model: 'gpt-4' // 更新模型
    };
    
    await configDb.setServiceConfig(updatedOpenaiConfig);
    const updatedConfig = await configDb.getServiceConfig('openai');
    console.log('更新后的 OpenAI 配置:');
    console.log(updatedConfig);
    
    // 测试删除配置
    console.log('\n=== 测试删除配置 ===');
    await configDb.deleteServiceConfig('baidu');
    const baiduConfigAfterDelete = await configDb.getServiceConfig('baidu');
    console.log('删除百度配置后查询结果:', baiduConfigAfterDelete); // 应该输出 null
    
    const remainingConfigs = await configDb.getAllServiceConfigs();
    console.log('剩余服务商配置数量:', remainingConfigs.length);
    
    // 关闭数据库
    await configDb.close();
    console.log('\n数据库已关闭');
    
  } catch (error) {
    console.error('测试过程中出现错误:', error);
  } finally {
    // 清理测试目录（可选）
    // fs.rmSync(tempDir, { recursive: true, force: true });
    // console.log('\n测试目录已清理');
  }
}

// 运行测试
testConfigDatabase().then(() => {
  console.log('\n测试完成');
}).catch((error) => {
  console.error('测试失败:', error);
});