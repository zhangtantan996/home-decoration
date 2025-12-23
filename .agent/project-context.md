# Home Decoration 项目环境配置

## 技术栈

| 层级 | 技术 |
|------|------|
| **数据库** | PostgreSQL 15 (Alpine) |
| **缓存** | Redis 6.2 (Alpine) |
| **后端** | Go (Gin + GORM) |
| **前端** | React Native (Bare 项目，非 Expo 托管) |
| **Web** | Vite + React Native Web |

---

## Docker 容器

| 容器名 | 镜像 | 端口 |
|--------|------|------|
| `decorating_db` | postgres:15-alpine | 5432:5432 |
| `decorating_redis` | redis:6.2-alpine | 6380:6379 |
| `decorating_api` | (自定义构建) | - |
| `decorating_web` | (自定义构建) | 80:80 |

---

## 数据库连接

```
Host: localhost
Port: 5432
User: postgres
Password: 123456
Database: home_decoration
```

**迁移执行方式**:
```powershell
docker cp "脚本路径" decorating_db:/tmp/
docker exec -it decorating_db psql -U postgres -d home_decoration -f /tmp/脚本名.sql
```

---

## 本地开发端口

| 服务 | 端口 | 命令 |
|------|------|------|
| 后端 API | 8080 | `go run ./cmd/api` |
| Web 前端 | 8082 | `npm run web` |
| Metro (Native) | 8081 | `npm start` |

---

## 注意事项

- 前端是 **Bare React Native**，不是 Expo 托管项目
- `expo-*` 原生库需要手动链接或使用 `npx install-expo-modules`
- 推荐使用纯 RN 原生库（如 `react-native-camera-kit`）
