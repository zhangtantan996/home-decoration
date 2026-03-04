import { test, expect } from '@playwright/test';

test.describe('Merchant Entry Foreman Flow', () => {
  test('entry page unified onboarding can select foreman flow', async ({ page }) => {
    const origin = process.env.MERCHANT_ORIGIN || 'http://localhost:5173';

    await page.goto(`${origin}/merchant/`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: '我要入驻' })).toBeVisible();
    await page.getByRole('button', { name: '我要入驻' }).click();

    const selectorModal = page.locator('.ant-modal-content').last();
    await expect(selectorModal).toBeVisible();

    await selectorModal.getByText('工长入驻').click();
    await selectorModal.getByRole('radio', { name: '个人' }).click();
    await selectorModal.getByRole('button', { name: '下一步' }).click();

    await expect(page).toHaveURL(/\/merchant\/register\?role=foreman&entityType=personal/);
    await expect(page.getByText('工长入驻申请（个人主体）')).toBeVisible();
    await expect(page.getByText('施工案例')).toBeVisible();
  });
});
