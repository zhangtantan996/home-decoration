import { execFileSync } from 'node:child_process';
import { type APIRequestContext, type Page } from '@playwright/test';

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

function withAppBase(path: string) {
  if (path.startsWith('/app/')) return path;
  if (path === '/') return '/app/';
  return `/app${path.startsWith('/') ? path : `/${path}`}`;
}

export async function loginThroughRealUi(page: Page, redirectPath: string) {
  const normalizedRedirect = redirectPath.startsWith('/app/') ? redirectPath.replace(/^\/app/, '') : redirectPath;
  await page.goto(`${withAppBase('/login')}?redirect=${encodeURIComponent(normalizedRedirect)}`, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('手机号').fill(userWebRealFixture.phone);
  await page.getByRole('button', { name: '获取验证码' }).click();
  const note = page.locator('[role="alert"]').first();
  await note.waitFor({ state: 'visible', timeout: 10000 });
  const noteText = await note.textContent();
  const code = noteText?.match(/(\d{6})/)?.[1] || process.env.USER_WEB_REAL_SMS_CODE || '123456';

  await page.getByLabel('短信验证码').fill(code);
  const agreement = page.getByRole('checkbox');
  if (await agreement.isVisible().catch(() => false)) {
    await agreement.check();
  }
  await page.getByRole('button', { name: '登录' }).click();
}

export { withAppBase };

export async function seedRealSession(page: Page, request: APIRequestContext) {
  const apiBase = process.env.USER_WEB_REAL_API_BASE || 'http://127.0.0.1:8080/api/v1';
  let session: {
    token: string;
    refreshToken: string;
    expiresIn?: number;
    user?: unknown;
  } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
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
    session = loginPayload?.data || null;

    if (session?.token && session?.refreshToken) {
      break;
    }

    try {
      execFileSync(process.execPath, ['./scripts/user-web-clear-rate-limit.mjs'], {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    } catch {
      // ignore cleanup failures in helper retry
    }
  }

  if (!session?.token || !session?.refreshToken) {
    throw new Error('real api login failed after retries');
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
