import { expect, test } from '@playwright/test';

import {
  buildBusinessHoursRanges,
  buildLegalAcceptancePayload,
  buildMaterialProducts,
  buildRandomMainlandPhone,
  getMerchantTestEnv,
  merchantApiPost,
} from './helpers/merchant';

interface MaterialShopApplyResponseData {
  applicationId?: number;
}

const buildMaterialShopPayload = (phone: string, productCount: number) => ({
  phone,
  code: '123456',
  entityType: 'company',
  shopName: '测试主材门店',
  shopDescription: '门店描述',
  companyName: '测试主材门店有限公司',
  businessLicenseNo: '91510100MA6C12345X',
  businessLicense: 'https://example.com/license.jpg',
  legalPersonName: '主材法人',
  legalPersonIdCardNo: '11010519491231002X',
  legalPersonIdCardFront: 'https://example.com/legal-front.jpg',
  legalPersonIdCardBack: 'https://example.com/legal-back.jpg',
  businessHours: '周一至周五 09:00-18:00',
  businessHoursRanges: buildBusinessHoursRanges(),
  contactPhone: phone,
  contactName: '主材负责人',
  address: '西安市高新区测试路 1 号',
  legalAcceptance: buildLegalAcceptancePayload(),
  products: buildMaterialProducts(productCount),
});

const isSmsGateError = (message: string) => /验证码|短信/.test(message);

test.describe('Material Shop Onboarding Product Rules', () => {
  test('material shop apply enforces product constraints', async ({ request }, testInfo) => {
    testInfo.setTimeout(90_000);
    const env = getMerchantTestEnv();

    {
      const phone = buildRandomMainlandPhone('14');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildMaterialShopPayload(phone, 4);
      const result = await merchantApiPost<MaterialShopApplyResponseData>(request, env.apiBaseUrl, '/material-shop/apply', payload);

      expect(result.status, 'material shop invalid product count should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'material shop with <5 products should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention material product count constraint').toContain('5-20');
    }

    {
      const phone = buildRandomMainlandPhone('14');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildMaterialShopPayload(phone, 5);
      (payload.products as Array<Record<string, unknown>>)[0].unit = '';
      const result = await merchantApiPost<MaterialShopApplyResponseData>(request, env.apiBaseUrl, '/material-shop/apply', payload);
      expect(result.status, 'material shop missing unit should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'material shop missing unit should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention unit constraint').toContain('单位');
    }

    {
      const phone = buildRandomMainlandPhone('14');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildMaterialShopPayload(phone, 5);
      (payload.products as Array<Record<string, unknown>>)[0].images = Array.from(
        { length: 7 },
        (_, index) => `https://example.com/material-overflow-${index + 1}.jpg`,
      );
      const result = await merchantApiPost<MaterialShopApplyResponseData>(request, env.apiBaseUrl, '/material-shop/apply', payload);
      expect(result.status, 'material shop product overflow images should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'material shop overflow images should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention material image constraint').toContain('1-6张图片');
    }
  });
});
