# Migration Manifest

## 正式发布该跑什么

正式 schema 发布只认：

- `server/migrations/`

认证 / 短信审计 / 商家入驻历史环境补洞统一优先执行：

- `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`

## 本地重建库该跑什么

- 以 `server/migrations/` 作为权威 schema 来源
- 不要把 `public.sql` / `local_backup.sql` 当成核心链路 schema source of truth
- 遇到历史环境残缺时，优先执行 `v1.6.4`

## 遇到历史脚本怎么判断

看 `server/scripts/migrations/README.md`、`server/scripts/migrations/ARCHIVED_DUPLICATES.md` 与新目录说明：

- 标记为 **legacy / 已被正式迁移吸收**：不要作为正式发版入口
- 标记为 **data-fix / seed / topic**：只在对应专题或运维流程执行

## 已被统一补洞迁移吸收的历史问题

`v1.6.4_reconcile_auth_and_onboarding_schema.sql` 已统一覆盖以下历史问题：

- `users.public_id`
- `users.last_login_at`
- `users.last_login_ip`
- `sms_audit_logs`
- `merchant_applications` 入驻扩展字段
- `providers` 入驻扩展字段 + `source_application_id`
- `material_shops` 扩展字段 + `source_application_id`
- `material_shop_applications`
- `material_shop_application_products`
- `material_shop_products`
- `merchant_identity_change_applications`

## 仍然保留在 `server/scripts/migrations/` 的有效脚本类别

- 数据修复 / 回填
- seed / 区域初始化
- IM 专题脚本
- 历史阶段脚本与回滚记录
