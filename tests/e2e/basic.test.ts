import { test, expect } from '@playwright/test';

test('Basic Page Load', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    await page.goto('http://localhost:5174/', { timeout: 60000 });

    // Give it a few seconds to try and render
    await page.waitForTimeout(5000);

    await expect(page.getByText('手机号码')).toBeVisible();
});
