import { expect, test } from '@playwright/test';

import { buildRandomMainlandPhone, getMerchantTestEnv, merchantApiPost } from './helpers/merchant';

interface MaterialShopApplyResponseData {
  applicationId?: number;
}

const createProduct = (index: number) => ({
  name: `测试商品-${index + 1}`,
  params: {
    品牌: '测试品牌',
    规格: `${60 + index}x${60 + index}`,
  },
  price: 99 + index,
  images: [`https://example.com/material-${index + 1}.jpg`],
});

const buildMaterialShopPayload = (phone: string, productCount: number) => ({
  phone,
  code: '123456',
  entityType: 'company',
  shopName: '测试主材门店',
  shopDescription: '门店描述',
  businessLicenseNo: '91510100MA6C12345X',
  businessLicense: 'https://example.com/license.jpg',
  businessHours: '09:00-18:00',
  contactPhone: phone,
  contactName: '主材负责人',
  address: '西安市高新区测试路 1 号',
  products: Array.from({ length: productCount }, (_, index) => createProduct(index)),
});

const isSmsGateError = (message: string) => /验证码|短信/.test(message);

test.describe('Material Shop Onboarding Product Rules', () => {
  test('material shop apply enforces 5-20 product constraints', async ({ request }, testInfo) => {
    testInfo.setTimeout(90_000);
    const env = getMerchantTestEnv();
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
  });
});
