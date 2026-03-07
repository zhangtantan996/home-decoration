# 数据库迁移规范

本文档用于统一当前仓库的数据库结构变更方式。

当前项目**没有统一 migration runner**，因此生产环境数据库变更采用：

- **受控手工执行**
- **SQL 文件规范化提交**
- **迁移 / 验证 / 回滚成对管理**
- **发布流程文档化**

> 生产发布总入口：`deploy/README.md`

---

## 1. 适用范围

适用于以下场景：

- 新增表
- 新增字段
- 新增索引
- 数据回填脚本
- 受控数据修复脚本
- 与生产发布绑定执行的 schema 变更

不适用于：

- 仅本地开发临时试验 SQL
- 无需进入版本控制的一次性个人调试语句

---

## 2. 迁移目录

统一使用：

- `server/scripts/migrations/`

当前仓库已存在该目录，后续迁移继续在此目录提交。

---

## 3. 文件命名规范

### 3.1 推荐命名

每次 schema 变更建议至少提交以下文件：

- `YYYYMMDD_<name>_up.sql`
- `YYYYMMDD_<name>_down.sql`
- 可选：`YYYYMMDD_<name>_verify.sql`

例如：

- `20260307_add_user_preferences_up.sql`
- `20260307_add_user_preferences_down.sql`
- `20260307_add_user_preferences_verify.sql`

### 3.2 命名要求

- 文件名使用 `snake_case`
- 名称直接体现变更目的
- `up/down/verify` 一眼可分辨
- 避免使用 `final.sql`、`new.sql`、`test.sql` 之类模糊命名

---

## 4. 提交要求

每次数据库结构变更至少需要包含：

1. `*_up.sql`
2. `*_down.sql`
3. 对应代码变更
4. 本文档或发布记录中的执行说明

推荐附带：

5. `*_verify.sql`
6. 变更影响说明
7. 执行顺序说明
8. 风险提示

---

## 5. 生产执行原则

### 5.1 强制要求

- 迁移前必须先备份数据库
- 如果涉及 uploads 或关键文件目录，建议同时备份
- 先在测试环境或低风险环境验证 SQL
- 生产执行必须有对应回滚方案
- 数据库迁移是**单独步骤**，不能和应用代码发布混在一条模糊命令里

### 5.2 不允许的做法

- 不允许在生产环境依赖 `AutoMigrate`
- 不允许先发代码后补写回滚 SQL
- 不允许执行未审查的临时 SQL 文件
- 不允许把数据库回滚脚本无条件自动化执行

---

## 6. 推荐执行流程

### 6.1 发布前

1. 确认本次发布是否包含数据库变更
2. 准备以下文件：
   - `*_up.sql`
   - `*_down.sql`
   - 可选 `*_verify.sql`
3. 先备份数据库
4. 在测试环境验证 SQL

### 6.2 生产执行

建议顺序：

1. 备份数据库
2. 执行 `*_up.sql`
3. 执行 `*_verify.sql` 或验证 SQL
4. 确认结果
5. 再执行应用发布脚本

### 6.3 出问题时

按以下顺序判断：

1. 只是应用代码不兼容？先回滚代码
2. schema 本身有问题？再评估是否执行 `*_down.sql`
3. 如果 down SQL 会导致数据丢失，优先评估备份恢复或人工修复

---

## 7. SQL 模板

### 7.1 up.sql 模板

```sql
BEGIN;

-- 1. schema change
-- ALTER TABLE ...

-- 2. indexes
-- CREATE INDEX ...

-- 3. data backfill if needed
-- UPDATE ...

COMMIT;
```

### 7.2 down.sql 模板

```sql
BEGIN;

-- rollback schema / indexes / backfill side effects if possible

COMMIT;
```

### 7.3 verify.sql 模板

```sql
-- Verify table / columns / indexes
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'example_table';

SELECT indexname
FROM pg_indexes
WHERE tablename = 'example_table';
```

---

## 8. 验证要求

每次迁移后至少验证：

- 表是否创建成功
- 字段是否存在
- 索引是否存在
- 默认值 / 约束是否符合预期
- 应用关键查询是否仍正常

推荐验证维度：

1. **结构验证**：表、字段、索引、约束
2. **数据验证**：回填结果、默认值
3. **应用验证**：接口或页面是否正常

---

## 9. 回滚要求

### 9.1 为什么不能全自动回滚

因为数据库回滚常常涉及：

- 新写入数据丢失风险
- 数据结构降级兼容性问题
- 索引或字段删除不可逆
- 长事务和锁表风险

因此本项目采用：

- **代码回滚可脚本化**
- **数据库回滚需人工确认**

### 9.2 回滚决策建议

| 场景 | 建议 |
|---|---|
| 仅代码 bug | 不回滚数据库 |
| schema 已执行但应用报错 | 先回滚代码，再评估数据库 |
| schema 本身错误且无业务写入 | 可评估执行 `*_down.sql` |
| 已有新数据写入新结构 | 优先人工评估，不直接 down |
| 数据已损坏 | 评估使用备份恢复 |

---

## 10. 发布记录模板

每次涉及数据库变更的发布，建议记录：

```markdown
## DB Migration Record

- Release tag: v1.2.3
- Operator: <name>
- Execute time: YYYY-MM-DD HH:mm

### Files
- Up SQL: server/scripts/migrations/20260307_xxx_up.sql
- Down SQL: server/scripts/migrations/20260307_xxx_down.sql
- Verify SQL: server/scripts/migrations/20260307_xxx_verify.sql

### Backup
- DB backup file: <file>
- Uploads backup file: <file or N/A>

### Result
- Up executed: yes / no
- Verify passed: yes / no
- App released after migration: yes / no
- Rollback needed: no / yes

### Notes
- <notes>
```

---

## 11. 与发布脚本的关系

`deploy/scripts/deploy_prod.sh` 和 `deploy/scripts/rollback_prod.sh` **不会自动执行数据库迁移或数据库回滚**。

这是有意保留的安全边界：

- 代码发布可以自动化
- 数据库变更必须受控执行
- 数据库回滚必须人工判断

---

## 12. 当前仓库建议后续收敛方向

虽然当前没有统一 migration runner，但建议后续所有新迁移都遵守：

- 同目录管理：`server/scripts/migrations/`
- 同一命名规范：`*_up.sql` / `*_down.sql` / `*_verify.sql`
- 同一发布规则：**备份 → 迁移 → 验证 → 发布服务**

这样即使未来引入 migration runner，也可以平滑迁移，不需要重做历史迁移资产。
