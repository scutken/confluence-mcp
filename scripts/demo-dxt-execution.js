#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DXT_FILE = path.join(PROJECT_ROOT, 'confluence-mcp.dxt');

console.log('🎯 DXT 执行演示\n');

// Check if DXT file exists
if (!fs.existsSync(DXT_FILE)) {
  console.error('❌ DXT 文件未找到。请先运行 "npm run build:dxt"');
  process.exit(1);
}

console.log('✅ 找到 DXT 文件:', path.basename(DXT_FILE));

// Show file info
const stats = fs.statSync(DXT_FILE);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`📏 文件大小: ${fileSizeMB} MB`);

console.log('\n📋 DXT 文件执行方式:\n');

console.log('1️⃣  在 Claude Desktop 中执行 (推荐):');
console.log('   • 双击 confluence-mcp.dxt 文件');
console.log('   • Claude Desktop 自动打开安装向导');
console.log('   • 配置 API Token 和 Base URL');
console.log('   • 完成安装后即可使用');

console.log('\n2️⃣  手动解压和执行 (开发测试):');
console.log('   • 解压: unzip confluence-mcp.dxt -d temp/');
console.log('   • 进入: cd temp/');
console.log('   • 设置环境变量:');
console.log('     export CONFLUENCE_API_TOKEN="your_token"');
console.log('     export CONFLUENCE_BASE_URL="https://your-domain.atlassian.net/wiki"');
console.log('   • 启动: node dist/index.js');

console.log('\n3️⃣  使用测试工具:');
console.log('   • npm run test:dxt:manual');
console.log('   • 交互式解压和配置');

console.log('\n🔍 DXT 内部结构预览:');

// Quick peek into DXT structure without full extraction
try {
  const tempDir = path.join(PROJECT_ROOT, 'temp-peek');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir);

  // Extract just the manifest
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    execSync(
      `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${DXT_FILE}'); $entry = $zip.Entries | Where-Object { $_.Name -eq 'manifest.json' }; [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, '${path.join(tempDir, 'manifest.json')}'); $zip.Dispose()"`,
      {
        stdio: 'pipe',
      }
    );
  } else {
    execSync(`unzip -j "${DXT_FILE}" manifest.json -d "${tempDir}"`, {
      stdio: 'pipe',
    });
  }

  const manifestPath = path.join(tempDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    console.log(`   📦 扩展名: ${manifest.display_name || manifest.name}`);
    console.log(`   🏷️  版本: ${manifest.version}`);
    console.log(`   👤 作者: ${manifest.author.name}`);
    console.log(`   🔧 服务器类型: ${manifest.server.type}`);
    console.log(`   📄 入口点: ${manifest.server.entry_point}`);

    console.log('\n   🛠️  可用工具:');
    manifest.tools.forEach((tool, index) => {
      console.log(`     ${index + 1}. ${tool.name} - ${tool.description}`);
    });

    console.log('\n   ⚙️  执行配置:');
    const mcpConfig = manifest.server.mcp_config;
    console.log(`     命令: ${mcpConfig.command}`);
    console.log(`     参数: ${JSON.stringify(mcpConfig.args)}`);
    console.log(`     环境变量: ${Object.keys(mcpConfig.env).join(', ')}`);
  }

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
} catch (error) {
  console.log('   ⚠️  无法预览内部结构:', error.message);
}

console.log('\n💡 执行原理:');
console.log('   1. DXT 应用解压文件到临时目录');
console.log('   2. 读取 manifest.json 获取配置');
console.log('   3. 替换配置中的变量 (${__dirname}, ${user_config.*})');
console.log('   4. 启动 Node.js 进程: node dist/index.js');
console.log('   5. 建立 stdio MCP 通信管道');

console.log('\n🎉 您的 Confluence MCP 已成功打包为 DXT 扩展！');
console.log('📁 文件位置:', DXT_FILE);
console.log('\n📖 下一步:');
console.log('   • 在 Claude Desktop 中测试安装');
console.log('   • 分享给用户使用');
console.log('   • 查看 INSTALLATION_GUIDE.md 了解详细安装步骤');
