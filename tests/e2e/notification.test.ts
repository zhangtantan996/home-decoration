import { test, expect, Page } from '@playwright/test';

// 测试数据
const USER_PHONE = '18888888888';
const PROVIDER_PHONE = '13900139001';
const TEST_CODE = '123456';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// 登录辅助函数 (移动端/移动 Web)
async function loginMobile(page: Page, phone: string) {
    await page.goto('/', { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // 填写手机号
    await page.getByPlaceholder('请输入手机号').fill(phone);

    // 获取验证码
    const codeBtn = page.getByText('获取验证码');
    if (await codeBtn.isVisible()) {
        await codeBtn.click();
    }

    // 填写验证码
    await page.getByPlaceholder('请输入验证码').fill(TEST_CODE);

    // 勾选协议 (圆圈 checkbox)
    // 根据 LoginScreen.tsx, 包含 "我已阅读并同意" 的文本
    await page.getByText('我已阅读并同意').click();

    // 点击进入平台
    await page.getByText('进入平台 →').click();

    // 等待进入首页 (检查 URL 或关键元素)
    await page.waitForURL('**/home', { timeout: 30000 });
}

// 登录辅助函数 (管理后台)
async function loginAdmin(page: Page) {
    await page.goto('http://localhost:5173/user/login', { timeout: 60000 });
    await page.getByPlaceholder('用户名').fill(ADMIN_USER);
    await page.getByPlaceholder('密码').fill(ADMIN_PASS);
    await page.getByRole('button', { name: '登 录' }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
}

test.describe('Notification System E2E', () => {

    test.beforeEach(async ({ page }) => {
        // 设置较长的默认超时
        test.setTimeout(120000);
    });

    // 场景 1: 用户预约并支付意向金 -> 检查管理员和商家通知
    test('Scenario 1: Booking & Intent Payment', async ({ browser }) => {
        const userContext = await browser.newContext();
        const userPage = await userContext.newPage();
        await loginMobile(userPage, USER_PHONE);

        // 点击设计师
        await userPage.getByText('找设计师').click();
        await userPage.getByText('金牌设计师').first().click();

        // 立即预约
        await userPage.getByText('立即预约').click();
        await userPage.getByPlaceholder('请简单描述您的需求').fill('E2E Test Request');
        await userPage.getByText('确认预约').click();

        // 预约成功
        await expect(userPage.getByText('预约成功')).toBeVisible();
        await userPage.getByText('查看详情').click();

        // 支付意向金
        await userPage.getByText('支付意向金').click();
        await userPage.getByText('确认支付').click();

        // 检查商家端通知
        const providerContext = await browser.newContext();
        const providerPage = await providerContext.newPage();
        await loginMobile(providerPage, PROVIDER_PHONE);

        await providerPage.getByText('我的').click();
        await providerPage.locator('.lucide-bell').click();
        await expect(providerPage.getByText('新预约通知')).toBeVisible();

        // 检查管理后台通知
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAdmin(adminPage);

        const bellIcon = adminPage.locator('.ant-badge');
        await bellIcon.click();
        await expect(adminPage.getByText('新支付通知')).toBeVisible();

        await adminContext.close();
        await providerContext.close();
        await userContext.close();
    });

    // 场景 2: 更多场景暂略，先调通场景 1
});
