import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const DB_CONTAINER = process.env.USER_WEB_FIXTURE_DB_CONTAINER || 'home_decor_db_local';
const DB_NAME = process.env.USER_WEB_FIXTURE_DB_NAME || 'home_decoration';
const DB_USER = process.env.USER_WEB_FIXTURE_DB_USER || 'postgres';
const DB_URL = process.env.USER_WEB_FIXTURE_DB_URL || '';

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

async function loginAdminSession(request: Parameters<typeof test>[0]['request']) {
  const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';
  const response = await request.post(`${apiBaseUrl}/admin/login`, {
    data: {
      username: process.env.E2E_ADMIN_USER || 'admin',
      password: process.env.E2E_ADMIN_PASS || 'admin123',
    },
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.code).toBe(0);
  expect(payload.data?.token).toBeTruthy();
  return payload.data;
}

async function getAdminProjectDetail(
  request: Parameters<typeof test>[0]['request'],
  adminToken: string,
  projectId: number,
) {
  const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';
  const response = await request.get(`${apiBaseUrl}/admin/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.code).toBe(0);
  return payload.data;
}

async function waitForProjectState(
  request: Parameters<typeof test>[0]['request'],
  adminToken: string,
  projectId: number,
  predicate: (detail: any) => boolean,
  timeoutMs = 15000,
) {
  const startedAt = Date.now();
  let lastDetail: any = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastDetail = await getAdminProjectDetail(request, adminToken, projectId);
    if (predicate(lastDetail)) {
      return lastDetail;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`project state did not converge in time: ${JSON.stringify(lastDetail)}`);
}

function prepareProjectForConstructionSelection(projectId: number, providerId: number) {
  applySql(`
UPDATE projects
SET provider_id = ${providerId},
    construction_provider_id = 0,
    foreman_id = 0,
    construction_quote = 0,
    construction_confirmed_at = NULL,
    quote_confirmed_at = NULL,
    business_status = 'draft',
    current_phase = '准备阶段'
WHERE id = ${projectId};

UPDATE business_flows
SET current_stage = 'construction_party_pending',
    selected_foreman_provider_id = 0,
    selected_quote_submission_id = 0,
    stage_changed_at = NOW()
WHERE project_id = ${projectId};
`);
}

function prepareProjectForQuoteConfirmation(projectId: number, foremanId: number) {
  applySql(`
UPDATE projects
SET provider_id = ${foremanId},
    construction_provider_id = 0,
    foreman_id = ${foremanId},
    construction_quote = 0,
    construction_confirmed_at = NOW(),
    quote_confirmed_at = NULL,
    business_status = 'construction_confirmed',
    current_phase = '施工方已确认'
WHERE id = ${projectId};

UPDATE business_flows
SET current_stage = 'construction_party_pending',
    selected_foreman_provider_id = ${foremanId},
    selected_quote_submission_id = 0,
    stage_changed_at = NOW()
WHERE project_id = ${projectId};
`);
}

test.describe('admin project construction acceptance', () => {
  test('admin can confirm construction party from project detail', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const adminOrigin = process.env.E2E_ADMIN_ORIGIN || 'http://127.0.0.1:5175/admin';
    const projectId = Number(process.env.E2E_ADMIN_PROJECT_ID || 3);
    const originalProviderId = 90004;

    prepareProjectForConstructionSelection(projectId, originalProviderId);
    const adminSession = await loginAdminSession(request);

    await page.addInitScript((storage) => {
      localStorage.setItem('admin_token', storage.token);
      localStorage.setItem('admin_user', JSON.stringify(storage.admin));
      localStorage.setItem('admin_permissions', JSON.stringify(storage.permissions));
      localStorage.setItem('admin_menus', JSON.stringify(storage.menus));
    }, adminSession);

    await page.goto(`${adminOrigin}/projects/detail/${projectId}?action=construction`, { waitUntil: 'domcontentloaded' });

    const modal = page.getByRole('dialog', { name: '运营干预施工方' });
    await expect(modal).toBeVisible({ timeout: 15000 });

    await modal.locator('.ant-select').first().click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '独立工长' }).click();

    await modal.locator('.ant-select').nth(1).click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '王胜利' }).first().click();

    const confirmButton = modal.locator('.ant-modal-footer .ant-btn-primary');
    await confirmButton.click();

    await expect(modal).toHaveCount(0);

    const detail = await waitForProjectState(
      request,
      adminSession.token,
      projectId,
      (next) => next.businessStatus === 'construction_confirmed' && Number(next.foremanId || 0) > 0,
    );
    expect(Number(detail.foremanId || 0)).toBeGreaterThan(0);
    expect(Number(detail.constructionProviderId || 0)).toBe(0);
    expect(detail.businessStatus).toBe('construction_confirmed');
    expect(detail.currentPhase).toBe('施工方已确认');
  });

  test('admin can confirm construction quote from project detail', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const adminOrigin = process.env.E2E_ADMIN_ORIGIN || 'http://127.0.0.1:5175/admin';
    const projectId = Number(process.env.E2E_ADMIN_PROJECT_ID || 3);
    const foremanId = 90011;
    const quoteValue = 188000;

    prepareProjectForQuoteConfirmation(projectId, foremanId);
    const adminSession = await loginAdminSession(request);

    await page.addInitScript((storage) => {
      localStorage.setItem('admin_token', storage.token);
      localStorage.setItem('admin_user', JSON.stringify(storage.admin));
      localStorage.setItem('admin_permissions', JSON.stringify(storage.permissions));
      localStorage.setItem('admin_menus', JSON.stringify(storage.menus));
    }, adminSession);

    await page.goto(`${adminOrigin}/projects/detail/${projectId}?action=quote`, { waitUntil: 'domcontentloaded' });

    const modal = page.getByRole('dialog', { name: '运营干预施工报价' });
    await expect(modal).toBeVisible({ timeout: 15000 });

    await modal.locator('.ant-input-number-input').fill(String(quoteValue));
    await modal.locator('.ant-select').first().click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '业主自采' }).click();

    const plannedStartPicker = modal.locator('.ant-picker').nth(0);
    await plannedStartPicker.click();
    const pickerDropdown = page.locator('.ant-picker-dropdown:visible').last();
    await pickerDropdown.locator('.ant-picker-cell-in-view').filter({ hasText: /^20$/ }).first().click();

    await modal.locator('.ant-modal-footer .ant-btn-primary').click();

    const detail = await waitForProjectState(
      request,
      adminSession.token,
      projectId,
      (next) => next.businessStatus === 'construction_quote_confirmed' && Number(next.constructionQuote || 0) === quoteValue,
    );
    expect(Number(detail.constructionQuote || 0)).toBe(quoteValue);
    expect(detail.businessStatus).toBe('construction_quote_confirmed');
    expect(detail.currentPhase).toBe('待开工');
    expect(detail.businessStage).toBe('ready_to_start');
  });
});
