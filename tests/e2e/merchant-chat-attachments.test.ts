import { test, expect } from '@playwright/test';

import fs from 'node:fs/promises';
import path from 'node:path';

// NOTE: Merchant portal runs on the admin Vite dev server (5173) under /merchant/*.
// It uses SMS-code login (test code is hardcoded as 123456).

test.describe('Merchant Chat Attachments', () => {
  test('merchant can login and send file + image', async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);

    // Ensure output dir exists for runtime-generated fixtures.
    await fs.mkdir(testInfo.outputDir, { recursive: true });

    const origin = process.env.MERCHANT_ORIGIN || 'http://localhost:5173';
    const phone = process.env.MERCHANT_PHONE || '13800000001';
    const code = process.env.MERCHANT_CODE || '123456';

    await page.goto(`${origin}/merchant/login`, { waitUntil: 'domcontentloaded' });

    await page.getByPlaceholder('请输入11位手机号').fill(phone);
    await page.getByPlaceholder('请输入6位验证码').fill(code);

    await Promise.all([
      page.waitForURL('**/merchant/dashboard', { timeout: 30_000 }),
      page.getByRole('button', { name: /登\s*录/ }).click(),
    ]);

    // Go directly to the chat page.
    await page.goto(`${origin}/merchant/chat`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('会话列表')).toBeVisible({ timeout: 30_000 });

    // If there are no seeded conversations, skip this test instead of failing.
    if (await page.getByText('暂无会话').isVisible()) {
      test.skip(true, 'No conversations seeded for this merchant. Seed chat data then re-run.');
    }

    // Select the first conversation.
    const firstConversation = page.locator('.conversation-item').first();
    await expect(firstConversation).toBeVisible({ timeout: 30_000 });
    await firstConversation.click();

    // Wait for input area to appear (only renders when a conversation is active).
    await expect(page.getByPlaceholder('输入消息...')).toBeVisible({ timeout: 30_000 });

    // -------- File attachment --------
    const fileName = 'attachment.txt';
    const filePath = path.join(testInfo.outputDir, fileName);
    await fs.writeFile(filePath, `hello from playwright ${Date.now()}\n`, 'utf8');

    const fileUploadRoot = page.locator('span.ant-upload').filter({
      has: page.getByRole('button', { name: '文件' }),
    });
    const fileInput = fileUploadRoot.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
    await fileInput.setInputFiles(filePath);

    await expect(page.getByText('文件已发送')).toBeVisible({ timeout: 60_000 });
    const fileCard = page
      .getByRole('button', { name: new RegExp(fileName.replace('.', '\\.'), 'i') })
      .first();
    await expect(fileCard).toBeVisible({ timeout: 60_000 });

    // Attempt to open the attachment (it uses window.open).
    const attachmentCard = fileCard;
    const popupPromise = page.waitForEvent('popup', { timeout: 10_000 }).catch(() => null);
    await attachmentCard.click();
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState('domcontentloaded', { timeout: 30_000 });
      await popup.close();
    }

    // -------- Image attachment --------
    const pngBase64 =
      // 1x1 transparent PNG
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qkqQAAAAASUVORK5CYII=';
    const imgPath = path.join(testInfo.outputDir, 'tiny.png');
    await fs.writeFile(imgPath, Buffer.from(pngBase64, 'base64'));

    const imageUploadRoot = page.locator('span.ant-upload').filter({
      has: page.getByRole('button', { name: '图片' }),
    });
    const imageInput = imageUploadRoot.locator('input[type="file"]');
    await expect(imageInput).toHaveCount(1);
    await imageInput.setInputFiles(imgPath);

    await expect(page.getByText('图片已发送')).toBeVisible({ timeout: 60_000 });
  });
});
