# Android 调试网络配置指南

本文档详细说明 Android 调试时为什么需要 `adb reverse` 以及各种替代方案。

---

## 问题背景

### 为什么需要 `adb reverse`？

当你在 Mac 上运行开发服务器时：
- **Metro Bundler** 运行在 `localhost:8081`（Mac）
- **后端 API** 运行在 `localhost:8080`（Mac）

但是 Android 模拟器/真机有**独立的网络环境**：
- 模拟器的 `localhost` ≠ Mac 的 `localhost`
- 模拟器访问 `localhost:8081` 实际访问的是**模拟器自己的** 8081 端口

**`adb reverse` 的作用**：建立反向端口映射，让模拟器访问 `localhost:8081` 时，实际访问 Mac 的 `localhost:8081`。

```bash
# Metro Bundler 端口映射
adb reverse tcp:8081 tcp:8081

# 后端 API 端口映射
adb reverse tcp:8080 tcp:8080
```

---

## 解决方案对比

| 方案 | 适用场景 | 优点 | 缺点 | 推荐度 |
|------|---------|------|------|--------|
| **方案 1: 自动化 adb reverse** | 模拟器 + 真机 | 配置简单，自动执行 | 需要 USB 连接 | ⭐⭐⭐⭐⭐ |
| **方案 2: Android 特殊 IP** | 仅模拟器 | 不需要 adb reverse | 真机无法使用 | ⭐⭐⭐ |
| **方案 3: Mac 局域网 IP** | 模拟器 + 真机 | 最灵活，真机可用 | IP 可能变化 | ⭐⭐⭐⭐ |

---

## 方案 1: 自动化 adb reverse（推荐）

### 实现方式

已在 `package.json` 中配置，每次运行 `npm run android` 时自动执行：

```json
{
  "scripts": {
    "android": "npm run android:setup && react-native run-android",
    "android:setup": "adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8080 tcp:8080",
    "android:clean": "npm run android:setup && react-native run-android --reset-cache"
  }
}
```

### 使用方法

```bash
# 直接运行，会自动执行 adb reverse
npm run android

# 清除缓存并运行
npm run android:clean
```

### 优点
- ✅ 完全自动化，无需手动执行
- ✅ 模拟器和真机都支持
- ✅ 代码中使用 `localhost`，与 iOS 保持一致

### 缺点
- ❌ 需要 USB 连接（无线调试时需要先配置）
- ❌ 设备未连接时会显示警告（不影响使用）

---

## 方案 2: 使用 Android 模拟器特殊 IP

### 原理

Android 模拟器提供了特殊 IP `10.0.2.2`，它**永远指向宿主机的 localhost**。

### 配置方法

#### 1. 修改环境配置

编辑 `src/config/env.ts`：

```typescript
// 将 NETWORK_MODE 改为 'emulator-ip'
const NETWORK_MODE: NetworkMode = 'emulator-ip';
```

#### 2. 配置 Metro Bundler

在应用中打开开发菜单：
- 摇晃设备或按 `Cmd + M`
- 选择 **Settings**
- 选择 **Debug server host & port for device**
- 输入：`10.0.2.2:8081`

### 使用方法

```bash
# 不需要 adb reverse，直接运行
npm run android
```

### API 请求示例

```typescript
import ENV from '@/config/env';

// 自动使用 http://10.0.2.2:8080
fetch(`${ENV.API_BASE_URL}/api/users`)
  .then(response => response.json())
  .then(data => console.log(data));
```

### 优点
- ✅ 不需要 `adb reverse`
- ✅ IP 地址固定，不会变化
- ✅ 配置简单

### 缺点
- ❌ **仅适用于 Android 模拟器**
- ❌ 真机无法使用此 IP
- ❌ 需要手动配置 Metro 地址

---

## 方案 3: 使用 Mac 局域网 IP

### 原理

使用 Mac 在局域网中的真实 IP 地址，模拟器和真机都可以通过网络访问。

### 配置方法

#### 1. 获取 Mac 的 IP 地址

```bash
# 方法 1: 使用 ifconfig
ifconfig | grep "inet " | grep -v 127.0.0.1

# 方法 2: 使用 ipconfig getifaddr
ipconfig getifaddr en0  # Wi-Fi
ipconfig getifaddr en1  # 以太网

# 假设获取到的 IP 是: 192.168.1.100
```

#### 2. 修改环境配置

编辑 `src/config/env.ts`：

