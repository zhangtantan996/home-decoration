import { expect, test, type Page } from '@playwright/test';

import {
  buildBusinessHoursRanges,
  buildLegalAcceptancePayload,
  buildMaterialProducts,
  buildRandomMainlandPhone,
  getMerchantAdminTestEnv,
  getMerchantTestEnv,
  loginAdminByApi,
  merchantApiPost,
  rejectMaterialShopApplication,
  rejectMerchantApplication,
} from './helpers/merchant';

function createProviderApplyPayload(phone: string) {
  return {
    phone,
    code: '123456',
    role: 'designer',
    entityType: 'personal',
    applicantType: 'personal',
    realName: '重提测试',
    avatar: 'https://img.example.com/avatar.jpg',
    idCardNo: '11010519491231002X',
    idCardFront: 'https://img.example.com/front.jpg',
    idCardBack: 'https://img.example.com/back.jpg',
    yearsExperience: 5,
    officeAddress: '西安市高新区软件新城 1 号',
    serviceArea: ['610100'],
    styles: ['现代简约'],
    pricing: { flat: 1200 },
    introduction: '重提测试简介',
    portfolioCases: [
      { title: '案例1', description: '案例1说明', images: ['https://img.example.com/c1.jpg', 'https://img.example.com/c2.jpg', 'https://img.example.com/c3.jpg', 'https://img.example.com/c4.jpg'], style: '现代简约', area: '100㎡' },
      { title: '案例2', description: '案例2说明', images: ['https://img.example.com/c5.jpg', 'https://img.example.com/c6.jpg', 'https://img.example.com/c7.jpg', 'https://img.example.com/c8.jpg'], style: '现代简约', area: '90㎡' },
      { title: '案例3', description: '案例3说明', images: ['https://img.example.com/c9.jpg', 'https://img.example.com/c10.jpg', 'https://img.example.com/c11.jpg', 'https://img.example.com/c12.jpg'], style: '现代简约', area: '80㎡' },
    ],
    legalAcceptance: buildLegalAcceptancePayload(),
  };
}

function createMaterialApplyPayload(phone: string) {
  return {
    phone,
    code: '123456',
    entityType: 'company',
    shopName: '主材门店测试',
    shopDescription: '主材门店入驻自动化测试',
    companyName: '西安主材门店测试有限公司',
    businessLicenseNo: '91350211M000100Y46',
    businessLicense: 'https://example.com/license.jpg',
    legalPersonName: '法人测试',
    legalPersonIdCardNo: '11010519491231002X',
    legalPersonIdCardFront: 'https://example.com/legal-front.jpg',
    legalPersonIdCardBack: 'https://example.com/legal-back.jpg',
    businessHours: '周一至周五 09:00-18:00',
    businessHoursRanges: buildBusinessHoursRanges(),
    contactPhone: phone,
    contactName: '联系人测试',
    address: '西安市雁塔区科技路 1 号',
    products: buildMaterialProducts(5),
    legalAcceptance: buildLegalAcceptancePayload(),
  };
}

