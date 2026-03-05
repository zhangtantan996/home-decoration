# 阿里云短信接入：环境模板与上线清单

本文档对齐当前后端实现（`server/internal/service/sms_verification.go`、`server/internal/service/sms_service.go`、`server/internal/service/sms_provider_aliyun.go`）。

## 1. 三套环境变量模板

以下模板建议写入不同环境的密钥系统或部署平台环境变量，不要直接提交真实值到仓库。

### 1.1 本地开发（不消耗短信）

目标：开发联调、接口测试，不发真实短信。

```bash
# app/runtime
APP_ENV=local
SERVER_MODE=debug

# sms provider
SMS_PROVIDER=mock
SMS_ACCESS_KEY_ID=
SMS_ACCESS_KEY_SECRET=
SMS_SIGN_NAME=
SMS_TEMPLATE_CODE=
SMS_REGION_ID=cn-hangzhou

# debug bypass（仅 local 生效）
SMS_DEBUG_BYPASS=true

# 风控
SMS_RISK_ENABLED=true
SMS_CODE_MAX_ATTEMPTS=5
SMS_PHONE_DAILY_LIMIT=10
SMS_IP_DAILY_LIMIT=20

# captcha（本地可先关）
SMS_CAPTCHA_ENABLED=false
SMS_CAPTCHA_PROVIDER=turnstile
SMS_CAPTCHA_VERIFY_URL=
SMS_CAPTCHA_SECRET_KEY=
SMS_CAPTCHA_TIMEOUT_MS=3000
SMS_CAPTCHA_MIN_SCORE=0.0
```

说明：
- `SMS_DEBUG_BYPASS` 只有在 `APP_ENV=local` 时才会允许固定码（当前实现固定码为 `123456`）。
- 本地前端调用 `POST /api/v1/auth/send-code` 时仍需带 `purpose`。

### 1.2 预发/UAT（建议小流量真实短信）

目标：上线前端到端验证，覆盖真实运营商链路。

```bash
# app/runtime
APP_ENV=staging
SERVER_MODE=release

# sms provider
SMS_PROVIDER=aliyun
SMS_ACCESS_KEY_ID=<staging_access_key_id>
SMS_ACCESS_KEY_SECRET=<staging_access_key_secret>
SMS_SIGN_NAME=<已审核签名>
SMS_TEMPLATE_CODE=<已审核模板>
SMS_REGION_ID=cn-hangzhou

# debug bypass
SMS_DEBUG_BYPASS=false

# 风控（预发建议更紧）
SMS_RISK_ENABLED=true
SMS_CODE_MAX_ATTEMPTS=5
SMS_PHONE_DAILY_LIMIT=5
SMS_IP_DAILY_LIMIT=10

# captcha（预发建议开启）
SMS_CAPTCHA_ENABLED=true
SMS_CAPTCHA_PROVIDER=turnstile
SMS_CAPTCHA_VERIFY_URL=
SMS_CAPTCHA_SECRET_KEY=<captcha_secret>
SMS_CAPTCHA_TIMEOUT_MS=3000
SMS_CAPTCHA_MIN_SCORE=0.0
```

说明：
- `SERVER_MODE=release` 且 `APP_ENV` 非 `local/docker/dev/development/test` 时，系统视为严格生产模式，禁止 `mock` provider。
- 因此预发如果想验证真实发送，必须使用 `aliyun`。

### 1.3 生产环境（正式放量）

目标：正式短信发送。

