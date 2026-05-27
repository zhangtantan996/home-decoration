import { chromium } from "playwright";

const baseUrl =
  process.env.SUPERVISOR_BASE_URL || "http://127.0.0.1:4178/apply";

const expectTextList = (actual, expected, label) => {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) {
    throw new Error(
      `${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
};

const expectIncludes = (values, expected, label) => {
  const missing = expected.filter((value) => !values.includes(value));
  if (missing.length > 0) {
    throw new Error(
      `${label} missing: ${JSON.stringify(missing)} in ${JSON.stringify(values)}`,
    );
  }
};

const ensureDropdown = async (page, areaSelect) => {
  const visibleDropdown = page.locator(".ant-select-dropdown").last();
  if (!(await visibleDropdown.isVisible().catch(() => false))) {
    await areaSelect.click();
    await page.waitForTimeout(200);
  }
  return page.locator(".ant-select-dropdown").last();
};

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1200 },
  });

  await page.route("**/api/v1/supervisor/onboarding/status**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 0, data: { status: "required" } }),
    });
  });

  await page.route(
    "**/api/v1/supervisor/onboarding/check-eligibility**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ code: 0, data: { status: "eligible" } }),
      });
    },
  );

  await page.route("**/api/v1/regions/service-cities", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: [{ code: "610100", name: "西安市" }],
      }),
    });
  });

  await page.route(
    "**/api/v1/regions/cities/610100/districts",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: [
            { code: "610100", name: "西安市" },
            { code: "610102", name: "新城区" },
            { code: "610103", name: "碑林区" },
            { code: "610104", name: "莲湖区" },
            { code: "610111", name: "灞桥区" },
          ],
        }),
      });
    },
  );

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByPlaceholder("请输入手机号").fill("13800000000");
  await page.getByRole("button", { name: "验证资格" }).click();
  await page.waitForSelector("text=填写入驻资料");

  const citySelect = page.locator(".ant-select").nth(0);
  const areaSelect = page.locator(".ant-select").nth(1);

  await areaSelect.click();
  await page.waitForTimeout(200);

  const hintBeforeCity = await page
    .locator(".ant-form-item-explain-error")
    .allInnerTexts();
  if (!hintBeforeCity.includes("请先选择服务城市")) {
    throw new Error(`missing service city hint: ${JSON.stringify(hintBeforeCity)}`);
  }

  const serviceAreaClass = await areaSelect.getAttribute("class");
  if (!serviceAreaClass?.includes("ant-select-status-error")) {
    throw new Error(`service area should be error state, got: ${serviceAreaClass}`);
  }

  await citySelect.click();
  await page
    .locator(".ant-select-dropdown")
    .last()
    .getByText("西安市", { exact: true })
    .click({ force: true });
  await page.waitForTimeout(300);

  let dropdown = await ensureDropdown(page, areaSelect);
  const hintAfterCity = await page
    .locator(".ant-form-item-explain-error")
    .allInnerTexts()
    .catch(() => []);
  expectTextList(hintAfterCity, [], "hintAfterCity");

  const optionsAfterCity = await dropdown
    .locator(".ant-select-item-option-content")
    .allInnerTexts();
  expectIncludes(
    optionsAfterCity,
    ["西安市全市", "新城区", "碑林区", "莲湖区"],
    "service area options",
  );

  await dropdown.getByText("新城区", { exact: true }).click({ force: true });
  await page.waitForTimeout(200);
  const tagsAfterDistrict = await areaSelect
    .locator(".ant-select-selection-item")
    .allInnerTexts();
  expectTextList(tagsAfterDistrict, ["新城区"], "tagsAfterDistrict");

  dropdown = await ensureDropdown(page, areaSelect);
  await dropdown
    .getByText("西安市全市", { exact: true })
    .click({ force: true });
  await page.waitForTimeout(200);
  const tagsAfterCityWide = await areaSelect
    .locator(".ant-select-selection-item")
    .allInnerTexts();
  expectTextList(tagsAfterCityWide, ["西安市全市"], "tagsAfterCityWide");

  dropdown = await ensureDropdown(page, areaSelect);
  await dropdown.getByText("碑林区", { exact: true }).click({ force: true });
  await page.waitForTimeout(200);
  const tagsAfterDistrictAgain = await areaSelect
    .locator(".ant-select-selection-item")
    .allInnerTexts();
  expectTextList(tagsAfterDistrictAgain, ["碑林区"], "tagsAfterDistrictAgain");

  console.log(
    JSON.stringify(
      {
        baseUrl,
        hintBeforeCity,
        optionsAfterCity,
        tagsAfterDistrict,
        tagsAfterCityWide,
        tagsAfterDistrictAgain,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
