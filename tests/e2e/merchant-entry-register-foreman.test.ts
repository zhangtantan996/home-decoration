import { test, expect } from '@playwright/test';

test.describe('Merchant Entry Foreman Flow', () => {
  test('entry page shows foreman option and register form works', async ({ page }) => {
    const origin = process.env.MERCHANT_ORIGIN || 'http://localhost:5173';

    await page.goto(`${origin}/merchant/`, { waitUntil: 'domcontentloaded' });

    const foremanCard = page.getByText('工长/项目经理');
    await expect(foremanCard).toBeVisible();

    await foremanCard.click();
    await expect(page).toHaveURL(/\/merchant\/register\?type=foreman/);

    await expect(page.getByText('工长/项目经理入驻申请')).toBeVisible();
    await expect(page.getByText('施工案例')).toBeVisible();
  });
});

