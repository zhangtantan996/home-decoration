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
2. 编写SQL语句（包含 up 和 down 逻辑）
3. 本地测试迁移
4. 提交代码
5. 部署时自动执行迁移

## 注意事项

- ⚠️ 迁移文件一旦部署到生产环境，不应修改
- ✅ 如需修正，创建新的迁移文件
- ✅ 所有迁移应支持回滚（提供down语句）
- ✅ 迁移前备份数据库
