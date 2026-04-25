#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, '..', '..', 'shared', 'design-tokens', 'scripts', 'generate-platforms.mjs');

const result = spawnSync(process.execPath, [scriptPath, '--scope', 'web'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
