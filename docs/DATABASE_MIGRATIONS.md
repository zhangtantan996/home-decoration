# 数据库迁移规范

本文档用于统一当前仓库的数据库结构变更方式。

当前项目**没有统一 migration runner**，因此数据库变更采用：

- **受控手工执行**
- **SQL 文件规范化提交**
- **迁移 / 验证 / 回滚文档化**
- **正式 schema 与辅助脚本分层管理**

> 生产发布总入口：`deploy/README.md`

---

## 1. 目录职责

### 1.1 正式 schema 发布目录

唯一正式目录：

- `server/migrations/`

用途：

- 生产/预发/测试环境正式 schema 发布
- 与应用发布绑定执行的结构变更
- 本地重建认证/商家入驻等核心环境时的权威来源

### 1.2 历史/辅助脚本目录

保留目录：

- `server/scripts/migrations/`

用途：

- 非执行型历史说明（保留在 `server/scripts/migrations/`）
- 执行型 seed 脚本迁至 `server/scripts/seeds/`
- 执行型数据修复脚本迁至 `server/scripts/data-fixes/` 与 `server/scripts/history/`
- 执行型专题脚本迁至 `server/scripts/topics/`

**禁止将 `server/scripts/migrations/` 继续当作正式发版唯一依据。**

### 1.3 当前统一补洞入口

认证 / 短信审计 / 商家入驻历史环境补洞统一优先执行：

- `server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql`（高风险链路最新补洞）
- `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`（历史补洞）

### 1.4 Schema 真相源声明

> **重要**：Schema 真相源唯一指向：
>
> - `server/migrations/*.sql`（正式迁移文件）
> - `model.go` 仅为代码映射，不是 schema 真相源
> - `public.sql` / `local_backup.sql` 仅作历史快照参考，不得作为正式 schema 演进入口

---

## 2. 适用范围

适用于以下场景：

- 新增表
- 新增字段
- 新增索引
- 与生产发布绑定执行的 schema 变更
- 需要正式纳入版本发布的结构修复

不适用于：

- 仅本地临时试验 SQL
- 无需进入版本控制的一次性个人调试语句
- 仅用于数据回填/seed/专题导入的辅助脚本（执行文件已迁出 `server/scripts/migrations/`，避免与正式 migration 混淆）

---

## 3. 正式迁移提交要求

每次正式 schema 变更至少需要包含：

1. `server/migrations/` 下的正式 SQL
2. 对应代码变更
3. 执行说明
4. 验证说明

推荐附带：

5. 回滚方案（允许是文档化人工回滚，不强制同目录 down.sql）
6. 风险提示
7. 影响范围说明

> 本仓库历史文件命名并不完全统一；新变更优先沿用 `vX.Y.Z_description.sql` 或已存在的版本化风格，避免再引入第三套命名规则。

---

## 4. 生产执行原则

### 4.1 强制要求

- 迁移前必须先备份数据库
- 先在测试环境或低风险环境验证 SQL
- 发布流程中必须单独记录迁移步骤和验证结果
- 已纳入发布脚本 allowlist 的正式迁移，允许在发布脚本中自动补齐；但仍必须单独记录“执行了哪些迁移、验证了哪些列/索引”
- 生产环境**不允许依赖 `AutoMigrate`**

### 4.2 不允许的做法

- 不允许把 `server/scripts/migrations/` 当作新的正式 migration 目录继续扩张
- 不允许先发代码后补 schema
- 不允许执行未审查的临时 SQL 文件
- 不允许对带 `-- up / -- down` 的迁移直接执行整文件 `psql -f`
- 不允许把数据库回滚脚本无条件自动化执行

---

## 5. 推荐执行流程

### 5.1 发布前

1. 确认本次发布是否包含数据库结构变更
2. 确认正式 SQL 已进入 `server/migrations/`
3. 备份数据库
4. 在测试环境验证 SQL
5. 准备验证命令与回滚口径

### 5.2 生产执行

建议顺序：

1. 备份数据库
2. 执行 `server/migrations/` 下正式 SQL
   - 若迁移已纳入 `deploy/scripts/lib/release_common.sh` 的 allowlist，可随发布脚本自动执行
   - 若迁移未纳入 allowlist，仍需人工执行并记录
   - 对于带 `-- up / -- down` 的单文件迁移，只执行 `up` 段
   - 若仓库中出现高于 allowlist 最新版本的迁移文件，发布脚本会直接失败，避免静默漏跑
3. 执行验证 SQL / 健康检查 / 关键接口 smoke
4. 确认结果
5. 再执行应用发布脚本

### 5.3 本地重建库

1. 以 `server/migrations/` 作为权威 schema 来源
2. 如需补历史漏迁移环境，优先执行 `v1.6.9_reconcile_high_risk_schema_guard.sql`（高风险链路最新补洞）
3. `v1.6.4_reconcile_auth_and_onboarding_schema.sql` 为历史 auth/onboarding 补洞，非必要不单独执行
4. `public.sql` / `local_backup.sql` 仅可作历史快照参考，不得作为核心链路 schema source of truth

---

## 6. 如何判断旧脚本还能不能跑

看 `server/scripts/migrations/README.md` 与 `server/migrations/MANIFEST.md`：

- 若被标记为 **legacy/已被正式迁移吸收**：不要作为正式发布入口执行
- 若被标记为 **data-fix / seed / topic**：仅按对应专题 SOP 执行
- 若文档与目录说明冲突：以 `server/migrations/` 的 manifest 和发布 SOP 为准

---

## 7. 验证要求

每次正式迁移后至少验证：

- 表是否创建成功
- 字段是否存在
- 索引是否存在
- 默认值 / 约束是否符合预期
- 应用关键查询是否仍正常
- `/api/v1/health` 中相关 schema 检查是否恢复为 `ok`

---

## 8. Schema Guard 与本地检查

### 8.1 Schema Guard 机制

项目提供 Schema Guard 机制用于检测高风险链路 schema 漂移：

- **高风险表清单**：`server/internal/repository/schema_guard.go` 中的 `HighRiskTables` 定义
- **Canonical 修复路径**：指向 `v1.6.9_reconcile_high_risk_schema_guard.sql`
- **Smoke 测试**：覆盖关键写入路径的事务内最小写入验证

### 8.2 db:check 本地检查命令

本地开发/切分支后，可运行以下命令检查 schema 健康状态：

```bash
npm run db:check
```

命令输出三段：

1. migration/version 状态
2. 高风险表关键列检查结果
3. 高风险 smoke 测试结果

### 8.3 高风险链路改动前置检查

**任何高风险链路改动前，提交前必须运行 `npm run db:check` 验证 schema 状态。**

---

## 9. 回滚原则

- 代码回滚可脚本化
- 数据库回滚需人工确认
- 若 down 会导致数据丢失，优先选择：回滚代码 + 保留向前兼容 schema
