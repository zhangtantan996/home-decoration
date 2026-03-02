import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { apiGet, expectNoServerError } from './helpers/api';
import {
  adminLogin,
  applyProviderIdentity,
  approveIdentityApplication,
  getIdentityApplicationDetail,
  listPendingIdentityApplications,
  listUserIdentities,
  loginUserByCode,
  refreshToken,
  rejectIdentityApplication,
  switchIdentity,
} from './helpers/identity';
import { buildTestPhone, getIdentityAcceptanceEnv, writeRuntimeContext } from './helpers/env';

test.describe.serial('Identity Phase1 API Acceptance', () => {
  const env = getIdentityAcceptanceEnv();

  let api: APIRequestContext;
  let adminToken = '';

  let approveUserPhone = '';
  let approveUserToken = '';
  let approveUserId = 0;

  let rejectUserPhone = '';
  let rejectUserToken = '';
  let rejectUserId = 0;


  test.beforeAll(async () => {
    api = await request.newContext();

    const admin = await adminLogin(api, env.apiBaseUrl, env.adminUser, env.adminPass);
    adminToken = admin.token;

    approveUserPhone = buildTestPhone(env.phonePrefix, env.runId, 1);
    rejectUserPhone = buildTestPhone(env.phonePrefix, env.runId, 2);

    const approveUser = await loginUserByCode(api, env.apiBaseUrl, approveUserPhone);
    approveUserToken = approveUser.token;
    approveUserId = approveUser.user.id;

    const rejectUser = await loginUserByCode(api, env.apiBaseUrl, rejectUserPhone);
    rejectUserToken = rejectUser.token;
    rejectUserId = rejectUser.user.id;

    await writeRuntimeContext({
      runId: env.runId,
      phonePrefix: env.phonePrefix,
      users: {
        approveUser: { id: approveUserId, phone: approveUserPhone },
        rejectUser: { id: rejectUserId, phone: rejectUserPhone },
      },
      generatedAt: new Date().toISOString(),
    });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('申请约束：禁止 providerSubType=worker', async () => {
    const result = await applyProviderIdentity(
      api,
      env.apiBaseUrl,
      approveUserToken,
      'worker',
      env.runId,
      'invalid-subtype',
    );

    expectNoServerError(result.status, 'invalid subtype apply must not return 5xx');
    expect(result.status).toBe(400);
  });

  test('审核接口权限：用户 token 不可访问 admin identity applications', async () => {
    const result = await apiGet(
      api,
      env.apiBaseUrl,
      '/admin/identity-applications?page=1&pageSize=20&status=0',
      approveUserToken,
    );

    expectNoServerError(result.status, 'admin list with user token must not return 5xx');
    expect([401, 403]).toContain(result.status);
  });

  test('审核通过链路：apply -> approve -> switch -> refresh 保持身份', async () => {
    const applyResult = await applyProviderIdentity(
      api,
      env.apiBaseUrl,
      approveUserToken,
      'designer',
      env.runId,
      'approve-path',
    );

    expectNoServerError(applyResult.status, 'apply identity for approve path must not return 5xx');
    expect(applyResult.status).toBe(200);
    expect(applyResult.body.code).toBe(0);

    const pending = await listPendingIdentityApplications(api, env.apiBaseUrl, adminToken);
    const approveApp = pending
      .filter((item) => item.userId === approveUserId)
      .sort((a, b) => b.id - a.id)[0];

    expect(approveApp, `pending application should exist for user ${approveUserId}`).toBeTruthy();

    const detailBeforeApprove = await getIdentityApplicationDetail(
      api,
      env.apiBaseUrl,
      adminToken,
      approveApp.id,
    );
    expect(detailBeforeApprove.status).toBe(0);

    await approveIdentityApplication(api, env.apiBaseUrl, adminToken, approveApp.id);

    const detailAfterApprove = await getIdentityApplicationDetail(
      api,
      env.apiBaseUrl,
      adminToken,
      approveApp.id,
    );
    expect(detailAfterApprove.status).toBe(1);

    const identities = await listUserIdentities(api, env.apiBaseUrl, approveUserToken);
    const providerIdentity = identities.identities.find((identity) => identity.identityType === 'provider');

    expect(providerIdentity, 'approved provider identity should exist').toBeTruthy();

    const switchResult = await switchIdentity(
      api,
      env.apiBaseUrl,
      approveUserToken,
      providerIdentity!.id,
    );

    expect(switchResult.activeRole).toBe('provider');
    expect(switchResult.providerSubType).toBeTruthy();
    expect(Number(switchResult.providerId || 0)).toBeGreaterThan(0);

    const refreshed = await refreshToken(api, env.apiBaseUrl, switchResult.refreshToken);

    expect(refreshed.activeRole).toBe('provider');
    expect(refreshed.providerSubType).toBe(switchResult.providerSubType);
    expect(refreshed.providerId).toBe(switchResult.providerId);
  });

  test('审核拒绝链路：apply -> reject -> reason 保留', async () => {
    const applyResult = await applyProviderIdentity(
      api,
      env.apiBaseUrl,
      rejectUserToken,
      'foreman',
      env.runId,
      'reject-path',
    );

    expectNoServerError(applyResult.status, 'apply identity for reject path must not return 5xx');
    expect(applyResult.status).toBe(200);
    expect(applyResult.body.code).toBe(0);

    const pending = await listPendingIdentityApplications(api, env.apiBaseUrl, adminToken);
    const rejectApp = pending
      .filter((item) => item.userId === rejectUserId)
      .sort((a, b) => b.id - a.id)[0];

    expect(rejectApp, `pending application should exist for user ${rejectUserId}`).toBeTruthy();

    const rejectReason = `E2E_REJECT_${env.runId}`;
    await rejectIdentityApplication(api, env.apiBaseUrl, adminToken, rejectApp.id, rejectReason);

    const detail = await getIdentityApplicationDetail(api, env.apiBaseUrl, adminToken, rejectApp.id);

    expect(detail.status).toBe(2);
    expect(detail.rejectReason || '').toContain(env.runId);
  });
});
