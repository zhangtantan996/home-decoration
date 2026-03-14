import { expect, request, test, type APIRequestContext } from '@playwright/test';

import { loginUserByCode } from './identity/helpers/identity';
import { buildMerchantAppUrl, getMerchantAdminTestEnv, getMerchantTestEnv, loginMerchantByApi } from './helpers/merchant';

interface DemandCreateData {
  id: number;
}

interface MerchantLoginData {
  token: string;
  provider: {
    id: number;
    name?: string;
    phone?: string;
    providerType?: number;
  };
  tinodeToken?: string;
}

interface AdminLoginPayload {
  token: string;
  admin: Record<string, unknown>;
  permissions: string[];
  menus: Array<Record<string, unknown>>;
}

test.describe.serial('Phase1 demand admin/merchant UI flow', () => {
  const merchantEnv = getMerchantTestEnv();
  const adminEnv = getMerchantAdminTestEnv();
  const adminOrigin = process.env.ADMIN_ORIGIN || 'http://127.0.0.1:5175/admin';
  const merchantOrigin = (process.env.MERCHANT_ORIGIN || 'http://127.0.0.1:5175/merchant').replace(/\/$/, '');

  let api: APIRequestContext;
  let userToken = '';
  let providerId = 0;
  let demandId = 0;
  let demandTitle = '';
  let merchantSession: MerchantLoginData;
  let adminSession: AdminLoginPayload;

  test.beforeAll(async () => {
    api = await request.newContext();

    const runId = Date.now();
    demandTitle = `E2E-Phase1-需求-${runId}`;

    const user = await loginUserByCode(api, merchantEnv.apiBaseUrl, '19999100001');
    userToken = user.token;

    const adminLoginRes = await api.post(`${merchantEnv.apiBaseUrl}/admin/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { username: adminEnv.username, password: adminEnv.password },
    });
    expect(adminLoginRes.status()).toBe(200);
    const adminLoginPayload = await adminLoginRes.json() as { code: number; data?: AdminLoginPayload };
    expect(adminLoginPayload.code).toBe(0);
    adminSession = adminLoginPayload.data as AdminLoginPayload;

    merchantSession = await loginMerchantByApi(api, merchantEnv.apiBaseUrl, '19999100002', merchantEnv.code) as MerchantLoginData;
    providerId = Number(merchantSession.provider.id);

    const createDemandRes = await api.post(`${merchantEnv.apiBaseUrl}/demands`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      data: {
        demandType: 'renovation',
        title: demandTitle,
        city: '西安',
        district: '雁塔区',
        address: '联调大道 100 号',
        area: 95,
        budgetMin: 100000,
        budgetMax: 200000,
        timeline: '3month',
        stylePref: '现代简约',
        description: 'E2E 串行联调需求，用于验证需求中心和线索页。',
        attachments: [{ url: 'https://example.com/e2e-demand.jpg', name: 'e2e-demand.jpg', size: 102400 }],
      },
    });
    expect(createDemandRes.status()).toBe(200);
    const createDemandPayload = await createDemandRes.json() as { code: number; data?: DemandCreateData };
    expect(createDemandPayload.code).toBe(0);
    demandId = Number(createDemandPayload.data?.id || 0);
    expect(demandId).toBeGreaterThan(0);

    const submitDemandRes = await api.post(`${merchantEnv.apiBaseUrl}/demands/${demandId}/submit`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(submitDemandRes.status()).toBe(200);
    const submitDemandPayload = await submitDemandRes.json() as { code: number };
    expect(submitDemandPayload.code).toBe(0);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('Admin 可在需求中心完成审核与分配', async ({ page }) => {
    await page.addInitScript((session) => {
      window.localStorage.setItem('admin_token', session.token);
      window.localStorage.setItem('admin_user', JSON.stringify(session.admin));
      window.localStorage.setItem('admin_permissions', JSON.stringify(session.permissions));
      window.localStorage.setItem('admin_menus', JSON.stringify(session.menus));
    }, adminSession);

    await page.goto(`${adminOrigin}/demands/list`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTitle('需求管理')).toBeVisible({ timeout: 30_000 });

    const row = page.locator('tr', { hasText: demandTitle }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole('button', { name: '详情' }).click();
    await expect(page.getByText(`需求详情 #${demandId}`)).toBeVisible();
    await expect(page.getByText('E2E 串行联调需求，用于验证需求中心和线索页。')).toBeVisible();
    await page.locator('.ant-drawer .ant-drawer-close').click();
    await expect(page.getByText(`需求详情 #${demandId}`)).toBeHidden({ timeout: 15_000 });

    await row.getByRole('button', { name: '通过' }).click();
    await page.getByRole('textbox').fill('E2E 审核通过');
    await page.locator('.ant-modal .ant-btn-primary').click();
    await expect(page.getByText('需求已审核通过')).toBeVisible({ timeout: 15_000 });

    await page.goto(`${adminOrigin}/demands/${demandId}/assign`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/demands/${demandId}/assign$`));
    await expect(page.getByText('候选商家')).toBeVisible({ timeout: 30_000 });

    const providerRow = page.locator('tr', { hasText: '拾光设计联调' }).first();
    await expect(providerRow).toBeVisible({ timeout: 30_000 });
    await providerRow.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: '分配给已选商家' }).click();
    await expect(page.getByText(/已分配/)).toBeVisible({ timeout: 15_000 });
  });

  test('Merchant 可在 线索管理 页面接受线索并打开提交方案弹窗', async ({ page }) => {
    await page.addInitScript((session) => {
      window.localStorage.setItem('merchant_token', session.token);
      window.localStorage.setItem('merchant_provider', JSON.stringify(session.provider));
      if (session.tinodeToken) {
        window.localStorage.setItem('merchant_tinode_token', session.tinodeToken);
      }
    }, merchantSession);

    await page.goto(buildMerchantAppUrl(merchantOrigin, '/leads'), { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.ant-card-head-title', { hasText: '线索管理' }).first()).toBeVisible({ timeout: 30_000 });

    const row = page.locator('tr', { hasText: demandTitle }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole('button', { name: /接\s*受/ }).click();
    await expect(page.getByText('已接受线索')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('tr', { hasText: demandTitle }).getByText('已接受')).toBeVisible({ timeout: 30_000 });

    const acceptedRow = page.locator('tr', { hasText: demandTitle }).first();
    await acceptedRow.getByRole('button', { name: '提交方案' }).click();
    await expect(page.getByText(`提交方案 · ${demandTitle}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('方案摘要')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('方案摘要')).toHaveValue(new RegExp(demandTitle));
  });
});
