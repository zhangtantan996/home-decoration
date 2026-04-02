# 生产发布与数据库迁移运行手册

## 目标
- 统一生产发布时的代码、配置、Schema 迁移、数据迁移边界
- 避免“代码发布成功，但关键 env / 迁移 / 数据修复遗漏”

## 适用范围
- ECS Docker 生产环境
- 生产工作目录：`/root/home-decoration`
- 测试工作目录：`/root/home-decoration-test`

## 一、发布前必须确认的配置

### 1. 管理后台网络门禁
- `ADMIN_AUTH_API_IP_ENFORCED=true`
- `ADMIN_AUTH_ALLOWED_CIDRS=` 必填，填写真实办公 / VPN 出口网段，多个值逗号分隔

示例：

```env
ADMIN_AUTH_API_IP_ENFORCED=true
ADMIN_AUTH_ALLOWED_CIDRS=113.132.74.62/32,113.132.74.153/32,127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

说明：
- 公网出口只保留真实办公 / VPN IP
- `127.0.0.1/32,::1/128,10/8,172.16/12,192.168/16` 仅作为代理 / 内网兜底
- 办公网络变化时，先改 `.env`，再重启 `api`

### 2. 生产关键 env
- `SERVER_PUBLIC_URL`
- `VITE_PUBLIC_SITE_URL`
- `DB_USER / DB_PASSWORD / DB_NAME`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `SMS_PROVIDER=aliyun`

## 二、发布边界

### 代码发布
- GitHub 是唯一真源
- 服务器目录不是 Git 仓库时，发布方式固定为：
  1. 本地锁定 commit / tag
  2. `rsync` 同步快照到服务器目录
  3. 服务器执行 `deploy_prod.sh --skip-git`

### 数据库变更
- `Schema 迁移` 进入标准发版链路
- `数据迁移 / 数据清洗` 不默认混入代码发布，需单独评审、单独备份、单独记录

## 三、Schema 迁移策略

### 1. 自动迁移
- `deploy/scripts/lib/release_common.sh` 会自动执行 allowlist 中的“已知迁移”
- 对于带 `-- up / -- down` 的单文件迁移，发布脚本只执行 `up` 段，不会整文件直喂 `psql`
- 当前自动列表已覆盖本轮关键正式迁移，包括：
  - `v1.9.12_normalize_provider_price_unit_to_sqm.sql`
  - `v1.9.13_add_official_provider_review_project_link.sql`
  - `v1.9.14_add_claimed_completion_onboarding_columns.sql`
  - `v1.9.15_add_admin_security_columns.sql`
  - `v1.9.16_add_provider_display_name.sql`
  - `v1.12.11_hide_legacy_risk_arbitration_menu.sql`
  - `v1.12.12_add_payment_central_runtime.sql`
  - `v1.12.13_add_settlement_and_bond_domains.sql`
  - `v1.13.4_add_public_visibility_switches.sql`

### 2. 仍需手工执行的新增迁移
- 当新增迁移尚未进入自动列表时，测试和生产都必须手工执行

判断原则：
- 迁移文件已进入 `server/migrations/` 但尚未加入 `release_apply_known_migrations()` 时，必须手工执行
- 手工执行时如果文件包含 `-- up / -- down`，只能执行 `up` 段

如环境历史较老，先补：
- `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`

### 3. 执行顺序
1. 备份生产 DB
2. 手工执行缺失迁移（仅执行 `up` 段）
3. 再执行 `deploy_prod.sh`
4. 发布后做列级验证

## 四、数据迁移策略

### 默认原则
- 先发 Schema，不默认夹带数据修复
- 只有验证明确暴露脏数据问题时，才单开 SQL

### 数据修复 SQL 要求
- 必须先备份 DB
- SQL 必须幂等或明确限定作用范围
- 必须记录：
  - 触发原因
  - 影响表
  - 影响行范围
  - 回滚方式

## 五、推荐发布步骤

1. 本地确认候选 commit / tag
2. 备份：
   - 工作区快照
   - 主库 dump
   - uploads
3. 同步代码快照到服务器
4. 手工执行缺失迁移
5. 执行：

```bash
bash deploy/scripts/deploy_prod.sh --tag <tag> --service all --skip-git --skip-backup
```

6. 冒烟验证：
   - `/api/v1/health`
   - `/`
   - `/admin/`
   - `/merchant/`
   - `/app/login`
   - 服务商详情 / 案例详情
   - 后台关键安全接口

## 六、发布记录至少要落这些信息
- `origin/dev` 候选 SHA
- `origin/main` 发布 SHA
- `rc tag / prod tag`
- 手工执行的迁移文件
- DB / uploads / worktree 备份路径
- 是否执行过额外数据修复

## 七、服务器侧当前约束
- 生产：`/root/home-decoration`
- 测试：`/root/home-decoration-test`
- 当前生产后台网络门禁依赖 `.env` 中：
  - `ADMIN_AUTH_API_IP_ENFORCED`
  - `ADMIN_AUTH_ALLOWED_CIDRS`

如果本次发布修改了这两个变量，必须至少重启 `api`。
