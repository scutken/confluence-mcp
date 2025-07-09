#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DXT_BUILD_DIR = path.join(PROJECT_ROOT, 'dxt-build');
const DXT_FILE = path.join(PROJECT_ROOT, 'confluence-mcp.dxt');

console.log('🚀 Building Confluence MCP DXT Extension...\n');

// Clean up previous build
if (fs.existsSync(DXT_BUILD_DIR)) {
  console.log('🧹 Cleaning previous build...');
  fs.rmSync(DXT_BUILD_DIR, { recursive: true, force: true });
}

if (fs.existsSync(DXT_FILE)) {
  fs.unlinkSync(DXT_FILE);
}

// Create build directory
fs.mkdirSync(DXT_BUILD_DIR, { recursive: true });

console.log('📦 Copying files...');

// Copy essential files
const filesToCopy = ['manifest.json', 'package.json', 'README.md', 'README_EN.md', 'LICENCE'];

filesToCopy.forEach((file) => {
  const srcPath = path.join(PROJECT_ROOT, file);
  const destPath = path.join(DXT_BUILD_DIR, file);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ⚠️  ${file} not found, skipping`);
  }
});

// Copy dist directory
const distSrc = path.join(PROJECT_ROOT, 'dist');
const distDest = path.join(DXT_BUILD_DIR, 'dist');

if (fs.existsSync(distSrc)) {
  console.log('  ✓ dist/');
  copyDirectory(distSrc, distDest);
} else {
  console.error('❌ dist directory not found. Please run "bun run build" first.');
  process.exit(1);
}

// Copy node_modules (production only)
console.log('📚 Installing production dependencies...');
try {
  // Create a temporary package.json with only production dependencies
  const originalPackage = JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8')
  );
  const productionPackage = {
    name: originalPackage.name,
    version: originalPackage.version,
    dependencies: originalPackage.dependencies || {},
    type: originalPackage.type,
  };

  fs.writeFileSync(
    path.join(DXT_BUILD_DIR, 'package.json'),
    JSON.stringify(productionPackage, null, 2)
  );

  // Install production dependencies in build directory
  execSync('npm install --production --no-optional', {
    cwd: DXT_BUILD_DIR,
    stdio: 'inherit',
  });

  console.log('  ✓ Production dependencies installed');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Create the DXT file (ZIP archive)
console.log('🗜️  Creating DXT archive...');
try {
  // Change to build directory and create zip
  process.chdir(DXT_BUILD_DIR);

  // Use different zip commands based on platform
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Use PowerShell on Windows
    execSync(`powershell -Command "Compress-Archive -Path * -DestinationPath '${DXT_FILE}'"`, {
      stdio: 'inherit',
    });
  } else {
    // Use zip command on Unix-like systems
    execSync(`zip -r "${DXT_FILE}" .`, {
      stdio: 'inherit',
    });
  }

  console.log(`✅ DXT file created: ${path.basename(DXT_FILE)}`);
} catch (error) {
  console.error('❌ Failed to create DXT archive:', error.message);
  console.log('\n💡 Alternative: You can manually create a ZIP file from the dxt-build directory');
  process.exit(1);
}

// Clean up build directory
console.log('🧹 Cleaning up...');
process.chdir(PROJECT_ROOT);
fs.rmSync(DXT_BUILD_DIR, { recursive: true, force: true });

console.log('\n🎉 DXT extension built successfully!');
console.log(`📁 File: ${DXT_FILE}`);
console.log('\n📖 Next steps:');
console.log('1. Test the DXT file by opening it with Claude Desktop');
console.log('2. Share the .dxt file with users for easy installation');

// Helper function to copy directory recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
