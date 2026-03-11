import { expect, test } from '@playwright/test';

import {
  approveMerchantApplication,
  buildForemanPortfolioCases,
  buildLegalAcceptancePayload,
  buildRandomMainlandPhone,
  getMerchantAdminTestEnv,
  getMerchantApplyStatusByPhone,
  getMerchantTestEnv,
  loginAdminByApi,
  merchantApiGet,
  merchantApiPost,
} from './helpers/merchant';

type ForemanApplyPayload = Record<string, unknown>;

function createVisibilityForemanPayload(phone: string, marker: string): ForemanApplyPayload {
  return {
    phone,
    code: '123456',
    role: 'foreman',
    entityType: 'personal',
    realName: '展示链路测试工长',
    avatar: `https://example.com/${marker}-avatar.jpg`,
    companyName: `西安${marker}施工服务`,
    yearsExperience: 9,
    idCardNo: '11010519491231002X',
    idCardFront: 'https://example.com/id-front.jpg',
    idCardBack: 'https://example.com/id-back.jpg',
    serviceArea: ['610100'],
    officeAddress: '西安市高新区展示路 9 号',
    highlightTags: ['准时交付', marker],
    pricing: {
      perSqm: 260,
    },
    introduction: '展示链路测试简介',
    graduateSchool: '西安建筑科技大学',
    designPhilosophy: `展示链路测试理念-${marker}`,
    portfolioCases: buildForemanPortfolioCases({ imageCount: 2 }),
    legalAcceptance: buildLegalAcceptancePayload(),
  };
}

test.describe('Publish Visibility Extended Fields', () => {
  test('pending application invisible, approved provider visible with extended fields', async ({ request }) => {
    const env = getMerchantTestEnv();
    const adminEnv = getMerchantAdminTestEnv();

    const phone = buildRandomMainlandPhone('18');
    const marker = `e2e_company_${Date.now()}`;
    const applyPayload = createVisibilityForemanPayload(phone, marker);

    const applyResult = await merchantApiPost(request, env.apiBaseUrl, '/merchant/apply', applyPayload);
    expect(applyResult.status).toBe(200);
    expect(applyResult.body.code).toBe(0);

    const pendingList = await merchantApiGet<{
      list: Array<{ id: number; specialty?: string; companyName?: string }>;
      total: number;
    }>(request, env.apiBaseUrl, `/providers?type=3&keyword=${encodeURIComponent(marker)}&page=1&pageSize=20`);
    expect(pendingList.status).toBe(200);
    expect(pendingList.body.code).toBe(0);
    expect(Array.isArray(pendingList.body.data.list)).toBeTruthy();
    expect(pendingList.body.data.list.length).toBe(0);

    const statusResult = await getMerchantApplyStatusByPhone(request, env.apiBaseUrl, phone);
    expect(statusResult.status).toBe(200);
    expect(statusResult.body.code).toBe(0);
    expect(statusResult.body.data.applicationId).toBeGreaterThan(0);

    const adminToken = await loginAdminByApi(request, env.apiBaseUrl, adminEnv.username, adminEnv.password);
    const approveResult = await approveMerchantApplication(
      request,
      env.apiBaseUrl,
      adminToken,
      statusResult.body.data.applicationId,
    );
    expect(approveResult.status).toBe(200);
    expect(approveResult.body.code).toBe(0);
    expect(approveResult.body.data.providerId).toBeGreaterThan(0);

    const approvedList = await merchantApiGet<{
      list: Array<{ id: number; specialty?: string; companyName?: string }>;
      total: number;
    }>(request, env.apiBaseUrl, `/providers?type=3&keyword=${encodeURIComponent(marker)}&page=1&pageSize=20`);
    expect(approvedList.status).toBe(200);
    expect(approvedList.body.code).toBe(0);
    expect(approvedList.body.data.list.length).toBeGreaterThan(0);

    const approvedItem = approvedList.body.data.list.find(
      (item) => item.id === approveResult.body.data.providerId,
    );
    expect(approvedItem, 'approved provider should appear in public list').toBeTruthy();

    const userLoginResult = await merchantApiPost<{ token: string }>(request, env.apiBaseUrl, '/auth/login', {
      phone,
      type: 'code',
      code: '123456',
    });
    expect(userLoginResult.status).toBe(200);
    expect(userLoginResult.body.code).toBe(0);
    expect(userLoginResult.body.data.token).toBeTruthy();

    const detailResult = await merchantApiGet<{
      provider: {
        id: number;
        verified: boolean;
        companyName?: string;
        highlightTags?: string;
        pricingJson?: string;
        graduateSchool?: string;
        designPhilosophy?: string;
      };
    }>(request, env.apiBaseUrl, `/foremen/${approveResult.body.data.providerId}`, userLoginResult.body.data.token);
    expect(detailResult.status).toBe(200);
    expect(detailResult.body.code).toBe(0);
    expect(detailResult.body.data.provider.id).toBe(approveResult.body.data.providerId);
    expect(detailResult.body.data.provider.verified).toBe(true);
    expect(detailResult.body.data.provider.companyName || '').toContain(marker);
    expect(detailResult.body.data.provider.highlightTags || '').toContain(marker);
    expect(detailResult.body.data.provider.pricingJson || '').toContain('perSqm');
    expect(detailResult.body.data.provider.graduateSchool).toBe('西安建筑科技大学');
    expect(detailResult.body.data.provider.designPhilosophy || '').toContain(marker);
  });
});