```typescript
// 将 NETWORK_MODE 改为 'lan-ip'
const NETWORK_MODE: NetworkMode = 'lan-ip';

// 填写你的 Mac IP 地址
const MAC_LAN_IP = '192.168.1.100'; // 替换为实际 IP
```

#### 3. 配置 Metro Bundler

在应用中打开开发菜单：
- 摇晃设备或按 `Cmd + M`
- 选择 **Settings**
- 选择 **Debug server host & port for device**
- 输入：`192.168.1.100:8081`（替换为你的实际 IP）

### 使用方法

```bash
# 不需要 adb reverse，直接运行
npm run android

# 真机也可以使用（确保在同一 Wi-Fi 网络）
```

### 优点
- ✅ 模拟器和真机都支持
- ✅ 不需要 USB 连接
- ✅ 更接近生产环境的网络配置
- ✅ 可以在真机上无线调试

### 缺点
- ❌ IP 地址可能变化（DHCP 分配）
- ❌ 需要手动更新配置
- ❌ 需要确保防火墙允许访问

### 解决 IP 变化问题

**方法 1: 设置静态 IP**

在 Mac 的网络设置中配置静态 IP：
1. 系统偏好设置 → 网络
2. 选择 Wi-Fi 或以太网
3. 点击"高级" → "TCP/IP"
4. 将"配置 IPv4"改为"手动"
5. 设置固定 IP（如 192.168.1.100）

**方法 2: 使用脚本自动获取 IP**

创建 `scripts/get-ip.sh`：

```bash
#!/bin/bash
IP=$(ipconfig getifaddr en0)
echo "当前 Mac IP: $IP"
echo "请在 src/config/env.ts 中更新 MAC_LAN_IP = '$IP'"
```

---

## 推荐配置

### 日常开发（模拟器）

**推荐：方案 1（自动化 adb reverse）**

```bash
# 一键启动，自动配置
npm run android
```

### 真机调试

**推荐：方案 3（局域网 IP）**

1. 获取 Mac IP
2. 修改 `src/config/env.ts` 中的 `NETWORK_MODE` 和 `MAC_LAN_IP`
3. 在应用中配置 Metro 地址
4. 运行应用

### 快速切换

在 `src/config/env.ts` 中修改 `NETWORK_MODE` 即可快速切换：

```typescript
// 开发时使用 adb reverse
const NETWORK_MODE: NetworkMode = 'adb-reverse';

// 真机调试时切换为 LAN IP
// const NETWORK_MODE: NetworkMode = 'lan-ip';
```

---

## 常见问题

### Q1: adb reverse 失败怎么办？

**检查设备连接**：
```bash
adb devices
```

**重启 adb 服务**：
```bash
adb kill-server
adb start-server
```

### Q2: 使用 10.0.2.2 无法连接？

确认：
- ✅ 使用的是 Android **模拟器**（不是真机）
- ✅ Metro Bundler 正在运行
- ✅ 在应用中配置了正确的 Metro 地址

### Q3: 使用局域网 IP 无法连接？

检查：
- ✅ Mac 和设备在**同一 Wi-Fi 网络**
- ✅ Mac 防火墙允许端口 8080 和 8081
- ✅ IP 地址正确（可能已变化）

**临时关闭防火墙测试**：
```bash
# 查看防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 临时关闭（测试后记得开启）
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

### Q4: 如何在 Android Studio 中使用？

Android Studio 运行应用时，`adb reverse` 不会自动执行。

**解决方法**：

1. 在 Android Studio 运行前，先在终端执行：
   ```bash
   npm run android:setup
   ```

2. 或者在 Android Studio 的 **Run Configuration** 中添加 **Before launch** 任务

---

## 总结

| 场景 | 推荐方案 | 命令 |
|------|---------|------|
| **日常开发（模拟器）** | 自动化 adb reverse | `npm run android` |
| **真机调试** | 局域网 IP | 修改 `env.ts` + `npm run android` |
| **快速测试（模拟器）** | Android 特殊 IP | 修改 `env.ts` + `npm run android` |
| **Android Studio** | 手动 adb reverse | `npm run android:setup` |

**最佳实践**：
1. 默认使用**自动化 adb reverse**（已配置）
2. 真机调试时切换到**局域网 IP**
3. 在 `src/config/env.ts` 中集中管理配置
4. 开发环境下会自动打印当前配置信息

现在你可以根据实际需求选择最适合的方案！🚀
