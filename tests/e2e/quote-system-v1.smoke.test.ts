import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { buildMerchantAppUrl, merchantApiGet, merchantApiPost, type MerchantLoginApiData } from './helpers/merchant';

type AdminLoginData = {
  token: string;
  admin: Record<string, unknown>;
  permissions: string[];
  menus: Array<Record<string, unknown>>;
};

const adminOrigin = process.env.E2E_ADMIN_ORIGIN || 'http://127.0.0.1:5175/admin';
const merchantOrigin = process.env.MERCHANT_ORIGIN || 'http://127.0.0.1:5175/merchant';
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';

function clearRateLimit() {
  execFileSync('bash', ['./scripts/user-web-clear-rate-limit.sh'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}

async function loginAdminByApiWithPayload(request: Parameters<typeof test>[0]['request']): Promise<AdminLoginData> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await request.post(`${apiBaseUrl}/admin/login`, {
      data: { username: process.env.E2E_ADMIN_USER || 'admin', password: process.env.E2E_ADMIN_PASS || 'admin123' },
    });
    expect(response.status(), 'admin login http status').toBe(200);
    const payload = await response.json();
    if (payload.code === 0) {
      expect(payload.data?.token, 'admin token').toBeTruthy();
      return payload.data as AdminLoginData;
    }
    if (payload.code === 429) {
      clearRateLimit();
      continue;
    }
    expect(payload.code, `admin login business code, message=${payload.message}`).toBe(0);
  }

  throw new Error('admin login exceeded retry budget after rate-limit reset');
}

async function loginMerchantByApiWithRetry(request: Parameters<typeof test>[0]['request']): Promise<MerchantLoginApiData> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await merchantApiPost<MerchantLoginApiData>(
      request,
      apiBaseUrl,
      '/merchant/login',
      {
        phone: process.env.MERCHANT_PHONE || '13800000001',
        code: process.env.MERCHANT_CODE || '123456',
      },
    );

    expect(result.status, 'merchant login should not return 5xx').toBeLessThan(500);
    expect(result.status, 'merchant login http status should be 200').toBe(200);

    if (result.body.code === 0) {
      expect(result.body.data?.token, 'merchant token').toBeTruthy();
      return result.body.data;
    }

    if (result.body.code === 429) {
      clearRateLimit();
      continue;
    }

    expect(result.body.code, `merchant login business code should be 0, message=${result.body.message}`).toBe(0);
  }

  throw new Error('merchant login exceeded retry budget after rate-limit reset');
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
  if (body.code === 429) {
    clearRateLimit();
    const retryResponse = await request.get(`${apiBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(retryResponse.status(), `${path} retry http status`).toBe(200);
    const retryBody = await retryResponse.json();
    expect(retryBody.code, `${path} retry business code, message=${retryBody.message}`).toBe(0);
    return retryBody.data as T;
  }
  expect(body.code, `${path} business code, message=${body.message}`).toBe(0);
  return body.data as T;
}

async function merchantApiPostWithRetry<T = any>(
  request: Parameters<typeof test>[0]['request'],
  path: string,
  payload: unknown,
  token: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await merchantApiPost<T>(request, apiBaseUrl, path, payload, token);
    if (result.body.code === 0) {
      return result;
    }
    if (result.body.code !== 429) {
      return result;
    }
    clearRateLimit();
  }
  return merchantApiPost<T>(request, apiBaseUrl, path, payload, token);
}

async function merchantApiGetWithRetry<T = any>(
  request: Parameters<typeof test>[0]['request'],
  path: string,
  token: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await merchantApiGet<T>(request, apiBaseUrl, path, token);
    if (result.body.code === 0) {
      return result;
    }
    if (result.body.code !== 429) {
      return result;
    }
    clearRateLimit();
  }
  return merchantApiGet<T>(request, apiBaseUrl, path, token);
}

test.describe('quote system v1 smoke', () => {
  test.setTimeout(180_000);

  test('admin -> merchant -> admin minimal quote flow works', async ({ request, browser }) => {
    clearRateLimit();
    const adminLogin = await loginAdminByApiWithPayload(request);
    const merchantLogin = await loginMerchantByApiWithRetry(request);

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
    await expect(adminPage.getByText('平台标准施工项库')).toBeVisible();

    await adminPage.goto(`${adminOrigin}/projects/quotes/lists`, { waitUntil: 'domcontentloaded' });
    await expect(adminPage.getByText('报价任务批次管理')).toBeVisible();

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
    await expect(merchantPage.getByRole('heading', { name: '报价清单' })).toBeVisible();

    clearRateLimit();
    await merchantPage.goto(buildMerchantAppUrl(merchantOrigin, `/quote-lists/${quoteList.id}`), { waitUntil: 'domcontentloaded' });
    await expect(merchantPage.getByText(firstItem.name)).toBeVisible();

    const merchantDraftDetail = await merchantApiGet<{ items?: Array<{ id: number }> }>(
      request,
      apiBaseUrl,
      `/merchant/quote-lists/${quoteList.id}`,
      merchantLogin.token,
    );
    expect(merchantDraftDetail.body.code).toBe(0);
    const quoteListItemId = Number(merchantDraftDetail.body.data?.items?.[0]?.id || 0);
    expect(quoteListItemId).toBeGreaterThan(0);
    const submitResult = await merchantApiPostWithRetry(
      request,
      `/merchant/quote-lists/${quoteList.id}/submission/submit`,
      {
        items: [
          {
            quoteListItemId,
            unitPriceCent: 1880,
            remark: 'E2E 提交报价',
          },
        ],
      },
      merchantLogin.token,
    );
    expect(submitResult.body.code).toBe(0);
    const merchantSubmittedDetail = await merchantApiGetWithRetry<{ submission?: { status?: string } }>(
      request,
      `/merchant/quote-lists/${quoteList.id}`,
      merchantLogin.token,
    );
    expect(merchantSubmittedDetail.body.code).toBe(0);
    expect(merchantSubmittedDetail.body.data?.submission?.status).toBe('submitted');

    clearRateLimit();
    await adminPage.goto(`${adminOrigin}/projects/quotes/compare/${quoteList.id}`, { waitUntil: 'domcontentloaded' });
    await expect(adminPage.getByRole('button', { name: '提交用户确认' }).first()).toBeVisible();

    const compareBefore = await adminApiGet<{ submissions: Array<{ submissionId: number }> }>(
      request,
      `/admin/quote-lists/${quoteList.id}/comparison`,
      adminLogin.token,
    );
    const submissionId = Number(compareBefore.submissions?.[0]?.submissionId || 0);
    expect(submissionId).toBeGreaterThan(0);
    await adminApiPost(
      request,
      `/admin/quote-tasks/${quoteList.id}/submit-to-user`,
      adminLogin.token,
      { submissionId },
    );

    clearRateLimit();
    const comparison = await adminApiGet<{ quoteList: { status: string; activeSubmissionId: number; userConfirmationStatus: string } }>(
      request,
      `/admin/quote-lists/${quoteList.id}/comparison`,
      adminLogin.token,
    );
    expect(comparison.quoteList.status).toBe('submitted_to_user');
    expect(comparison.quoteList.activeSubmissionId).toBeGreaterThan(0);
    expect(comparison.quoteList.userConfirmationStatus).toBe('pending');

    await adminContext.close();
    await merchantContext.close();
  });
});
