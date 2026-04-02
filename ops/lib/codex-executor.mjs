import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function buildPrompt(controlPlane, task) {
  return [
    `You are an automatic worker for task ${task.id} in ${controlPlane.project.project.name}.`,
    '',
    'Task:',
    `- Goal: ${task.goal}`,
    `- Role: ${task.owner_role}`,
    `- Owned paths: ${(task.owned_paths ?? []).join(', ')}`,
    `- Done when: ${task.done_when ?? 'Complete the bounded task safely.'}`,
    `- Risk: ${task.risk}`,
    `- Verify profile after execution: ${task.verify_profile}`,
    '',
    'Rules:',
    '- Read AGENTS.md and the docs listed in ops/project.yaml docs_order as needed.',
    '- Modify only the owned paths listed above.',
    '- Do not edit ops/ or tests/ops unless they are explicitly owned by this task.',
    '- Do not revert unrelated dirty changes.',
    '- Run only the smallest relevant checks inside the owned scope when useful.',
    '- If the task cannot be completed safely, return status "blocked" with blocker reasons.',
    '',
    'Return a final structured result matching the provided schema.',
  ].join('\n');
}

async function runCodexTask(repoRoot, controlPlane, task, options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-codex-'));
  const outputFile = path.join(tmpDir, 'worker-result.json');
  const schemaPath = path.join(repoRoot, 'ops', 'schemas', 'worker-result.schema.json');
  const prompt = buildPrompt(controlPlane, task);

  const args = [
    '--sandbox',
    options.sandbox ?? 'workspace-write',
    '-a',
    options.approval ?? 'never',
    'exec',
    '-',
    '-C',
    repoRoot,
    '--output-schema',
    schemaPath,
    '-o',
    outputFile,
  ];

  const child = spawn('codex', args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdin.write(prompt);
  child.stdin.end();

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`codex executor timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });

  if (!fs.existsSync(outputFile)) {
    return {
      blockers: [`Codex worker did not produce a structured result. Exit code: ${exitCode}`],
      outputs: [],
      raw: { stderr, stdout },
      status: 'failed',
      summary: 'Worker exited without a structured result.',
      verification_notes: stderr.trim(),
    };
  }

  const parsed = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  return {
    ...parsed,
    raw: { stderr, stdout },
  };
}

export { buildPrompt, runCodexTask };
