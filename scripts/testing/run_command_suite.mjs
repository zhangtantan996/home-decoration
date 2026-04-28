#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

function usage() {
  console.error('Usage: node scripts/testing/run_command_suite.mjs --suite <name> [--continue-on-error] --step "name::command" ...');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'step';
}

function parseArgs(argv) {
  const args = {
    suite: '',
    continueOnError: false,
    steps: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--suite') {
      args.suite = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (item === '--continue-on-error') {
      args.continueOnError = true;
      continue;
    }
    if (item === '--step') {
      const raw = argv[index + 1] || '';
      index += 1;
      const separator = raw.indexOf('::');
      if (separator === -1) {
        throw new Error(`Invalid --step value: ${raw}`);
      }
      const name = raw.slice(0, separator).trim();
      const command = raw.slice(separator + 2).trim();
      if (!name || !command) {
        throw new Error(`Invalid --step value: ${raw}`);
      }
      args.steps.push({ name, command });
      continue;
    }
    throw new Error(`Unknown argument: ${item}`);
  }

  if (!args.suite || args.steps.length === 0) {
    throw new Error('Missing required suite name or steps.');
  }

  return args;
}

async function runCommand(command, logPath) {
  return new Promise((resolve) => {
    const child = spawn('/bin/bash', ['-lc', command], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const append = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);

    child.on('close', async (code, signal) => {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(logPath, output, 'utf8');
      resolve({ exitCode: code ?? 1, signal: signal ?? null });
    });
  });
}

function renderMarkdown(summary) {
  const lines = [
    `# ${summary.suite}`,
    '',
    `- startedAt: ${summary.startedAt}`,
    `- finishedAt: ${summary.finishedAt}`,
    `- status: **${summary.status.toUpperCase()}**`,
    `- cwd: ${summary.cwd}`,
    `- continueOnError: ${summary.continueOnError}`,
    '',
    '## Steps',
    '',
    '| Step | Status | ExitCode | Duration(s) | Log |',
    '|---|---|---:|---:|---|',
  ];

  for (const step of summary.steps) {
    lines.push(`| ${step.name} | ${step.status} | ${step.exitCode} | ${(step.durationMs / 1000).toFixed(2)} | \`${step.logPath}\` |`);
  }

  lines.push('');
  lines.push('## Commands');
  lines.push('');
  for (const step of summary.steps) {
    lines.push(`- ${step.name}: \`${step.command}\``);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    console.error(String(error instanceof Error ? error.message : error));
    process.exit(1);
  }

  const suiteDir = path.resolve(process.cwd(), 'test-results', options.suite);
  await fs.mkdir(suiteDir, { recursive: true });

  const startedAt = new Date();
  const steps = [];
  let hasFailure = false;

  for (const step of options.steps) {
    const logPath = path.resolve(suiteDir, `${slugify(step.name)}.log`);
    console.log(`\n[suite:${options.suite}] step=${step.name}`);
    const stepStartedAt = Date.now();
    const result = await runCommand(step.command, logPath);
    const status = result.exitCode === 0 ? 'passed' : 'failed';
    const stepSummary = {
      name: step.name,
      command: step.command,
      status,
      exitCode: result.exitCode,
      signal: result.signal,
      durationMs: Date.now() - stepStartedAt,
      logPath,
    };
    steps.push(stepSummary);

    if (result.exitCode !== 0) {
      hasFailure = true;
      if (!options.continueOnError) {
        break;
      }
    }
  }

  const summary = {
    suite: options.suite,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    status: hasFailure ? 'failed' : 'passed',
    cwd: process.cwd(),
    continueOnError: options.continueOnError,
    steps,
  };

  const summaryJsonPath = path.resolve(suiteDir, 'summary.json');
  const summaryMarkdownPath = path.resolve(suiteDir, 'summary.md');
  await fs.writeFile(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(summaryMarkdownPath, renderMarkdown(summary), 'utf8');

  console.log(`\n[suite:${options.suite}] summary json: ${summaryJsonPath}`);
  console.log(`[suite:${options.suite}] summary md: ${summaryMarkdownPath}`);
  console.log(`[suite:${options.suite}] final status: ${summary.status.toUpperCase()}`);

  process.exit(hasFailure ? 1 : 0);
}

main().catch((error) => {
  console.error('[run_command_suite] crashed:', error);
  process.exit(1);
});
