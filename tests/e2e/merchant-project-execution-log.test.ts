import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

import {
  buildMerchantAppUrl,
  merchantApiGet,
  merchantApiPost,
} from './helpers/merchant';

const DB_CONTAINER = process.env.USER_WEB_FIXTURE_DB_CONTAINER || 'home_decor_db_local';
const DB_NAME = process.env.USER_WEB_FIXTURE_DB_NAME || 'home_decoration';
const DB_USER = process.env.USER_WEB_FIXTURE_DB_USER || 'postgres';
const DB_URL = process.env.USER_WEB_FIXTURE_DB_URL || '';
const merchantSessionCache = new Map<string, any>();

function clearRateLimit() {
  execFileSync('bash', ['./scripts/user-web-clear-rate-limit.sh'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}

function applySql(sql: string) {
  if (DB_URL) {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1'], {
      input: sql,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    return;
  }

  execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', DB_USER, '-d', DB_NAME], {
    input: sql,
    stdio: ['pipe', 'ignore', 'pipe'],
  });
}

function prepareMerchantProjectExecutionFixture(projectId: number, providerId: number) {
  const sql = `
DELETE FROM business_flows WHERE project_id = ${projectId};
DELETE FROM business_flows WHERE source_type = 'booking' AND source_id = ${projectId};

UPDATE projects
SET provider_id = ${providerId},
    construction_provider_id = ${providerId},
    business_status = 'in_progress',
    status = 0,
    current_phase = '开工交底施工中',
    started_at = COALESCE(started_at, NOW()),
    start_date = COALESCE(start_date, NOW())
WHERE id = ${projectId};

UPDATE milestones
SET status = CASE WHEN seq = 1 THEN 1 ELSE 0 END,
    rejection_reason = '',
    submitted_at = NULL,
    accepted_at = NULL,
    paid_at = NULL
WHERE project_id = ${projectId};

UPDATE business_flows
SET current_stage = 'in_progress',
    project_id = ${projectId},
    selected_foreman_provider_id = COALESCE(selected_foreman_provider_id, ${providerId}),
    stage_changed_at = NOW()
WHERE project_id = ${projectId};

INSERT INTO business_flows (
  source_type,
  source_id,
  customer_user_id,
  designer_provider_id,
  project_id,
  current_stage,
  stage_changed_at,
  selected_foreman_provider_id,
  created_at,
  updated_at
)
SELECT 'booking',
       ${projectId},
       owner_id,
       provider_id,
       id,
       'in_progress',
       NOW(),
       ${providerId},
       NOW(),
       NOW()
FROM projects
WHERE id = ${projectId}
  AND NOT EXISTS (
    SELECT 1 FROM business_flows WHERE project_id = ${projectId}
  );
`;

  applySql(sql);
}

function prepareMerchantProjectReadyToStartFixture(projectId: number, providerId: number) {
  const sql = `
DELETE FROM business_flows WHERE project_id = ${projectId};
DELETE FROM business_flows WHERE source_type = 'booking' AND source_id = ${projectId};

UPDATE projects
SET provider_id = ${providerId},
    construction_provider_id = ${providerId},
    business_status = 'construction_quote_confirmed',
    status = 0,
    current_phase = '待开工',
    started_at = NULL,
    start_date = NULL,
    construction_quote = 188000
WHERE id = ${projectId};

UPDATE milestones
SET status = 0,
    rejection_reason = '',
    submitted_at = NULL,
    accepted_at = NULL,
    paid_at = NULL
WHERE project_id = ${projectId};

UPDATE business_flows
SET current_stage = 'ready_to_start',
    project_id = ${projectId},
    selected_foreman_provider_id = COALESCE(selected_foreman_provider_id, ${providerId}),
    stage_changed_at = NOW()
WHERE project_id = ${projectId};

INSERT INTO business_flows (
  source_type,
  source_id,
  customer_user_id,
  designer_provider_id,
  project_id,
  current_stage,
  stage_changed_at,
  selected_foreman_provider_id,
  created_at,
  updated_at
)
SELECT 'booking',
       ${projectId},
       owner_id,
       provider_id,
       id,
       'ready_to_start',
       NOW(),
       ${providerId},
       NOW(),
       NOW()
FROM projects
WHERE id = ${projectId}
  AND NOT EXISTS (
    SELECT 1 FROM business_flows WHERE project_id = ${projectId}
  );
`;

  applySql(sql);
}

async function bootstrapMerchantProjectExecution(
  request: Parameters<typeof test>[0]['request'],
  page: Parameters<typeof test>[0]['page'],
  options?: { phone?: string; code?: string },
) {
  clearRateLimit();

  const merchantOrigin = process.env.MERCHANT_ORIGIN || 'http://127.0.0.1:5175/merchant';
  const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';
  const merchantPhone = options?.phone || process.env.MERCHANT_PROJECT_PHONE || '13800000004';
  const merchantCode = options?.code || process.env.MERCHANT_CODE || '123456';

  const login = await loginMerchantSession(request, apiBaseUrl, merchantPhone, merchantCode);
  const projectListResult = await merchantApiGet<{ list: Array<{ id: number }> }>(
    request,
    apiBaseUrl,
    '/merchant/projects?page=1&pageSize=20',
    login.token,
  );

  expect(projectListResult.status).toBe(200);
  expect(projectListResult.body.code).toBe(0);
  expect(projectListResult.body.data?.list?.length || 0).toBeGreaterThan(0);

  const projectId = Number(projectListResult.body.data!.list[0].id);
  expect(projectId).toBeGreaterThan(0);

  prepareMerchantProjectExecutionFixture(projectId, login.provider.id);

  await page.addInitScript((session) => {
    window.localStorage.setItem('merchant_token', session.token);
    window.localStorage.setItem('merchant_provider', JSON.stringify(session.provider));
    if (session.tinodeToken) {
      window.localStorage.setItem('merchant_tinode_token', session.tinodeToken);
    }
  }, login);

  return { merchantOrigin, apiBaseUrl, login, projectId };
}

