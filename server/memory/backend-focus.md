# 后端关注点

- 任何环境切换都优先检查 `APP_ENV`、`SERVER_PUBLIC_URL`、`DATABASE_*`、`REDIS_*`
- 涉及短信联调时，先确认是否在 `local` 环境并评估 debug bypass 风险
- 高风险操作（删除、回滚、迁移）默认先说明风险与恢复路径
