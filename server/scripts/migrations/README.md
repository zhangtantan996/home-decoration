# server/scripts/migrations 目录说明

本目录**保留但降级**，不再作为正式 schema 发布唯一依据。

## 目录职责

本目录仅用于以下场景：

- 历史版本化 schema 脚本存档（legacy）
- 数据修复 / 数据回填脚本（已迁至 `server/scripts/data-fixes/` 或 `server/scripts/history/`）
- seed / 本地辅助脚本（已迁至 `server/scripts/seeds/`）
- 专题脚本（例如 IM，已迁至 `server/scripts/topics/`）

## 当前规则

- 正式发布目录：`server/migrations/`
- 历史环境统一补洞：优先执行 `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`
- 遇到本目录中的 `v1.x.x` 历史脚本时，不要默认把它当成当前正式 migration

## 如何判断脚本类型

- **legacy**：历史版本化脚本，仅供追溯，当前正式发布应改用 `server/migrations/`
- **data-fix**：数据修复 / 回填脚本，只在对应 SOP 或故障处置中执行
- **seed**：初始化/演示/地区数据脚本，只在本地或指定专题流程中执行
- **topic**：专题脚本（如 IM），按专题文档执行，不纳入主业务 schema 发布序列

## 高风险历史脚本

以下脚本最容易被误当成当前正式 migration，请优先看文件头注释：

- `v1.4.4_add_user_last_login_fields.sql`
- `v1.4.5_create_sms_audit_logs.sql`
- `v1.5.0_unified_merchant_onboarding.sql`
- `v1.5.1_add_onboarding_avatar_fields.sql`
- `v1.5.2_add_onboarding_legal_acceptance.sql`
- `v1.5.3_reconcile_unified_onboarding_schema.sql`
- `v1.6.1_add_material_shop_legal_fields.sql`


## 重复版本化 SQL 归档

- 重复/重叠的历史版本化 SQL 清单见 `server/scripts/migrations/已归档重复SQL映射.md`
- 若某脚本在 `server/migrations/` 中已有正式对应文件，则本目录版本仅作历史追溯
