import { test, expect } from '@playwright/test';

test.describe('Merchant Entry Foreman Flow', () => {
  test('entry page unified onboarding can select foreman flow', async ({ page }) => {
    const origin = process.env.MERCHANT_ORIGIN || 'http://localhost:5173';

    await page.goto(`${origin}/merchant`, { waitUntil: 'domcontentloaded' });

    const selectorModal = page.locator('.ant-modal-content').last();
    await page.getByText('工长入驻').first().click();
    await expect(selectorModal).toBeVisible({ timeout: 10_000 });

    await selectorModal.getByText('个人资质').click();
    await selectorModal.getByRole('button', { name: '开始入驻申请' }).click();

    await expect(page).toHaveURL(/\/merchant\/register\?role=foreman&entityType=personal/);
    await expect(page.getByText('工长入驻申请（个人主体）')).toBeVisible();
    await expect(page.getByText('施工案例')).toBeVisible();
  });
});
