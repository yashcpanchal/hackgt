#!/usr/bin/env node

/**
 * Build script for Notion Highlighter Extension
 * Compiles TypeScript and copies necessary files
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Notion Highlighter Extension...\n');

// Clean dist directory
console.log('1. Cleaning dist directory...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist', { recursive: true });

// Compile TypeScript
console.log('2. Compiling TypeScript...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful\n');
} catch (error) {
  console.error('❌ TypeScript compilation failed');
  process.exit(1);
}

// Copy additional files that need to be in the root
console.log('3. Copying static files...');
const filesToCopy = [
  'manifest.json',
  'popup.html',
  'styles.css',
  'icons'
];

filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(__dirname, file);

  if (fs.existsSync(srcPath)) {
    if (fs.statSync(srcPath).isDirectory()) {
      // Copy directory recursively
      if (fs.existsSync(destPath)) {
        console.log(`  📁 ${file} (already exists)`);
      } else {
        fs.cpSync(srcPath, destPath, { recursive: true });
        console.log(`  📁 ${file}`);
      }
    } else {
      // Files are already in the right place
      console.log(`  📄 ${file} (in place)`);
    }
  } else {
    console.log(`  ⚠️  ${file} (not found)`);
  }
});

console.log('\n✅ Build completed successfully!');
console.log('\n📦 Extension is ready for loading:');
console.log('   1. Open Chrome and go to chrome://extensions/');
console.log('   2. Enable "Developer mode"');
console.log('   3. Click "Load unpacked" and select this directory');
console.log('\n🔧 For development, run: npm run dev');