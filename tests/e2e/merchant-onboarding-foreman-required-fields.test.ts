import { expect, test } from '@playwright/test';

import {
  buildForemanPortfolioCases,
  buildLegalAcceptancePayload,
  buildRandomMainlandPhone,
  getMerchantAdminTestEnv,
  getMerchantApplyStatusByPhone,
  getMerchantTestEnv,
  loginAdminByApi,
  merchantApiPost,
  rejectMerchantApplication,
} from './helpers/merchant';

type ForemanApplyPayload = Record<string, unknown>;

function createForemanApplyPayload(phone: string): ForemanApplyPayload {
  return {
    phone,
    code: '123456',
    role: 'foreman',
    entityType: 'personal',
    realName: '工长测试',
    avatar: 'https://example.com/avatar-foreman.jpg',
    yearsExperience: 8,
    idCardNo: '11010519491231002X',
    idCardFront: 'https://example.com/id-front.jpg',
    idCardBack: 'https://example.com/id-back.jpg',
    serviceArea: ['610100'],
    officeAddress: '西安市雁塔区科技路 8 号',
    highlightTags: ['工期稳定'],
    pricing: {
      perSqm: 220,
    },
    introduction: 'E2E 工长入驻校验',
    portfolioCases: buildForemanPortfolioCases({ imageCount: 2 }),
    legalAcceptance: buildLegalAcceptancePayload(),
  };
}

test.describe('Merchant Onboarding Foreman Required Fields', () => {
  test('foreman required fields validation', async ({ request }) => {
    const env = getMerchantTestEnv();

    const missingDescriptionPhone = buildRandomMainlandPhone('15');
    const missingDescriptionPayload = createForemanApplyPayload(missingDescriptionPhone);
    const missingDescriptionCases = (missingDescriptionPayload.portfolioCases as Array<Record<string, unknown>>) || [];
    missingDescriptionCases[0].description = '';
    const missingDescription = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingDescriptionPayload);
    expect(missingDescription.status).toBe(200);
    expect(missingDescription.body.code).toBe(400);
    expect(missingDescription.body.message).toContain('水工施工展示工艺说明不能为空');

    const missingHighlightPhone = buildRandomMainlandPhone('15');
    const missingHighlightPayload = createForemanApplyPayload(missingHighlightPhone);
    missingHighlightPayload.highlightTags = [];
    const missingHighlight = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingHighlightPayload);
    expect(missingHighlight.status).toBe(200);
    expect(missingHighlight.body.code).toBe(400);
    expect(missingHighlight.body.message).toContain('1-3个');

    const invalidOtherPhone = buildRandomMainlandPhone('15');
    const invalidOtherPayload = createForemanApplyPayload(invalidOtherPhone);
    const invalidOtherCases = (invalidOtherPayload.portfolioCases as Array<Record<string, unknown>>) || [];
    invalidOtherCases.push({ category: 'other', description: '其他施工说明', images: [] });
    const invalidOther = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', invalidOtherPayload);
    expect(invalidOther.status).toBe(200);
    expect(invalidOther.body.code).toBe(400);
    expect(invalidOther.body.message).toContain('其他施工展示需上传2-8张图片');

    const legalRejectedPhone = buildRandomMainlandPhone('15');
    const legalRejectedPayload = createForemanApplyPayload(legalRejectedPhone);
    legalRejectedPayload.legalAcceptance = {
      ...buildLegalAcceptancePayload(),
      accepted: false,
    };
    const legalRejected = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', legalRejectedPayload);
    expect(legalRejected.status).toBe(200);
    expect(legalRejected.body.code).toBe(400);
    expect(legalRejected.body.message).toContain('同意');
  });

  test('foreman resubmit follows same validation rules as apply', async ({ request }) => {
    const env = getMerchantTestEnv();
    const adminEnv = getMerchantAdminTestEnv();

    const phone = buildRandomMainlandPhone('15');
    const applyPayload = createForemanApplyPayload(phone);

    const applyResult = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', applyPayload);
    expect(applyResult.status).toBe(200);
    expect(applyResult.body.code).toBe(0);

    const statusResult = await getMerchantApplyStatusByPhone(request, env.apiBaseUrl, phone);
    expect(statusResult.status).toBe(200);
    expect(statusResult.body.code).toBe(0);
    expect(statusResult.body.data.applicationId).toBeGreaterThan(0);

    const adminToken = await loginAdminByApi(request, env.apiBaseUrl, adminEnv.username, adminEnv.password);
    const rejectResult = await rejectMerchantApplication(
      request,
      env.apiBaseUrl,
      adminToken,
      statusResult.body.data.applicationId,
      'E2E: verify resubmit validation',
    );
    expect(rejectResult.status).toBe(200);
    expect(rejectResult.body.code).toBe(0);

    const invalidResubmitPayload = createForemanApplyPayload(phone);
    invalidResubmitPayload.portfolioCases = (invalidResubmitPayload.portfolioCases as Array<Record<string, unknown>>).filter(
      (item) => item.category !== 'paint',
    );
    const resubmitResult = await merchantApiPost(
      request,
      env.apiBaseUrl,
      `/merchant/apply/${statusResult.body.data.applicationId}/resubmit`,
      invalidResubmitPayload,
    );
    expect(resubmitResult.status).toBe(200);
    expect(resubmitResult.body.code).toBe(400);
    expect(resubmitResult.body.message).toContain('油漆工施工展示');
  });
});
