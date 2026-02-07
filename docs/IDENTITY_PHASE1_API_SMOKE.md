# 多身份 Phase 1 API 联调脚本（Smoke）

> 以下示例均为本地联调，请按实际环境替换地址和 token。不要提交真实密钥或生产账号信息。

## 1. 环境变量

```bash
export BASE_URL="http://localhost:8080/api/v1"
export USER_TOKEN="<user_access_token>"
export ADMIN_TOKEN="<admin_access_token>"
```

## 2. 提交身份申请（provider）

```bash
curl -X POST "$BASE_URL/identities/apply" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "identityType": "provider",
    "providerSubType": "foreman",
    "applicationData": "{\"documents\":[\"demo://cert-1\"]}"
  }'
```

## 3. 管理端查询申请列表

```bash
curl "$BASE_URL/admin/identity-applications?page=1&pageSize=20&status=0" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 4. 管理端查看申请详情

```bash
export APP_ID="<identity_application_id>"

curl "$BASE_URL/admin/identity-applications/$APP_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 5. 管理端审核通过

```bash
curl -X POST "$BASE_URL/admin/identity-applications/$APP_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 6. 管理端审核拒绝

```bash
curl -X POST "$BASE_URL/admin/identity-applications/$APP_ID/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"资质材料不完整"}'
```

## 7. 用户查询身份列表与当前身份

```bash
curl "$BASE_URL/identities" \
  -H "Authorization: Bearer $USER_TOKEN"

curl "$BASE_URL/identities/current" \
  -H "Authorization: Bearer $USER_TOKEN"
```

## 8. 身份切换（identityId 主入参）

```bash
export IDENTITY_ID="<approved_identity_id>"

curl -X POST "$BASE_URL/identities/switch" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"identityId\": $IDENTITY_ID}"
```

## 9. 刷新 token（验证身份不回退）

```bash
export REFRESH_TOKEN="<refresh_token_after_switch>"

curl -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

## 10. 关键断言
- 登录/refresh/switch 返回中必须包含 `activeRole`。
- 当 `activeRole=provider` 时，必须返回 `providerSubType` 与 `providerId`。
- `providerSubType` 只允许 `designer/company/foreman`。
- 禁止新增 `worker` 申请。
