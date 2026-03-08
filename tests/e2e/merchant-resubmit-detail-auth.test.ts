import { expect, test } from '@playwright/test';

import {
  buildLegalAcceptancePayload,
  buildRandomMainlandPhone,
  getMerchantAdminTestEnv,
  getMerchantTestEnv,
  loginAdminByApi,
  merchantApiPost,
  rejectMerchantApplication,
  getMerchantApplyStatusByPhone,
} from './helpers/merchant';

test.describe('Merchant resubmit detail auth', () => {
  test('rejected merchant requires sms auth to fetch detail and can resubmit with token', async ({ request }) => {
    const env = getMerchantTestEnv();
    const admin = getMerchantAdminTestEnv();
    const phone = buildRandomMainlandPhone('19');

    const applyPayload = {
      phone,
      code: env.code,
      role: 'designer',
      entityType: 'personal',
      applicantType: 'personal',
      realName: '重提测试',
      avatar: 'https://img.example.com/avatar.jpg',
      idCardNo: '11010519491231002X',
      idCardFront: 'https://img.example.com/front.jpg',
      idCardBack: 'https://img.example.com/back.jpg',
      yearsExperience: 5,
      serviceArea: ['610113'],
      styles: ['现代简约'],
      pricing: { flat: 1200 },
      introduction: '重提测试简介',
      portfolioCases: [
        { title: '案例1', description: '案例1说明', images: ['https://img.example.com/case1.jpg', 'https://img.example.com/case2.jpg', 'https://img.example.com/case3.jpg'], style: '现代简约', area: '100㎡' },
        { title: '案例2', description: '案例2说明', images: ['https://img.example.com/case4.jpg', 'https://img.example.com/case5.jpg', 'https://img.example.com/case6.jpg'], style: '现代简约', area: '90㎡' },
        { title: '案例3', description: '案例3说明', images: ['https://img.example.com/case7.jpg', 'https://img.example.com/case8.jpg', 'https://img.example.com/case9.jpg'], style: '现代简约', area: '80㎡' },
      ],
      legalAcceptance: buildLegalAcceptancePayload(),
    };

    const applyResult = await merchantApiPost<{ applicationId: number }>(request, env.apiBaseUrl, '/merchant/apply', applyPayload);
    expect(applyResult.status).toBe(200);
    expect(applyResult.body.code).toBe(0);
    const applicationId = Number(applyResult.body.data?.applicationId || 0);
    expect(applicationId).toBeGreaterThan(0);

    const adminToken = await loginAdminByApi(request, env.apiBaseUrl, admin.username, admin.password);
    const rejectResult = await rejectMerchantApplication(request, env.apiBaseUrl, adminToken, applicationId, 'E2E 重提认证校验');
    expect(rejectResult.status).toBe(200);
    expect(rejectResult.body.code).toBe(0);

    const statusResult = await getMerchantApplyStatusByPhone(request, env.apiBaseUrl, phone);
    expect(statusResult.status).toBe(200);
    expect(statusResult.body.code).toBe(0);
    expect(statusResult.body.data?.status).toBe(2);

    const deniedDetail = await merchantApiPost(request, env.apiBaseUrl, `/merchant/apply/${applicationId}/detail-for-resubmit`, { phone, code: '000000' });
    expect(deniedDetail.status).toBe(200);
    expect(deniedDetail.body.code).not.toBe(0);

    const detailResult = await merchantApiPost<{ resubmitToken: string; form: typeof applyPayload }>(
      request,
      env.apiBaseUrl,
      `/merchant/apply/${applicationId}/detail-for-resubmit`,
      { phone, code: env.code },
    );
    expect(detailResult.status).toBe(200);
    expect(detailResult.body.code).toBe(0);
    expect(detailResult.body.data?.resubmitToken).toBeTruthy();
    expect(detailResult.body.data?.form?.phone).toBe(phone);

    const resubmitPayload = {
      ...applyPayload,
      code: '',
      resubmitToken: detailResult.body.data?.resubmitToken,
    };
    const resubmitResult = await merchantApiPost<{ applicationId: number }>(request, env.apiBaseUrl, `/merchant/apply/${applicationId}/resubmit`, resubmitPayload);
    expect(resubmitResult.status).toBe(200);
    expect(resubmitResult.body.code).toBe(0);
  });
});
