import { expect, test } from '@playwright/test';

import {
  getMerchantTestEnv,
  loginMerchantByApi,
  loginMerchantByUi,
  merchantApiGet,
  merchantApiPut,
} from './helpers/merchant';

interface MerchantInfoData {
  id: number;
  name: string;
  providerType: number;
  applicantType?: string;
  providerSubType?: string;
  companyName?: string;
  yearsExperience?: number;
  workTypes?: string[];
  serviceArea?: string[];
  serviceAreaCodes?: string[];
  introduction?: string;
  teamSize?: number;
  officeAddress?: string;
}

const WORK_TYPE_LABEL: Record<string, string> = {
  mason: '瓦工',
  electrician: '电工',
  carpenter: '木工',
  painter: '油漆工',
  plumber: '水暖工',
};

test.describe('Merchant Foreman Settings WorkTypes', () => {
  test('foreman settings page shows and persists workTypes', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const env = getMerchantTestEnv();

    const login = await loginMerchantByApi(request, env.apiBaseUrl, env.foremanPhone, env.code);
    const token = login.token;

    const infoResult = await merchantApiGet<MerchantInfoData>(request, env.apiBaseUrl, '/merchant/info', token);
    expect(infoResult.status, 'merchant info should not return 5xx').toBeLessThan(500);
    expect(infoResult.status, 'merchant info status should be 200').toBe(200);
    expect(infoResult.body.code, `merchant info should succeed: ${infoResult.body.message}`).toBe(0);

    const info = infoResult.body.data;
    const providerSubType = String(info.providerSubType || login.provider.providerSubType || '').toLowerCase();
    const providerType = Number(info.providerType || login.provider.providerType || 0);

    if (providerSubType !== 'foreman' && providerType !== 3) {
      test.skip(true, `MERCHANT_FOREMAN_PHONE=${env.foremanPhone} 不是工长账号，当前 providerSubType=${providerSubType || 'unknown'}`);
      return;
    }

    const targetWorkTypes = ['mason', 'electrician'];
    const updatePayload = {
      name: info.name || '工长E2E',
      companyName: info.companyName || '',
      yearsExperience: Math.max(Number(info.yearsExperience || 0), 1),
      workTypes: targetWorkTypes,
      serviceArea: Array.isArray(info.serviceAreaCodes)
        ? info.serviceAreaCodes
        : (Array.isArray(info.serviceArea) ? info.serviceArea : []),
      introduction: info.introduction || '',
      teamSize: Math.max(Number(info.teamSize || 0), 1),
      officeAddress: info.officeAddress || '',
    };

    const updateResult = await merchantApiPut(request, env.apiBaseUrl, '/merchant/info', updatePayload, token);
    expect(updateResult.status, 'merchant info update should not return 5xx').toBeLessThan(500);
    expect(updateResult.status, 'merchant info update status should be 200').toBe(200);
    expect(updateResult.body.code, `merchant info update should succeed: ${updateResult.body.message}`).toBe(0);

    await loginMerchantByUi(page, env.origin, env.foremanPhone, env.code);
    await page.goto(`${env.origin}/merchant/settings`, { waitUntil: 'domcontentloaded' });

    const workTypeFormItem = page.locator('.ant-form-item').filter({ hasText: '工种类型' }).first();
    await expect(workTypeFormItem).toBeVisible({ timeout: 20_000 });

    const workTypeCombobox = workTypeFormItem.getByRole('combobox', { name: /工种类型/ });
    await workTypeCombobox.click();

    for (const workType of targetWorkTypes) {
      const label = WORK_TYPE_LABEL[workType];
      const selectedTag = workTypeFormItem.locator('.ant-select-selection-item').filter({ hasText: label }).first();
      const alreadySelected = await selectedTag.isVisible().catch(() => false);

      if (!alreadySelected) {
        await page
          .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content')
          .filter({ hasText: label })
          .first()
          .click();
      }
    }

    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: '保存基本信息' }).click();
    await expect(page.getByText('基本信息保存成功')).toBeVisible({ timeout: 10_000 });

    const refreshed = await merchantApiGet<MerchantInfoData>(request, env.apiBaseUrl, '/merchant/info', token);
    expect(refreshed.status, 'merchant info refresh should not return 5xx').toBeLessThan(500);
    expect(refreshed.status, 'merchant info refresh status should be 200').toBe(200);
    expect(refreshed.body.code, `merchant info refresh should succeed: ${refreshed.body.message}`).toBe(0);

    const persistedWorkTypes = refreshed.body.data.workTypes || [];
    for (const workType of targetWorkTypes) {
      expect(persistedWorkTypes, `workTypes should include ${workType}`).toContain(workType);
    }
  });
});
