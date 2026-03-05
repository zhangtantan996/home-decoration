import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { buildTestPhone, getIdentityAcceptanceEnv } from './helpers/env';
import { adminLogin, applyProviderIdentity, listPendingIdentityApplications, loginUserByCode } from './helpers/identity';

test.describe.serial('Identity Phase1 Admin UI Acceptance', () => {
  const env = getIdentityAcceptanceEnv();

  let api: APIRequestContext;
  let adminToken = '';

  let approveUserId = 0;
  let rejectUserId = 0;

  test.beforeAll(async () => {
    api = await request.newContext();

    const admin = await adminLogin(api, env.apiBaseUrl, env.adminUser, env.adminPass);
    adminToken = admin.token;

    const approveUser = await loginUserByCode(
      api,
      env.apiBaseUrl,
      buildTestPhone(env.phonePrefix, env.runId, 11),
    );
    approveUserId = approveUser.user.id;

    const rejectUser = await loginUserByCode(
      api,
      env.apiBaseUrl,
      buildTestPhone(env.phonePrefix, env.runId, 12),
    );
    rejectUserId = rejectUser.user.id;

    const applyApprove = await applyProviderIdentity(
      api,
      env.apiBaseUrl,
      approveUser.token,
      'company',
      env.runId,
      'ui-approve-path',
    );
    expect(applyApprove.status).toBe(200);
    expect(applyApprove.body.code).toBe(0);

    const applyReject = await applyProviderIdentity(
      api,
      env.apiBaseUrl,
      rejectUser.token,
      'foreman',
      env.runId,
      'ui-reject-path',
    );
    expect(applyReject.status).toBe(200);
    expect(applyReject.body.code).toBe(0);

    const pending = await listPendingIdentityApplications(api, env.apiBaseUrl, adminToken);
    const hasApprovePending = pending.some((item) => item.userId === approveUserId && item.status === 0);
    const hasRejectPending = pending.some((item) => item.userId === rejectUserId && item.status === 0);

    expect(hasApprovePending).toBeTruthy();
    expect(hasRejectPending).toBeTruthy();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('管理员可在审核页完成详情、通过、驳回操作', async ({ page }) => {
    await page.goto(`${env.adminOrigin}/admin/login`, { waitUntil: 'domcontentloaded' });

    await page.getByPlaceholder('用户名').fill(env.adminUser);
    await page.getByPlaceholder('密码').fill(env.adminPass);

    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page).toHaveURL(/\/(?:admin\/)?dashboard(?:[/?#].*)?$/, { timeout: 30_000 });

    await page.goto(`${env.adminOrigin}/admin/providers/identity-applications`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('身份申请审核')).toBeVisible({ timeout: 30_000 });

    const approveRow = page.locator('tr', { hasText: String(approveUserId) }).first();
    await expect(approveRow).toBeVisible({ timeout: 30_000 });

    await approveRow.getByRole('button', { name: '详情' }).click();
    const detailDialog = page.getByRole('dialog', { name: '身份申请详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText(String(approveUserId), { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '审核通过' }).click();
    await expect(page.locator('.ant-modal-confirm')).toBeVisible();
    await page.locator('.ant-modal-confirm .ant-btn-primary').click();
    await expect(page.getByText('审核通过').first()).toBeVisible({ timeout: 15_000 });

    const rejectRow = page.locator('tr', { hasText: String(rejectUserId) }).first();
    await expect(rejectRow).toBeVisible({ timeout: 30_000 });
    await rejectRow.getByRole('button', { name: '驳回' }).click();

    await expect(page.getByText('驳回身份申请').first()).toBeVisible();
    const rejectReason = `UI_REJECT_${env.runId}`;
    await page.getByPlaceholder('请输入驳回原因').fill(rejectReason);
    await page.getByRole('button', { name: '确 定' }).click();
    await expect(page.getByText('已驳回申请').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('.ant-select').click();
    await page.getByTitle('已通过').click();
    await expect(page.locator('tr', { hasText: String(approveUserId) }).first()).toBeVisible({ timeout: 30_000 });

    await page.locator('.ant-select').click();
    await page.getByTitle('已拒绝').click();
    await expect(page.locator('tr', { hasText: String(rejectUserId) }).first()).toBeVisible({ timeout: 30_000 });
  });
});
