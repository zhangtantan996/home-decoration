# 正式上线前清单 - 测试数据清理

> ⚠️ **重要提醒**：正式版本上线前，必须执行以下清理步骤！

## 背景

在开发过程中，为了测试首页推荐功能，我们向数据库插入了一批测试数据。这些数据带有 `[TEST]` 标记，必须在正式上线前清理干净。

## 涉及的测试数据

| 数据类型 | 数量 | 标识特征 | ID 范围 |
|---------|-----|---------|--------|
| 用户 (users) | 12 条 | `nickname LIKE '%[TEST]%'` | 90001-90022 |
| 设计师 (providers, type=1) | 6 条 | `company_name LIKE '%[TEST]%'` | 90001-90006 |
| 工长 (providers, type=3) | 4 条 | `company_name LIKE '%[TEST]%'` | 90011-90014 |
| 装修公司 (providers, type=2) | 2 条 | `company_name LIKE '%[TEST]%'` | 90021-90022 |

## 清理步骤

### 方法 1：使用清理脚本（推荐）

```bash
# 1. 备份数据库（重要！）
docker exec decorating_db pg_dump -U postgres home_decoration > backup_before_cleanup_$(date +%Y%m%d).sql

# 2. 执行清理脚本
docker exec -i decorating_db psql -U postgres -d home_decoration < server/scripts/cleanup_test_data.sql

# 3. 验证清理结果
docker exec decorating_db psql -U postgres -d home_decoration -c "SELECT COUNT(*) FROM users WHERE nickname LIKE '%[TEST]%';"
# 应返回 0
```

---

## 服务器测试数据操作

### 步骤 1：本地代码推送到服务器

```bash
# 本地执行
cd "G:\AI engineering\home_decoration"
git add .
git commit -m "feat: add provider fields and test data scripts"
git push origin main
```

### 步骤 2：服务器拉取代码

```bash
# SSH 登录服务器后执行
cd /path/to/home_decoration  # 替换为实际项目路径
git pull origin main
```

### 步骤 3：执行数据库迁移（新增字段）

```bash
# 在服务器执行 - 添加新字段到 providers 表
cd /path/to/home_decoration/server/scripts/migrations
docker exec -i decorating_db psql -U postgres -d home_decoration < v1.1.0_add_provider_fields.sql
```

**新增字段清单：**
| 字段 | 类型 | 说明 |
|-----|------|------|
| `years_experience` | INTEGER | 从业年限 |
| `specialty` | VARCHAR(200) | 专长/风格描述 |
| `work_types` | VARCHAR(100) | 工种类型（逗号分隔） |
| `review_count` | INTEGER | 评价数量 |
| `price_min` | DECIMAL | 最低价格 |
| `price_max` | DECIMAL | 最高价格 |
| `price_unit` | VARCHAR(20) | 价格单位 |

### 步骤 4：执行测试数据插入

```bash
# 在服务器执行
cd /path/to/home_decoration/server/scripts
docker exec -i decorating_db psql -U postgres -d home_decoration < seed_test_data.sql
```

### 步骤 5：重启后端服务

```bash
# 使用 Docker Compose
cd /path/to/home_decoration
docker-compose restart api

# 或者单独重启容器
docker restart decorating_api
```

### 步骤 6：验证测试数据

```bash
docker exec decorating_db psql -U postgres -d home_decoration -c "SELECT id, nickname, specialty, years_experience FROM providers WHERE company_name LIKE '%[TEST]%' LIMIT 5;"
```

### 步骤 7：正式上线前清理

```bash
# 在服务器项目根目录执行
cd /path/to/home_decoration/server/scripts
docker exec -i decorating_db psql -U postgres -d home_decoration < cleanup_test_data.sql
```

---

## 验证清理完成

执行以下查询，确保返回结果都为 0：

```sql
SELECT 'users' AS table_name, COUNT(*) AS test_count 
FROM users WHERE nickname LIKE '%[TEST]%'
UNION ALL
SELECT 'providers', COUNT(*) 
FROM providers WHERE company_name LIKE '%[TEST]%';
```

## 注意事项

1. **务必先备份**：清理前一定要备份数据库
2. **确认环境**：确保是在正式环境而非开发环境执行
3. **检查外键**：如果测试数据有关联的项目、交易等，先清理关联数据
4. **记录日志**：清理完成后在运维日志中记录

## 相关文件

- 测试数据插入脚本：[seed_test_data.sql](./scripts/seed_test_data.sql)
- 测试数据清理脚本：[cleanup_test_data.sql](./scripts/cleanup_test_data.sql)

## 负责人

- [ ] 清理执行人：_____________
- [ ] 执行日期：_____________
- [ ] 验证确认人：_____________

---

*文档创建日期：2024-12-22*
*最后更新：2024-12-22*
