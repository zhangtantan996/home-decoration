import { expect, test } from '@playwright/test';

import {
  buildLegalAcceptancePayload,
  buildRandomMainlandPhone,
  getMerchantTestEnv,
  merchantApiPost,
} from './helpers/merchant';

interface MerchantApplyResponseData {
  applicationId?: number;
}

const createPortfolioCase = (index: number, imageCount: number) => ({
  title: `设计案例-${index + 1}`,
  style: '现代简约',
  area: '120㎡',
  description: `案例说明-${index + 1}`,
  images: Array.from({ length: imageCount }, (_, imageIndex) => `https://example.com/designer-${index + 1}-${imageIndex + 1}.jpg`),
});

const buildDesignerPayload = (phone: string) => ({
  phone,
  code: '123456',
  role: 'designer',
  entityType: 'personal',
  applicantType: 'personal',
  realName: '张三',
  avatar: 'https://example.com/avatar.jpg',
  idCardNo: '11010519491231002X',
  idCardFront: 'https://example.com/id-front.jpg',
  idCardBack: 'https://example.com/id-back.jpg',
  yearsExperience: 6,
  serviceArea: ['雁塔区'],
  styles: ['现代简约'],
  pricing: {
    flat: 199,
    duplex: 229,
    other: 259,
  },
  introduction: '设计说明',
  legalAcceptance: buildLegalAcceptancePayload(),
  portfolioCases: [
    createPortfolioCase(0, 3),
    createPortfolioCase(1, 3),
    createPortfolioCase(2, 3),
  ],
});

const isSmsGateError = (message: string) => /验证码|短信/.test(message);

test.describe('Merchant Onboarding Designer Rules', () => {
  test('designer role rules are enforced by backend', async ({ request }, testInfo) => {
    testInfo.setTimeout(90_000);
    const env = getMerchantTestEnv();

    {
      const phone = buildRandomMainlandPhone('18');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildDesignerPayload(phone);
      payload.styles = ['现代简约', '北欧', '新中式', '日式'];

      const result = await merchantApiPost<MerchantApplyResponseData>(request, env.apiBaseUrl, '/merchant/apply', payload);
      expect(result.status, 'designer invalid styles should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'designer invalid styles should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention style constraint').toContain('擅长风格需选择1-3个');
    }

    {
      const phone = buildRandomMainlandPhone('17');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildDesignerPayload(phone);
      payload.portfolioCases[0].images = payload.portfolioCases[0].images.slice(0, 2);

      const result = await merchantApiPost<MerchantApplyResponseData>(request, env.apiBaseUrl, '/merchant/apply', payload);
      expect(result.status, 'designer invalid portfolio should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'designer invalid portfolio should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention case images constraint').toContain('3-6张图片');
    }
  });
});
