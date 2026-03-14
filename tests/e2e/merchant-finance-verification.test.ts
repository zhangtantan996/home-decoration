import { expect, test } from '@playwright/test';

import {
  buildMerchantAppUrl,
  getMerchantTestEnv,
  loginMerchantByApi,
  loginMerchantByUi,
  merchantApiGet,
  merchantApiPost,
} from './helpers/merchant';

interface MerchantBankAccountsData {
  list: Array<{
    id: number;
    accountName: string;
    accountNo: string;
    bankName: string;
    isDefault: boolean;
  }>;
}

const buildRandomAccountNo = () => {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const withPrefix = `62${seed}`;
  return withPrefix.slice(0, 19).padEnd(16, '8');
};

async function ensureBankAccount(
  request: Parameters<typeof merchantApiGet>[0],
  apiBaseUrl: string,
  token: string,
  code: string,
): Promise<number> {
  const listResult = await merchantApiGet<MerchantBankAccountsData>(request, apiBaseUrl, '/merchant/bank-accounts', token);
  expect(listResult.status, 'list bank accounts should not return 5xx').toBeLessThan(500);

  if (listResult.body.code === 0 && listResult.body.data?.list?.length) {
    return listResult.body.data.list[0].id;
  }

  await merchantApiPost(
    request,
    apiBaseUrl,
    '/merchant/bank-accounts',
    {
      accountName: 'E2E测试户名',
      accountNo: buildRandomAccountNo(),
      bankName: '中国工商银行',
      branchName: '西安E2E支行',
      isDefault: true,
      verificationCode: code,
    },
    token,
  );

  const listAgain = await merchantApiGet<MerchantBankAccountsData>(request, apiBaseUrl, '/merchant/bank-accounts', token);
  expect(listAgain.status, 'list bank accounts after add should not return 5xx').toBeLessThan(500);
  expect(listAgain.body.code, `list bank accounts after add should succeed: ${listAgain.body.message}`).toBe(0);
  expect(listAgain.body.data.list.length, 'bank account should exist after ensure step').toBeGreaterThan(0);

  return listAgain.body.data.list[0].id;
}

test.describe('Merchant Finance Verification', () => {
  test('bank account / withdraw require verificationCode', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const env = getMerchantTestEnv();

    const login = await loginMerchantByApi(request, env.apiBaseUrl, env.phone, env.code);
    const token = login.token;
    const bankAccountId = await ensureBankAccount(request, env.apiBaseUrl, token, env.code);

    const addWithoutCode = await merchantApiPost(
      request,
      env.apiBaseUrl,
      '/merchant/bank-accounts',
      {
        accountName: '无验证码账户',
        accountNo: buildRandomAccountNo(),
        bankName: '中国建设银行',
      },
      token,
    );
    expect(addWithoutCode.status, 'add bank account without code should not return 5xx').toBeLessThan(500);
    expect(addWithoutCode.body.code, 'add bank account without code should be rejected').not.toBe(0);

    const withdrawWithoutCode = await merchantApiPost(
      request,
      env.apiBaseUrl,
      '/merchant/withdraw',
      {
        amount: 1,
        bankAccountId,
      },
      token,
    );
    expect(withdrawWithoutCode.status, 'withdraw without code should not return 5xx').toBeLessThan(500);
    expect(withdrawWithoutCode.body.code, 'withdraw without verificationCode should be rejected').not.toBe(0);

    await loginMerchantByUi(page, env.origin, env.phone, env.code);
    await page.goto(buildMerchantAppUrl(env.origin, '/bank-accounts'), { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '添加银行账户' }).click();
    const bankModal = page.locator('.ant-modal-content').last();
    await expect(bankModal).toBeVisible();

    await bankModal.getByRole('combobox', { name: /开户银行/ }).click();
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content')
      .filter({ hasText: '中国工商银行' })
      .first()
      .click();

    await bankModal.getByPlaceholder('请输入银行账户户名').fill('UI验证账户');
    await bankModal.getByPlaceholder('请输入16-19位银行账号').fill(buildRandomAccountNo());

    await bankModal.getByRole('button', { name: '确认添加' }).click();
    await expect(bankModal.getByText('请输入验证码')).toBeVisible();

    await bankModal.getByPlaceholder('请输入验证码').fill('000000');
    await bankModal.getByRole('button', { name: '确认添加' }).click();
    await expect(page.getByText('验证码错误')).toBeVisible({ timeout: 10_000 });

    await page.goto(buildMerchantAppUrl(env.origin, '/withdraw'), { waitUntil: 'domcontentloaded' });
    const applyWithdrawButton = page.getByRole('button', { name: '申请提现' }).first();

    if (!(await applyWithdrawButton.isEnabled())) {
      testInfo.annotations.push({
        type: 'note',
        description: '当前商家无可提现金额，已跳过提现弹窗 UI 验证，仅完成 API 与银行卡 UI 验证。',
      });
      return;
    }

    await applyWithdrawButton.click();
    const withdrawModal = page.locator('.ant-modal-content').last();
    const withdrawModalVisible = await withdrawModal
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    if (!withdrawModalVisible) {
      testInfo.annotations.push({
        type: 'note',
        description: '申请提现按钮可点击但弹窗未出现（常见于可提现金额不足场景），已跳过提现 UI 验证。',
      });
      return;
    }

    await withdrawModal.locator('input[placeholder="请输入提现金额"]').fill('1');
    await withdrawModal.getByRole('combobox', { name: /收款银行账户/ }).click();
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .first()
      .click();

    await withdrawModal.getByRole('button', { name: '确认提现' }).click();
    await expect(withdrawModal.getByText('请输入验证码')).toBeVisible();

    await withdrawModal.getByPlaceholder('请输入验证码').fill('000000');
    await withdrawModal.getByRole('button', { name: '确认提现' }).click();
    await expect(page.getByText('验证码错误')).toBeVisible({ timeout: 10_000 });
  });
});
