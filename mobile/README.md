# 装修设计一体化平台 - 业主端APP

## 技术栈

- React Native 0.76+
- React Navigation 6.x
- Zustand (状态管理)
- Axios (HTTP请求)

## 项目结构

```
mobile/
├── src/
│   ├── screens/           # 页面组件
│   │   ├── HomeScreen.tsx       # 首页
│   │   ├── SearchScreen.tsx     # 搜索
│   │   ├── MySiteScreen.tsx     # 我的工地
│   │   ├── MessageScreen.tsx    # 消息
│   │   └── ProfileScreen.tsx    # 个人中心
│   ├── navigation/         # 导航配置
│   │   └── AppNavigator.tsx
│   ├── services/           # API服务
│   │   └── api.ts
│   ├── stores/             # 状态管理
│   └── components/         # 公共组件
├── App.tsx                 # 入口文件
└── package.json
```

## 快速开始

### 1. 安装依赖
```bash
cd mobile
npm install
```

### 2. 运行Android
```bash
npx react-native run-android
```

### 3. 运行iOS (仅Mac)
```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

## 核心功能

- 🏠 首页 - 金刚区入口、服务商推荐、我的工地胶囊
- 🔍 发现 - 搜索设计师、装修公司
- 🏗️ 工地 - 项目进度、施工日志
- 💬 消息 - IM聊天
- 👤 我的 - 个人中心、订单、收藏
