# 环境配置约定

项目统一环境名：
- `local`
- `test`
- `staging`
- `production`

统一公共变量：
- `APP_ENV`
- `API_BASE_URL`
- `WEB_BASE_URL`
- `ADMIN_BASE_URL`
- `TINODE_SERVER_URL`
- `TINODE_API_KEY`

后端优先读取环境变量；前端各端通过适配层映射到自己的框架变量。
