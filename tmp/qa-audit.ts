import { chromium, Browser, Page } from 'playwright';

interface QAResult {
  page: string;
  viewport: string;
  passed: boolean;
  observations: string[];
  consoleErrors: string[];
  consoleWarnings: string[];
}

const results: QAResult[] = [];

function captureConsole(page: Page) {
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });

  return { errors, warnings };
}

async function testHomepage(browser: Browser, viewport: { width: number; height: number }, viewportName: string) {
  const page = await browser.newPage({ viewport });
  const { errors, warnings } = captureConsole(page);
  const observations: string[] = [];

  try {
    await page.goto('http://localhost:5173/merchant/', { waitUntil: 'networkidle' });
    
    // Check role cards
    const roleCards = await page.locator('[class*="Card"]').count();
    observations.push(`Found ${roleCards} role cards`);

    // Check if modal opens on card click
    const firstCard = page.locator('[class*="Card"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForTimeout(500);
      
      const modal = page.locator('.ant-modal');
      const modalVisible = await modal.isVisible();
      observations.push(`Modal opens on card click: ${modalVisible}`);

      if (modalVisible) {
        // Check if role is preselected
        const selectedRole = await page.locator('.ant-radio-wrapper-checked').count();
        observations.push(`Role preselected in modal: ${selectedRole > 0}`);
        
        // Close modal
        await page.locator('.ant-modal-close').click();
      }
    }

    await page.screenshot({ path: `tmp/merchant-home-${viewportName}.png` });

    results.push({
      page: 'Homepage',
      viewport: viewportName,
      passed: true,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } catch (error) {
    observations.push(`Error: ${error}`);
    results.push({
      page: 'Homepage',
      viewport: viewportName,
      passed: false,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } finally {
    await page.close();
  }
}

async function testLogin(browser: Browser, viewport: { width: number; height: number }, viewportName: string) {
  const page = await browser.newPage({ viewport });
  const { errors, warnings } = captureConsole(page);
  const observations: string[] = [];

  try {
    await page.goto('http://localhost:5173/merchant/login', { waitUntil: 'networkidle' });
    
    // Check phone input
    const phoneInput = page.locator('input[placeholder*="手机号"]');
    await phoneInput.fill('13800138000');
    observations.push('Phone input works');

    // Check send code button
    const sendCodeBtn = page.locator('button:has-text("发送验证码")');
    const btnVisible = await sendCodeBtn.isVisible();
    observations.push(`Send code button visible: ${btnVisible}`);

    if (btnVisible) {
      await sendCodeBtn.click();
      await page.waitForTimeout(1000);

      // Check countdown
      const btnText = await sendCodeBtn.textContent();
      const hasCountdown = btnText?.includes('s') || btnText?.includes('秒');
      observations.push(`Countdown active: ${hasCountdown}`);

      // Check for debug code leak in toast
      const toastMessages = await page.locator('.ant-message-notice-content').allTextContents();
      const hasCodeLeak = toastMessages.some(msg => /\d{4,6}/.test(msg) && (msg.includes('验证码') || msg.includes('code')));
      observations.push(`Debug code leak in toast: ${hasCodeLeak}`);
    }

    await page.screenshot({ path: `tmp/merchant-login-${viewportName}.png` });

    results.push({
      page: 'Login',
      viewport: viewportName,
      passed: true,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } catch (error) {
    observations.push(`Error: ${error}`);
    results.push({
      page: 'Login',
      viewport: viewportName,
      passed: false,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } finally {
    await page.close();
  }
}

async function testRegister(browser: Browser, viewport: { width: number; height: number }, viewportName: string) {
  const page = await browser.newPage({ viewport });
  const { errors, warnings } = captureConsole(page);
  const observations: string[] = [];

  try {
    await page.goto('http://localhost:5173/merchant/register?role=designer&entityType=personal', { waitUntil: 'networkidle' });
    
    // Check steps component
    const steps = page.locator('.ant-steps');
    const stepsVisible = await steps.isVisible();
    observations.push(`Steps component visible: ${stepsVisible}`);

    if (stepsVisible) {
      const stepsDirection = await steps.getAttribute('class');
      const isVertical = stepsDirection?.includes('vertical');
      observations.push(`Steps direction (vertical on mobile): ${isVertical} for ${viewportName}`);
    }

    // Check form responsiveness
    const formWidth = await page.locator('form').boundingBox();
    observations.push(`Form width: ${formWidth?.width}px (viewport: ${viewport.width}px)`);

    await page.screenshot({ path: `tmp/merchant-register-${viewportName}.png` });

    results.push({
      page: 'Register',
      viewport: viewportName,
      passed: true,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } catch (error) {
    observations.push(`Error: ${error}`);
    results.push({
      page: 'Register',
      viewport: viewportName,
      passed: false,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } finally {
    await page.close();
  }
}

async function testMaterialShopRegister(browser: Browser, viewport: { width: number; height: number }, viewportName: string) {
  const page = await browser.newPage({ viewport });
  const { errors, warnings } = captureConsole(page);
  const observations: string[] = [];

  try {
    await page.goto('http://localhost:5173/merchant/material-shop/register', { waitUntil: 'networkidle' });
    
    // Check form elements
    const productCards = await page.locator('[class*="Card"]').count();
    observations.push(`Product cards found: ${productCards}`);

    // Check for key-value params input (not JSON textarea)
    const jsonTextarea = await page.locator('textarea[placeholder*="JSON"]').count();
    observations.push(`JSON textarea (should be 0): ${jsonTextarea}`);

    const paramInputs = await page.locator('input[placeholder*="参数"]').count();
    observations.push(`Key-value param inputs: ${paramInputs}`);

    await page.screenshot({ path: `tmp/merchant-material-shop-${viewportName}.png` });

    results.push({
      page: 'MaterialShopRegister',
      viewport: viewportName,
      passed: true,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } catch (error) {
    observations.push(`Error: ${error}`);
    results.push({
      page: 'MaterialShopRegister',
      viewport: viewportName,
      passed: false,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } finally {
    await page.close();
  }
}

async function testApplyStatus(browser: Browser, viewport: { width: number; height: number }, viewportName: string) {
  const page = await browser.newPage({ viewport });
  const { errors, warnings } = captureConsole(page);
  const observations: string[] = [];

  try {
    await page.goto('http://localhost:5173/merchant/apply-status', { waitUntil: 'networkidle' });
    
    // Check query form
    const phoneInput = page.locator('input[placeholder*="手机号"]');
    const queryBtn = page.locator('button:has-text("查询")');
    
    const inputVisible = await phoneInput.isVisible();
    const btnVisible = await queryBtn.isVisible();
    observations.push(`Query form visible: input=${inputVisible}, button=${btnVisible}`);

    // Check card responsiveness
    const card = page.locator('.ant-card').first();
    const cardWidth = await card.boundingBox();
    observations.push(`Card width: ${cardWidth?.width}px (viewport: ${viewport.width}px)`);

    await page.screenshot({ path: `tmp/merchant-apply-status-${viewportName}.png` });

    results.push({
      page: 'ApplyStatus',
      viewport: viewportName,
      passed: true,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } catch (error) {
    observations.push(`Error: ${error}`);
    results.push({
      page: 'ApplyStatus',
      viewport: viewportName,
      passed: false,
      observations,
      consoleErrors: errors,
      consoleWarnings: warnings
    });
  } finally {
    await page.close();
  }
}

async function runQA() {
  const browser = await chromium.launch({ headless: true });

  console.log('Starting QA audit...\n');

  // Desktop tests
  console.log('Testing desktop viewport (1920x1080)...');
  await testHomepage(browser, { width: 1920, height: 1080 }, 'desktop');
  await testLogin(browser, { width: 1920, height: 1080 }, 'desktop');
  await testRegister(browser, { width: 1920, height: 1080 }, 'desktop');
  await testMaterialShopRegister(browser, { width: 1920, height: 1080 }, 'desktop');
  await testApplyStatus(browser, { width: 1920, height: 1080 }, 'desktop');

  // Mobile tests
  console.log('Testing mobile viewport (375x667)...');
  await testHomepage(browser, { width: 375, height: 667 }, 'mobile');
  await testLogin(browser, { width: 375, height: 667 }, 'mobile');
  await testRegister(browser, { width: 375, height: 667 }, 'mobile');
  await testMaterialShopRegister(browser, { width: 375, height: 667 }, 'mobile');
  await testApplyStatus(browser, { width: 375, height: 667 }, 'mobile');

  await browser.close();

  // Generate report
  console.log('\n=== QA AUDIT REPORT ===\n');
  
  console.log('| Page | Viewport | Status | Key Observations |');
  console.log('|------|----------|--------|------------------|');
  
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const keyObs = result.observations.slice(0, 2).join('; ');
    console.log(`| ${result.page} | ${result.viewport} | ${status} | ${keyObs} |`);
  }

  console.log('\n=== CONSOLE ERRORS/WARNINGS ===\n');
  
  for (const result of results) {
    if (result.consoleErrors.length > 0 || result.consoleWarnings.length > 0) {
      console.log(`\n${result.page} (${result.viewport}):`);
      if (result.consoleErrors.length > 0) {
        console.log('  Errors:');
        result.consoleErrors.forEach(err => { console.log(`    - ${err}`); });
      }
      if (result.consoleWarnings.length > 0) {
        console.log('  Warnings:');
        result.consoleWarnings.forEach(warn => { console.log(`    - ${warn}`); });
      }
    }
  }

  console.log('\n=== DETAILED OBSERVATIONS ===\n');
  
  for (const result of results) {
    console.log(`\n${result.page} (${result.viewport}):`);
    result.observations.forEach(obs => { console.log(`  - ${obs}`); });
  }

  console.log('\nScreenshots saved to tmp/ directory');
}

runQA().catch(console.error);
