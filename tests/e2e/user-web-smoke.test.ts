import { expect, test } from '@playwright/test';

import { loginThroughUi, mockUserWebApi, userWebFixtureIds } from './helpers/userWeb';

const protectedPaths = [
  '/app/',
  '/app/inspiration',
  '/app/progress',
  '/app/messages',
  '/app/me',
  '/app/providers?category=designer',
  `/app/bookings/${userWebFixtureIds.bookingId}`,
];

test.describe('user web app-aligned smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockUserWebApi(page);
  });

  test('未登录访问核心路由都会先到登录页', async ({ page }) => {
    for (const path of protectedPaths) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/login\?redirect=/);
      await expect(page.getByRole('heading', { name: /登录禾泽云/ })).toBeVisible();
    }
  });

  test('法律页可匿名访问', async ({ page }) => {
    await page.goto('/app/legal/user-agreement', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '禾泽云用户服务协议' })).toBeVisible();

    await page.goto('/app/legal/privacy-policy', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '隐私与数据处理条款' })).toBeVisible();
  });

  test('登录后首页按 app 心智展示搜索、分类和服务列表', async ({ page }) => {
    await loginThroughUi(page, '/');

    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('link', { name: '首页', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '服务商', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '灵感案例', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '我的项目', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '个人中心', exact: true })).toBeVisible();

    await expect(page.getByRole('heading', { name: '开启您的理想家居之旅' })).toBeVisible();
    await expect(page.getByPlaceholder('搜索设计师、装修公司、工长或主材门店')).toBeVisible();
    await expect(page.getByRole('button', { name: '设计师' })).toBeVisible();
    await expect(page.getByRole('button', { name: '装修公司' })).toBeVisible();
    await expect(page.getByRole('button', { name: '工长' })).toBeVisible();
    await expect(page.getByRole('button', { name: '主材门店' })).toBeVisible();

    await page.getByRole('button', { name: '主材门店' }).click();
    await expect(page.getByRole('link', { name: '查看更多服务商' })).toBeVisible();
  });

  test('找服务页按 设计师/施工/主材 三类切换', async ({ page }) => {
    await loginThroughUi(page, '/providers?category=designer');

    await expect(page.getByRole('button', { name: '设计师' })).toBeVisible();
    await expect(page.getByText('拾光设计')).toBeVisible();

    await page.getByRole('button', { name: '工长' }).click();
    await expect(page.getByText('老陈工长')).toBeVisible();

    await page.getByRole('button', { name: '主材门店' }).click();
    await expect(page.getByText('西安整装主材馆').first()).toBeVisible();
  });

  test('进度页展示项目状态、待处理节点和最近日志', async ({ page }) => {
    await loginThroughUi(page, '/progress');

    await expect(page.getByRole('heading', { name: '我的项目' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '云杉路旧房改造项目' })).toBeVisible();
    await expect(page.getByText('待确认施工报价').first()).toBeVisible();
    await expect(page.getByText('整体进度')).toBeVisible();
  });

  test('消息页和我的页都可正常访问', async ({ page }) => {
    await loginThroughUi(page, '/messages');

    await expect(page.getByRole('heading', { name: '我的通知' })).toBeVisible();
    await expect(page.getByText('报价待确认')).toBeVisible();

    await page.getByRole('link', { name: '概览', exact: true }).click();
    await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '最近订单' })).toBeVisible();
  });

  test('服务商详情仍可创建预约并进入详情页', async ({ page }) => {
    await loginThroughUi(page, `/providers/designer/${userWebFixtureIds.designerId}`);

    await page.getByRole('link', { name: '提交预约需求' }).click();
    await page.getByLabel('项目地址').fill('西安市雁塔区丈八东路 66 号');
    await page.getByLabel('联系电话').fill('13900000001');
    await page.getByRole('button', { name: '提交预约申请' }).click();

    await expect(page).toHaveURL(new RegExp(`/bookings/${userWebFixtureIds.bookingId}$`));
    await expect(page.getByRole('heading', { name: '流程进度' })).toBeVisible();
    await expect(page.getByText('西安市雁塔区丈八东路 66 号')).toBeVisible();
  });
});
