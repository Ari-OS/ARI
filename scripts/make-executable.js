#!/usr/bin/env node

/**
 * Helper script to make shell scripts executable
 * Run this after creating the scripts: node scripts/make-executable.js
 */

const fs = require('fs');
const path = require('path');

const scriptFiles = [
  'scripts/macos/install.sh',
  'scripts/macos/uninstall.sh',
  'scripts/macos/restart.sh',
  'scripts/macos/status.sh',
  'scripts/macos/logs.sh',
  'scripts/backup.sh',
];

console.log('Making scripts executable...\n');

scriptFiles.forEach((file) => {
  const fullPath = path.join(__dirname, '..', file);
  try {
    fs.chmodSync(fullPath, 0o755);
    console.log(`✓ ${file}`);
  } catch (error) {
    console.error(`✗ ${file}: ${error.message}`);
  }
});

console.log('\nDone! Scripts are now executable.');
