# Android APK 打包完整指南

**版本**: v1.0  
**更新时间**: 2026-01-01

---

## 📋 打包前检查清单

### 1. 确认 API 地址配置

打开 `mobile/src/config.ts`，确认生产环境 API 地址：

```typescript
export const getApiBaseUrl = (): string => {
    if (__DEV__) {
        // 开发环境配置...
    }
    return 'http://47.99.105.195';  // ← 确认这是你的服务器地址
};
```

> [!IMPORTANT]
> **如果服务器 IP 或域名不同，请修改第 14 行的地址！**
> 
> - 如果使用域名：`return 'https://yourdomain.com';`
> - 如果使用 IP：`return 'http://你的服务器IP';`

---

## 🔨 方式一：使用 Android Studio 打包（推荐）

### 步骤 1：打开项目

1. 启动 Android Studio
2. 选择 **Open an Existing Project**
3. 导航到 `G:\AI_engineering\home_decoration\mobile\android`
4. 点击 **OK**

### 步骤 2：等待 Gradle 同步

首次打开会自动下载依赖，等待底部进度条完成（可能需要 5-10 分钟）。

### 步骤 3：构建 Release APK

1. 点击菜单栏 **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. 等待构建完成（右下角会显示进度）
3. 构建成功后会弹出通知，点击 **locate** 查看 APK 文件

**APK 位置**：
```
mobile\android\app\build\outputs\apk\release\app-release.apk
```

---

## 🔨 方式二：使用命令行打包（更快）

### 步骤 1：进入 Android 目录

```powershell
cd G:\AI_engineering\home_decoration\mobile\android
```

### 步骤 2：清理并构建

```powershell
# 清理旧的构建文件
.\gradlew clean

# 构建 Release APK
.\gradlew assembleRelease
```

### 步骤 3：查找 APK

构建成功后，APK 文件位于：
```
app\build\outputs\apk\release\app-release.apk
```

---

## ⚠️ 当前签名配置说明

你的项目当前使用 **Debug Keystore** 签名（见 `build.gradle` 第 103 行）：

```gradle
release {
    signingConfig signingConfigs.debug  // ← 使用调试签名
    ...
}
```

> [!WARNING]
> **Debug 签名的限制**：
> - ✅ 可以安装到任何设备测试
> - ✅ 可以分发给内部测试人员
> - ❌ **不能上传到应用商店**（Google Play / 华为应用市场等）
> - ❌ 每次重装会清空应用数据

---

## 🔐 生产环境签名配置（上架应用商店必需）

如果你需要上架应用商店，必须生成正式签名密钥。

### 步骤 1：生成签名密钥

```powershell
# 在 mobile/android/app 目录下执行
cd G:\AI_engineering\home_decoration\mobile\android\app

# 生成密钥（有效期 10000 天）
keytool -genkeypair -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

**填写信息时注意**：
- **密码**：请牢记，丢失无法找回！
- **姓名**：填写公司或个人名称
- **组织单位**：可填写部门或留空
- **组织**：公司名称
- **城市/省份/国家代码**：如实填写

### 步骤 2：配置 Gradle

编辑 `mobile/android/app/build.gradle`，在 `signingConfigs` 块中添加：

```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        storeFile file('my-release-key.keystore')
        storePassword '你的密码'
        keyAlias 'my-key-alias'
        keyPassword '你的密码'
    }
}
```

然后修改 `buildTypes.release`：

```gradle
release {
    signingConfig signingConfigs.release  // ← 改为使用正式签名
    minifyEnabled enableProguardInReleaseBuilds
    proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
}
```

### 步骤 3：重新打包

```powershell
cd G:\AI_engineering\home_decoration\mobile\android
.\gradlew assembleRelease
```

---

## 📱 安装 APK 到手机

### 方法 1：USB 连接

```powershell
# 确保手机已开启 USB 调试
adb install app\build\outputs\apk\release\app-release.apk
```

### 方法 2：文件传输

1. 将 APK 文件复制到手机
2. 在手机上打开文件管理器
3. 点击 APK 文件安装（需允许"未知来源"）

---

## 🐛 常见问题

### Q1: 构建失败 "SDK location not found"

**解决方案**：创建 `mobile/android/local.properties` 文件：

```properties
sdk.dir=C\:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk
```

### Q2: 打包后 APP 闪退或白屏

**原因**：API 地址配置错误或服务器未启动。

**解决方案**：
1. 检查 `config.ts` 中的 API 地址
2. 确认服务器已启动并可访问
3. 查看 Logcat 日志定位错误

### Q3: 如何查看 APP 日志？

```powershell
# 连接手机后执行
adb logcat | findstr "ReactNativeJS"
```

### Q4: 如何减小 APK 体积？

编辑 `build.gradle`，启用代码混淆：

```gradle
def enableProguardInReleaseBuilds = true  // 改为 true
```

---

## 📊 打包后的验证步骤

1. **安装测试**：在至少 2 台不同设备上安装
2. **功能测试**：
   - ✅ 登录/注册
   - ✅ 浏览设计师/公司
   - ✅ 预约功能
   - ✅ 支付流程
   - ✅ 聊天功能
3. **网络测试**：
   - ✅ WiFi 环境
   - ✅ 4G/5G 环境
   - ✅ 弱网环境

---

## 🚀 快速打包命令总结

```powershell
# 1. 修改 API 地址（如果需要）
# 编辑 mobile/src/config.ts

# 2. 进入 Android 目录
cd G:\AI_engineering\home_decoration\mobile\android

# 3. 打包
.\gradlew assembleRelease

# 4. APK 位置
# app\build\outputs\apk\release\app-release.apk
```

---

## 📞 技术支持

如遇到问题，请检查：
1. Node.js 版本是否 >= 18
2. JDK 版本是否 = 17
3. Android SDK 是否完整安装
4. Gradle 版本是否匹配（项目使用 8.x）

---

*文档更新时间: 2026-01-01*
