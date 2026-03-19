import { expect, test } from '@playwright/test';

import { loginThroughUi, mockUserWebApi, userWebFixtureIds } from './helpers/userWeb';

test.describe('user web demand phase1 flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockUserWebApi(page);
  });

  test('首页主 CTA 指向需求提交页', async ({ page }) => {
    await loginThroughUi(page, '/');

    await expect(page.getByRole('button', { name: '提交装修需求' })).toBeVisible();
    await page.getByRole('button', { name: '提交装修需求' }).click();

    await expect(page).toHaveURL(/\/demands\/new$/);
    await expect(page.getByRole('heading', { name: '把你的装修需求整理成可匹配的任务' })).toBeVisible();
  });

  test('用户可提交需求并进入详情与方案对比页', async ({ page }) => {
    await loginThroughUi(page, '/demands/new');

    await page.getByLabel('需求标题').fill('西安 98㎡ 老房翻新');
    await page.getByLabel('城市').fill('西安');
    await page.getByLabel('区域').fill('雁塔区');
    await page.getByLabel('详细地址').fill('科技路 66 号');
    await page.getByLabel('建筑面积（㎡）').fill('98');
    await page.getByLabel('预算下限').fill('120000');
    await page.getByLabel('预算上限').fill('220000');
    await page.getByLabel('风格偏好').fill('现代简约 / 原木');
    await page.getByLabel('需求描述').fill('重点解决采光、收纳和餐厨动线问题。');

    await page.getByRole('button', { name: '正式提交' }).click();

    await expect(page).toHaveURL(new RegExp(`/demands/${userWebFixtureIds.demandId}$`));
    await expect(page.getByRole('heading', { name: '西安 98㎡ 老房翻新' })).toBeVisible();
    await expect(page.getByText('平台已完成初审并开始分配商家。').first()).toBeVisible();
    await expect(page.getByText('拾光设计')).toBeVisible();

    await page.getByRole('link', { name: '查看方案对比' }).click();
    await expect(page).toHaveURL(new RegExp(`/demands/${userWebFixtureIds.demandId}/compare$`));
    await expect(page.getByRole('heading', { name: '西安 98㎡ 老房翻新' })).toBeVisible();
    await expect(page.getByText('先做餐厨一体化和主卧储物优化')).toBeVisible();
    await expect(page.getByText('¥176,000')).toBeVisible();
  });
});
