import { expect, test } from '@playwright/test';

import { buildRandomMainlandPhone, getMerchantTestEnv } from './helpers/merchant';

test.describe('Merchant Login Unregistered Redirect', () => {
  test('unregistered phone redirects to onboarding with alert and prefilled phone', async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);

    const env = getMerchantTestEnv();
    const phone = process.env.MERCHANT_UNREGISTERED_PHONE || buildRandomMainlandPhone('19');

    await page.goto(`${env.origin}/merchant/login`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('请输入11位手机号').fill(phone);
    await page.getByPlaceholder('请输入6位验证码').fill(env.code);
    await page.getByRole('button', { name: /登\s*录/ }).click();

    const redirectToast = page.getByText('该手机号尚未入驻，正在为你跳转入驻页');
    await redirectToast
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => null);

    await page.waitForURL(
      (url) =>
        url.pathname.endsWith('/merchant/register') &&
        url.searchParams.get('from') === 'login_unregistered',
      { timeout: 10_000 },
    );

    await expect(page.getByText('该手机号尚未入驻，请先完成入驻申请后再登录')).toBeVisible();
    await expect(page.getByPlaceholder('请输入11位手机号')).toHaveValue(phone);
  });
});
