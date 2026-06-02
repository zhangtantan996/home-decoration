# 磁盘清理与告警运行手册

这套方案的目标不是“看到满了就乱删”，而是把磁盘治理收成一条安全链路：

- `75%`：进入提醒区，先做安全清理，再复查占用。
- `85%`：进入严重区，仍先做安全清理；若无效，升级告警并要求人工处理。
- 永远不自动删除数据库目录、Docker 卷、上传目录这类关键数据。

## 1. 需要不要再配阿里云 OOS

默认答案：`不必须`。

如果已经在 ECS 上安装了本机 `cron`，并且由 `deploy/scripts/install_disk_guard_cron.sh` 安装定时任务，那么这套磁盘守护已经可以独立运行。

更推荐的口径是：

- `cron` 作为主执行器，负责真正清理。
- 阿里云 OOS 或云助手定时任务作为可选托底，只做远端可视化、巡检或人工补刀。

不要同时让 `cron` 和 OOS 在同一时间都执行清理，否则容易重复触发。

## 2. 脚本现在会做什么

主脚本：`deploy/scripts/disk_guard.sh`

它只会清理“可安全重建”的内容：

- 已停止的 Docker 容器
- 未使用的 Docker 镜像
- Docker builder 缓存
- 过期的 journald 日志
- 超过保留天数的备份目录文件

它不会自动清理：

- PostgreSQL / MySQL / Redis 数据目录
- Docker 卷数据
- 上传目录
- 业务静态资源和用户文件

如果磁盘主要是被这些关键目录占满，脚本会：

- 输出热点目录
- 输出受保护目录占用
- 写入风险告警（如果配置了 `RISK_WARNING_ENABLED=1` 和数据库连接）
- 等待人工扩容、迁移或手动清理

## 3. 建议的默认阈值

- `WARN_THRESHOLD=75`
- `CRITICAL_THRESHOLD=85`
- `KEEP_BACKUP_DAYS=7`
- `DOCKER_IMAGE_UNTIL=168h`
- `DOCKER_CONTAINER_UNTIL=72h`
- `DOCKER_BUILDER_UNTIL=168h`
- `JOURNAL_KEEP=7d`

## 4. 安装本机 cron

进入服务器仓库根目录后执行：

```bash
cd /root/home-decoration/deploy
bash ./scripts/install_disk_guard_cron.sh
```

如果要把告警写进后台风险中心，可以在安装前补齐数据库环境变量：

```bash
export RISK_WARNING_ENABLED=1
export DATABASE_HOST=...
export DATABASE_PORT=5432
export DATABASE_USER=...
export DATABASE_PASSWORD=...
export DATABASE_DBNAME=home_decoration
bash ./scripts/install_disk_guard_cron.sh
```

默认每 30 分钟运行一次，也可以改成：

```bash
export DISK_GUARD_CRON_SCHEDULE="0 * * * *"
bash ./scripts/install_disk_guard_cron.sh
```

## 5. 手动预演

只看会做什么，不实际删除：

```bash
cd /root/home-decoration/deploy
DRY_RUN=1 bash ./scripts/disk_guard.sh
```

实际执行：

```bash
cd /root/home-decoration/deploy
bash ./scripts/disk_guard.sh
```

## 6. 如果你坚持用阿里云 OOS

建议只把 OOS 当成“外部调度入口”或“托底巡检入口”，不要和本机 cron 双开。

推荐两种用法：

1. 用 OOS / 云助手定时执行只读巡检：

```bash
cd /root/home-decoration/deploy && DRY_RUN=1 bash ./scripts/disk_guard.sh
```

2. 如果你决定完全改由 OOS 调度，那就停掉本机 cron，再让 OOS 执行正式清理：

```bash
cd /root/home-decoration/deploy && bash ./scripts/disk_guard.sh
```

根据阿里云官方文档，OOS 的定时运维支持创建“周期性重复执行”的定时任务，云助手命令也支持按固定间隔、指定时间或 Cron 表达式执行命令。当前更适合这类磁盘巡检的，是直接对 ECS 下发 Shell 命令。官方参考：

- OOS 定时运维：https://help.aliyun.com/zh/oos/getting-started/perform-scheduled-o-and-m
- `ACS::TimerTrigger`：https://www.alibabacloud.com/help/doc-detail/120869.html
- ECS 云助手定时执行命令：https://help.aliyun.com/zh/ecs/user-guide/run-a-command

## 7. 推荐收口

对这台服务器，建议采用下面这条线：

- 先启用本机 `cron` 作为主执行器
- OOS 暂时不做强依赖
- 如果后面想加阿里云侧托底，就把 OOS 配成 `DRY_RUN=1` 的巡检任务
- 真正的磁盘扩容、数据库归档、上传迁移仍然走人工变更
