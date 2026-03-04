import { expect, test } from '@playwright/test';

import { getMerchantTestEnv, merchantApiGet } from './helpers/merchant';

interface PublicProviderListData {
  list: Array<{
    id: number;
    verified?: boolean;
  }>;
}

interface PublicMaterialShopListData {
  list: Array<{
    id: number;
    isVerified?: boolean;
  }>;
}

interface PublicMaterialShopDetailData {
  id: number;
  isVerified?: boolean;
}

test.describe('Publish Visibility Threshold', () => {
  test('public providers/material-shops only expose verified entities', async ({ request }, testInfo) => {
    testInfo.setTimeout(90_000);
    const env = getMerchantTestEnv();

    const providersResult = await merchantApiGet<PublicProviderListData>(request, env.apiBaseUrl, '/providers?page=1&pageSize=30');
    expect(providersResult.status, 'providers list should not return 5xx').toBeLessThan(500);
    expect(providersResult.status, 'providers list status should be 200').toBe(200);
    expect(providersResult.body.code, `providers list should succeed: ${providersResult.body.message}`).toBe(0);

    for (const provider of providersResult.body.data?.list || []) {
      expect(provider.verified, `public provider ${provider.id} should be verified`).toBe(true);
    }

    const shopsResult = await merchantApiGet<PublicMaterialShopListData>(request, env.apiBaseUrl, '/material-shops?page=1&pageSize=30');
    expect(shopsResult.status, 'material shops list should not return 5xx').toBeLessThan(500);
    expect(shopsResult.status, 'material shops list status should be 200').toBe(200);
    expect(shopsResult.body.code, `material shops list should succeed: ${shopsResult.body.message}`).toBe(0);

    const shopList = shopsResult.body.data?.list || [];
    for (const shop of shopList) {
      expect(shop.isVerified, `public material shop ${shop.id} should be verified`).toBe(true);
    }

    if (shopList.length === 0) {
      testInfo.annotations.push({
        type: 'note',
        description: '当前环境没有可见主材商数据，仅完成接口可用性与契约断言。',
      });
      return;
    }

    const detailResult = await merchantApiGet<PublicMaterialShopDetailData>(
      request,
      env.apiBaseUrl,
      `/material-shops/${shopList[0].id}`,
    );
    expect(detailResult.status, 'material shop detail should not return 5xx').toBeLessThan(500);
    expect(detailResult.status, 'material shop detail status should be 200').toBe(200);
    expect(detailResult.body.code, `material shop detail should succeed: ${detailResult.body.message}`).toBe(0);
    expect(detailResult.body.data?.isVerified, 'public material shop detail should be verified').toBe(true);
  });
});
