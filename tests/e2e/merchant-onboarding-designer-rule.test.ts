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

function buildDesignerPayload(phone: string, options?: { entityType?: 'personal' | 'company'; applicantType?: 'personal' | 'studio'; imageCount?: number }) {
  const entityType = options?.entityType ?? 'personal';
  const applicantType = options?.applicantType ?? (entityType === 'company' ? 'studio' : 'personal');
  const imageCount = options?.imageCount ?? (entityType === 'company' ? 6 : 4);

  return {
    phone,
    code: '123456',
    role: 'designer',
    entityType,
    applicantType,
    realName: '张三',
    avatar: 'https://example.com/avatar.jpg',
    idCardNo: '11010519491231002X',
    idCardFront: 'https://example.com/id-front.jpg',
    idCardBack: 'https://example.com/id-back.jpg',
    legalPersonName: entityType === 'company' ? '张三' : undefined,
    legalPersonIdCardNo: entityType === 'company' ? '11010519491231002X' : undefined,
    legalPersonIdCardFront: entityType === 'company' ? 'https://example.com/id-front.jpg' : undefined,
    legalPersonIdCardBack: entityType === 'company' ? 'https://example.com/id-back.jpg' : undefined,
    companyName: entityType === 'company' ? '西安设计工作室有限公司' : undefined,
    licenseNo: entityType === 'company' ? '110105000000123' : undefined,
    licenseImage: entityType === 'company' ? 'https://example.com/license.jpg' : undefined,
    yearsExperience: 6,
    officeAddress: '西安市雁塔区高新路 12 号',
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
      createPortfolioCase(0, imageCount),
      createPortfolioCase(1, imageCount),
      createPortfolioCase(2, imageCount),
    ],
  };
}

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
      payload.portfolioCases[0].images = payload.portfolioCases[0].images.slice(0, 3);

      const result = await merchantApiPost<MerchantApplyResponseData>(request, env.apiBaseUrl, '/merchant/apply', payload);
      expect(result.status, 'personal designer invalid portfolio should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'personal designer invalid portfolio should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention personal case images constraint').toContain('4-12张图片');
    }

    {
      const phone = buildRandomMainlandPhone('19');
      await merchantApiPost(request, env.apiBaseUrl, '/auth/send-code', {
        phone,
        purpose: 'identity_apply',
      });

      const payload = buildDesignerPayload(phone, { entityType: 'company', applicantType: 'studio', imageCount: 6 });
      payload.portfolioCases[0].images = payload.portfolioCases[0].images.slice(0, 5);

      const result = await merchantApiPost<MerchantApplyResponseData>(request, env.apiBaseUrl, '/merchant/apply', payload);
      expect(result.status, 'company designer invalid portfolio should not return 5xx').toBeLessThan(500);

      if (isSmsGateError(result.body.message || '')) {
        test.skip(true, `验证码环境未就绪，跳过规则断言: ${result.body.message}`);
        return;
      }

      expect(result.body.code, 'company designer invalid portfolio should be rejected').not.toBe(0);
      expect(result.body.message, 'error should mention company case images constraint').toContain('6-12张图片');
    }
  });
});