```bash
# app/runtime
APP_ENV=production
SERVER_MODE=release

# sms provider
SMS_PROVIDER=aliyun
SMS_ACCESS_KEY_ID=<prod_access_key_id>
SMS_ACCESS_KEY_SECRET=<prod_access_key_secret>
SMS_SIGN_NAME=<已审核签名>
SMS_TEMPLATE_CODE=<已审核模板>
SMS_REGION_ID=cn-hangzhou

# debug bypass
SMS_DEBUG_BYPASS=false

# 风控（根据业务量逐步调优）
SMS_RISK_ENABLED=true
SMS_CODE_MAX_ATTEMPTS=5
SMS_PHONE_DAILY_LIMIT=8
SMS_IP_DAILY_LIMIT=20

# captcha（生产强烈建议开启）
SMS_CAPTCHA_ENABLED=true
SMS_CAPTCHA_PROVIDER=turnstile
SMS_CAPTCHA_VERIFY_URL=
SMS_CAPTCHA_SECRET_KEY=<captcha_secret>
SMS_CAPTCHA_TIMEOUT_MS=3000
SMS_CAPTCHA_MIN_SCORE=0.0
```

## 2. 上线当天检查清单

### 2.1 阿里云控制台准备

- [ ] 短信服务已开通
- [ ] 短信签名已审核通过
- [ ] 验证码模板已审核通过，模板变量与系统发送参数一致（当前发送 `{"code":"xxxxxx"}`）
- [ ] 已创建 RAM 子账号 AccessKey（最小权限，不使用主账号）
- [ ] 已配置金额/调用量预警

### 2.2 应用配置与数据库

- [ ] 部署环境已注入 `SMS_PROVIDER=aliyun` 及全部密钥
- [ ] `SMS_DEBUG_BYPASS=false`
- [ ] 已执行短信审计日志迁移：`server/scripts/migrations/v1.4.5_create_sms_audit_logs.sql`
- [ ] Redis 连通（验证码依赖 Redis 存储与风控计数）

### 2.3 接口 smoke 测试

发送验证码（示例）：

```bash
curl -X POST http://<api-host>/api/v1/auth/send-code \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","purpose":"login","captchaToken":"<token>"}'
```

要点：
- [ ] 返回 `code=0`
- [ ] `data.requestId` 有值
- [ ] 在 `sms_audit_logs` 中可查到对应 `request_id` 且状态为 `sent`

### 2.4 验证码登录验证

- [ ] 使用真实验证码完成一次登录
- [ ] 连续错误验证码会触发失败计数与锁定
- [ ] 超过发送频率会返回限流错误（冷却/日限额/风控）

### 2.5 监控与回滚

- [ ] 监控短信失败率（按 `error_code` 聚合）
- [ ] 监控验证码请求量突增（按 IP、手机号、purpose）
- [ ] 已准备紧急开关：可临时调低日限额，必要时先提升 captcha 严格度

## 3. 上线前如何更节省短信次数

### 3.1 开发阶段不发真实短信

- 本地固定 `SMS_PROVIDER=mock`
- 仅在 `APP_ENV=local` 下使用 `SMS_DEBUG_BYPASS=true` 联调
- 自动化测试优先走 mock + bypass，不占阿里云条数

### 3.2 预发阶段小流量验证

- 只对白名单手机号开放真实发送
- 预发先用低日限额（如手机号 5 次/IP 10 次）
- 前端发送按钮强制 60 秒倒计时，防止重复点击

### 3.3 生产防刷与成本控制

- 开启 `SMS_CAPTCHA_ENABLED=true`，先人机校验再发短信
- 保持 `SMS_RISK_ENABLED=true`
- 监控 `sms_audit_logs` 中 `risk_blocked`、`captcha_failed`、`send_failed` 趋势
- 模板文案控制长度，避免长短信拆分多条计费
- 不做“无限重试”，超时后先查回执/日志再补发

## 4. 与当前代码的关键对应

- 发送/校验主流程：`server/internal/service/sms_verification.go`
- 阿里云 provider：`server/internal/service/sms_provider_aliyun.go`
- 限流与风险控制：`server/internal/service/sms_service.go`
- 发送入口（需要 `purpose`）：`server/internal/handler/handler.go`
- 审计模型：`server/internal/model/model.go` 中 `SMSAuditLog`

