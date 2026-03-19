import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

import {
  buildMerchantAppUrl,
  merchantApiGet,
  merchantApiPost,
  merchantApiPut,
} from './helpers/merchant';

function clearRateLimit() {
  execFileSync('bash', ['./scripts/user-web-clear-rate-limit.sh'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}

async function loginMerchantSession(
  request: Parameters<typeof test>[0]['request'],
  apiBaseUrl: string,
  phone: string,
  fallbackCode = '123456',
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    clearRateLimit();
    try {
      const result = await merchantApiPost<any>(request, apiBaseUrl, '/merchant/login', { phone, code: fallbackCode });
      expect(result.status).toBe(200);
      if (result.body.code === 429) {
        lastError = new Error(result.body.message || 'rate limited');
        continue;
      }
      expect(result.body.code).toBe(0);
      expect(result.body.data?.token).toBeTruthy();
      return result.body.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

test.describe('merchant role scope acceptance', () => {
  test('material shop only exposes dashboard/products/settings and settings page is minimal', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const merchantOrigin = process.env.MERCHANT_ORIGIN || 'http://127.0.0.1:5175/merchant';
    const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';
    const materialPhone = process.env.MATERIAL_SHOP_PHONE || '19999200001';

    const session = await loginMerchantSession(request, apiBaseUrl, materialPhone);

    await page.addInitScript((payload) => {
      window.localStorage.setItem('merchant_token', payload.token);
      window.localStorage.setItem('merchant_provider', JSON.stringify(payload.provider));
      if (payload.tinodeToken) {
        window.localStorage.setItem('merchant_tinode_token', payload.tinodeToken);
      }
    }, session);

    await page.goto(buildMerchantAppUrl(merchantOrigin, '/dashboard'), { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('menuitem', { name: /工作台/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /商品管理/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /店铺设置/ })).toBeVisible();

    await expect(page.getByRole('menuitem', { name: /报价清单/ })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /订单管理/ })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /项目执行/ })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /资金中心/ })).toHaveCount(0);

    await expect(page.getByText('已纳入统一商家体系')).toHaveCount(0);
    await expect(page.getByText('本期不支持直接切换其他商家子类型')).toHaveCount(0);

    await page.goto(buildMerchantAppUrl(merchantOrigin, '/material-shop/settings'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '主材商资料中心' })).toBeVisible();
    await expect(page.getByText('店铺基础资料', { exact: true })).toBeVisible();
    await expect(page.getByText('主体资质资料', { exact: true })).toBeVisible();
    await expect(page.getByText('服务设置')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保存服务设置' })).toHaveCount(0);

    await page.goto(buildMerchantAppUrl(merchantOrigin, '/orders'), { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname.endsWith('/dashboard'), { timeout: 15000 });
  });

  test('foreman price book allows save draft but blocks publish when required items are missing', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const merchantOrigin = process.env.MERCHANT_ORIGIN || 'http://127.0.0.1:5175/merchant';
    const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';
    const foremanPhone = process.env.MERCHANT_FOREMAN_PHONE || '19900000001';

    const session = await loginMerchantSession(request, apiBaseUrl, foremanPhone);

    const detail = await merchantApiGet<any>(request, apiBaseUrl, '/merchant/price-book', session.token);
    expect(detail.status).toBe(200);
    expect(detail.body.code).toBe(0);
    const items = detail.body.data?.items || [];
    const requiredItem = items.find((item: any) => item.required);
    expect(requiredItem).toBeTruthy();

    const saveResult = await merchantApiPut<any>(
      request,
      apiBaseUrl,
      '/merchant/price-book',
      {
        remark: 'E2E foreman draft save',
        items: [
          {
            standardItemId: requiredItem.standardItemId,
            unit: requiredItem.unit || '项',
            unitPriceCent: 18800,
            minChargeCent: 0,
            remark: '',
            status: 1,
          },
        ],
      },
      session.token,
    );
    expect(saveResult.status).toBe(200);
    expect(saveResult.body.code).toBe(0);

    await page.addInitScript((payload) => {
      window.localStorage.setItem('merchant_token', payload.token);
      window.localStorage.setItem('merchant_provider', JSON.stringify(payload.provider));
      if (payload.tinodeToken) {
        window.localStorage.setItem('merchant_tinode_token', payload.tinodeToken);
      }
    }, session);

    await page.goto(buildMerchantAppUrl(merchantOrigin, '/price-book'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '工长价格库' })).toBeVisible();

    const saveButton = page.getByRole('button', { name: '保存价格' });
    await saveButton.click();
    await expect(page.getByText('工长价格库已保存')).toBeVisible({ timeout: 15000 });

    const publishButton = page.getByRole('button', { name: '发布价格库' });
    await publishButton.click();
    await expect(page.getByText(/补齐后才能发布/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('dialog', { name: '发布价格库' })).toHaveCount(0);
  });
});
