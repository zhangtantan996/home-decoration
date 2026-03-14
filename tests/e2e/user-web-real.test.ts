import { expect, test } from '@playwright/test';

import { loginThroughRealUi, userWebRealFixture } from './helpers/userWebReal';

let cachedSession: string | null = null;

test.describe.serial('pure user web real backend smoke', () => {
  test('首页、个人中心、公开页与受保护详情页走真实后端', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '把装修前台这条链路先跑顺' })).toBeVisible();

    await page.goto('/providers?role=designer&keyword=联调', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '服务商列表' })).toBeVisible();
    await expect(page.getByText(userWebRealFixture.providerName, { exact: true })).toBeVisible();

    await page.goto(`/providers/designer/${userWebRealFixture.providerId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: userWebRealFixture.providerName })).toBeVisible();
    await expect(page.getByText('最小预约 CTA')).toBeVisible();

    await page.goto('/me', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await expect(page.getByRole('heading', { name: '未登录访问详情页，直接回这里' })).toBeVisible();

    await loginThroughRealUi(page, '/me');

    await expect(page).toHaveURL(/\/me$/);
    cachedSession = await page.evaluate(() => window.localStorage.getItem('user-web-session'));
    await expect(page.getByRole('heading', { name: userWebRealFixture.profileName })).toBeVisible();
    await expect(page.getByRole('heading', { name: '我的预约 / 我的报价 / 我的项目 / 我的订单 / 消息 / 设置' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '我的预约', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '我的报价', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '我的项目', exact: true })).toBeVisible();

    await page.goto(`/bookings/${userWebRealFixture.bookingId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/bookings/${userWebRealFixture.bookingId}$`));
    await expect(page.getByRole('heading', { name: '预约详情' })).toBeVisible();
    await expect(page.getByText('fixture booking for pure web user smoke')).toBeVisible();

    await page.getByRole('link', { name: '查看报价详情' }).click();
    await expect(page).toHaveURL(new RegExp(`/proposals/${userWebRealFixture.proposalId}$`));
    await expect(page.getByRole('heading', { name: '报价详情 / 确认' })).toBeVisible();
    await expect(page.getByText('UW-DF-99130')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认报价' })).toBeDisabled();
    await expect(page.getByText('设计费订单已生成，需先完成支付或处理现有订单。')).toBeVisible();

    await page.getByRole('link', { name: '查看项目详情' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${userWebRealFixture.projectId}$`));
    await expect(page.getByRole('heading', { name: '项目详情 / 进度' })).toBeVisible();
    await expect(page.getByText('拆改与水电')).toBeVisible();
    await expect(page.getByRole('heading', { name: '泥木阶段' })).toBeVisible();
    await expect(page.getByText('水电验收')).toBeVisible();
    await expect(page.getByRole('heading', { name: '节点 2 · 泥木验收' })).toBeVisible();
  });

  test('项目页可执行真实里程碑验收动作', async ({ page }) => {
    if (!cachedSession) {
      throw new Error('cached session missing from previous real smoke step');
    }
    await page.addInitScript((sessionValue) => {
      window.localStorage.setItem('user-web-session', sessionValue);
    }, cachedSession);
    await page.goto(`/projects/${userWebRealFixture.projectId}`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(new RegExp(`/projects/${userWebRealFixture.projectId}$`));
    await expect(page.getByRole('heading', { name: '项目详情 / 进度' })).toBeVisible();
    await expect(page.getByRole('button', { name: '确认验收' })).toBeVisible();

    await page.getByRole('button', { name: '确认验收' }).click();

    await expect(page.getByText('节点 泥木验收 已验收。')).toBeVisible();
    const milestoneCard = page.locator('article').filter({ hasText: '节点 2 · 泥木验收' }).first();
    await expect(milestoneCard.getByText('已验收')).toBeVisible();
  });
});
