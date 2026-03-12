import { expect, test } from '@playwright/test';
import { buildMerchantAppUrl, loginMerchantByApi, merchantApiGet, merchantApiPost } from './helpers/merchant';

type AdminLoginData = {
  token: string;
  admin: Record<string, unknown>;
  permissions: string[];
  menus: Array<Record<string, unknown>>;
};

const adminOrigin = process.env.E2E_ADMIN_ORIGIN || 'http://127.0.0.1:5173';
const merchantOrigin = process.env.MERCHANT_ORIGIN || 'http://127.0.0.1:5174';
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';

async function loginAdminByApiWithPayload(request: Parameters<typeof test>[0]['request']): Promise<AdminLoginData> {
  const response = await request.post(`${apiBaseUrl}/admin/login`, {
    data: { username: process.env.E2E_ADMIN_USER || 'admin', password: process.env.E2E_ADMIN_PASS || 'admin123' },
  });
  expect(response.status(), 'admin login http status').toBe(200);
  const payload = await response.json();
  expect(payload.code, `admin login business code, message=${payload.message}`).toBe(0);
  expect(payload.data?.token, 'admin token').toBeTruthy();
  return payload.data as AdminLoginData;
}

async function adminApiPost<T = any>(request: Parameters<typeof test>[0]['request'], path: string, token: string, payload?: unknown) {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: payload,
  });
  expect(response.status(), `${path} http status`).toBe(200);
  const body = await response.json();
  expect(body.code, `${path} business code, message=${body.message}`).toBe(0);
  return body.data as T;
}

async function adminApiGet<T = any>(request: Parameters<typeof test>[0]['request'], path: string, token: string) {
  const response = await request.get(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status(), `${path} http status`).toBe(200);
  const body = await response.json();
  expect(body.code, `${path} business code, message=${body.message}`).toBe(0);
  return body.data as T;
}

test.describe('quote system v1 smoke', () => {
  test.setTimeout(180_000);

  test('admin -> merchant -> admin minimal quote flow works', async ({ request, browser }) => {
    const adminLogin = await loginAdminByApiWithPayload(request);
    const merchantLogin = await loginMerchantByApi(
      request,
      apiBaseUrl,
      process.env.MERCHANT_PHONE || '13800000001',
      process.env.MERCHANT_CODE || '123456',
    );

    await adminApiPost(request, '/admin/quote-library/import', adminLogin.token, {});
    const library = await adminApiGet<{ list: Array<{ id: number; name: string }> }>(
      request,
      '/admin/quote-library/items?page=1&pageSize=20',
      adminLogin.token,
    );
    expect(library.list.length, 'quote library items after import').toBeGreaterThan(0);
    const firstItem = library.list[0];

    const title = `联调报价清单-${Date.now()}`;
    const quoteList = await adminApiPost<{ id: number }>(request, '/admin/quote-lists', adminLogin.token, {
      projectId: 101,
      customerId: 201,
      houseId: 301,
      ownerUserId: 401,
      scenarioType: 'plan_a',
      title,
      currency: 'CNY',
    });

    await adminApiPost(request, `/admin/quote-lists/${quoteList.id}/items/batch-upsert`, adminLogin.token, {
      items: [
        {
          standardItemId: firstItem.id,
          lineNo: 1,
          quantity: 12,
          sortOrder: 1,
        },
      ],
    });
    await adminApiPost(request, `/admin/quote-lists/${quoteList.id}/invitations`, adminLogin.token, {
      providerIds: [merchantLogin.provider.id],
    });
    await adminApiPost(request, `/admin/quote-lists/${quoteList.id}/start`, adminLogin.token, {});

    const adminContext = await browser.newContext();
    await adminContext.addInitScript((storage) => {
      localStorage.setItem('admin_token', storage.token);
      localStorage.setItem('admin_user', JSON.stringify(storage.admin));
      localStorage.setItem('admin_permissions', JSON.stringify(storage.permissions));
      localStorage.setItem('admin_menus', JSON.stringify(storage.menus));
    }, adminLogin);
    const adminPage = await adminContext.newPage();

    await adminPage.goto(`${adminOrigin}/projects/quotes/library`, { waitUntil: 'domcontentloaded' });
    await expect(adminPage.getByText('报价库管理')).toBeVisible();

    await adminPage.goto(`${adminOrigin}/projects/quotes/lists`, { waitUntil: 'domcontentloaded' });
    await expect(adminPage.getByText('报价清单管理')).toBeVisible();
    await expect(adminPage.getByText(title)).toBeVisible();

    const merchantContext = await browser.newContext();
    await merchantContext.addInitScript((storage) => {
      localStorage.setItem('merchant_token', storage.token);
      localStorage.setItem('merchant_provider', JSON.stringify(storage.provider));
      if (storage.tinodeToken) {
        localStorage.setItem('merchant_tinode_token', storage.tinodeToken);
      }
    }, merchantLogin);
    const merchantPage = await merchantContext.newPage();

    await merchantPage.goto(buildMerchantAppUrl(merchantOrigin, '/quote-lists'), { waitUntil: 'domcontentloaded' });
    await expect(merchantPage.getByText('报价清单')).toBeVisible();
    await expect(merchantPage.getByText(title)).toBeVisible();

    await merchantPage.goto(buildMerchantAppUrl(merchantOrigin, `/quote-lists/${quoteList.id}`), { waitUntil: 'domcontentloaded' });
    await expect(merchantPage.getByText(title)).toBeVisible();
    await expect(merchantPage.getByText(firstItem.name)).toBeVisible();

    const unitPriceInput = merchantPage.getByRole('spinbutton').first();
    await unitPriceInput.click();
    await unitPriceInput.fill('18.80');
    await merchantPage.getByRole('button', { name: '保存草稿' }).click();
    await expect(merchantPage.getByText('已保存草稿')).toBeVisible();

    await merchantPage.getByRole('button', { name: '提交报价' }).click();
    await merchantPage.getByRole('button', { name: '提交', exact: true }).click();
    await expect(merchantPage.getByText('报价已提交')).toBeVisible();

    await adminPage.goto(`${adminOrigin}/projects/quotes/compare/${quoteList.id}`, { waitUntil: 'domcontentloaded' });
    await expect(adminPage.getByText('报价对比')).toBeVisible();
    await expect(adminPage.getByText('定标')).toBeVisible();
    await adminPage.getByRole('button', { name: '定标' }).first().click();
    await adminPage.getByRole('button', { name: '确认定标' }).click();
    await expect(adminPage.getByText('定标完成')).toBeVisible();

    const comparison = await adminApiGet<{ quoteList: { status: string; awardedProviderId: number } }>(
      request,
      `/admin/quote-lists/${quoteList.id}/comparison`,
      adminLogin.token,
    );
    expect(comparison.quoteList.status).toBe('awarded');
    expect(comparison.quoteList.awardedProviderId).toBe(merchantLogin.provider.id);

    await adminContext.close();
    await merchantContext.close();
  });
});
