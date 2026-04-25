import { test, expect } from '@playwright/test';
import { buildMerchantAppUrl } from './helpers/merchant';

test.describe('Merchant Entry Foreman Flow', () => {
  test('entry page unified onboarding can select foreman flow', async ({ page }) => {
    const origin = process.env.MERCHANT_ORIGIN || 'http://127.0.0.1:5175/merchant';

    await page.goto(buildMerchantAppUrl(origin, '/'), { waitUntil: 'domcontentloaded' });

    const selectorModal = page.locator('.ant-modal-content').last();
    await page.getByText('工长入驻').first().click();
    await expect(selectorModal).toBeVisible({ timeout: 10_000 });

    await selectorModal.getByText('个人资质', { exact: true }).click();
    await selectorModal.getByRole('button', { name: '开始入驻申请' }).click();

    await expect(page).toHaveURL(/\/(?:merchant\/)?register\?role=foreman&entityType=personal/);
    await expect(page.getByText('确认入驻资质')).toBeVisible();
    await expect(page.getByText('工长入驻', { exact: true }).last()).toBeVisible();
  });
});
