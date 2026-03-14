# 测试数据隔离与清理指南

这份文档只解决两件事：

1. 如何把 `local / test / staging / production` 的数据库物理隔离开
2. 如何安全清理测试脏数据，而不是直接在共享库里手写 `DELETE`

## 1. 环境隔离原则

必须长期维持以下规则：

- `local`：本地开发专用
- `test`：联调 / 验收 / 回归专用
- `staging`：预发布 / 演练专用
- `production`：线上真实流量专用

禁止事项：

- `production` 与 `test/staging` 共享数据库
- `production` 与 `test/staging` 共享 Redis
- `production` 与 `test/staging` 共享 JWT Secret
- 在 `production` 库中直接插入测试数据

推荐数据库命名：

- `local`: `home_decoration`
- `test`: `home_decoration_test`
- `staging`: `home_decoration_staging`
- `production`: `home_decoration`

## 2. 启动防呆

后端启动时会执行数据库目标安全检查：

- `APP_ENV=local`：
  - 仅允许连接本地 / 内网数据库主机
- `APP_ENV=test`：
  - `DATABASE_HOST` 或 `DATABASE_DBNAME` 必须带 `test`
- `APP_ENV=staging`：
  - `DATABASE_HOST` 或 `DATABASE_DBNAME` 必须带 `staging`
- `APP_ENV=production`：
  - 禁止连接带 `test / staging` 标记的数据库目标

如果你明确知道自己在做什么，需要临时绕过：

```bash
ALLOW_UNSAFE_DB_TARGET=1
```

默认不建议设置。

## 3. 本地 / 测试环境启动

### Local

本地开发继续使用：

```bash
docker compose -f docker-compose.local.yml up -d db redis api admin merchant website user-web local-gateway
```

### Test

仓库已经提供长期复用的测试环境编排：

```bash
cp deploy/.env.test.example deploy/.env.test
# 填入 test 环境自己的 DB / Redis / JWT / ENCRYPTION_KEY

npm run infra:test:up
```

关闭：

```bash
npm run infra:test:down
```

## 4. 测试数据命名约定

所有测试数据都必须满足“可识别、可筛选、可删除”：

- 文本标记：
  - `[TEST]`
  - `测试`
  - `验收`
  - `联调`
  - `fixture`
  - `acceptance`
  - `smoke`
  - `demo`
- 手机号前缀：`19999`
- 批次标记：`run_id`

建议：

- 测试用户昵称 / 公司名 / 项目名至少带一个稳定标记：
  - `[TEST]` 或 `测试` 或 `验收` 或 `联调`
- 自动化验收批次写入 `run_id`
- 尽量复用 `19999` 手机号前缀
- 不要使用看起来像真实业务的数据名

## 5. 安全清理入口

新增了统一清理命令：

```bash
# local dry-run
npm run db:cleanup:testdata:local

# test dry-run
npm run db:cleanup:testdata:test

# staging dry-run
npm run db:cleanup:testdata:staging
```

默认是 `dry-run`，只打印待清理数量，不执行删除。

实际删除：

```bash
bash ./scripts/db-cleanup-tagged-test-data.sh local --apply
```

按手机号前缀或 run_id 缩小范围：

```bash
bash ./scripts/db-cleanup-tagged-test-data.sh test --phone-prefix 19999 --run-id identity_20260314 --apply
```

在 `staging` 执行真实删除时，必须显式放行：

```bash
bash ./scripts/db-cleanup-tagged-test-data.sh staging --allow-staging --apply
```

## 6. 清理覆盖范围

当前清理器优先覆盖“测试用户/服务商/项目/预约/订单/报价/入驻申请”主链：

- `users`
- `providers`
- `workers`
- `projects`
- `project_phases`
- `phase_tasks`
- `work_logs`
- `milestones`
- `bookings`
- `proposals`
- `orders`
- `payment_plans`
- `escrow_accounts`
- `transactions`
- `provider_cases`
- `provider_reviews`
- `case_audits`
- `merchant_applications`
- `material_shop_applications`
- `material_shop_application_products`
- `material_shops`
- `material_shop_products`
- `identity_applications`
- `identity_audit_logs`
- `user_identities`
- `quote_lists`
- `quote_list_items`
- `quote_invitations`
- `quote_submissions`
- `quote_submission_items`
- `quote_price_books`
- `quote_price_book_items`
- 以及若存在的部分关联表

如果后续发现某个业务新表也会沉积测试数据，就把它加入清理器，而不是继续单独写散 SQL。

## 7. 推荐日常流程

### 开发

- 平时只在 `local` 库开发
- 本地测试数据统一带 `[TEST]`

### 联调 / 验收

- 统一在 `test` 环境做
- 跑前确认：
  - `DATABASE_DBNAME=home_decoration_test`
  - JWT / Redis / uploads 都与 production 隔离

### 清理

1. 先 dry-run
2. 确认命中数量
3. 再 `--apply`
4. 保留命令记录

### 生产

- 禁止运行测试数据清理器
- 禁止插入任何 `[TEST]` 数据
- 如线上已混入脏数据，先导出候选范围，再单独审计后处理
