import { expect, test } from '@playwright/test';

import {
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
  const buildImages = (prefix: string) =>
    Array.from({ length: 8 }, (_, index) => `https://example.com/${prefix}-${index + 1}.jpg`);

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
    workTypes: ['mason'],
    highlightTags: ['工期稳定'],
    pricing: {
      perSqm: 220,
    },
    introduction: 'E2E 工长入驻校验',
    portfolioCases: [
      {
        title: '施工案例A',
        description: '施工案例A说明',
        images: buildImages('foreman-a'),
      },
      {
        title: '施工案例B',
        description: '施工案例B说明',
        images: buildImages('foreman-b'),
      },
      {
        title: '施工案例C',
        description: '施工案例C说明',
        images: buildImages('foreman-c'),
      },
    ],
    legalAcceptance: buildLegalAcceptancePayload(),
  };
}

test.describe('Merchant Onboarding Foreman Required Fields', () => {
  test('foreman required fields validation', async ({ request }) => {
    const env = getMerchantTestEnv();

    const missingWorkTypesPhone = buildRandomMainlandPhone('15');
    const missingWorkTypesPayload = createForemanApplyPayload(missingWorkTypesPhone);
    missingWorkTypesPayload.workTypes = [];
    const missingWorkTypes = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingWorkTypesPayload);
    expect(missingWorkTypes.status).toBe(200);
    expect(missingWorkTypes.body.code).toBe(400);
    expect(missingWorkTypes.body.message).toContain('至少选择1个工种');

    const missingHighlightPhone = buildRandomMainlandPhone('15');
    const missingHighlightPayload = createForemanApplyPayload(missingHighlightPhone);
    missingHighlightPayload.highlightTags = [];
    const missingHighlight = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingHighlightPayload);
    expect(missingHighlight.status).toBe(200);
    expect(missingHighlight.body.code).toBe(400);
    expect(missingHighlight.body.message).toContain('1-3个');

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
    invalidResubmitPayload.workTypes = [];
    const resubmitResult = await merchantApiPost(
      request,
      env.apiBaseUrl,
      `/merchant/apply/${statusResult.body.data.applicationId}/resubmit`,
      invalidResubmitPayload,
    );
    expect(resubmitResult.status).toBe(200);
    expect(resubmitResult.body.code).toBe(400);
    expect(resubmitResult.body.message).toContain('至少选择1个工种');
  });
});