async function openRejectedStatusAndJump(page: Page, origin: string, phone: string) {
  await page.goto(`${origin}/merchant/apply-status?phone=${encodeURIComponent(phone)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('button').filter({ hasText: '查询状态' }).click();
  await page.locator('[data-testid="merchant-apply-status-resubmit-button"]').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('[data-testid="merchant-apply-status-resubmit-button"]').click();
}

async function expectMessage(page: Page, text: string) {
  await expect(page.locator('.ant-message-notice-content').filter({ hasText: text }).last()).toBeVisible({ timeout: 5_000 });
}

test.describe('Merchant onboarding phone verification flows', () => {
  test('provider apply step 0 blocks after code is cleared on back navigation', async ({ page }) => {
    const env = getMerchantTestEnv();
    const phone = buildRandomMainlandPhone('18');

    await page.goto(`${env.origin}/merchant/register?role=designer&entityType=personal`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="merchant-register-phone-input"]').fill(phone);
    await page.locator('input[aria-label="验证码"]').fill(env.code);
    await page.locator('[data-testid="merchant-register-next-0"]').click();

    await expect(page.locator('[data-testid="merchant-register-step-1"]')).toBeVisible();
    await page.getByRole('button', { name: '上一步' }).click();
    await page.locator('input[aria-label="验证码"]').fill('');
    await page.locator('[data-testid="merchant-register-next-0"]').click();

    await expect(page.locator('[data-testid="merchant-register-step-0"]')).toBeVisible();
    await expect(page.getByText('请输入验证码')).toBeVisible();
  });

  test('provider resubmit autofills step 1 and can restore after refresh', async ({ page, request }) => {
    const env = getMerchantTestEnv();
    const adminEnv = getMerchantAdminTestEnv();
    const phone = buildRandomMainlandPhone('18');

    const applyResult = await merchantApiPost<{ applicationId: number }>(request, env.apiBaseUrl, '/merchant/apply', createProviderApplyPayload(phone));
    expect(applyResult.body.code).toBe(0);
    const applicationId = Number(applyResult.body.data?.applicationId || 0);
    expect(applicationId).toBeGreaterThan(0);

    const adminToken = await loginAdminByApi(request, env.apiBaseUrl, adminEnv.username, adminEnv.password);
    const rejectResult = await rejectMerchantApplication(request, env.apiBaseUrl, adminToken, applicationId, 'E2E 浏览器重提回填');
    expect(rejectResult.body.code).toBe(0);

    await openRejectedStatusAndJump(page, env.origin, phone);
    await expect(page).toHaveURL(new RegExp(`/merchant/register\?.*resubmit=${applicationId}`));

    await page.locator('input[aria-label="验证码"]').fill(env.code);
    await page.locator('[data-testid="merchant-register-next-0"]').click();
    await expect(page.locator('[data-testid="merchant-register-step-1"]')).toBeVisible();
    await expect(page.locator('input[aria-label="负责人姓名"]')).toHaveValue('重提测试');

    await page.reload({ waitUntil: 'domcontentloaded' });
    const restoreModal = page.locator('.ant-modal-content').filter({ hasText: '检测到未完成的申请' });
    if (await restoreModal.isVisible().catch(() => false)) {
      await restoreModal.getByRole('button', { name: '恢复' }).click();
    }
    await expect(page.locator('[data-testid="merchant-register-step-1"]')).toBeVisible();
    await expect(page.locator('input[aria-label="负责人姓名"]')).toHaveValue('重提测试');
  });

  test('material apply enters step 1 after phone verification succeeds', async ({ page }) => {
    const env = getMerchantTestEnv();
    const phone = buildRandomMainlandPhone('17');

    await page.goto(`${env.origin}/merchant/material-shop/register?entityType=company`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="material-register-phone-input"]').fill(phone);
    await page.getByPlaceholder('请输入6位验证码').fill(env.code);
    await page.locator('[data-testid="material-register-next-0"]').click();

    await expect(page.locator('[data-testid="material-register-step-1"]')).toBeVisible();
    await expect(page.getByPlaceholder('请输入店铺名称')).toBeVisible();
  });

  test('material resubmit autofills step 1 after phone verification succeeds', async ({ page, request }) => {
    const env = getMerchantTestEnv();
    const adminEnv = getMerchantAdminTestEnv();
    const phone = buildRandomMainlandPhone('17');

    const applyResult = await merchantApiPost<{ applicationId: number }>(request, env.apiBaseUrl, '/material-shop/apply', createMaterialApplyPayload(phone));
    expect(applyResult.body.code).toBe(0);
    const applicationId = Number(applyResult.body.data?.applicationId || 0);
    expect(applicationId).toBeGreaterThan(0);

    const adminToken = await loginAdminByApi(request, env.apiBaseUrl, adminEnv.username, adminEnv.password);
    const rejectResult = await rejectMaterialShopApplication(request, env.apiBaseUrl, adminToken, applicationId, 'E2E 浏览器重提回填');
    expect(rejectResult.body.code).toBe(0);

    await openRejectedStatusAndJump(page, env.origin, phone);
    await expect(page).toHaveURL(new RegExp(`/merchant/material-shop/register\?.*resubmit=${applicationId}`));

    await page.getByPlaceholder('请输入6位验证码').fill(env.code);
    await page.locator('[data-testid="material-register-next-0"]').click();

    await expect(page.locator('[data-testid="material-register-step-1"]')).toBeVisible();
    await expect(page.getByPlaceholder('请输入店铺名称')).toHaveValue('主材门店测试');
    await expect(page.getByPlaceholder('请输入公司/个体名称')).toHaveValue('西安主材门店测试有限公司');
  });

  test('switching to another application does not reuse verification state', async ({ page, request }) => {
    const env = getMerchantTestEnv();
    const adminEnv = getMerchantAdminTestEnv();
    const phone = buildRandomMainlandPhone('19');
    const adminToken = await loginAdminByApi(request, env.apiBaseUrl, adminEnv.username, adminEnv.password);

    const providerApply = await merchantApiPost<{ applicationId: number }>(request, env.apiBaseUrl, '/merchant/apply', createProviderApplyPayload(phone));
    expect(providerApply.body.code).toBe(0);
    const providerId = Number(providerApply.body.data?.applicationId || 0);
    await rejectMerchantApplication(request, env.apiBaseUrl, adminToken, providerId, 'E2E application switch isolation');

    const materialApply = await merchantApiPost<{ applicationId: number }>(request, env.apiBaseUrl, '/material-shop/apply', createMaterialApplyPayload(phone));
    expect(materialApply.body.code).toBe(0);
    const materialId = Number(materialApply.body.data?.applicationId || 0);
    await rejectMaterialShopApplication(request, env.apiBaseUrl, adminToken, materialId, 'E2E application switch isolation');

    await page.goto(`${env.origin}/merchant/register?role=designer&entityType=personal&resubmit=${providerId}&phone=${encodeURIComponent(phone)}`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[aria-label="验证码"]').fill(env.code);
    await page.locator('[data-testid="merchant-register-next-0"]').click();
    await expect(page.locator('[data-testid="merchant-register-step-1"]')).toBeVisible();

    await page.goto(`${env.origin}/merchant/material-shop/register?resubmit=${materialId}&phone=${encodeURIComponent(phone)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="material-register-step-0"]')).toBeVisible();
    await page.locator('[data-testid="material-register-next-0"]').click();
    await expect(page.locator('[data-testid="material-register-step-0"]')).toBeVisible();
    await expect(page.getByText('请输入验证码')).toBeVisible();
  });

  test('provider and material apply show consistent wrong-code error message', async ({ page }) => {
    const env = getMerchantTestEnv();

    const providerPhone = buildRandomMainlandPhone('18');
    await page.goto(`${env.origin}/merchant/register?role=designer&entityType=personal`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="merchant-register-phone-input"]').fill(providerPhone);
    await page.locator('input[aria-label="验证码"]').fill('000000');
    await page.locator('[data-testid="merchant-register-next-0"]').click();
    await expectMessage(page, '验证码校验失败，请检查后重试');

    const materialPhone = buildRandomMainlandPhone('17');
    await page.goto(`${env.origin}/merchant/material-shop/register?entityType=company`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="material-register-phone-input"]').fill(materialPhone);
    await page.getByPlaceholder('请输入6位验证码').fill('000000');
    await page.locator('[data-testid="material-register-next-0"]').click();
    await expectMessage(page, '验证码校验失败，请检查后重试');
  });
});