async function loginMerchantSession(
  request: Parameters<typeof test>[0]['request'],
  apiBaseUrl: string,
  phone: string,
  fallbackCode: string,
) {
  const cacheKey = `${apiBaseUrl}|${phone}`;
  const cached = merchantSessionCache.get(cacheKey);
  if (cached?.token) {
    return cached;
  }

  let code = fallbackCode;
  try {
    const sendCodeResponse = await request.post(`${apiBaseUrl}/auth/send-code`, {
      data: { phone, purpose: 'login' },
    });
    const sendCodeJson = await sendCodeResponse.json();
    code = sendCodeJson?.data?.debugCode || fallbackCode;
  } catch {
    clearRateLimit();
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      clearRateLimit();
      const result = await merchantApiPost<any>(request, apiBaseUrl, '/merchant/login', {
        phone,
        code,
      });
      expect(result.status, 'merchant login should not return 5xx').toBeLessThan(500);
      expect(result.status, 'merchant login http status should be 200').toBe(200);
      if (result.body.code === 429) {
        lastError = new Error(result.body.message || 'merchant login rate limited');
        continue;
      }
      expect(result.body.code, `merchant login business code should be 0, message=${result.body.message}`).toBe(0);
      expect(result.body.data?.token, 'merchant login should return token').toBeTruthy();
      merchantSessionCache.set(cacheKey, result.body.data);
      return result.body.data;
    } catch (error) {
      lastError = error;
      clearRateLimit();
    }
  }

  throw lastError;
}

test.describe('merchant project execution log', () => {
  test('merchant can create a project log with image in execution page', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);
    const { merchantOrigin, projectId } = await bootstrapMerchantProjectExecution(request, page);
    await page.goto(buildMerchantAppUrl(merchantOrigin, `/projects/${projectId}`), { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('施工日志', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: '新增日志' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: '新增日志' }).click();
    const modal = page.locator('.ant-modal-content').last();
    await expect(modal).toBeVisible();

    const title = `E2E施工日志-${Date.now()}`;
    await modal.getByPlaceholder('例如：水电施工第 3 天').fill(title);
    await modal.getByPlaceholder('记录本次施工进展、现场情况和交付说明').fill('E2E 自动化写入的施工日志内容，用于验证项目执行页新增日志闭环。');

    await fs.mkdir(testInfo.outputDir, { recursive: true });
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qkqQAAAAASUVORK5CYII=';
    const filePath = path.join(testInfo.outputDir, `merchant-project-log-${Date.now()}.png`);
    await fs.writeFile(filePath, Buffer.from(pngBase64, 'base64'));

    const fileInput = modal.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
    await expect(modal.locator('.ant-upload-list-item-container')).toHaveCount(1, { timeout: 20_000 });

    const saveButton = modal.locator('.ant-modal-footer .ant-btn-primary');
    await expect(saveButton).toBeVisible({ timeout: 20_000 });
    await saveButton.click();

    await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText('E2E 自动化写入的施工日志内容，用于验证项目执行页新增日志闭环。', { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('merchant can submit active milestone from execution page', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const { merchantOrigin, apiBaseUrl, login, projectId } = await bootstrapMerchantProjectExecution(request, page);
    await page.goto(buildMerchantAppUrl(merchantOrigin, `/projects/${projectId}`), { waitUntil: 'domcontentloaded' });

    const submitButton = page.getByRole('button', { name: '提交节点完成' });
    await expect(submitButton).toBeVisible({ timeout: 20_000 });
    await submitButton.click();

    await expect(page.getByText(/已提交验收/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('节点验收中')).toBeVisible({ timeout: 20_000 });

    const detailResult = await merchantApiGet<any>(
      request,
      apiBaseUrl,
      `/merchant/projects/${projectId}`,
      login.token,
    );
    expect(detailResult.status).toBe(200);
    expect(detailResult.body.code).toBe(0);
    expect(detailResult.body.data?.businessStage).toBe('node_acceptance_in_progress');
    expect(detailResult.body.data?.currentPhase).toContain('待验收');
    expect(detailResult.body.data?.milestones?.[0]?.status).toBe(2);
  });

  test('merchant can start project from ready-to-start execution page', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const { merchantOrigin, apiBaseUrl, login, projectId } = await bootstrapMerchantProjectExecution(request, page);
    prepareMerchantProjectReadyToStartFixture(projectId, login.provider.id);

    await page.goto(buildMerchantAppUrl(merchantOrigin, `/projects/${projectId}`), { waitUntil: 'domcontentloaded' });

    const startButton = page.getByRole('button', { name: '发起开工' });
    await expect(startButton).toBeVisible({ timeout: 20_000 });
    await startButton.click();

    await expect(page.getByText('项目已开工')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('开工交底施工中', { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    const detailResult = await merchantApiGet<any>(
      request,
      apiBaseUrl,
      `/merchant/projects/${projectId}`,
      login.token,
    );
    expect(detailResult.status).toBe(200);
    expect(detailResult.body.code).toBe(0);
    expect(detailResult.body.data?.businessStage).toBe('in_construction');
    expect(String(detailResult.body.data?.currentPhase || '')).toContain('施工中');
  });
});
