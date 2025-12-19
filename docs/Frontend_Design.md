# 装修设计一体化平台 - 前端设计文档

> **文档版本**: v1.2
> **更新日期**: 2024年12月
> **状态**: 原型/开发中

---

## 1. 移动端 (React Native)

已实现核心模块：
- **首页 (Home)**
- **搜索 (Search)**
- **我的工地 (MySite)**
- **消息 (Message)**
- **个人中心 (Profile)**

### 1.1 页面与API映射

| 页面 | 核心组件 | 调用API | 数据流说明 |
|------|---------|---------|-----------|
| **登录/注册** | `AuthScreen` | `POST /auth/login` | 获取JWT存入AsyncStorage |
| **首页** | `HomeScreen` | `GET /designers` (推荐) | 推荐附近服务商 |
| **找服务商** | `ProviderList` | `GET /designers`<br>`GET /companies` | 支持筛选、排序、分页 |
| **服务商详情** | `ProviderDetail` | `GET /designers/:id` | 展示详情、案例、评价 |
| **创建项目** | `CreateProject` | `POST /projects` | 提交需求，生成项目 |
| **我的工地** | `ProjectList` | `GET /projects` | 展示进行中的项目卡片 |
| **工地详情** | `SiteDetail` | `GET /projects/:id` | 聚合显示进度、日志、资金 |
| **施工日志** | `WorkLog` | `GET/POST /logs` | 工长上传，业主查看 |
| **资金托管** | `Escrow` | `GET /escrow`<br>`POST /deposit` | 查看余额，充值阶段款 |

### 1.2 目录结构 (mobile/)

```
src/
├── screens/
│   ├── HomeScreen.tsx       # 首页
│   ├── SearchScreen.tsx     # 找服务商
│   ├── MySiteScreen.tsx     # 我的工地
│   ├── MessageScreen.tsx    # 消息列表
│   └── ProfileScreen.tsx    # 个人中心
├── navigation/
│   └── AppNavigator.tsx     # 路由配置
├── services/
│   └── api.ts               # Axios封装与API定义
└── stores/                  # Zustand状态管理
```

---

## 2. Web 管理后台 (React Admin)

已实现模块：
- **仪表盘 (Dashboard)**
- **项目列表 (Project List)**

### 2.1 页面与API映射

| 页面 | 功能 | 调用API |
|------|------|---------|
| **工作台** | 核心指标 | `GET /statistics` (Mock) |
| **项目管理** | 项目列表/详情 | `GET /projects` |
| **服务商管理** | 审核/列表 | `GET /providers` |
| **财务中心** | 托管账户监控 | `GET /escrow/overview` |

### 2.2 目录结构 (admin/)

```
src/
├── pages/
│   ├── dashboard/           # 工作台
│   ├── projects/            # 项目列表
│   └── user/                # 用户管理
├── services/
│   └── api.ts               # 统一API服务
└── layouts/                 # Ant Design Pro Layout
```

---

## 3. UI 交互与布局规范 (沉浸式)

App 采用沉浸式布局设计，背景颜色穿透状态栏，实现全屏视觉。

### 3.1 状态栏管理 (StatusBar)

- **全局配置**：在 `App.tsx` 中统一配置为 `translucent` 且背景透明。
- **色彩策略**：默认为 `dark-content` (纯白底色配深色图标)，确保在浅色背景下的易读性。

### 3.2 沉浸式布局原则

- **UI 避让机制**：顶部功能性 UI（标题、返回按钮、搜索框）必须预留安全间距（Safe Area Padding）。
  - **Android 适配**: 沉浸式下头部 `paddingTop` 建议为 `44px`。
- **媒体全屏**：页面顶部的实景图、视频容器**不进行**安全区域避让，直接延展至屏幕顶部。

### 3.3 粘性头部 (Sticky Header)

- **实现机制**：利用 `ScrollView` 的 `stickyHeaderIndices` 属性。
- **背景保护**：吸顶组件背景必须不透明，且增加顶部间距（适配状态栏高度），确保在吸顶状态下内容不会与系统状态栏图标重叠。

---

## 4. 业务逻辑与核心流程

### 4.1 资金托管流程 (Escrow)
1. 业主点击"存入资金" -> 弹出金额输入框 -> 调用 `POST /deposit`
2. 资金变动 -> 刷新 `Escrow` 余额显示
3. 节点验收通过 -> 激活"释放资金"按钮 -> 业主确认 -> 调用 `POST /release`