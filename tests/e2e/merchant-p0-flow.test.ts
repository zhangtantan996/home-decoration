import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

import { buildMerchantAppUrl, merchantApiGet, merchantApiPost } from './helpers/merchant';

const DB_CONTAINER = process.env.USER_WEB_FIXTURE_DB_CONTAINER || 'home_decor_db_local';
const DB_NAME = process.env.USER_WEB_FIXTURE_DB_NAME || 'home_decoration';
const DB_USER = process.env.USER_WEB_FIXTURE_DB_USER || 'postgres';
const DB_URL = process.env.USER_WEB_FIXTURE_DB_URL || '';
const BOOKING_ID = 99210;
const REDIS_CONTAINER = process.env.USER_WEB_FIXTURE_REDIS_CONTAINER || 'home_decor_redis_local';
const REDIS_PASSWORD = process.env.USER_WEB_FIXTURE_REDIS_PASSWORD || 'kXTSG3Q7yjug7I60JgOmWo6w9OIJrFUf';

function clearRateLimit() {
  if (DB_URL) {
    return;
  }
  let keys = '';
  try {
    keys = execFileSync('docker', ['exec', REDIS_CONTAINER, 'redis-cli', '-a', REDIS_PASSWORD, '--raw', 'KEYS', 'rate_limit:*'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return;
  }
  if (!keys) {
    return;
  }
  for (const key of keys.split('\n')) {
    if (!key) continue;
    execFileSync('docker', ['exec', REDIS_CONTAINER, 'redis-cli', '-a', REDIS_PASSWORD, 'DEL', key], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  }
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

function prepareMerchantBookingP0Fixture(providerId: number) {
  const sql = `
DELETE FROM budget_confirmations WHERE booking_id = ${BOOKING_ID};
DELETE FROM site_surveys WHERE booking_id = ${BOOKING_ID};
DELETE FROM business_flows WHERE source_type = 'booking' AND source_id = ${BOOKING_ID};
DELETE FROM bookings WHERE id = ${BOOKING_ID};

INSERT INTO bookings (
  id, user_id, provider_id, provider_type, address, area, renovation_type, budget_range,
  preferred_date, phone, notes, house_layout, status, intent_fee, intent_fee_paid,
  intent_fee_deducted, intent_fee_refunded, merchant_response_deadline, created_at, updated_at
) VALUES (
  ${BOOKING_ID}, 99100, ${providerId}, 'designer', '西安市高新区 P0 量房测试 1 号', 96, '全屋整装', '10-30万',
  '2026-03-25', '19999100001', 'merchant p0 e2e booking', '三室两厅', 2, 99, true,
  false, false, NOW() + interval '2 day', NOW(), NOW()
);

INSERT INTO business_flows (
  source_type, source_id, customer_user_id, designer_provider_id, current_stage, stage_changed_at, created_at, updated_at
) VALUES (
  'booking', ${BOOKING_ID}, 99100, ${providerId}, 'negotiating', NOW(), NOW(), NOW()
);
`;
  applySql(sql);
}

function prepareMerchantCompletionFixture(projectId: number, providerId: number) {
  const sql = `
DELETE FROM case_audits WHERE source_type = 'project_completion' AND source_project_id = ${projectId};
UPDATE projects
SET provider_id = ${providerId},
    construction_provider_id = ${providerId},
    business_status = 'in_progress',
    status = 0,
    current_phase = '待提交完工材料',
    inspiration_case_draft_id = 0,
    completed_photos = '[]'::jsonb,
    completion_notes = NULL,
    completion_submitted_at = NULL,
    completion_rejection_reason = NULL,
    completion_rejected_at = NULL,
    actual_end = NULL,
    started_at = COALESCE(started_at, NOW()),
    start_date = COALESCE(start_date, NOW())
WHERE id = ${projectId};

UPDATE milestones
SET status = 3,
    rejection_reason = '',
    submitted_at = NOW() - interval '2 day',
    accepted_at = NOW() - interval '1 day',
    paid_at = NULL
WHERE project_id = ${projectId};

UPDATE business_flows
SET current_stage = 'in_progress',
    inspiration_case_draft_id = 0,
    selected_foreman_provider_id = COALESCE(selected_foreman_provider_id, ${providerId}),
    stage_changed_at = NOW(),
    closed_reason = ''
WHERE project_id = ${projectId};
`;
  applySql(sql);
}

async function loginMerchantSession(
  request: Parameters<typeof test>[0]['request'],
  apiBaseUrl: string,
  phone: string,
  fallbackCode: string,
) {
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
      expect(result.status).toBe(200);
      if (result.body.code === 429) {
        lastError = new Error(result.body.message || 'merchant login rate limited');
        continue;
      }
      expect(result.body.code).toBe(0);
      expect(result.body.data?.token).toBeTruthy();
      return result.body.data;
    } catch (error) {
      lastError = error;
      clearRateLimit();
    }
  }
  throw lastError;
}

async function bootstrapMerchantSession(
  request: Parameters<typeof test>[0]['request'],
  page: Parameters<typeof test>[0]['page'],
) {
  clearRateLimit();
  const merchantOrigin = process.env.MERCHANT_ORIGIN || 'http://127.0.0.1:5175/merchant';
  const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';
  const phone = process.env.MERCHANT_PROJECT_PHONE || process.env.MERCHANT_PHONE || '19999100002';
  const login = await loginMerchantSession(request, apiBaseUrl, phone, process.env.MERCHANT_CODE || '123456');

  await page.addInitScript((session) => {
    window.localStorage.setItem('merchant_token', session.token);
    window.localStorage.setItem('merchant_provider', JSON.stringify(session.provider));
    if (session.tinodeToken) {
      window.localStorage.setItem('merchant_tinode_token', session.tinodeToken);
    }
  }, login);

  return { merchantOrigin, apiBaseUrl, login };
}

test.describe('merchant p0 flow', () => {
  test('merchant can submit site survey and budget confirm pages', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);
    const { merchantOrigin, apiBaseUrl, login } = await bootstrapMerchantSession(request, page);
    prepareMerchantBookingP0Fixture(login.provider.id);

    await page.goto(buildMerchantAppUrl(merchantOrigin, `/bookings/${BOOKING_ID}/site-survey`), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: `量房记录 #${BOOKING_ID}` })).toBeVisible({ timeout: 20_000 });

    await fs.mkdir(testInfo.outputDir, { recursive: true });
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qkqQAAAAASUVORK5CYII=';
    const filePath = path.join(testInfo.outputDir, `merchant-site-survey-${Date.now()}.png`);
    await fs.writeFile(filePath, Buffer.from(pngBase64, 'base64'));

    await page.locator('input[type="file"]').first().setInputFiles(filePath);
    await page.locator('input').nth(1).fill('客厅');
    await page.locator('input[role="spinbutton"]').nth(0).fill('5.2');
    await page.locator('input[role="spinbutton"]').nth(1).fill('4.6');
    await page.locator('input[role="spinbutton"]').nth(2).fill('2.8');
    await page.getByPlaceholder('记录量房现场情况、用户关注点和后续建议').fill('E2E 量房记录：先完成客厅与主卧测量。');
    await page.getByRole('button', { name: '提交量房记录' }).click();
    await expect(page.getByText('量房记录已提交')).toBeVisible({ timeout: 20_000 });

    const ownerLoginSend = await request.post(`${apiBaseUrl}/auth/send-code`, { data: { phone: '19999100001', purpose: 'login' } });
    const ownerCode = (await ownerLoginSend.json())?.data?.debugCode || '123456';
    const ownerLogin = await request.post(`${apiBaseUrl}/auth/login`, { data: { phone: '19999100001', code: ownerCode } });
    const ownerJson = await ownerLogin.json();
    const ownerToken = ownerJson?.data?.token as string;
    expect(ownerToken).toBeTruthy();

    const confirmSurvey = await request.post(`${apiBaseUrl}/bookings/${BOOKING_ID}/site-survey/confirm`, {
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    });
    const confirmSurveyJson = await confirmSurvey.json();
    expect(confirmSurveyJson.code).toBe(0);

    await page.goto(buildMerchantAppUrl(merchantOrigin, `/bookings/${BOOKING_ID}/budget-confirm`), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: `预算确认 #${BOOKING_ID}` })).toBeVisible({ timeout: 20_000 });
    await page.locator('input[role="spinbutton"]').nth(0).fill('50000');
    await page.locator('input[role="spinbutton"]').nth(1).fill('80000');
    await page.getByPlaceholder('说明风格建议、功能诉求和方案方向，用户接受预算时会一并确认这里的设计意向。').fill('现代简约，强化玄关收纳和餐厨动线。');
    await page.getByPlaceholder('补充预算假设、范围边界和已知不包含项。').fill('不含家具软装与智能家居。');
    await page.getByRole('button', { name: '提交预算确认' }).click();
    await expect(page.getByText('预算确认已提交')).toBeVisible({ timeout: 20_000 });

    const budgetResult = await merchantApiGet<any>(request, apiBaseUrl, `/merchant/bookings/${BOOKING_ID}/budget-confirm`, login.token);
    expect(budgetResult.status).toBe(200);
    expect(budgetResult.body.code).toBe(0);
    expect(budgetResult.body.data?.budgetConfirmation?.status).toBe('submitted');
  });

  test('merchant can submit completion materials from execution page', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);
    const { merchantOrigin, apiBaseUrl, login } = await bootstrapMerchantSession(request, page);
    const projectId = 99140;
    prepareMerchantCompletionFixture(projectId, login.provider.id);

    await page.goto(buildMerchantAppUrl(merchantOrigin, `/projects/${projectId}`), { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('完工材料', { exact: true })).toBeVisible({ timeout: 20_000 });

    await fs.mkdir(testInfo.outputDir, { recursive: true });
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qkqQAAAAASUVORK5CYII=';
    const filePath = path.join(testInfo.outputDir, `merchant-completion-${Date.now()}.png`);
    await fs.writeFile(filePath, Buffer.from(pngBase64, 'base64'));

    await page.locator('input[type="file"]').first().setInputFiles(filePath);
    await page.getByPlaceholder('说明完工范围、交付结果和建议验收重点。').fill('E2E 完工提交：柜体、灯具、收口均已完成。');
    await page.getByRole('button', { name: '提交完工材料' }).click();
    await expect(page.getByText('完工材料已提交')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('已完工待验收').first()).toBeVisible({ timeout: 20_000 });

    const detailResult = await merchantApiGet<any>(request, apiBaseUrl, `/merchant/projects/${projectId}`, login.token);
    expect(detailResult.status).toBe(200);
    expect(detailResult.body.code).toBe(0);
    expect(detailResult.body.data?.businessStage).toBe('completed');
    expect(detailResult.body.data?.completionSubmittedAt).toBeTruthy();
  });
});
