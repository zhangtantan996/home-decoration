# 统一环境配置说明

## 环境层级

项目统一使用以下环境名：

- `local`
- `test`
- `staging`
- `production`

历史别名在代码内兼容，但新脚本和新配置都只使用这 4 个名字。

## 统一环境契约

### 公共前端变量

- `APP_ENV`: 当前业务环境名。
- `API_BASE_URL`: API 外部访问基址，不带 `/api/v1`。例如 `https://api.example.com`。
- `WEB_BASE_URL`: Web/官网访问基址。
- `ADMIN_BASE_URL`: 管理后台访问基址。
- `TINODE_SERVER_URL`: Tinode 地址，建议提供完整 `ws://` 或 `wss://` 地址。
- `TINODE_API_KEY`: Tinode API Key。

### 服务端变量

- `SERVER_PUBLIC_URL`
- `CORS_ALLOWED_ORIGINS`
- `DATABASE_*`
- `REDIS_*`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `WECHAT_*`
- `SMS_*`

## 文件与脚本

- 示例模板：`env/*.env.example`
- 实际私有配置：复制为 `env/local.env`、`env/test.env`、`env/staging.env`、`env/production.env`
- 通用加载脚本：`scripts/env/with-env.sh`
- 移动端启动脚本：`scripts/env/mobile-run.sh`

## 常用命令

- 查看本地环境解析结果：`npm run env:print:local`
- 本地启动后端：`npm run dev:server`
- 本地启动管理后台：`npm run dev:admin`
- 本地启动小程序 H5：`npm run dev:mini:h5`
- 本地启动小程序 weapp：`npm run dev:mini:weapp`
- 本地运行 Android：`npm run mobile:android:local`
- 预发运行 Android：`npm run mobile:android:staging`

## 默认映射规则

- `admin` 从 `VITE_APP_ENV` / `VITE_API_URL` 读取，统一由根脚本从公共变量派生。
- `mini` 从 `TARO_APP_ENV` / `TARO_APP_API_BASE` / `TARO_APP_TINODE_*` 读取，统一由根脚本派生。
- `mobile` 从 `react-native-config` 读取 `APP_ENV`、`API_BASE_URL`、`WEB_BASE_URL`、`TINODE_*`；根脚本会在启动前生成临时 `ENVFILE`。
- `server` 仍使用自身配置结构，但统一以 `APP_ENV` 标识环境，并优先读取环境变量。
