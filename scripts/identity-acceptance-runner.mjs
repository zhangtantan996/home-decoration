import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const resultDir = path.resolve(rootDir, 'test-results');
const summaryJsonPath = path.resolve(resultDir, 'identity-acceptance-summary.json');
const summaryMarkdownPath = path.resolve(resultDir, 'identity-acceptance-summary.md');
const playwrightConfig = 'playwright.identity.config.ts';
const cleanupSqlPath = path.resolve(rootDir, 'server/scripts/testdata/identity_acceptance_cleanup.sql');

const runId = process.env.E2E_RUN_ID || `identity_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`;
const baseApiOrigin = process.env.API_BASE_URL || 'http://localhost:8080';
const apiBaseUrl = process.env.E2E_API_BASE_URL || `${baseApiOrigin.replace(/\/$/, '')}/api/v1`;
const adminOrigin = process.env.E2E_ADMIN_ORIGIN || process.env.ADMIN_BASE_URL || 'http://localhost:5173';
const phonePrefix = process.env.E2E_PHONE_PREFIX || '19999';
const uiStrict = process.env.E2E_UI_STRICT === '1';
const dbCleanup = process.env.E2E_DB_CLEANUP === '1';
const dbUrl = process.env.E2E_DB_URL || '';

const runEnv = {
  ...process.env,
  E2E_RUN_ID: runId,
  E2E_API_BASE_URL: apiBaseUrl,
  E2E_ADMIN_ORIGIN: adminOrigin,
  E2E_PHONE_PREFIX: phonePrefix,
};

const startedAt = new Date();

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function getPsqlCommand() {
  return process.platform === 'win32' ? 'psql.exe' : 'psql';
}

function getDockerCommand() {
  return process.platform === 'win32' ? 'docker.exe' : 'docker';
}

function runRateLimitReset(stage) {
  const startedAtMs = Date.now();
  const child = spawnSync(
    getNpmCommand(),
    ['run', 'reset:user-web:rate-limit'],
    {
      cwd: rootDir,
      env: runEnv,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );

  return {
    stage,
    status: child.status === 0 ? 'passed' : 'failed',
    exitCode: child.status ?? 1,
    durationMs: Date.now() - startedAtMs,
    stdout: (child.stdout || '').trim(),
    stderr: `${(child.stderr || '').trim()}${child.error ? `\n${String(child.error.message || child.error)}` : ''}`.trim(),
  };
}

function runCleanupViaDockerPsql() {
  const sql = fs.readFile(cleanupSqlPath, 'utf8');
  const containerCandidates = ['home_decor_db_local', 'decorating_db'];

  return sql.then((sqlText) => {
    for (const containerName of containerCandidates) {
      const child = spawnSync(
        getDockerCommand(),
        [
          'exec',
          '-i',
          containerName,
          'psql',
          '-U',
          'postgres',
          '-d',
          'home_decoration',
          '-v',
          `run_id=${runId}`,
          '-v',
          `phone_prefix=${phonePrefix}`,
        ],
        {
          cwd: rootDir,
          stdio: 'inherit',
          env: runEnv,
          input: sqlText,
        },
      );

      if (child.status === 0) {
        return {
          mode: 'docker-psql',
          status: 'passed',
          message: `已通过 docker exec 在容器 ${containerName} 中完成 DB 清理`,
        };
      }
    }

    return {
      mode: 'hybrid',
      status: 'failed',
      message: '本机 psql 不可用，且 docker 容器内清理也失败，请手动清理',
    };
  });
}

function isLocalAddress(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function assertSafeLocalTargets() {
  let apiUrl;
  let adminUrl;
  try {
    apiUrl = new URL(apiBaseUrl);
    adminUrl = new URL(adminOrigin);
  } catch (error) {
    throw new Error(`E2E URL 配置非法: api=${apiBaseUrl}, admin=${adminOrigin}`);
  }

  if (!isLocalAddress(apiUrl.hostname)) {
    throw new Error(`安全保护：E2E_API_BASE_URL 仅允许本机地址，当前=${apiBaseUrl}`);
  }

  if (!isLocalAddress(adminUrl.hostname)) {
    throw new Error(`安全保护：E2E_ADMIN_ORIGIN 仅允许本机地址，当前=${adminOrigin}`);
  }

  if (!/^\d{5,11}$/.test(phonePrefix)) {
    throw new Error(`安全保护：E2E_PHONE_PREFIX 仅允许数字前缀（5~11位），当前=${phonePrefix}`);
  }
}

function runPlaywrightProject(projectName) {
  const projectStartedAt = Date.now();
  const child = spawnSync(
    getNpxCommand(),
    ['playwright', 'test', '-c', playwrightConfig, '--project', projectName],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: runEnv,
    },
  );

  return {
    name: projectName,
    status: child.status === 0 ? 'passed' : 'failed',
    exitCode: child.status ?? 1,
    durationMs: Date.now() - projectStartedAt,
    signal: child.signal || null,
  };
}

function renderSummaryMarkdown(summary) {
  const lines = [
    '# Identity Phase1 自动化验收摘要',
    '',
    `- 执行时间: ${summary.startedAt} ~ ${summary.finishedAt}`,
    `- runId: ${summary.runId}`,
    `- API 基址: ${summary.env.apiBaseUrl}`,
    `- Admin 地址: ${summary.env.adminOrigin}`,
    `- 测试手机号前缀: ${summary.env.phonePrefix}`,
    `- 门禁策略: API 阻断, UI ${summary.gate.uiStrict ? '严格阻断' : '默认告警'}`,
    `- 总结论: **${summary.finalStatus.toUpperCase()}**`,
    '',
    '## 项目结果',
    '',
    '| Project | Status | ExitCode | Duration(s) |',
    '|---|---:|---:|---:|',
  ];

  for (const project of summary.projects) {
    lines.push(`| ${project.name} | ${project.status} | ${project.exitCode} | ${(project.durationMs / 1000).toFixed(2)} |`);
  }

  lines.push('');
  lines.push('## 限流清理');
  lines.push('');
  lines.push('| Stage | Status | ExitCode | Duration(s) |');
  lines.push('|---|---:|---:|---:|');
  for (const reset of summary.rateLimitResets || []) {
    lines.push(`| ${reset.stage} | ${reset.status} | ${reset.exitCode} | ${(reset.durationMs / 1000).toFixed(2)} |`);
  }

  lines.push('');
  lines.push('## 清理结果');
  lines.push('');
  lines.push(`- 模式: ${summary.cleanup.mode}`);
  lines.push(`- 状态: ${summary.cleanup.status}`);
  if (summary.cleanup.message) {
    lines.push(`- 说明: ${summary.cleanup.message}`);
  }

  lines.push('');
  lines.push('## 产物路径');
  lines.push('');
  lines.push(`- JSON: \`${summary.paths.summaryJsonPath}\``);
  lines.push(`- Markdown: \`${summary.paths.summaryMarkdownPath}\``);

  return `${lines.join('\n')}\n`;
}

async function runCleanup() {
  if (!dbCleanup) {
    return { mode: 'soft', status: 'skipped', message: 'E2E_DB_CLEANUP != 1，使用软清理（不执行 DB 删除）' };
  }

  if (!dbUrl) {
    return { mode: 'hybrid', status: 'skipped', message: 'E2E_DB_CLEANUP=1 但未提供 E2E_DB_URL，回退为软清理' };
  }

  const child = spawnSync(
    getPsqlCommand(),
    [
      dbUrl,
      '-v',
      `run_id=${runId}`,
      '-v',
      `phone_prefix=${phonePrefix}`,
      '-f',
      cleanupSqlPath,
    ],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: runEnv,
    },
  );

  if (child.status === 0) {
    return { mode: 'db', status: 'passed', message: '已执行 DB 清理脚本（本机 psql）' };
  }

  return runCleanupViaDockerPsql();
}

