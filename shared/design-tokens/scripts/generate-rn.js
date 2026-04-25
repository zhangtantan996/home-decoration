#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scriptPath = path.join(__dirname, 'generate-platforms.mjs');
const result = spawnSync(process.execPath, [scriptPath, '--scope', 'mobile'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
