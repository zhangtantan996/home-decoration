# Archived Duplicate SQL Map

以下脚本与 `server/migrations/` 中正式版本化 SQL 重复或语义重叠。

原则：
- `server/migrations/` 是唯一正式发版入口
- 本文件中的脚本仅保留历史追溯/参考用途
- 遇到历史环境缺口时，优先执行 `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`

## 与正式目录重复的历史脚本

- `add_user_login_lock_fields.sql` -> `server/migrations/add_user_login_lock_fields.sql`
- `v1.1.0_add_provider_fields.sql` -> `server/migrations/v1.1.0_add_provider_fields.sql`
- `v1.1.1_add_provider_subtype.sql` -> `server/migrations/v1.1.1_add_provider_subtype.sql`
- `v1.2.0_add_project_phases.sql` -> `server/migrations/v1.2.0_add_project_phases.sql`
- `v1.4.3_add_merchant_application_work_types.sql` -> `server/migrations/v1.4.3_add_merchant_application_work_types.sql`
- `v1.5.0_unified_merchant_onboarding.sql` -> `server/migrations/v1.5.0_unified_merchant_onboarding.sql`
- `v1.5.3_reconcile_unified_onboarding_schema.sql` -> `server/migrations/v1.5.3_reconcile_unified_onboarding_schema.sql`

## 已被 v1.6.4 吸收的高风险历史脚本

- `v1.4.4_add_user_last_login_fields.sql`
- `v1.4.5_create_sms_audit_logs.sql`
- `v1.5.1_add_onboarding_avatar_fields.sql`
- `v1.5.2_add_onboarding_legal_acceptance.sql`
- `v1.6.1_add_material_shop_legal_fields.sql`