async function main() {
  assertSafeLocalTargets();
  await fs.mkdir(resultDir, { recursive: true });

  console.log(`[identity-acceptance] safety check passed. runId=${runId}, api=${apiBaseUrl}, admin=${adminOrigin}, prefix=${phonePrefix}`);

  console.log('\n[identity-acceptance] Resetting login limiter before API acceptance...\n');
  const resetBeforeApi = runRateLimitReset('before-api');

  console.log('\n[identity-acceptance] Running API acceptance project...\n');
  const apiProject = runPlaywrightProject('identity-api');

  console.log('\n[identity-acceptance] Resetting login limiter before Admin UI acceptance...\n');
  const resetBeforeUi = runRateLimitReset('before-ui');

  console.log('\n[identity-acceptance] Running Admin UI acceptance project...\n');
  const uiProject = runPlaywrightProject('identity-admin-ui');

  console.log('\n[identity-acceptance] Running cleanup phase...\n');
  const cleanup = await runCleanup();

  const apiFailed = apiProject.exitCode !== 0;
  const uiFailed = uiProject.exitCode !== 0;
  const resetFailed = resetBeforeApi.exitCode !== 0 || resetBeforeUi.exitCode !== 0;
  const shouldBlock = apiFailed || (uiStrict && uiFailed) || resetFailed;

  const finishedAt = new Date();
  const summary = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    runId,
    env: {
      apiBaseUrl,
      adminOrigin,
      phonePrefix,
    },
    gate: {
      uiStrict,
      policy: uiStrict ? 'api+ui strict block + rate-limit reset required' : 'api block + ui warning + rate-limit reset required',
    },
    projects: [apiProject, uiProject],
    rateLimitResets: [resetBeforeApi, resetBeforeUi],
    cleanup,
    finalStatus: shouldBlock ? 'failed' : 'passed',
    paths: {
      summaryJsonPath,
      summaryMarkdownPath,
    },
  };

  await fs.writeFile(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  await fs.writeFile(summaryMarkdownPath, renderSummaryMarkdown(summary), 'utf8');

  console.log(`\n[identity-acceptance] Summary JSON: ${summaryJsonPath}`);
  console.log(`[identity-acceptance] Summary Markdown: ${summaryMarkdownPath}`);
  console.log(`[identity-acceptance] Final status: ${summary.finalStatus.toUpperCase()}`);

  if (!uiStrict && uiFailed && !apiFailed) {
    console.warn('[identity-acceptance] UI project failed but not blocking release (E2E_UI_STRICT!=1).');
  }

  process.exit(shouldBlock ? 1 : 0);
}

main().catch(async (error) => {
  console.error('[identity-acceptance] runner crashed:', error);
  await fs.mkdir(resultDir, { recursive: true });
  const failedSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    runId,
    finalStatus: 'failed',
    reason: error instanceof Error ? error.message : String(error),
    paths: {
      summaryJsonPath,
      summaryMarkdownPath,
    },
  };
  await fs.writeFile(summaryJsonPath, JSON.stringify(failedSummary, null, 2), 'utf8');
  process.exit(1);
});
