# Mac端 React Native 调试教程

本文档详细介绍如何在 Mac 上使用 Android Studio (AS) 和 iOS Simulator 调试 React Native 应用程序。

---

## 目录

1. [前置要求](#前置要求)
2. [项目结构说明](#项目结构说明)
3. [方法一：同时调试 Android 和 iOS](#方法一同时调试-android-和-ios)
4. [方法二：单独调试 Android](#方法二单独调试-android)
5. [方法三：单独调试 iOS](#方法三单独调试-ios)
6. [常见问题与解决方案](#常见问题与解决方案)

---

## 前置要求

### 必需软件

- **Node.js**: v16+ (推荐使用 nvm 管理)
- **Watchman**: `brew install watchman`
- **Android Studio**: 最新稳定版
- **Xcode**: 最新稳定版 (仅 iOS 调试需要)
- **CocoaPods**: `sudo gem install cocoapods` (仅 iOS 调试需要)

### Android 环境配置

确保在 `~/.zshrc` 或 `~/.bash_profile` 中配置了以下环境变量:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

配置完成后执行: `source ~/.zshrc`

### iOS 环境配置

确保 Xcode Command Line Tools 已安装:

```bash
xcode-select --install
```

---

## 项目结构说明

本项目采用 monorepo 结构，React Native 移动应用位于:

```
home-decoration/
└── mobile/           # React Native 移动应用
    ├── android/      # Android 原生代码
    ├── ios/          # iOS 原生代码
    ├── src/          # React Native 源代码
    └── package.json
```

---

## 方法一：同时调试 Android 和 iOS

这种方法允许你同时在 Android 模拟器和 iOS 模拟器上运行应用，适合需要同时测试两个平台的场景。

### 步骤 1: 启动 Metro Bundler

Metro 是 React Native 的 JavaScript 打包工具，两个平台共享同一个 Metro 服务。

```bash
# 进入 mobile 目录
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 安装依赖 (首次运行或依赖更新时)
npm install

# 启动 Metro Bundler
npm start
```

**说明**: Metro 会在 `http://localhost:8081` 启动，保持此终端窗口运行。

### 步骤 2: 启动 Android 调试

**打开新的终端窗口**，执行以下命令:

```bash
# 进入 mobile 目录
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 启动 Android 模拟器 (或连接真机)
# 方法 1: 使用命令行启动模拟器
emulator -list-avds  # 查看可用的模拟器
emulator -avd <模拟器名称> &  # 启动指定模拟器

# 方法 2: 在 Android Studio 中手动启动模拟器
# 打开 Android Studio -> Tools -> Device Manager -> 启动模拟器

# 运行 Android 应用
npm run android
```

**或者使用 Android Studio 调试**:

1. 打开 Android Studio
2. 选择 **Open an Existing Project**
3. 导航到 `/Volumes/tantan/AI_project/home-decoration/mobile/android`
4. 等待 Gradle 同步完成
5. 选择模拟器或真机
6. 点击 **Run** 按钮 (绿色三角形) 或按 `Ctrl + R`

### 步骤 3: 启动 iOS 调试

**打开另一个新的终端窗口**，执行以下命令:

```bash
# 进入 mobile 目录
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 安装 iOS 依赖 (首次运行或依赖更新时)
cd ios
pod install
cd ..

# 运行 iOS 应用
npm run ios

# 或指定特定模拟器
npm run ios -- --simulator="iPhone 15 Pro"
```

### 步骤 4: 开始调试

现在你应该看到:

- ✅ Metro Bundler 在终端 1 运行
- ✅ Android 应用在 Android 模拟器/真机上运行
- ✅ iOS 应用在 iOS 模拟器上运行

**调试工具**:

- **React Native Debugger**: 推荐使用独立调试工具
- **Chrome DevTools**: 在应用中摇晃设备 → 选择 "Debug"
- **Flipper**: Facebook 官方调试工具

**热重载**:

- 代码修改后会自动刷新
- 手动刷新: Android (`R + R`), iOS (`Cmd + R`)
- 打开开发菜单: Android (`Cmd + M`), iOS (`Cmd + D`)

---

## 方法二：单独调试 Android

### 使用命令行调试

```bash
# 进入 mobile 目录
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 安装依赖 (首次运行)
npm install

# 启动 Android 模拟器
emulator -list-avds
emulator -avd <模拟器名称> &

# 运行 Android 应用 (会自动启动 Metro)
npm run android
```

### 使用 Android Studio 调试

#### 方法 A: 通过 Android Studio 运行 (推荐)

1. **打开项目**
   ```bash
   # 在 Android Studio 中打开
   # File -> Open -> 选择目录
   /Volumes/tantan/AI_project/home-decoration/mobile/android
   ```

2. **等待 Gradle 同步**
   - 首次打开会自动同步依赖
   - 如果遇到问题，点击 **File -> Sync Project with Gradle Files**

3. **配置 Node 路径** (如果使用 NVM)
   
   在 `android/gradle.properties` 中添加:
   ```properties
   # 获取 Node 路径: which node
   reactNativeNodeExecutable=/Users/<你的用户名>/.nvm/versions/node/v<版本号>/bin/node
   ```

4. **启动 Metro Bundler**
   
   **打开终端**:
   ```bash
   cd /Volumes/tantan/AI_project/home-decoration/mobile
   npm start
   ```

5. **在 Android Studio 中运行**
   - 选择模拟器或连接的真机
   - 点击 **Run** 按钮 (绿色三角形)
   - 或按快捷键 `Ctrl + R`

#### 方法 B: 完全在 Android Studio 内调试

1. **打开 Android 项目**
   ```
   /Volumes/tantan/AI_project/home-decoration/mobile/android
   ```

2. **配置 Run Configuration**
   - 点击 **Run -> Edit Configurations**
   - 选择 **app**
   - 在 **Before launch** 部分，添加:
     - **Run External tool**
     - **Program**: `/usr/local/bin/npm` (或 `which npm` 的输出)
     - **Arguments**: `start`
     - **Working directory**: `/Volumes/tantan/AI_project/home-decoration/mobile`

3. **运行应用**
   - 点击 **Run** 按钮
   - Android Studio 会自动启动 Metro，然后安装应用

### 调试技巧

**查看日志**:

```bash
# 实时查看 Android 日志
adb logcat | grep ReactNative

# 或在 Android Studio 中查看 Logcat 面板
```

**清除缓存**:

```bash
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 清除 React Native 缓存
npm start -- --reset-cache

# 清除 Android 构建缓存
cd android
./gradlew clean
cd ..
```

**重新安装应用**:

```bash
# 卸载应用
adb uninstall com.homedecorationmobile

# 重新安装
npm run android
```

---

## 方法三：单独调试 iOS

### 使用命令行调试

```bash
# 进入 mobile 目录
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 安装依赖 (首次运行)
npm install

# 安装 iOS 依赖
cd ios
pod install
cd ..

# 运行 iOS 应用 (会自动启动 Metro 和模拟器)
npm run ios

# 指定特定模拟器
npm run ios -- --simulator="iPhone 15 Pro"

# 查看可用的模拟器
xcrun simctl list devices
```

### 使用 Xcode 调试

1. **打开 Xcode 项目**
   ```bash
   # 使用命令行打开
   open /Volumes/tantan/AI_project/home-decoration/mobile/ios/HomeDecorationMobile.xcworkspace
   
   # 注意: 必须打开 .xcworkspace 文件，不是 .xcodeproj
   ```

2. **选择目标设备**
   - 在 Xcode 顶部工具栏选择模拟器或真机
   - 推荐: iPhone 15 Pro (iOS 17.0+)

3. **启动 Metro Bundler**
   
   **打开终端**:
   ```bash
   cd /Volumes/tantan/AI_project/home-decoration/mobile
   npm start
   ```

4. **在 Xcode 中运行**
   - 点击 **Run** 按钮 (播放图标)
   - 或按快捷键 `Cmd + R`

### 调试技巧

**查看日志**:

- 在 Xcode 中查看 **Console** 面板
- 或使用命令行:
  ```bash
  # 查看模拟器日志
  xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "HomeDecorationMobile"'
  ```

**清除缓存**:

```bash
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 清除 React Native 缓存
npm start -- --reset-cache

# 清除 iOS 构建缓存
cd ios
rm -rf ~/Library/Developer/Xcode/DerivedData
pod deintegrate
pod install
cd ..
```

**重置模拟器**:

```bash
# 列出所有模拟器
xcrun simctl list devices

# 重置指定模拟器
xcrun simctl erase <设备ID或名称>

# 删除并重新安装应用
xcrun simctl uninstall booted com.homedecorationmobile
npm run ios
```

---

## 常见问题与解决方案

### Android 相关问题

#### 1. "Cannot run program 'node'" 错误

**原因**: Android Studio 找不到 Node.js 路径 (常见于使用 NVM 时)

**解决方案**:

在 `android/gradle.properties` 中添加:

```properties
# 获取 Node 路径
# 在终端执行: which node
reactNativeNodeExecutable=/Users/<你的用户名>/.nvm/versions/node/v<版本号>/bin/node
```

#### 2. Gradle 同步失败

**解决方案**:

```bash
cd /Volumes/tantan/AI_project/home-decoration/mobile/android

# 清理 Gradle 缓存
./gradlew clean

# 删除 .gradle 文件夹
rm -rf .gradle

# 重新同步
./gradlew --refresh-dependencies
```

#### 3. 应用无法连接到 Metro

**解决方案**:

```bash
# 确保 Metro 在运行
npm start

# 在应用中摇晃设备 -> Settings -> Debug server host
# 输入: localhost:8081

# 或使用 adb 反向代理
adb reverse tcp:8081 tcp:8081
```

### iOS 相关问题

#### 1. "No bundle URL present" 错误

**原因**: Metro Bundler 未运行或无法连接

**解决方案**:

```bash
# 确保 Metro 在运行
cd /Volumes/tantan/AI_project/home-decoration/mobile
npm start -- --reset-cache
```

#### 2. CocoaPods 依赖问题

**解决方案**:

```bash
cd /Volumes/tantan/AI_project/home-decoration/mobile/ios

# 清理并重新安装
pod deintegrate
pod cache clean --all
pod install

# 如果还有问题，更新 CocoaPods
sudo gem install cocoapods
```

#### 3. Xcode 构建失败

**解决方案**:

```bash
# 清理 Xcode 缓存
rm -rf ~/Library/Developer/Xcode/DerivedData

# 在 Xcode 中
# Product -> Clean Build Folder (Shift + Cmd + K)
# 然后重新构建
```

### 通用问题

#### 1. Metro Bundler 端口被占用

**解决方案**:

```bash
# 查找占用 8081 端口的进程
lsof -i :8081

# 终止进程
kill -9 <PID>

# 或使用 React Native 命令
npm start -- --port 8082
```

#### 2. 代码修改后不生效

**解决方案**:

```bash
# 重启 Metro 并清除缓存
npm start -- --reset-cache

# 在应用中重新加载
# Android: R + R
# iOS: Cmd + R
```

#### 3. 依赖安装问题

**解决方案**:

```bash
cd /Volumes/tantan/AI_project/home-decoration/mobile

# 清理并重新安装
rm -rf node_modules
rm package-lock.json
npm install

# iOS 额外步骤
cd ios
pod install
cd ..
```

---

## 推荐的开发工作流

### 日常开发 (推荐)

```bash
# 1. 启动 Metro (保持运行)
cd /Volumes/tantan/AI_project/home-decoration/mobile
npm start

# 2. 在新终端启动 Android (如需要)
npm run android

# 3. 在新终端启动 iOS (如需要)
npm run ios
```

### 使用 IDE 调试 (深度调试)

- **Android**: 使用 Android Studio 打开 `mobile/android`
- **iOS**: 使用 Xcode 打开 `mobile/ios/HomeDecorationMobile.xcworkspace`
- **JavaScript**: 使用 VS Code + React Native Debugger

### 性能分析

- **Android**: Android Studio Profiler
- **iOS**: Xcode Instruments
- **React Native**: Flipper Performance Monitor

---

## 总结

- **同时调试**: 启动一个 Metro，分别在两个终端运行 `npm run android` 和 `npm run ios`
- **单独调试 Android**: 使用命令行 (`npm run android`) 或 Android Studio
- **单独调试 iOS**: 使用命令行 (`npm run ios`) 或 Xcode
- **关键点**: Metro Bundler 必须始终运行，两个平台可以共享同一个 Metro 实例

根据你的需求选择合适的调试方法，祝开发顺利！ 🚀
