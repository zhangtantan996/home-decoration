# 装修APP移动端运行指南

> **前置条件**: 确保已安装 Android Studio 或 Xcode，并配置好环境。

## 方式一：使用 Web 浏览器 (推荐调试) 🆕

最快速的查看和调试 UI 的方式，无需模拟器。

1. **运行命令**
   ```bash
   cd mobile
   npm run web
   ```
2. **浏览器访问**
   打开控制台显示的地址，通常是 [http://localhost:5173](http://localhost:5173) 或 [http://localhost:5174](http://localhost:5174)。

*注意：Web 版主要用于 UI 布局和逻辑调试，部分原生功能（如摄像头、复杂的原生模块）可能不可用。*

---

## 方式二：使用 Android 模拟器

1. **启动模拟器**
   打开 Android Studio -> Device Manager -> 启动一个模拟器 (建议 API 30+)。

2. **启动 Metro 服务**
   在终端 1 中运行：
   ```bash
   cd mobile
   npm start
   ```

3. **安装并运行 App**
   在终端 2 中运行：
   ```bash
   cd mobile
   npm run android
   ```

---

## 方式三：连接真机 (Android)

1. 打开手机 "开发者选项" -> 开启 "USB调试"。
2. 运行 `adb devices` 检查连接。
3. 修改 `src/services/api.ts` 中的 IP 地址为电脑局域网 IP。
4. 运行 `npm run android`。

---

## 常见问题

### 1. 连不上本地后端 API？
- **Web**:使用 `localhost:8080` (自动匹配)。
- **Android 模拟器**: 使用 `10.0.2.2:8080`。
- **真机**: 使用局域网 IP (如 `192.168.1.5:8080`)。

### 2. Web 版图标显示方块？
Web 版默认可能未加载 Native 字体文件。这是调试模式的已知限制，建议忽略或后续配置 Web字体加载。
