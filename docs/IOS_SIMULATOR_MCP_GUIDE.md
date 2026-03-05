# iOS Simulator MCP 测试指南

## 📋 概述

iOS Simulator MCP 是一个 Model Context Protocol 服务器，允许 Claude Code 自动化控制 iOS 模拟器，用于测试 React Native 移动应用。

## ✅ 环境要求

| 要求 | 状态 | 说明 |
|------|------|------|
| macOS | ✅ | Darwin 25.2.0 |
| Xcode | ✅ | 已安装 |
| iOS 模拟器 | ✅ | iOS 26.2（多个设备可用） |
| Homebrew | ✅ | 已安装 |
| Facebook IDB | ✅ | 已安装（idb-companion 1.1.8） |
| Node.js | ✅ | 系统已安装 |

## 🚀 已完成的配置

### 1. IDB 工具安装

```bash
# 已安装 Facebook IDB Companion
brew tap facebook/fb
brew install idb-companion

# 已安装 IDB Python 客户端
pipx install fb-idb
```

### 2. MCP 服务器配置

已创建项目级别的 `.mcp.json` 配置文件：

```json
{
  "mcpServers": {
    "ios-simulator": {
      "command": "npx",
      "args": ["-y", "ios-simulator-mcp"],
      "env": {
        "IOS_SIMULATOR_MCP_DEFAULT_OUTPUT_DIR": "/Users/zhangtantan/Downloads"
      }
    }
  }
}
```

## 🎯 使用方法

### 启动 iOS 模拟器

1. **构建 React Native iOS 应用**：
   ```bash
   cd mobile
   npm run ios
   ```

2. **等待模拟器启动**：
   - 应用会自动安装到模拟器
   - Metro bundler 会自动启动

### 使用 MCP 工具进行测试

重启 Claude Code 后，你可以使用以下命令：

#### 1. 获取模拟器信息
```
请使用 get_booted_sim_id 工具获取当前运行的模拟器 ID
```

#### 2. 截图
```
请使用 screenshot 工具截取当前模拟器屏幕，保存为 home_screen.png
```

#### 3. UI 元素检查
```
请使用 ui_describe_all 工具列出当前屏幕上的所有可访问性元素
```

#### 4. 自动化交互
```
请使用 ui_tap 工具点击坐标 (200, 400)
```

```
请使用 ui_type 工具在输入框中输入 "测试用户"
```

```
请使用 ui_swipe 工具从 (200, 400) 滑动到 (200, 100)
```

#### 5. 录制视频
```
请使用 record_video 工具开始录制模拟器屏幕
```

```
请使用 stop_recording 工具停止录制并保存为 test_video.mp4
```

## 📱 可用的 iOS 模拟器设备

当前系统中可用的 iOS 26.2 设备：

- iPhone 17 Pro
- iPhone 17 Pro Max
- iPhone Air
- iPhone 17
- iPhone 16e
- iPad Pro 13-inch (M5)
- iPad Pro 11-inch (M5)
- iPad mini (A17 Pro)
- iPad (A16)
- iPad Air 13-inch (M3)
- iPad Air 11-inch (M3)

## 🧪 测试场景示例

### 场景 1：登录流程测试

```
1. 启动应用并截图
2. 使用 ui_describe_all 查找登录按钮
3. 使用 ui_tap 点击登录按钮
4. 使用 ui_type 输入手机号
5. 使用 ui_tap 点击获取验证码
6. 截图验证结果
```

### 场景 2：首页浏览测试

```
1. 启动应用到首页
2. 使用 ui_describe_all 列出所有服务商卡片
3. 使用 ui_swipe 向下滚动
4. 使用 ui_tap 点击某个服务商卡片
5. 截图验证详情页
```

### 场景 3：聊天功能测试

```
1. 导航到消息页面
2. 使用 ui_tap 打开某个聊天会话
3. 使用 ui_type 输入消息
4. 使用 ui_tap 发送消息
5. 截图验证消息发送成功
```

## 🔧 可用的 MCP 工具

