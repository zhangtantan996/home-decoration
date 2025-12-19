# Android 打包指南

本文档记录了本项目的 Android 打包流程、环境配置及常见问题解决方法。

## 环境配置要求

1. **API 地址配置** (`mobile/src/config.ts`):
   项目已配置为自动切换环境：
   - **开发模式 (`__DEV__`)**: 自动连接本地或局域网 IP。
   - **生产模式 (Release)**: 自动连接服务器公网 IP `47.99.105.195`。

2. **HTTP 明文传输** (`AndroidManifest.xml`):
   由于服务器使用 HTTP（非 HTTPS）IP 地址，已强制开启 `android:usesCleartextTraffic="true"`。

---

## 打包步骤

### 1. 手动编译 JS 资源 (推荐每次打包前执行)
为了确保最新的代码修改（尤其是 IP 配置）被打包进 APK，请在 `mobile` 目录下运行：
```powershell
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
```

### 2. 使用 Android Studio 打包
1. **打开项目**: 选择 `mobile/android` 目录。
2. **切换模式**: 在左下角 `Build Variants` 中，将 `app` 模块选择为 `release`。
3. **清理缓存**: `Build -> Clean Project`。
4. **生成包**: 
   - **普通包**: `Build -> Build Bundle(s) / APK(s) -> Build APK(s)`。
   - **签名包**: `Build -> Generate Signed Bundle / APK...` (使用已创建的 `my-release-key.keystore`)。

---

## 常见问题排查

### 1. APK 无法获取验证码或连接后端
- **检查模式**: 确认是否打的是 `release` 变体包。
- **验证端口**: 确认服务器 `80` 端口已在安全组放行。
- **查看日志**: 在服务器执行 `docker logs -f decorating_api` 查看是否有请求进入。

### 2. APK 体积过大
- **原因**: 默认包包含了所有 CPU 架构 (arm64, v7a, x86)。
- **方案**: 在 `app/build.gradle` 中设置 `enableSeparateBuildPerCPUArchitecture = true` 进行分构打包。

---

## 关键路径
- **签名文件**: `mobile/android/app/my-release-key.keystore`
- **输出目录**: `mobile/android/app/build/outputs/apk/release/`
- **最后部署文档**: `docs/DEPLOY_DOCKER.md`
