# Quote Validation Baseline

- Merchant Playwright 默认入口统一走网关：`http://127.0.0.1:5175/merchant`
- Admin 网关入口：`http://127.0.0.1:5175/admin`
- 报价 bridge focused 入口：`npm run test:e2e:quote:bridge`
- 报价 close fixture 入口：`npm run test:e2e:quote:close:fixture`
- 汇总入口：`npm run test:e2e:quote:focused`
- API smoke：`./scripts/quote-workflow-v1-api-smoke.sh`

## Notes

- `quote-workflow-v1-api-smoke.sh` 已对 429 限流和缺失 `data` 字段做容错，close 尚未打通时会输出 `user_confirm_*` 摘要而不是直接崩溃。
- 如果只想确认 merchant `/merchant/` 基址未漂移，可先跑：
  - `npm run test:e2e:merchant:ci:list`
  - `npx playwright test tests/e2e/merchant-entry-register-foreman.test.ts tests/e2e/merchant-login-unregistered-redirect.test.ts`
