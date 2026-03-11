import { expect, test } from '@playwright/test';

import {
  buildLegalAcceptancePayload,
  buildRandomMainlandPhone,
  getMerchantApplyStatusByPhone,
  getMerchantTestEnv,
  merchantApiPost,
} from './helpers/merchant';

type DesignerApplyPayload = Record<string, unknown>;

function createDesignerApplyPayload(phone: string): DesignerApplyPayload {
  const caseImages = (prefix: string) => [
    `https://example.com/${prefix}-1.jpg`,
    `https://example.com/${prefix}-2.jpg`,
    `https://example.com/${prefix}-3.jpg`,
    `https://example.com/${prefix}-4.jpg`,
  ];

  return {
    phone,
    code: '123456',
    role: 'designer',
    entityType: 'personal',
    realName: '设计师测试',
    avatar: 'https://example.com/avatar-designer.jpg',
    yearsExperience: 6,
    idCardNo: '11010519491231002X',
    idCardFront: 'https://example.com/id-front.jpg',
    idCardBack: 'https://example.com/id-back.jpg',
    officeAddress: '西安市高新区科技路 66 号',
    serviceArea: ['610100'],
    styles: ['现代简约'],
    pricing: {
      flat: 280,
      duplex: 320,
    },
    introduction: 'E2E 设计师入驻校验',
    portfolioCases: [
      {
        title: '设计案例A',
        description: '设计案例A说明',
        images: caseImages('designer-a'),
      },
      {
        title: '设计案例B',
        description: '设计案例B说明',
        images: caseImages('designer-b'),
      },
      {
        title: '设计案例C',
        description: '设计案例C说明',
        images: caseImages('designer-c'),
      },
    ],
    legalAcceptance: buildLegalAcceptancePayload(),
  };
}

test.describe('Merchant Onboarding Designer Required Fields', () => {
  test('designer required fields validation and success path', async ({ request }) => {
    const env = getMerchantTestEnv();

    const missingAvatarPhone = buildRandomMainlandPhone('13');
    const missingAvatarPayload = createDesignerApplyPayload(missingAvatarPhone);
    missingAvatarPayload.avatar = '';
    const missingAvatar = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingAvatarPayload);
    expect(missingAvatar.status).toBe(200);
    expect(missingAvatar.body.code).toBe(400);
    expect(
      missingAvatar.body.message.includes('请上传头像') || missingAvatar.body.message.includes('Avatar'),
      `unexpected message: ${missingAvatar.body.message}`,
    ).toBeTruthy();

    const missingYearsPhone = buildRandomMainlandPhone('13');
    const missingYearsPayload = createDesignerApplyPayload(missingYearsPhone);
    missingYearsPayload.yearsExperience = 0;
    const missingYears = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingYearsPayload);
    expect(missingYears.status).toBe(200);
    expect(missingYears.body.code).toBe(400);
    expect(missingYears.body.message).toContain('1-50年');

    const missingAddressPhone = buildRandomMainlandPhone('13');
    const missingAddressPayload = createDesignerApplyPayload(missingAddressPhone);
    missingAddressPayload.officeAddress = '';
    const missingAddress = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingAddressPayload);
    expect(missingAddress.status).toBe(200);
    expect(missingAddress.body.code).toBe(400);
    expect(missingAddress.body.message).toContain('办公地址');

    const missingCaseDescPhone = buildRandomMainlandPhone('13');
    const missingCaseDescPayload = createDesignerApplyPayload(missingCaseDescPhone);
    const cases = (missingCaseDescPayload.portfolioCases as Array<Record<string, unknown>>) || [];
    cases[0].description = '';
    const missingCaseDesc = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingCaseDescPayload);
    expect(missingCaseDesc.status).toBe(200);
    expect(missingCaseDesc.body.code).toBe(400);
    expect(missingCaseDesc.body.message).toContain('缺少说明');

    const validPhone = buildRandomMainlandPhone('13');
    const validPayload = createDesignerApplyPayload(validPhone);
    const submit = await merchantApiPost<{ applicationId: number }>(request, env.apiBaseUrl, '/merchant/apply', validPayload);
    expect(submit.status).toBe(200);
    expect(submit.body.code).toBe(0);
    expect(submit.body.data.applicationId).toBeGreaterThan(0);

    const status = await getMerchantApplyStatusByPhone(request, env.apiBaseUrl, validPhone);
    expect(status.status).toBe(200);
    expect(status.body.code).toBe(0);
    expect(status.body.data.applicationId).toBe(submit.body.data.applicationId);
    expect(status.body.data.status).toBe(0);
  });
});
