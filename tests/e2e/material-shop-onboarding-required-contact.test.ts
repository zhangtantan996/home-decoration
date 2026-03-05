import { expect, test } from '@playwright/test';

import {
  buildLegalAcceptancePayload,
  buildRandomMainlandPhone,
  getMaterialShopApplyStatusByPhone,
  getMerchantAdminTestEnv,
  getMerchantTestEnv,
  loginAdminByApi,
  merchantApiPost,
  rejectMaterialShopApplication,
} from './helpers/merchant';

type MaterialApplyPayload = Record<string, unknown>;

function createMaterialShopApplyPayload(phone: string): MaterialApplyPayload {
  const products = Array.from({ length: 5 }, (_, index) => ({
    name: `主材商品${index + 1}`,
    params: { brand: '测试品牌', spec: `${index + 1}号` },
    price: 199 + index,
    images: [`https://example.com/material-${index + 1}.jpg`],
  }));

  return {
    phone,
    code: '123456',
    entityType: 'company',
    shopName: '主材门店测试',
    shopDescription: '主材门店入驻自动化测试',
    businessLicenseNo: '91310114666007254Q',
    businessLicense: 'https://example.com/license.jpg',
    businessHours: '09:00-18:00',
    contactPhone: phone,
    contactName: '联系人测试',
    address: '西安市雁塔区科技路 1 号',
    products,
    legalAcceptance: buildLegalAcceptancePayload(),
  };
}

test.describe('Material Shop Onboarding Required Contact', () => {
  test('material shop required contact and legal validation', async ({ request }) => {
    const env = getMerchantTestEnv();

    const missingContactNamePhone = buildRandomMainlandPhone('16');
    const missingContactNamePayload = createMaterialShopApplyPayload(missingContactNamePhone);
    missingContactNamePayload.contactName = '';
    const missingContactName = await merchantApiPost(request, env.apiBaseUrl, '/material-shop/apply', missingContactNamePayload);
    expect(missingContactName.status).toBe(200);
    expect(missingContactName.body.code).toBe(400);
    expect(missingContactName.body.message).toContain('联系人姓名');

    const missingContactPhonePhone = buildRandomMainlandPhone('16');
    const missingContactPhonePayload = createMaterialShopApplyPayload(missingContactPhonePhone);
    missingContactPhonePayload.contactPhone = '';
    const missingContactPhone = await merchantApiPost(request, env.apiBaseUrl, '/material-shop/apply', missingContactPhonePayload);
    expect(missingContactPhone.status).toBe(200);
    expect(missingContactPhone.body.code).toBe(400);
    expect(missingContactPhone.body.message).toContain('联系人手机号');

    const missingBusinessHoursPhone = buildRandomMainlandPhone('16');
    const missingBusinessHoursPayload = createMaterialShopApplyPayload(missingBusinessHoursPhone);
    missingBusinessHoursPayload.businessHours = '';
    const missingBusinessHours = await merchantApiPost(request, env.apiBaseUrl, '/material-shop/apply', missingBusinessHoursPayload);
    expect(missingBusinessHours.status).toBe(200);
    expect(missingBusinessHours.body.code).toBe(400);
    expect(missingBusinessHours.body.message).toContain('营业时间');

    const missingAddressPhone = buildRandomMainlandPhone('16');
    const missingAddressPayload = createMaterialShopApplyPayload(missingAddressPhone);
    missingAddressPayload.address = '';
    const missingAddress = await merchantApiPost(request, env.apiBaseUrl, '/material-shop/apply', missingAddressPayload);
    expect(missingAddress.status).toBe(200);
    expect(missingAddress.body.code).toBe(400);
    expect(missingAddress.body.message).toContain('门店地址');

    const legalRejectedPhone = buildRandomMainlandPhone('16');
    const legalRejectedPayload = createMaterialShopApplyPayload(legalRejectedPhone);
    legalRejectedPayload.legalAcceptance = {
      ...buildLegalAcceptancePayload(),
      accepted: false,
    };
    const legalRejected = await merchantApiPost(request, env.apiBaseUrl, '/material-shop/apply', legalRejectedPayload);
    expect(legalRejected.status).toBe(200);
    expect(legalRejected.body.code).toBe(400);
    expect(legalRejected.body.message).toContain('同意');
  });

  test('material shop resubmit keeps same required field rules', async ({ request }) => {
    const env = getMerchantTestEnv();
    const adminEnv = getMerchantAdminTestEnv();

    const phone = buildRandomMainlandPhone('16');
    const applyPayload = createMaterialShopApplyPayload(phone);
    const applyResult = await merchantApiPost(request, env.apiBaseUrl, '/material-shop/apply', applyPayload);
    expect(applyResult.status).toBe(200);
    expect(applyResult.body.code).toBe(0);

    const statusResult = await getMaterialShopApplyStatusByPhone(request, env.apiBaseUrl, phone);
    expect(statusResult.status).toBe(200);
    expect(statusResult.body.code).toBe(0);
    expect(statusResult.body.data.applicationId).toBeGreaterThan(0);

    const adminToken = await loginAdminByApi(request, env.apiBaseUrl, adminEnv.username, adminEnv.password);
    const rejectResult = await rejectMaterialShopApplication(
      request,
      env.apiBaseUrl,
      adminToken,
      statusResult.body.data.applicationId,
      'E2E: verify material resubmit validation',
    );
    expect(rejectResult.status).toBe(200);
    expect(rejectResult.body.code).toBe(0);

    const invalidResubmitPayload = createMaterialShopApplyPayload(phone);
    invalidResubmitPayload.contactPhone = '';
    const resubmitResult = await merchantApiPost(
      request,
      env.apiBaseUrl,
      `/material-shop/apply/${statusResult.body.data.applicationId}/resubmit`,
      invalidResubmitPayload,
    );
    expect(resubmitResult.status).toBe(200);
    expect(resubmitResult.body.code).toBe(400);
    expect(resubmitResult.body.message).toContain('联系人手机号');
  });
});
