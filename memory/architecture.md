# 架构全局视图

> 最后更新：2026-03-07

## 系统结构

```
home-decoration (monorepo)
├── server/     Go 后端 (Gin + GORM + PostgreSQL + Redis)
├── admin/      管理后台 (React 18.3.1 + Vite + Ant Design 5.x)
├── mobile/     React Native App (RN 0.83 + React 19.2.0, native-only)
├── mini/       微信小程序 (Taro 3.x + React 18.3.1)
└── deploy/     Docker / Nginx 部署配置
```

## 关键架构决策

### React 版本策略（禁止修改）
| 平台 | 版本 | 原因 |
|------|------|------|
| admin | 18.3.1（精确锁定） | Ant Design 5.x 兼容 |
| mobile | 19.2.0 | RN 0.83 支持，利用新特性 |
| mini | 18.3.1 | Taro 3.x 要求 |

### 后端分层（强制，不可跨层）
```
Handler → Service → Repository → Model
```

### 状态管理（全平台统一 Zustand）
- admin: localStorage 持久化
- mobile: SecureStorage/Keychain（token 加密）
- mini: Taro.setStorage

### 认证流程
- admin/mobile: 账密登录 → JWT
- mini: wx.login → code → 后端换 openid → JWT

## 模块边界

| 模块 | 不可触碰 |
|------|----------|
| admin/ | 不引入 Redux/MobX；不升级 React |
| mobile/ | 不做 web build；不降级 React |
| mini/ | 不升级 Taro 主版本；不使用 wx 原生组件替代 Taro 组件 |
| server/ | Handler 不直接查 DB；Service 不直接写 SQL |

## WebSocket（旧）vs IM（新）

| 系统 | 状态 |
|------|------|
| internal/ws/ | 已废弃，仅保留兼容性 |
| 腾讯云 IM | 集成中，新功能优先 |
| Tinode | 备选方案 |

**新聊天功能禁止引用 internal/ws/**
