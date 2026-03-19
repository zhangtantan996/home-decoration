import { expect, test } from '@playwright/test';

import {
  buildForemanPortfolioCases,
  buildLegalAcceptancePayload,
  buildRandomMainlandPhone,
  getMerchantTestEnv,
  merchantApiPost,
} from './helpers/merchant';

interface MerchantApplyResponseData {
  applicationId?: number;
}

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
  highlightTags: ['工期可控'],
  serviceArea: ['雁塔区'],
  officeAddress: '西安市雁塔区科技路 1 号',
  pricing: {
    perSqm: 280,
  },
  introduction: '施工说明',
  legalAcceptance: buildLegalAcceptancePayload(),
  portfolioCases: buildForemanPortfolioCases({ imageCount: 2 }),
});

const isSmsGateError = (message: string) => /验证码|短信/.test(message);

test.describe('Merchant Onboarding Foreman Rules', () => {
  test('foreman category rules are enforced by backend', async ({ request }, testInfo) => {
    testInfo.setTimeout(90_000);
    const env = getMerchantTestEnv();

    {
      const phone = buildRandomMainlandPhone('16');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildForemanPayload(phone);
      payload.portfolioCases = (payload.portfolioCases as Array<Record<string, unknown>>).filter(
        (item) => item.category !== 'water',
      );

      const result = await merchantApiPost<MerchantApplyResponseData>(request, env.apiBaseUrl, '/merchant/apply', payload);
      expect(result.status, 'foreman missing required category should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'foreman missing required category should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention required category').toContain('水工施工展示');
    }

    {
      const phone = buildRandomMainlandPhone('15');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildForemanPayload(phone);
      const cases = payload.portfolioCases as Array<Record<string, unknown>>;
      cases[0].images = ['https://example.com/foreman-only-1.jpg'];

      const result = await merchantApiPost<MerchantApplyResponseData>(request, env.apiBaseUrl, '/merchant/apply', payload);
      expect(result.status, 'foreman invalid case image count should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'foreman invalid case image count should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention foreman case image constraint').toContain('2-8张图片');
    }
  });
});
