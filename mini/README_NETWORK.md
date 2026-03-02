# 小程序网络配置说明

## 问题背景

微信小程序在开发者工具中运行时，`localhost` 指向开发者工具环境本身，不一定等于宿主机地址。

## 当前配置

项目默认 API 地址由环境变量控制：

```
默认 API 地址: http://localhost:8080/api/v1
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
