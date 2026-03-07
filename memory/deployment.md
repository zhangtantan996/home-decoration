# 部署步骤与注意事项

> 最后更新：2026-03-07

---

## 本地开发

### 全栈启动（推荐）
```bash
docker-compose -f docker-compose.local.yml up -d
# 包含：PostgreSQL + Redis + API（热重载）+ Admin（dev server）
```

### 只起基础设施
```bash
docker-compose -f docker-compose.dev-env.yml up -d
# 只起 db + redis，后端和前端本地跑
```

### 服务端口
| 服务 | 端口 |
|------|------|
| PostgreSQL | 5432 |
| Redis | 6380（本地）|
| Backend API | 8080 |
| Admin dev | 5173 |

---

## 各端单独启动

```bash
# 后端（热重载，需要 air）
cd server && make dev

# Admin 前端
cd admin && npm run dev

# Mobile（Metro bundler）
cd mobile && npm start
# iOS: cd mobile && npm run ios
# Android: cd mobile && npm run android

# 微信小程序（生成 dist/ 后用开发者工具导入）
cd mini && npm run dev:weapp
```

---

## 生产部署

### 构建顺序
1. 后端：`deploy/Dockerfile.backend`（多阶段 Go build）
2. Admin：`deploy/Dockerfile.frontend`（Node.js build → Nginx）
3. 启动：`cd deploy && docker-compose -f docker-compose.prod.yml up -d`

### 必须配置的环境变量
```bash
DB_USER / DB_PASSWORD / DB_NAME
REDIS_PASSWORD
JWT_SECRET
SERVER_MODE=release
WECHAT_MINI_APPID / WECHAT_MINI_SECRET（小程序需要）
```

### Android APK
- 用 Android Studio 构建，见 `docs/ANDROID_APK_BUILD_GUIDE.md`

### 微信小程序发布
```bash
cd mini && npm run build:weapp
# 产物在 mini/dist/，用微信开发者工具上传
```

---

## 常用运维命令

```bash
# 查看日志
docker-compose -f docker-compose.local.yml logs -f api

# 重建后端
docker-compose -f docker-compose.local.yml build --no-cache api

# 进入数据库
docker-compose -f docker-compose.local.yml exec db psql -U postgres

# ADB 端口映射（Android 调试）
adb reverse tcp:8080 tcp:8080
adb reverse tcp:8081 tcp:8081
```

---

## 注意事项

- **不要** `docker-compose down -v`，会删所有数据
- Mobile 没有 Docker 支持，只能本地 native 构建
- Mini 没有 Docker 支持，只能用微信开发者工具
- 生产 CORS 必须配白名单，不能用 `*`
