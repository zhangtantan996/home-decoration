import { expect, test } from '@playwright/test';

import {
  buildLegalAcceptancePayload,
  buildRandomMainlandPhone,
  getMerchantApplyStatusByPhone,
  getMerchantTestEnv,
  merchantApiPost,
} from './helpers/merchant';

type CompanyApplyPayload = Record<string, unknown>;

function createCompanyApplyPayload(phone: string): CompanyApplyPayload {
  const caseImages = (prefix: string) => [
    `https://example.com/${prefix}-1.jpg`,
    `https://example.com/${prefix}-2.jpg`,
    `https://example.com/${prefix}-3.jpg`,
  ];

  return {
    phone,
    code: '123456',
    role: 'company',
    entityType: 'company',
    applicantType: 'company',
    realName: '装修公司法人',
    avatar: 'https://example.com/company-avatar.jpg',
    idCardNo: '11010519491231002X',
    idCardFront: 'https://example.com/company-id-front.jpg',
    idCardBack: 'https://example.com/company-id-back.jpg',
    legalPersonName: '装修公司法人',
    legalPersonIdCardNo: '11010519491231002X',
    legalPersonIdCardFront: 'https://example.com/company-id-front.jpg',
    legalPersonIdCardBack: 'https://example.com/company-id-back.jpg',
    companyName: '西安整装测试有限公司',
    licenseNo: '91510100MA6C12345X',
    licenseImage: 'https://example.com/company-license.jpg',
    officeAddress: '西安市高新区锦业路 66 号',
    teamSize: 20,
    serviceArea: ['610100'],
    pricing: {
      fullPackage: 880,
      halfPackage: 620,
    },
    introduction: '装修公司入驻校验',
    companyAlbum: [
      'https://example.com/company-album-1.jpg',
      'https://example.com/company-album-2.jpg',
      'https://example.com/company-album-3.jpg',
    ],
    portfolioCases: [
      { title: '整装案例A', description: '整装案例A说明', images: caseImages('company-a') },
      { title: '整装案例B', description: '整装案例B说明', images: caseImages('company-b') },
      { title: '整装案例C', description: '整装案例C说明', images: caseImages('company-c') },
    ],
    legalAcceptance: buildLegalAcceptancePayload(),
  };
}

test.describe('Merchant Onboarding Company Required Fields', () => {
  test('company onboarding enforces company album and office address', async ({ request }) => {
    const env = getMerchantTestEnv();

    const missingAlbumPhone = buildRandomMainlandPhone('15');
    const missingAlbumPayload = createCompanyApplyPayload(missingAlbumPhone);
    missingAlbumPayload.companyAlbum = [];
    const missingAlbum = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingAlbumPayload);
    expect(missingAlbum.status).toBe(200);
    expect(missingAlbum.body.code).toBe(400);
    expect(missingAlbum.body.message).toContain('3-8张图片');

    const overflowAlbumPhone = buildRandomMainlandPhone('15');
    const overflowAlbumPayload = createCompanyApplyPayload(overflowAlbumPhone);
    overflowAlbumPayload.companyAlbum = Array.from({ length: 9 }, (_, index) => `https://example.com/company-overflow-${index + 1}.jpg`);
    const overflowAlbum = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', overflowAlbumPayload);
    expect(overflowAlbum.status).toBe(200);
    expect(overflowAlbum.body.code).toBe(400);
    expect(overflowAlbum.body.message).toContain('3-8张图片');

    const missingAddressPhone = buildRandomMainlandPhone('15');
    const missingAddressPayload = createCompanyApplyPayload(missingAddressPhone);
    missingAddressPayload.officeAddress = '';
    const missingAddress = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', missingAddressPayload);
    expect(missingAddress.status).toBe(200);
    expect(missingAddress.body.code).toBe(400);
    expect(missingAddress.body.message).toContain('办公地址');

    const validPhone = buildRandomMainlandPhone('15');
    const validPayload = createCompanyApplyPayload(validPhone);
    const submit = await merchantApiPost<{ applicationId: number }>(request, env.apiBaseUrl, '/merchant/apply', validPayload);
    expect(submit.status).toBe(200);
    expect(submit.body.code).toBe(0);
    expect(submit.body.data.applicationId).toBeGreaterThan(0);

    const status = await getMerchantApplyStatusByPhone(request, env.apiBaseUrl, validPhone);
    expect(status.status).toBe(200);
    expect(status.body.code).toBe(0);
    expect(status.body.data.applicationId).toBe(submit.body.data.applicationId);
  });
});
