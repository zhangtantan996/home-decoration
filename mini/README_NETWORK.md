# 小程序网络配置说明

## 问题背景

微信小程序在开发者工具中运行时，`localhost` 指向开发者工具环境本身，不一定等于宿主机地址。

## 当前配置

项目默认 API 地址由环境变量控制：

```
默认 API 地址: http://127.0.0.1:8080/api/v1
```

在局域网真机/开发者工具联调场景，请使用可访问的宿主机 IP 注入 `TARO_APP_API_BASE`。

## 如果 IP 地址变化

如果网络变化导致本机 IP 变化，不需要修改代码文件，只需要修改启动时环境变量。

### 查看当前 IP 地址

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

通常使用 `192.168.x.x` 的 WiFi 地址。

## 微信开发者工具配置

确保在微信开发者工具中：

1. 开启“**不校验合法域名**”（设置 → 项目设置 → 本地设置）
2. 允许 HTTP 请求（开发环境）

## 使用环境变量

```bash
export TARO_APP_API_BASE=http://YOUR_IP:8080/api/v1
npm run dev:weapp
```

## 生产环境真机调试

如果你要在微信开发者工具里做“真机调试”，并且让小程序直接请求生产环境，不要再走 `127.0.0.1`，直接用生产编译脚本：

```bash
cd /Volumes/tantan/AI_project/home-decoration/mini
npm run dev:weapp:prod
```

该脚本默认会注入：

- `APP_ENV=production`
- `TARO_APP_API_BASE=https://api.hezeyunchuang.com/api/v1`
- `TARO_APP_H5_URL=https://hezeyunchuang.com/app/`
- `TARO_APP_ENABLE_NOTIFICATION_WS=true`

如果临时要覆盖，也可以显式传值：

```bash
cd /Volumes/tantan/AI_project/home-decoration/mini
TARO_APP_API_BASE=https://api.hezeyunchuang.com/api/v1 \
TARO_APP_H5_URL=https://hezeyunchuang.com/app/ \
npm run dev:weapp:prod
```

### 真机调试前必须确认

1. 微信开发者工具项目 AppID 已设置为正式小程序：
   - `wxd89a401b87800a6a`
2. 小程序后台已配置：
   - `https://api.hezeyunchuang.com` 到 `request / upload / download / socket` 合法域名
3. 如果要测 `web-view`：
   - `https://hezeyunchuang.com` 已配置为业务域名
4. 当前生产 API 可用：
   - `https://api.hezeyunchuang.com/api/v1/health`

### 当前线上检查结论

截至 `2026-04-03`，从本机实测：

```bash
curl https://api.hezeyunchuang.com/api/v1/health
curl 'https://api.hezeyunchuang.com/api/v1/providers?type=designer&page=1&pageSize=3'
```

生产 API 的 `GET` 请求是可用的。

注意：

- `curl -I` / `HEAD` 对 `health` 会返回 `404`
- 这不代表生产 API 不可用
- 小程序真实请求走的是 `GET`，所以应以 `GET` 验证结果为准

当前更需要关注的是：

- 小程序是否真的编译成了生产环境
- 微信开发者工具/真机是否还在缓存旧包
- 小程序后台合法域名是否已经加上 `https://api.hezeyunchuang.com`

## Tinode（IM）配置说明

小程序聊天基于 Tinode WebSocket 连接，默认端口为 `6060`。

### 必需环境变量

- `TARO_APP_TINODE_API_KEY`：Tinode API Key（用于连接时的 `apikey` 参数）

### 可选环境变量

- `TARO_APP_TINODE_URL`：形如 `ws://YOUR_IP:6060/v0/channels`（生产环境使用 `wss://`）

如果不设置 `TARO_APP_TINODE_URL`，小程序会从 `TARO_APP_API_BASE` 解析 host，并自动推导 Tinode 地址：
- `http://<host>:8080/api/v1` → `ws://<host>:6060/v0/channels`
- `https://<host>/api/v1` → `wss://<host>:6060/v0/channels`

### 开发者工具注意事项

1. 确保 Tinode 服务端口 `6060` 在同一网络可访问
2. 开发环境需允许 WebSocket（同时配合“不校验合法域名”）

示例：

```bash
export TARO_APP_API_BASE=http://YOUR_IP:8080/api/v1
export TARO_APP_TINODE_API_KEY=YOUR_TINODE_API_KEY
export TARO_APP_TINODE_URL=ws://YOUR_IP:6060/v0/channels
npm run dev:weapp
```

## OrbStack 特殊域名说明

`host.orb.local` 是 OrbStack 的特殊域名，在微信开发者工具环境通常不可解析：

- ❌ 不建议直接在小程序端使用 `host.orb.local`
- ✅ 建议使用真实局域网 IP，并通过 `TARO_APP_API_BASE` 注入

## 故障排查

1. **检查后端服务是否可访问**
   ```bash
   curl http://YOUR_IP:8080/api/v1/health
   ```
2. **检查防火墙设置**：确保端口 8080 放行
3. **查看开发者工具 Network 面板**：确认请求命中配置的 `TARO_APP_API_BASE`
4. **检查环境变量注入**：确认当前终端/IDE 启动命令带了正确地址
