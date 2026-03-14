import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const userWebRealFixture = {
  phone: process.env.USER_WEB_FIXTURE_PHONE || '19999100001',
  providerId: Number(process.env.USER_WEB_FIXTURE_PROVIDER_ID || '99101'),
  bookingId: Number(process.env.USER_WEB_FIXTURE_BOOKING_ID || '99110'),
  proposalId: Number(process.env.USER_WEB_FIXTURE_PROPOSAL_ID || '99120'),
  orderId: Number(process.env.USER_WEB_FIXTURE_ORDER_ID || '99130'),
  projectId: Number(process.env.USER_WEB_FIXTURE_PROJECT_ID || '99140'),
  providerName: process.env.USER_WEB_FIXTURE_PROVIDER_NAME || '拾光设计联调',
  profileName: process.env.USER_WEB_FIXTURE_PROFILE_NAME || '用户端联调业主',
};

export async function loginThroughRealUi(page: Page, redirectPath: string) {
  await page.goto(`/login?redirect=${encodeURIComponent(redirectPath)}`, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('手机号').fill(userWebRealFixture.phone);
  await page.getByRole('button', { name: '发送验证码' }).click();

  const note = page.locator('.status-note').first();
  await expect(note).toBeVisible();
  const noteText = await note.textContent();
  const code = noteText?.match(/(\d{6})/)?.[1] || process.env.USER_WEB_REAL_SMS_CODE || '123456';

  await page.getByLabel('验证码').fill(code);
  await page.getByRole('button', { name: '登录并继续' }).click();
}

export async function seedRealSession(page: Page, request: APIRequestContext) {
  const apiBase = process.env.USER_WEB_REAL_API_BASE || 'http://127.0.0.1:8080/api/v1';

  const sendCodeResponse = await request.post(`${apiBase}/auth/send-code`, {
    data: {
      phone: userWebRealFixture.phone,
      purpose: 'login',
    },
  });
  const sendCodePayload = await sendCodeResponse.json();
  const code = sendCodePayload?.data?.debugCode || process.env.USER_WEB_REAL_SMS_CODE || '123456';

  const loginResponse = await request.post(`${apiBase}/auth/login`, {
    data: {
      phone: userWebRealFixture.phone,
      code,
    },
  });
  const loginPayload = await loginResponse.json();
  const session = loginPayload?.data;

  if (!session?.token || !session?.refreshToken) {
    throw new Error(`real api login failed: ${JSON.stringify(loginPayload)}`);
  }

  await page.addInitScript((payload) => {
    window.localStorage.setItem(
      'user-web-session',
      JSON.stringify({
        state: {
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          expiresIn: payload.expiresIn,
          user: payload.user || null,
        },
        version: 0,
      }),
    );
  }, {
    accessToken: session.token,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn || 7200,
    user: session.user || null,
  });
}
