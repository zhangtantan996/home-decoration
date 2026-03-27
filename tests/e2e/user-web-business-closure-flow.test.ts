import { expect, test } from '@playwright/test';

import { mockUserWebApi, userWebFixtureIds } from './helpers/userWeb';

async function openWithMockSession(
  page: Parameters<typeof test>[0]['page'],
  redirectPath: string,
  options?: { initialBusinessStage?: 'construction_quote_pending' | 'ready_to_start' | 'milestone_review' | 'completed' | 'archived' },
) {
  await mockUserWebApi(page, options || {});
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'user-web-session',
      JSON.stringify({
        state: {
          accessToken: 'user-web-token',
          refreshToken: 'user-web-refresh-token',
          expiresIn: 7200,
          expiresAt: Date.now() + 7200_000,
          user: {
            id: 1,
            phone: '13900000001',
            nickname: '测试业主',
            userType: 1,
          },
        },
        version: 0,
      }),
    );
  });
  const normalizedRedirect = redirectPath.startsWith('/app/') ? redirectPath : `/app${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}`;
  await page.goto(`http://127.0.0.1:5175${normalizedRedirect}`, { waitUntil: 'domcontentloaded' });
}

test.describe('user web business closure flow', () => {
  test('预约量房页可要求重新量房并回显原因', async ({ page }) => {
    await openWithMockSession(page, `/bookings/${userWebFixtureIds.bookingId}/site-survey`);

    await expect(page.getByRole('heading', { name: `预约 #${userWebFixtureIds.bookingId} 量房记录` })).toBeVisible();
    await page.getByPlaceholder('如需重新量房，请写明原因和需要补测的点。').fill('主卧衣柜位置尺寸还需要补测');
    await page.getByRole('button', { name: '要求重新量房' }).click();

    await expect(page.getByText('已要求重新量房，等待商家重提。')).toBeVisible();
    await expect(page.getByText('上次退回原因：主卧衣柜位置尺寸还需要补测')).toBeVisible();
  });

  test('预约预算页可接受预算并确认设计意向', async ({ page }) => {
    await openWithMockSession(page, `/bookings/${userWebFixtureIds.bookingId}/budget-confirm`);

    await expect(page.getByRole('heading', { name: `预约 #${userWebFixtureIds.bookingId} 预算与设计意向` })).toBeVisible();
    await page.getByRole('button', { name: '接受预算并确认设计意向' }).click();

    await expect(page.getByText('预算与设计意向已确认，商家可进入方案提交阶段。')).toBeVisible();
  });

  test('项目详情待开工时不再由用户发起开工', async ({ page }) => {
    await openWithMockSession(page, `/projects/${userWebFixtureIds.projectId}`, { initialBusinessStage: 'ready_to_start' });

    await expect(page.getByRole('button', { name: '确认开工' })).toHaveCount(0);
    await expect(page.getByText('施工报价已确认，项目待开工')).toBeVisible();
  });

  test('项目详情可进入施工报价确认页并完成确认', async ({ page }) => {
    await openWithMockSession(page, `/projects/${userWebFixtureIds.projectId}`, { initialBusinessStage: 'construction_quote_pending' });

    await expect(page.getByRole('heading', { name: '云杉路旧房改造项目' })).toBeVisible();
    await expect(page.getByRole('link', { name: '去确认' })).toBeVisible();

    await page.getByRole('link', { name: '去确认' }).click();
    await expect(page).toHaveURL(new RegExp(`/quote-tasks/${userWebFixtureIds.quoteTaskId}$`));
    await expect(page.getByRole('heading', { name: '施工报价概览' })).toBeVisible();
    await expect(page.getByText('施工报价待用户确认')).toBeVisible();

    await page.getByRole('button', { name: '确认施工报价' }).click();
    await expect(page).toHaveURL(/\/progress$/);
  });

  test('验收页可驳回当前节点并保留在验收链路', async ({ page }) => {
    await openWithMockSession(page, `/projects/${userWebFixtureIds.projectId}/acceptance`, { initialBusinessStage: 'milestone_review' });

    await expect(page.getByRole('heading', { name: '泥木验收 验收' })).toBeVisible();
    await page.getByLabel('验收说明').fill('泥木基层还有两处收口需要整改');
    await page.getByRole('button', { name: '驳回' }).click();

    await expect(page.getByText('节点 泥木验收 已驳回，等待整改后重新提交。')).toBeVisible();
  });

  test('完工验收页可通过并自动生成灵感案例草稿', async ({ page }) => {
    await openWithMockSession(page, `/projects/${userWebFixtureIds.projectId}/completion`, { initialBusinessStage: 'completed' });

    const approveButton = page.getByRole('button', { name: '整体验收通过' });
    await expect(approveButton).toBeEnabled();
    await approveButton.click();

    await expect(page.getByText(`验收通过，已生成案例草稿 #${userWebFixtureIds.inspirationDraftAuditId}。`)).toBeVisible();
  });

  test('完工验收页可驳回并退回整改', async ({ page }) => {
    await openWithMockSession(page, `/projects/${userWebFixtureIds.projectId}/completion`, { initialBusinessStage: 'completed' });

    await page.getByPlaceholder('如需驳回，请写明需要整改的点。').fill('柜门收口和墙面补色仍需处理');
    await page.getByRole('button', { name: '驳回并整改' }).click();

    await expect(page.getByText('已驳回完工，项目退回施工整改。')).toBeVisible();
    await expect(page.getByText('上次驳回原因：柜门收口和墙面补色仍需处理')).toBeVisible();
  });

  test('归档后的完工验收页不再展示可提交动作', async ({ page }) => {
    await openWithMockSession(page, `/projects/${userWebFixtureIds.projectId}/completion`, { initialBusinessStage: 'archived' });

    await expect(page.getByText('项目已完成整体验收并归档，无需重复操作。')).toBeVisible();
    await expect(page.getByRole('button', { name: '整体验收通过' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '驳回并整改' })).toHaveCount(0);
  });
});
