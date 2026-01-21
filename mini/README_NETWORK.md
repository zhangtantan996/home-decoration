# 小程序网络配置说明

## 问题背景

微信小程序在开发者工具中运行时,无法直接访问 `localhost`,因为 `localhost` 指向的是开发者工具本身,而不是您的 Mac 主机。

## 当前配置

小程序已配置为使用 Mac 本地 IP 地址访问 OrbStack 容器中的后端 API:

```
API 地址: http://192.168.110.128:8080/api/v1
```

## 如果 IP 地址变化

如果您的 Mac IP 地址发生变化(例如更换网络),需要更新以下文件:

1. **`config/dev.ts`** - 开发环境配置
2. **`src/utils/request.ts`** - 请求工具
3. **`src/services/uploads.ts`** - 上传服务

### 查看当前 IP 地址

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

通常使用 `192.168.x.x` 格式的 WiFi 地址。

## 微信开发者工具配置

确保在微信开发者工具中:

1. **开启"不校验合法域名"** - 设置 → 项目设置 → 本地设置
2. **允许 HTTP 请求** - 默认已开启

## 使用环境变量(可选)

您也可以通过环境变量覆盖 API 地址:

```bash
export TARO_APP_API_BASE=http://YOUR_IP:8080/api/v1
npm run dev:weapp
```

## OrbStack 特殊域名(备选方案)

OrbStack 提供了特殊域名 `host.orb.local` 来访问主机,但需要确认是否支持微信小程序环境。

## 故障排查

如果仍然无法获取数据:

1. **检查后端是否运行**
   ```bash
   curl http://192.168.110.128:8080/api/v1/health
   ```

2. **检查防火墙设置** - 确保 Mac 防火墙允许端口 8080

3. **查看开发者工具控制台** - 检查网络请求是否成功

4. **验证 IP 地址** - 确认 Mac IP 地址未变化
