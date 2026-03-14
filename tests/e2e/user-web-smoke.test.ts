import { expect, test } from '@playwright/test';

import { loginThroughUi, mockUserWebApi, userWebFixtureIds } from './helpers/userWeb';

const protectedPaths = [
  '/',
  '/inspiration',
  '/progress',
  '/messages',
  '/me',
  '/providers?category=designer',
  `/bookings/${userWebFixtureIds.bookingId}`,
];

test.describe('user web app-aligned smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockUserWebApi(page);
  });

  test('未登录访问核心路由都会先到登录页', async ({ page }) => {
    for (const path of protectedPaths) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/login\?redirect=/);
      await expect(page.getByRole('heading', { name: '登录后查看报价、项目进度与预约动态' })).toBeVisible();
    }
  });

  test('法律页可匿名访问', async ({ page }) => {
    await page.goto('/legal/user-agreement', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '禾泽云用户服务协议' })).toBeVisible();

    await page.goto('/legal/privacy-policy', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '隐私与数据处理条款' })).toBeVisible();
  });

  test('登录后首页按 app 心智展示搜索、分类和服务列表', async ({ page }) => {
    await loginThroughUi(page, '/');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: '首页', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '灵感', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '进度', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '消息', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '我的', exact: true })).toBeVisible();

    await expect(page.getByRole('heading', { name: '先找到适合的人和店，再往下看报价和进度' })).toBeVisible();
    await expect(page.getByPlaceholder('搜索设计师、风格或擅长方向')).toBeVisible();
    await expect(page.getByRole('button', { name: '设计师' })).toBeVisible();
    await expect(page.getByRole('button', { name: '施工' })).toBeVisible();
    await expect(page.getByRole('button', { name: '主材' })).toBeVisible();
    await expect(page.getByText('热门搜索')).toBeVisible();
    await expect(page.getByRole('heading', { name: '拾光设计' })).toBeVisible();

    await page.getByRole('button', { name: '主材' }).click();
    await expect(page.getByText('西安整装主材馆')).toBeVisible();
  });

  test('找服务页按 设计师/施工/主材 三类切换', async ({ page }) => {
    await loginThroughUi(page, '/providers?category=designer');

    await expect(page.getByRole('heading', { name: '按分类找合适的人和店' })).toBeVisible();
    await expect(page.getByText('拾光设计')).toBeVisible();

    await page.getByRole('button', { name: '施工' }).click();
    await expect(page.getByText('老陈工长')).toBeVisible();

    await page.getByRole('button', { name: '主材' }).click();
    await expect(page.getByText('西安整装主材馆')).toBeVisible();
  });

  test('进度页展示项目状态、待处理节点和最近日志', async ({ page }) => {
    await loginThroughUi(page, '/progress');

    await expect(page.getByRole('heading', { name: '装修进度' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '云杉路旧房改造项目' })).toBeVisible();
    await expect(page.getByText('待处理节点')).toBeVisible();
    await expect(page.getByText('泥木验收')).toBeVisible();
    await expect(page.getByText('最近日志', { exact: true })).toBeVisible();
    await expect(page.getByText('泥木阶段巡检')).toBeVisible();
  });

  test('消息页和我的页都可正常访问', async ({ page }) => {
    await loginThroughUi(page, '/messages');

    await expect(page.getByRole('heading', { name: '消息中心' })).toBeVisible();
    await expect(page.getByText('报价待确认')).toBeVisible();

    await page.getByRole('link', { name: '我的', exact: true }).click();
    await expect(page.getByText('常看内容')).toBeVisible();
    await expect(page.locator('p.kicker').filter({ hasText: '我的订单' })).toBeVisible();
    await expect(page.getByText('更多服务')).toBeVisible();
  });

  test('服务商详情仍可创建预约并进入详情页', async ({ page }) => {
    await loginThroughUi(page, `/providers/designer/${userWebFixtureIds.designerId}`);

    await page.getByLabel('装修地址').fill('西安市雁塔区丈八东路 66 号');
    await page.getByRole('button', { name: '提交预约' }).click();

    await expect(page).toHaveURL(new RegExp(`/bookings/${userWebFixtureIds.bookingId}$`));
    await expect(page.getByRole('heading', { name: '预约详情' })).toBeVisible();
    await expect(page.getByText('西安市雁塔区丈八东路 66 号')).toBeVisible();
  });
});
