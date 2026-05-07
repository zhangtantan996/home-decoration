import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

import { seedRealSession, userWebRealFixture, withAppBase } from './helpers/userWebReal';

let cachedSession: string | null = null;

function clearRateLimit() {
  execFileSync(process.execPath, ['./scripts/user-web-clear-rate-limit.mjs'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}

async function retryIfRateLimited(page: import('@playwright/test').Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rateLimitText = page.getByText('请求过于频繁，请稍后再试');
    if (!(await rateLimitText.isVisible().catch(() => false))) {
      return;
    }
    clearRateLimit();
    const retry = page.getByRole('button', { name: '重试' });
    if (await retry.isVisible().catch(() => false)) {
      await retry.click();
    } else {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(500);
  }
}

test.describe.serial('pure user web real backend smoke', () => {
  test('首页、个人中心、公开页与受保护详情页走真实后端', async ({ page, request }) => {
    clearRateLimit();
    await page.goto(withAppBase('/providers?role=designer&keyword=联调'), { waitUntil: 'domcontentloaded' });
    await retryIfRateLimited(page);
    await expect(page.getByText(userWebRealFixture.providerName)).toBeVisible();

    clearRateLimit();
    await page.goto(withAppBase(`/providers/designer/${userWebRealFixture.providerId}`), { waitUntil: 'domcontentloaded' });
    await retryIfRateLimited(page);
    await expect(page.getByText('服务商详情')).toBeVisible();
    await expect(page.getByText(userWebRealFixture.providerName)).toBeVisible();
    await expect(page.getByRole('heading', { name: '预约免费咨询' })).toBeVisible();

    clearRateLimit();
    await page.goto(withAppBase('/me'), { waitUntil: 'domcontentloaded' });
    await retryIfRateLimited(page);
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await expect(page.getByText('登录禾泽云')).toBeVisible();

    await seedRealSession(page, request);
    await page.goto(withAppBase('/me'), { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/me$/, { timeout: 15000 });
    cachedSession = await page.evaluate(() => window.localStorage.getItem('user-web-session'));
    await expect(page.getByText(userWebRealFixture.profileName, { exact: true })).toBeVisible();
    await expect(page.getByText('概览')).toBeVisible();
    const main = page.locator('#app-main');
    await expect(main.getByRole('link', { name: '我的预约', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: '我的报价', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: '我的项目', exact: true })).toBeVisible();

    clearRateLimit();
    await page.goto(withAppBase(`/bookings/${userWebRealFixture.bookingId}`), { waitUntil: 'domcontentloaded' });
    await retryIfRateLimited(page);
    await expect(page).toHaveURL(new RegExp(`/bookings/${userWebRealFixture.bookingId}$`));
    await expect(page.getByText('fixture booking for pure web user smoke')).toBeVisible();

    clearRateLimit();
    await page.getByRole('link', { name: '查看报价详情' }).click();
    await retryIfRateLimited(page);
    await expect(page).toHaveURL(new RegExp(`/proposals/${userWebRealFixture.proposalId}$`));
    await expect(page.getByText('费用结构')).toBeVisible();
    await expect(page.getByText('订单与动作')).toBeVisible();
    await expect(page.getByText('订单状态')).toBeVisible();
    await expect(page.getByText('待支付').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '确认报价' })).toBeVisible();

  });

  test('验收页可执行真实里程碑验收动作', async ({ page, request }) => {
    if (!cachedSession) {
      await seedRealSession(page, request);
      cachedSession = await page.evaluate(() => window.localStorage.getItem('user-web-session'));
    }

    await page.addInitScript((sessionValue) => {
      window.localStorage.setItem('user-web-session', sessionValue);
    }, cachedSession);
    clearRateLimit();
    await page.goto(withAppBase(`/projects/${userWebRealFixture.projectId}/acceptance`), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await retryIfRateLimited(page);

    await expect(page).toHaveURL(new RegExp(`/projects/${userWebRealFixture.projectId}/acceptance$`));
    await expect(page.getByRole('button', { name: '通过验收' })).toBeVisible();

    await page.getByRole('button', { name: '通过验收' }).click();

    await expect(page.getByText('节点 泥木验收 已通过验收。')).toBeVisible();
  });
});