| 工具名称 | 功能 | 示例 |
|---------|------|------|
| `get_booted_sim_id` | 获取当前启动的模拟器 ID | 查询模拟器状态 |
| `open_simulator` | 打开 iOS 模拟器 | 启动模拟器 |
| `ui_describe_all` | 描述屏幕上所有可访问性元素 | UI 元素检查 |
| `ui_tap` | 点击屏幕坐标 | 点击按钮 |
| `ui_type` | 输入文本 | 填写表单 |
| `ui_swipe` | 滑动操作 | 滚动列表 |
| `ui_describe_point` | 描述特定坐标的 UI 元素 | 查询元素信息 |
| `ui_view` | 获取当前屏幕截图 | 查看屏幕 |
| `screenshot` | 保存截图到文件 | 保存测试结果 |
| `record_video` | 录制视频 | 录制测试过程 |
| `stop_recording` | 停止录制 | 结束录制 |
| `install_app` | 安装应用 | 部署测试应用 |
| `launch_app` | 启动应用 | 启动测试应用 |

## ⚠️ 注意事项

### IDB Python 兼容性问题

当前 IDB Python 客户端（fb-idb 1.1.7）在 Python 3.14 上有兼容性问题：

```
RuntimeError: There is no current event loop in thread 'MainThread'.
```

**解决方案**：
- MCP 服务器会通过 `npx` 自动处理 IDB 调用
- 不需要手动运行 `idb` 命令
- 所有操作通过 Claude Code 的 MCP 工具完成

### 截图和视频保存位置

默认保存到：`/Users/zhangtantan/Downloads`

可以通过修改 `.mcp.json` 中的 `IOS_SIMULATOR_MCP_DEFAULT_OUTPUT_DIR` 环境变量来更改。

### 模拟器必须先启动

在使用 MCP 工具之前，必须先启动 iOS 模拟器：

```bash
cd mobile
npm run ios
```

或者使用 MCP 工具：

```
请使用 open_simulator 工具打开 iOS 模拟器
```

## 🎓 最佳实践

### 1. 测试前准备

- 确保 Metro bundler 正在运行
- 确保模拟器已启动并加载应用
- 使用 `ui_describe_all` 先了解屏幕结构

### 2. 坐标定位

- 使用 `ui_describe_all` 获取元素的可访问性标签
- 使用 `ui_describe_point` 验证坐标位置
- 截图辅助定位

### 3. 测试流程

1. 截图记录初始状态
2. 执行操作
3. 截图验证结果
4. 使用 `ui_describe_all` 确认 UI 变化

### 4. 调试技巧

- 使用 `record_video` 录制整个测试过程
- 每个关键步骤都截图
- 使用 `ui_describe_all` 检查 UI 状态

## 📚 相关文档

- [iOS Simulator MCP GitHub](https://github.com/joshuayoes/ios-simulator-mcp)
- [Facebook IDB 文档](https://fbidb.io/)
- [React Native 测试指南](https://reactnative.dev/docs/testing-overview)
- [项目 Mobile App 文档](../mobile/README.md)

## 🔄 下一步

1. **重启 Claude Code** 以加载 MCP 配置
2. **启动 iOS 模拟器**：`cd mobile && npm run ios`
3. **开始测试**：使用上述 MCP 工具进行自动化测试

## 💡 示例对话

### 测试登录流程

```
用户：请帮我测试移动应用的登录流程

Claude：
1. 首先让我截图查看当前屏幕
2. 使用 ui_describe_all 找到登录相关的元素
3. 点击登录按钮
4. 输入测试手机号
5. 验证登录结果
```

### 测试首页滚动

```
用户：请测试首页的服务商列表是否可以正常滚动

Claude：
1. 截图记录初始状态
2. 使用 ui_swipe 向下滚动
3. 截图验证滚动后的内容
4. 使用 ui_describe_all 确认新加载的元素
```

---

**提示**：重启 Claude Code 后，MCP 工具会自动加载，你可以直接在对话中请求使用这些工具进行自动化测试。
