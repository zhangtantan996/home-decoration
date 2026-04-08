# 数据库迁移文件

本目录包含所有数据库迁移SQL文件。

## 命名规范

迁移文件应遵循以下命名规范：
```
vX.Y.Z_description.sql
```

其中：
- `X.Y.Z` 是版本号（主版本.次版本.修订版本）
- `description` 是简短的英文描述

## 现有迁移

| 版本 | 文件名 | 说明 |
|------|--------|------|
| - | add_user_login_lock_fields.sql | 添加用户登录锁定字段 |
| v1.1.0 | v1.1.0_add_provider_fields.sql | 添加服务商字段 |
| v1.1.1 | v1.1.1_add_provider_subtype.sql | 添加服务商子类型 |
| v1.2.0 | v1.2.0_add_project_phases.sql | 添加项目阶段功能 |

## 使用方法

### 手动执行迁移

```bash
psql -U postgres -d home_decoration -f migrations/vX.Y.Z_description.sql
```

如果迁移文件采用单文件 `-- up / -- down` 格式：

- 不要直接整文件 `psql -f`
- 只能执行 `up` 段
- 仓库发布脚本中的 `release_apply_postgres_sql_file()` 已按这个规则处理

### 使用 golang-migrate 工具（推荐）

安装工具：
```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

执行迁移：
```bash
migrate -database "postgres://postgres:123456@localhost:5432/home_decoration?sslmode=disable" \
        -path server/migrations up
```

## 迁移开发流程

1. 创建新迁移文件（使用版本号命名）
2. 编写 SQL 语句
   - 如果同文件包含 `-- up / -- down`，必须保证 `up` 段独立可执行
3. 本地测试迁移
4. 提交代码
5. 如需随发布自动执行，同步更新 `deploy/scripts/lib/release_common.sh` 的 allowlist
   - 若是插入到旧版本号区间的兼容回填迁移，也必须手工补 allowlist，不能只依赖“高于最新版本自动告警”

## 注意事项

- ⚠️ 迁移文件一旦部署到生产环境，不应修改
- ✅ 如需修正，创建新的迁移文件
- ✅ 如需回滚，优先给出文档化回滚方案；使用 `-- up / -- down` 时，发布链路只会自动执行 `up`
- ✅ 迁移前备份数据库
- ✅ 认证 / 短信审计 / 商家入驻历史环境补洞统一执行 `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`
- ⚠️ `public.sql` / `local_backup.sql` 仅为历史快照，不是 schema source of truth
