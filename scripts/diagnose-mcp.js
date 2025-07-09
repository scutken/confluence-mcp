#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🔍 MCP 连接诊断工具\n');

// Check if dist files exist
const distPath = path.join(PROJECT_ROOT, 'dist');
const indexPath = path.join(distPath, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ dist/index.js 不存在，请先运行: npm run build');
  process.exit(1);
}

console.log('✅ 构建文件存在');

// Check environment variables
const requiredEnvVars = ['CONFLUENCE_API_TOKEN', 'CONFLUENCE_BASE_URL'];
const envStatus = {};

console.log('\n🔧 环境变量检查:');
requiredEnvVars.forEach((varName) => {
  const value = process.env[varName];
  envStatus[varName] = !!value;

  if (value) {
    console.log(`  ✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`  ❌ ${varName}: 未设置`);
  }
});

const allEnvSet = Object.values(envStatus).every(Boolean);

if (!allEnvSet) {
  console.log('\n⚠️  缺少必需的环境变量。请设置：');
  requiredEnvVars.forEach((varName) => {
    if (!envStatus[varName]) {
      console.log(`   export ${varName}="your_value"`);
    }
  });
  console.log('\n或者创建 .env 文件：');
  console.log('   cp .env.example .env');
  console.log('   # 然后编辑 .env 文件填入您的配置');
}

console.log('\n🧪 测试 MCP 服务器启动...');

// Test MCP server startup
const testMcpServer = () => {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('bun', [indexPath], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let hasResponded = false;

    // Set timeout
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        serverProcess.kill();
        reject(new Error('服务器启动超时'));
      }
    }, 10000);

    serverProcess.stdout.on('data', (data) => {
      stdout += data.toString();

      // Look for startup message
      if (stdout.includes('Confluence MCP server running')) {
        console.log('✅ 服务器启动成功');

        // Send initialize request
        const initRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'diagnostic-test',
              version: '1.0.0',
            },
          },
        };

        serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
      }

      // Look for initialize response
      if (stdout.includes('"method":"initialize"') || stdout.includes('"result"')) {
        hasResponded = true;
        clearTimeout(timeout);
        serverProcess.kill();
        resolve({ stdout, stderr });
      }
    });

    serverProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    serverProcess.on('close', (code) => {
      if (!hasResponded) {
        if (code !== 0) {
          reject(new Error(`服务器退出，代码: ${code}\nstderr: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

try {
  const result = await testMcpServer();
  console.log('✅ MCP 协议测试通过');

  if (result.stdout.includes('"protocolVersion"')) {
    console.log('✅ 初始化响应正常');
  }
} catch (error) {
  console.error('❌ MCP 服务器测试失败:', error.message);

  console.log('\n🔧 可能的解决方案:');
  console.log('1. 检查环境变量是否正确设置');
  console.log('2. 验证 Confluence API Token 是否有效');
  console.log('3. 确认 Confluence Base URL 格式正确');
  console.log('4. 检查网络连接');
  console.log('5. 查看详细错误日志');
}

console.log('\n📋 诊断总结:');
console.log(`  构建状态: ✅ 正常`);
console.log(`  环境变量: ${allEnvSet ? '✅ 完整' : '❌ 缺失'}`);

console.log('\n💡 如果问题仍然存在:');
console.log('1. 手动测试服务器:');
console.log('   bun dist/index.js');
console.log('2. 检查 Claude Desktop 配置');
console.log('3. 查看应用程序日志');
console.log('4. 重新构建 DXT: npm run build:dxt');
