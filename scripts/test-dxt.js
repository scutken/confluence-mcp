#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DXT_FILE = path.join(PROJECT_ROOT, 'confluence-mcp.dxt');

console.log('🧪 Testing DXT Extension...\n');

// Check if DXT file exists
if (!fs.existsSync(DXT_FILE)) {
  console.error('❌ DXT file not found. Please run "npm run build:dxt" first.');
  process.exit(1);
}

console.log('✅ DXT file found');

// Check file size
const stats = fs.statSync(DXT_FILE);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`📏 File size: ${fileSizeMB} MB`);

if (stats.size > 50 * 1024 * 1024) {
  // 50MB
  console.warn('⚠️  Warning: DXT file is quite large (>50MB)');
}

// Test if it's a valid ZIP file
console.log('🗜️  Testing ZIP structure...');

try {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Use PowerShell to test ZIP on Windows
    const result = execSync(
      `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; try { [System.IO.Compression.ZipFile]::OpenRead('${DXT_FILE}').Dispose(); Write-Output 'valid' } catch { Write-Output 'invalid' }"`,
      {
        encoding: 'utf8',
      }
    ).trim();

    if (result !== 'valid') {
      throw new Error('Invalid ZIP file');
    }
  } else {
    // Use unzip to test on Unix-like systems
    execSync(`unzip -t "${DXT_FILE}"`, {
      stdio: 'pipe',
    });
  }

  console.log('✅ ZIP structure is valid');
} catch (error) {
  console.error('❌ Invalid ZIP file:', error.message);
  process.exit(1);
}

// Extract and validate manifest.json
console.log('📋 Validating manifest.json...');

const tempDir = path.join(PROJECT_ROOT, 'temp-test');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir);

try {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    execSync(
      `powershell -Command "Expand-Archive -Path '${DXT_FILE}' -DestinationPath '${tempDir}'"`,
      {
        stdio: 'pipe',
      }
    );
  } else {
    execSync(`unzip -q "${DXT_FILE}" -d "${tempDir}"`, {
      stdio: 'pipe',
    });
  }

  // Check required files
  const requiredFiles = ['manifest.json', 'package.json', 'dist/index.js'];

  for (const file of requiredFiles) {
    const filePath = path.join(tempDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required file missing: ${file}`);
    }
    console.log(`  ✓ ${file}`);
  }

  // Validate manifest.json
  const manifestPath = path.join(tempDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Check required manifest fields
  const requiredFields = ['dxt_version', 'name', 'version', 'description', 'author', 'server'];

  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`Required manifest field missing: ${field}`);
    }
  }

  console.log('✅ Manifest validation passed');
  console.log(`  📦 Extension: ${manifest.display_name || manifest.name}`);
  console.log(`  🏷️  Version: ${manifest.version}`);
  console.log(`  👤 Author: ${manifest.author.name}`);
} catch (error) {
  console.error('❌ Manifest validation failed:', error.message);
  process.exit(1);
} finally {
  // Clean up
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

console.log('\n🎉 DXT extension validation passed!');
console.log('\n📖 Next steps:');
console.log('1. Test installation in Claude Desktop');
console.log('2. Verify all tools work correctly');
console.log('3. Share the DXT file with users');

console.log(`\n📁 DXT file ready: ${path.basename(DXT_FILE)}`);
