# OSS 免费资源包接入（当前架构：本地上传 + 定时备份到 OSS）

适用场景：
- ECS 4C8G 上已经跑 API + PostgreSQL + Redis
- 业务上传先落本地 `server/uploads`
- 用 OSS 做备份兜底（先不改上传代码）

相关脚本：
- `deploy/scripts/backup_postgres.sh`
- `deploy/scripts/backup_uploads.sh`
- `deploy/scripts/oss_sync_backups.sh`
- `deploy/scripts/backup_and_sync_oss.sh`

## 1. OSS 控制台准备

1. 创建 Bucket（与 ECS 同地域）
2. Bucket 权限选择私有
3. 创建 RAM 用户，并授权该 Bucket 的最小权限（读写对象）
4. 记录 AccessKeyId 和 AccessKeySecret

## 2. ECS 安装并初始化 ossutil

```bash
cd /opt
curl -LO https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil64
chmod +x ossutil64
sudo mv ossutil64 /usr/local/bin/ossutil
ossutil --version
```

初始化配置（按提示输入）：
```bash
ossutil config
```

配置完成后验证：
```bash
ossutil ls oss://<your-bucket>/
```

## 3. 先手动跑一次（验证链路）

在 ECS：
```bash
cd /opt/home_decoration/deploy

export DATABASE_HOST="<your-db-host>"
export DATABASE_PORT="5432"
export DATABASE_USER="postgres"
export DATABASE_PASSWORD="<your-db-password>"
export DATABASE_DBNAME="home_decoration"
export OSS_BUCKET="<your-bucket>"
export OSS_PREFIX="home-decoration/prod-backups"
export KEEP_LOCAL_DAYS="7"

bash ./scripts/backup_and_sync_oss.sh
```

验证 OSS 里是否有文件：
```bash
ossutil ls oss://<your-bucket>/home-decoration/prod-backups/
```

## 4. 配置 crontab（每天自动执行）

建议每天凌晨 3 点执行：
```bash
crontab -e
```

加入一行（按实际密码替换）：
```bash
0 3 * * * cd /opt/home_decoration/deploy && DATABASE_HOST="<your-db-host>" DATABASE_PORT="5432" DATABASE_USER="postgres" DATABASE_PASSWORD="<your-db-password>" DATABASE_DBNAME="home_decoration" OSS_BUCKET="<your-bucket>" OSS_PREFIX="home-decoration/prod-backups" KEEP_LOCAL_DAYS="7" bash ./scripts/backup_and_sync_oss.sh >> /var/log/home-decoration-backup.log 2>&1
```

检查是否生效：
```bash
crontab -l
tail -n 200 /var/log/home-decoration-backup.log
```

## 5. 免费资源包注意点

- 免费包通常只覆盖部分容量/请求/流量，超出后按量计费
- 图片业务请求数增长会很快，建议控制上传原图大小并尽快加缩略图策略
- 监控以下两项：
  - ECS 磁盘使用率（建议 70% 告警）
  - OSS 请求量与下行流量

## 6. 现阶段与后续建议

- 现在可上线：本地上传 + OSS 备份（当前文档方案）
- 下一阶段（推荐）：把上传路径改成“直接写 OSS”，数据库只存 URL，减少 ECS 磁盘和 I/O 压力
