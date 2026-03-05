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

const createForemanCase = (index: number, imageCount: number) => ({
  title: `施工案例-${index + 1}`,
  style: '现代简约',
  area: '100㎡',
  description: `施工说明-${index + 1}`,
  images: Array.from({ length: imageCount }, (_, imageIndex) => `https://example.com/foreman-${index + 1}-${imageIndex + 1}.jpg`),
});

const buildForemanPayload = (phone: string) => ({
  phone,
  code: '123456',
  role: 'foreman',
  entityType: 'personal',
  applicantType: 'foreman',
  realName: '李四',
  avatar: 'https://example.com/avatar.jpg',
  idCardNo: '11010519491231002X',
  idCardFront: 'https://example.com/id-front.jpg',
  idCardBack: 'https://example.com/id-back.jpg',
  yearsExperience: 8,
  workTypes: ['mason'],
  highlightTags: ['工期可控'],
  serviceArea: ['雁塔区'],
  pricing: {
    perSqm: 280,
  },
  introduction: '施工说明',
  legalAcceptance: buildLegalAcceptancePayload(),
  portfolioCases: [
    createForemanCase(0, 8),
    createForemanCase(1, 8),
    createForemanCase(2, 8),
  ],
});

const isSmsGateError = (message: string) => /验证码|短信/.test(message);

test.describe('Merchant Onboarding Foreman Rules', () => {
  test('foreman role rules are enforced by backend', async ({ request }, testInfo) => {
    testInfo.setTimeout(90_000);
    const env = getMerchantTestEnv();

    {
      const phone = buildRandomMainlandPhone('16');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildForemanPayload(phone);
      payload.workTypes = [];

      const result = await merchantApiPost<MerchantApplyResponseData>(request, env.apiBaseUrl, '/merchant/apply', payload);
      expect(result.status, 'foreman missing workTypes should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'foreman missing workTypes should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention workTypes constraint').toContain('至少选择1个工种');
    }

    {
      const phone = buildRandomMainlandPhone('15');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildForemanPayload(phone);
      payload.portfolioCases[0].images = payload.portfolioCases[0].images.slice(0, 7);

      const result = await merchantApiPost<MerchantApplyResponseData>(request, env.apiBaseUrl, '/merchant/apply', payload);
      expect(result.status, 'foreman invalid case image count should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'foreman invalid case image count should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention foreman case image constraint').toContain('8-12张图片');
    }
  });
});
