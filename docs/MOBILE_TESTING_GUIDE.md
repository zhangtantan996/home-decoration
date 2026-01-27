# 家装平台移动端测试指南

> React Native 0.83.0 | React 19.2.0 | iOS & Android 测试完整流程

---

## 📋 目录

- [环境要求](#环境要求)
- [iOS 测试](#ios-测试)
  - [iOS 模拟器测试](#ios-模拟器测试)
  - [iOS 真机测试](#ios-真机测试)
- [Android 测试](#android-测试)
  - [Android 模拟器测试](#android-模拟器测试)
  - [Android 真机测试](#android-真机测试)
- [常见问题](#常见问题)
- [调试工具](#调试工具)

---

## 环境要求

### 通用环境

| 工具 | 版本要求 | 安装方式 |
|------|---------|---------|
| **Node.js** | >= 20.0.0 | `brew install node@20` |
| **npm** | >= 10.0.0 | 随 Node.js 安装 |
| **Watchman** | 最新版 | `brew install watchman` |
| **React Native CLI** | 最新版 | `npm install -g react-native-cli` |

### iOS 环境（仅 macOS）

| 工具 | 版本要求 | 安装方式 |
|------|---------|---------|
| **Xcode** | >= 15.0 | App Store 下载 |
| **Xcode Command Line Tools** | 最新版 | `xcode-select --install` |
| **CocoaPods** | >= 1.15.0 | `sudo gem install cocoapods` |
| **iOS Simulator** | iOS 13+ | Xcode 自带 |

### Android 环境（macOS/Windows/Linux）

| 工具 | 版本要求 | 安装方式 |
|------|---------|---------|
| **JDK** | 17 或 21 | `brew install openjdk@17` |
| **Android SDK** | API Level 36 | Android Studio 或命令行工具 |
| **Android Build Tools** | 36.0.0 | SDK Manager 安装 |
| **Android NDK** | 27.1.12297006 | SDK Manager 安装 |

---

## iOS 测试

### iOS 模拟器测试

#### 步骤 1：环境验证

```bash
# 验证 Xcode 安装
xcodebuild -version
# 预期输出：Xcode 15.x

# 验证 Command Line Tools
xcode-select -p
# 预期输出：/Applications/Xcode.app/Contents/Developer

# 验证 CocoaPods
pod --version
# 预期输出：1.15.x

# 验证 Node.js
node --version
# 预期输出：v20.x.x
```

#### 步骤 2：安装项目依赖

```bash
# 进入项目目录
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 安装 npm 依赖
npm install

# 安装 iOS 原生依赖（CocoaPods）
cd ios
pod install
cd ..
```

**预期输出**：
```
✓ Pod installation complete! There are X dependencies from the Podfile and X total pods installed.
```

#### 步骤 3：启动后端服务（必需）

```bash
# 在新终端窗口，启动后端 API
cd /Volumes/tantan/AI_project/home-decoration
docker-compose -f docker-compose.local.yml up -d

# 验证后端运行
curl http://localhost:8080/api/v1/health
# 预期输出：{"status":"ok"}
```

#### 步骤 4：启动 Metro Bundler

```bash
# 在新终端窗口（终端 1）
cd /Volumes/tantan/AI_project/home-decoration/mobile
npm start

# 或者清除缓存启动
npm start -- --reset-cache
```

**预期输出**：
```
 BUNDLE  ./index.js

 LOG  Running "HomeDecorationApp" with {"rootTag":1,"initialProps":{}}
```

#### 步骤 5：运行 iOS 模拟器

```bash
# 在新终端窗口（终端 2）
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 运行默认模拟器（iPhone 15）
npm run ios

# 或指定模拟器型号
npx react-native run-ios --simulator="iPhone 15 Pro"

# 或指定 iOS 版本
npx react-native run-ios --simulator="iPhone 15 Pro (17.0)"
```

#### 步骤 6：验证应用启动

**成功标志**：
- ✅ 模拟器自动打开
- ✅ 应用安装并启动
- ✅ 看到登录界面或首页
- ✅ Metro bundler 显示 bundle 加载成功

**失败排查**：
- 如果模拟器未打开：检查 Xcode 是否正确安装
- 如果应用闪退：查看 Metro bundler 日志
- 如果白屏：检查后端 API 是否运行

---

### iOS 真机测试

#### 步骤 1：准备 iOS 设备

1. **连接设备**：
   - 使用 USB 线连接 iPhone/iPad 到 Mac
   - 在设备上点击"信任此电脑"

2. **开启开发者模式**（iOS 16+）：
   - 设置 → 隐私与安全 → 开发者模式 → 开启
   - 重启设备

3. **验证设备连接**：
   ```bash
   # 查看连接的设备
   xcrun xctrace list devices

   # 或使用 instruments
   instruments -s devices
   ```

#### 步骤 2：配置 Xcode 签名

```bash
# 打开 Xcode 项目
cd /Volumes/tantan/AI_project/home-decoration/mobile/ios
open HomeDecorationApp.xcworkspace
```

在 Xcode 中：
1. 选择项目 `HomeDecorationApp`
2. 选择 Target `HomeDecorationApp`
3. 进入 **Signing & Capabilities** 标签
4. 勾选 **Automatically manage signing**
5. 选择你的 **Team**（需要 Apple Developer 账号）
6. 确认 **Bundle Identifier** 唯一（如 `com.yourcompany.homedecoration`）

**免费账号限制**：
- 每 7 天需要重新签名
- 最多 3 个设备
- 无法使用推送通知等高级功能

#### 步骤 3：安装到真机

**方法 1：使用 React Native CLI（推荐）**

```bash
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 启动 Metro bundler（终端 1）
npm start

# 在新终端（终端 2），指定设备运行
npx react-native run-ios --device="Your iPhone Name"

# 或使用设备 UDID
npx react-native run-ios --udid=<device-udid>
```

**方法 2：使用 Xcode**

1. 在 Xcode 中选择你的设备（顶部工具栏）
2. 点击 **Run** 按钮（▶️）或按 `Cmd + R`
3. 等待构建和安装完成

#### 步骤 4：信任开发者证书

首次安装后，设备上会提示：
1. 设置 → 通用 → VPN 与设备管理
2. 找到你的开发者账号
3. 点击"信任"

#### 步骤 5：连接 Metro Bundler

**自动连接**（推荐）：
- 确保设备和 Mac 在同一 Wi-Fi 网络
- Metro bundler 会自动通过网络连接

**手动配置**（如果自动连接失败）：
1. 摇晃设备打开开发者菜单
2. 点击 **Configure Bundler**
3. 输入 Mac 的 IP 地址和端口 `192.168.x.x:8081`

**获取 Mac IP 地址**：
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

#### 步骤 6：验证真机运行

**成功标志**：
- ✅ 应用安装到设备
- ✅ 应用正常启动
- ✅ 可以正常操作界面
- ✅ 网络请求正常（连接后端 API）

---

## Android 测试

### Android 模拟器测试

#### 步骤 1：环境验证

```bash
# 验证 Java 版本
java -version
# 预期输出：openjdk version "17.x.x"

# 验证 Android SDK
echo $ANDROID_HOME
# 预期输出：/Users/xxx/Library/Android/sdk

# 验证 adb
adb version
# 预期输出：Android Debug Bridge version 1.0.x
```

#### 步骤 2：配置环境变量

在 `~/.zshrc` 或 `~/.bash_profile` 中添加：

```bash
# Android SDK
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin

# Java（如果使用 Homebrew 安装）
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH=$JAVA_HOME/bin:$PATH
```

然后执行：
```bash
source ~/.zshrc
```

#### 步骤 3：安装 Android SDK 组件

```bash
# 查看已安装的组件
sdkmanager --list_installed

# 安装必需组件（根据项目配置）
sdkmanager "platform-tools" \
           "platforms;android-36" \
           "build-tools;36.0.0" \
           "ndk;27.1.12297006" \
           "system-images;android-36;google_apis;arm64-v8a"

# 接受许可协议
sdkmanager --licenses
```

#### 步骤 4：创建 Android 模拟器

**使用 Android Studio（推荐）**：
1. 打开 Android Studio
2. Tools → Device Manager
3. 点击 **Create Device**
4. 选择设备型号（如 Pixel 7）
5. 选择系统镜像（Android 14 / API 36）
6. 完成创建

**使用命令行**：
```bash
# 创建 AVD（Android Virtual Device）
avdmanager create avd \
  --name Pixel_7_API_36 \
  --package "system-images;android-36;google_apis;arm64-v8a" \
  --device "pixel_7"

# 查看已创建的 AVD
avdmanager list avd
```

#### 步骤 5：启动模拟器

```bash
# 列出可用模拟器
emulator -list-avds

# 启动指定模拟器
emulator -avd Pixel_7_API_36

# 或在后台启动
emulator -avd Pixel_7_API_36 &
```

**验证模拟器启动**：
```bash
# 等待模拟器完全启动（可能需要 1-2 分钟）
adb wait-for-device

# 查看设备列表
adb devices
# 预期输出：
# List of devices attached
# emulator-5554    device
```

#### 步骤 6：安装项目依赖

```bash
cd /Volumes/tantan/AI_project/home-decoration/mobile
npm install
```

#### 步骤 7：启动后端服务

```bash
# 在新终端窗口
cd /Volumes/tantan/AI_project/home-decoration
docker-compose -f docker-compose.local.yml up -d
```

#### 步骤 8：配置端口转发

```bash
# 转发 Metro bundler 端口
adb reverse tcp:8081 tcp:8081

# 转发后端 API 端口
adb reverse tcp:8080 tcp:8080

# 转发 Tinode 消息服务端口
adb reverse tcp:6060 tcp:6060

# 验证端口转发
adb reverse --list
```

#### 步骤 9：启动 Metro Bundler

```bash
# 在新终端窗口（终端 1）
cd /Volumes/tantan/AI_project/home-decoration/mobile
npm start
```

#### 步骤 10：运行 Android 应用

```bash
# 在新终端窗口（终端 2）
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 运行应用（会自动执行端口转发）
npm run android

# 或清除缓存运行
npm run android:clean
```

**构建过程**：
- 第一次构建可能需要 5-10 分钟
- 下载 Gradle 依赖
- 编译 Java/Kotlin 代码
- 打包 APK
- 安装到模拟器

#### 步骤 11：验证应用启动

**成功标志**：
- ✅ 模拟器中应用自动启动
- ✅ 看到登录界面或首页
- ✅ Metro bundler 显示 bundle 加载成功
- ✅ 可以正常操作界面

---

### Android 真机测试

#### 步骤 1：准备 Android 设备

1. **开启开发者模式**：
   - 设置 → 关于手机
   - 连续点击"版本号" 7 次
   - 提示"您已处于开发者模式"

2. **开启 USB 调试**：
   - 设置 → 系统 → 开发者选项
   - 开启"USB 调试"
   - 开启"USB 安装"（部分设备）

3. **连接设备**：
   - 使用 USB 线连接设备到电脑
   - 设备上弹出"允许 USB 调试"对话框
   - 勾选"始终允许"并点击"确定"

#### 步骤 2：验证设备连接

```bash
# 查看连接的设备
adb devices

# 预期输出：
# List of devices attached
# XXXXXXXX    device

# 如果显示 unauthorized，在设备上重新授权
```

**常见状态**：
- `device`：已连接并授权 ✅
- `unauthorized`：未授权，需要在设备上允许
- `offline`：设备离线，重新插拔 USB
- `no permissions`：权限问题，重启 adb 服务

#### 步骤 3：重启 adb 服务（如果需要）

```bash
# 停止 adb 服务
adb kill-server

# 启动 adb 服务
adb start-server

# 再次查看设备
adb devices
```

#### 步骤 4：配置端口转发

```bash
# 转发 Metro bundler 端口
adb reverse tcp:8081 tcp:8081

# 转发后端 API 端口
adb reverse tcp:8080 tcp:8080

# 转发 Tinode 消息服务端口
adb reverse tcp:6060 tcp:6060

# 验证端口转发
adb reverse --list
# 预期输出：
# (reverse) tcp:8081 tcp:8081
# (reverse) tcp:8080 tcp:8080
# (reverse) tcp:6060 tcp:6060
```

#### 步骤 5：安装项目依赖

```bash
cd /Volumes/tantan/AI_project/home-decoration/mobile
npm install
```

#### 步骤 6：启动后端服务

```bash
cd /Volumes/tantan/AI_project/home-decoration
docker-compose -f docker-compose.local.yml up -d
```

#### 步骤 7：启动 Metro Bundler

```bash
# 在新终端窗口（终端 1）
cd /Volumes/tantan/AI_project/home-decoration/mobile
npm start
```

#### 步骤 8：运行应用到真机

```bash
# 在新终端窗口（终端 2）
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 运行应用（自动安装到连接的设备）
npm run android

# 或指定设备（如果连接多个设备）
npx react-native run-android --deviceId=<device-id>
```

**查看设备 ID**：
```bash
adb devices -l
```

#### 步骤 9：验证真机运行

**成功标志**：
- ✅ 应用安装到设备
- ✅ 应用自动启动
- ✅ 看到登录界面或首页
- ✅ 可以正常操作界面
- ✅ 网络请求正常

#### 步骤 10：查看日志（可选）

```bash
# 查看应用日志
npx react-native log-android

# 或使用 adb logcat
adb logcat | grep "ReactNative"

# 过滤错误日志
adb logcat | grep -E "Error|Exception"
```

---

## 常见问题

### iOS 问题

#### 问题 1：`pod install` 失败

**错误**：
```
[!] CocoaPods could not find compatible versions for pod "xxx"
```

**解决方案**：
```bash
cd mobile/ios

# 清理 CocoaPods 缓存
rm -rf Pods
rm Podfile.lock
pod cache clean --all

# 更新 CocoaPods 仓库
pod repo update

# 重新安装
pod install
```

#### 问题 2：模拟器无法连接 Metro

**错误**：
```
Unable to connect to Metro bundler
```

**解决方案**：
```bash
# 1. 确保 Metro 运行在 8081 端口
lsof -i :8081

# 2. 清理缓存重启 Metro
npm start -- --reset-cache

# 3. 在模拟器中重新加载
# 按 Cmd + D 打开开发者菜单 → Reload
```

#### 问题 3：Xcode 构建失败

**错误**：
```
Build input file cannot be found: 'xxx.framework'
```

**解决方案**：
```bash
cd mobile/ios

# 清理 Xcode 构建缓存
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 清理项目构建
rm -rf build

# 重新安装 Pods
pod install

# 在 Xcode 中 Clean Build Folder（Cmd + Shift + K）
```

#### 问题 4：真机无法连接 Metro

**解决方案**：
1. 确保设备和 Mac 在同一 Wi-Fi
2. 摇晃设备打开开发者菜单
3. 点击 **Configure Bundler**
4. 输入 Mac IP：`192.168.x.x:8081`

**获取 Mac IP**：
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

---

### Android 问题

#### 问题 1：Gradle 构建失败

**错误**：
```
Could not resolve all dependencies for configuration ':app:debugRuntimeClasspath'
```

**解决方案**：
```bash
cd mobile/android

# 清理 Gradle 缓存
./gradlew clean

# 删除 Gradle 缓存目录
rm -rf ~/.gradle/caches

# 重新构建
./gradlew assembleDebug
```

#### 问题 2：adb 找不到设备

**错误**：
```
adb: no devices/emulators found
```

**解决方案**：
```bash
# 重启 adb 服务
adb kill-server
adb start-server

# 检查 USB 连接
# - 更换 USB 线
# - 更换 USB 端口
# - 重新授权 USB 调试

# 查看设备
adb devices
```

#### 问题 3：端口转发失败

**错误**：
```
adb: error: cannot bind listener: Operation not permitted
```

**解决方案**：
```bash
# 方法 1：重启 adb
adb kill-server
adb start-server
adb reverse tcp:8081 tcp:8081

# 方法 2：使用设备 IP（不推荐）
# 在应用中配置 Metro URL 为电脑 IP
```

#### 问题 4：应用闪退

**排查步骤**：
```bash
# 1. 查看崩溃日志
adb logcat | grep -E "AndroidRuntime|FATAL"

# 2. 清理应用数据
adb shell pm clear com.homedecorationapp

# 3. 重新安装
npm run android:clean

# 4. 查看 Metro bundler 日志
# 检查是否有 JavaScript 错误
```

#### 问题 5：NDK 版本不匹配

**错误**：
```
NDK at /xxx/ndk/xx.x.xxxxx does not have a source.properties file
```

**解决方案**：
```bash
# 安装正确的 NDK 版本（项目要求 27.1.12297006）
sdkmanager "ndk;27.1.12297006"

# 或在 android/build.gradle 中指定
# ndkVersion = "27.1.12297006"
```

---

## 调试工具

### React Native Debugger

**安装**：
```bash
brew install --cask react-native-debugger
```

**使用**：
1. 启动 React Native Debugger
2. 在应用中打开开发者菜单
3. 选择 **Debug**

### Flipper（推荐）

**安装**：
```bash
brew install --cask flipper
```

**功能**：
- 网络请求监控
- 布局检查器
- 日志查看
- 数据库查看
- Redux DevTools

### Chrome DevTools

**使用**：
1. 在应用中打开开发者菜单
2. 选择 **Debug**
3. 浏览器自动打开 `http://localhost:8081/debugger-ui/`

### 性能监控

**启用性能监控**：
```bash
# iOS
# 在模拟器中按 Cmd + D → Show Perf Monitor

# Android
# 在应用中按 Menu 键 → Show Perf Monitor
```

---

## 测试检查清单

### 启动前检查

- [ ] Node.js 版本 >= 20
- [ ] npm 依赖已安装（`npm install`）
- [ ] 后端服务已启动（`docker-compose up`）
- [ ] Metro bundler 已启动（`npm start`）

### iOS 检查

- [ ] Xcode 已安装
- [ ] CocoaPods 依赖已安装（`pod install`）
- [ ] 模拟器/真机已连接
- [ ] 签名配置正确（真机）

### Android 检查

- [ ] Android SDK 已安装
- [ ] 环境变量已配置（`$ANDROID_HOME`）
- [ ] 模拟器已启动或真机已连接
- [ ] 端口转发已配置（`adb reverse`）

### 功能测试

- [ ] 应用正常启动
- [ ] 登录功能正常
- [ ] 网络请求正常
- [ ] 图片加载正常
- [ ] 导航功能正常
- [ ] 相机/相册功能正常（真机）
- [ ] 地理定位功能正常（真机）

---

## 生产构建

### iOS 生产构建

```bash
# 在 Xcode 中
# 1. 选择 Product → Archive
# 2. 等待构建完成
# 3. 在 Organizer 中选择 Archive
# 4. 点击 Distribute App
# 5. 选择发布方式（App Store / Ad Hoc / Enterprise）
```

### Android 生产构建

```bash
cd mobile/android

# 生成签名密钥（首次）
keytool -genkeypair -v -storetype PKCS12 \
  -keystore my-release-key.keystore \
  -alias my-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000

# 构建 Release APK
./gradlew assembleRelease

# 构建 Release AAB（Google Play）
./gradlew bundleRelease

# 输出位置
# APK: android/app/build/outputs/apk/release/app-release.apk
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 技术支持

如遇到问题，请按以下顺序排查：

1. **查看本文档的"常见问题"章节**
2. **查看 Metro bundler 日志**（终端 1）
3. **查看应用日志**（`npx react-native log-ios/android`）
4. **查看后端日志**（`docker-compose logs -f api`）
5. **搜索 React Native 官方文档**
6. **提交 Issue 到项目仓库**

---

**文档版本**：v1.0.0
**最后更新**：2026-01-26
**适用版本**：React Native 0.83.0
