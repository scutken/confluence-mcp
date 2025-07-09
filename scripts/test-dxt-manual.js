#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DXT_FILE = path.join(PROJECT_ROOT, 'confluence-mcp.dxt');
const TEMP_DIR = path.join(PROJECT_ROOT, 'temp-dxt-test');

console.log('🧪 Manual DXT Testing Tool\n');

// Check if DXT file exists
if (!fs.existsSync(DXT_FILE)) {
  console.error('❌ DXT file not found. Please run "npm run build:dxt" first.');
  process.exit(1);
}

// Clean up previous test
if (fs.existsSync(TEMP_DIR)) {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

console.log('📦 Extracting DXT file...');

// Extract DXT file
fs.mkdirSync(TEMP_DIR);

try {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    execSync(
      `powershell -Command "Expand-Archive -Path '${DXT_FILE}' -DestinationPath '${TEMP_DIR}'"`,
      {
        stdio: 'pipe',
      }
    );
  } else {
    execSync(`unzip -q "${DXT_FILE}" -d "${TEMP_DIR}"`, {
      stdio: 'pipe',
    });
  }

  console.log('✅ DXT file extracted');
} catch (error) {
  console.error('❌ Failed to extract DXT file:', error.message);
  process.exit(1);
}

// Read manifest
const manifestPath = path.join(TEMP_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('📋 Manifest Info:');
console.log(`  Name: ${manifest.display_name || manifest.name}`);
console.log(`  Version: ${manifest.version}`);
console.log(`  Author: ${manifest.author.name}`);
console.log(`  Server Type: ${manifest.server.type}`);
console.log(`  Entry Point: ${manifest.server.entry_point}`);

// Show MCP config
console.log('\n⚙️  MCP Configuration:');
const mcpConfig = manifest.server.mcp_config;
console.log(`  Command: ${mcpConfig.command}`);
console.log(`  Args: ${JSON.stringify(mcpConfig.args)}`);
console.log(`  Env: ${JSON.stringify(mcpConfig.env, null, 2)}`);

// Show user config requirements
if (manifest.user_config) {
  console.log('\n👤 Required User Configuration:');
  Object.entries(manifest.user_config).forEach(([key, config]) => {
    console.log(`  ${key}: ${config.title} (${config.type}${config.required ? ', required' : ''})`);
    console.log(`    ${config.description}`);
  });
}

// Show available tools
console.log('\n🔧 Available Tools:');
manifest.tools.forEach((tool) => {
  console.log(`  - ${tool.name}: ${tool.description}`);
});

console.log('\n🚀 Manual Execution Options:');
console.log('\n1. Test MCP Server directly:');

// Prepare command with variable substitution
const command = mcpConfig.command;
const args = mcpConfig.args.map((arg) => arg.replace('${__dirname}', TEMP_DIR));

console.log(`   cd ${TEMP_DIR}`);
console.log(`   ${command} ${args.join(' ')}`);

console.log('\n2. Test with environment variables:');
console.log('   # Set these environment variables first:');
Object.entries(mcpConfig.env).forEach(([key, value]) => {
  if (value.includes('${user_config.')) {
    const configKey = value.match(/\$\{user_config\.(.+)\}/)?.[1];
    console.log(`   export ${key}="your_${configKey}_value"`);
  } else {
    console.log(`   export ${key}="${value}"`);
  }
});

console.log('\n3. Interactive test:');
console.log('   Would you like to start the MCP server now? (y/n)');

// Wait for user input
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
  const input = key.toString().toLowerCase();

  if (input === 'y' || input === '\r' || input === '\n') {
    console.log('\n🚀 Starting MCP server...');
    console.log('Press Ctrl+C to stop\n');

    // Check if required env vars are set
    const requiredEnvVars = ['CONFLUENCE_API_TOKEN', 'CONFLUENCE_BASE_URL'];
    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      console.log('⚠️  Missing required environment variables:');
      missingVars.forEach((varName) => {
        console.log(`   ${varName}`);
      });
      console.log('\nPlease set these variables and try again.');
      cleanup();
      return;
    }

    // Start the server
    const serverProcess = spawn(command, args, {
      cwd: TEMP_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...Object.fromEntries(
          Object.entries(mcpConfig.env).map(([key, value]) => [
            key,
            value
              .replace('${__dirname}', TEMP_DIR)
              .replace('${user_config.api_token}', process.env.CONFLUENCE_API_TOKEN || '')
              .replace('${user_config.base_url}', process.env.CONFLUENCE_BASE_URL || ''),
          ])
        ),
      },
    });

    serverProcess.on('close', (code) => {
      console.log(`\n📊 Server exited with code ${code}`);
      cleanup();
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping server...');
      serverProcess.kill('SIGINT');
    });
  } else if (input === 'n') {
    console.log('\n👋 Skipping server start');
    cleanup();
  } else if (input === '\u0003') {
    // Ctrl+C
    cleanup();
  }
});

function cleanup() {
  console.log('\n🧹 Cleaning up...');
  process.stdin.setRawMode(false);
  process.stdin.pause();

  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }

  console.log('✅ Cleanup complete');
  process.exit(0);
}
