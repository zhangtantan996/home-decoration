# Docker 配置

**最后更新**: 2026-01-25

本项目使用 Docker 和 Docker Compose 进行容器化部署和开发环境搭建。通过容器化技术，确保了开发、测试和生产环境的一致性。

## Docker Compose 配置

项目根目录和 `deploy/` 目录下提供了多个 Docker Compose 配置文件，以适应不同的使用场景：

| 配置文件 | 场景 | 说明 |
| :--- | :--- | :--- |
| `docker-compose.yml` | 通用/测试 | 标准的多服务配置，包含数据库、Redis、API 和 Web。 |
| `docker-compose.local.yml` | 本地全栈开发 | 支持后端代码热更新（通过 `Dockerfile.api.dev`）和前端开发服务器（Vite）。 |
| `docker-compose.dev-env.yml` | 基础环境 | 仅启动 PostgreSQL 和 Redis，适用于在宿主机直接运行后端和前端代码的情况。 |
| `deploy/docker-compose.prod.yml` | 生产环境 | 针对生产环境优化，使用环境变量配置敏感信息，前端使用 Nginx 托管静态文件。 |

### 生产环境配置示例 (`deploy/docker-compose.prod.yml`)

```yaml
version: '3.8'
services:
  db:
    image: postgres:15-alpine
    container_name: prod_db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD not set}
      POSTGRES_DB: ${DB_NAME:-home_decoration}
    volumes:
      - db_data_prod:/var/lib/postgresql/data
    networks:
      - prod-net

  redis:
    image: redis:6.2-alpine
    container_name: prod_redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD not set}
    volumes:
      - redis_data_prod:/data
    networks:
      - prod-net

  api:
    build:
      context: ../
      dockerfile: deploy/Dockerfile.backend
    container_name: prod_api
    restart: always
    environment:
      - SERVER_MODE=release
      - DB_HOST=db
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
      - redis
    networks:
      - prod-net

  web:
    build:
      context: ../
      dockerfile: deploy/Dockerfile.frontend
    container_name: prod_web
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    networks:
      - prod-net

volumes:
  db_data_prod:
  redis_data_prod:

networks:
  prod-net:
    driver: bridge
```

## 各服务配置

### PostgreSQL (db)
- **镜像**: `postgres:15-alpine`
- **用途**: 核心业务数据存储。
- **配置重点**:
    - 生产环境必须通过 `DB_PASSWORD` 环境变量设置强密码。
    - 默认数据库名为 `home_decoration`。
    - 内部端口 5432。
    - 本地开发通常将宿主机端口 5432 映射到容器 5432。

### Redis (redis)
- **镜像**: `redis:6.2-alpine`
- **用途**: 缓存、验证码存储及会话管理。
- **配置重点**:
    - 生产环境必须开启密码校验（`--requirepass`）。
    - 内部端口 6379，本地开发映射端口通常为 6380。

### API 服务 (api)
- **构建**: 
    - 生产: `deploy/Dockerfile.backend` (多阶段构建，基于 Alpine，移除了调试符号)。
    - 开发: `server/Dockerfile.api.dev` (支持热更新)。
- **依赖**: 依赖 `db` 和 `redis` 服务启动。
- **配置**: 通过环境变量传递数据库连接串、Redis 地址及 JWT 密钥。
- **端口**: 内部端口 8080。

### Admin/Web 服务 (web)
- **构建**: `deploy/Dockerfile.frontend`
- **内容**: 
    - 第一阶段：基于 Node.js 构建 React 管理后台（Vite）静态文件。
    - 第二阶段：基于 Nginx 托管静态文件，并反向代理 API 请求。
- **配置**: 生产环境通过 Nginx 处理 SSL/TLS（443 端口）。
- **注意**: 移动端（React Native）不通过 Docker 部署，需使用 Android Studio 或 Xcode。

## 数据持久化

### Volumes 映射

为了保证容器重启或销毁后数据不丢失，必须配置数据卷映射：

1.  **数据库持久化**:
    - 生产环境: 使用具名卷 `db_data_prod` 映射到 `/var/lib/postgresql/data`。
    - 本地开发: 通常映射到本地目录 `./db_data_local` 以方便查看和备份。
2.  **Redis 持久化**:
    - 使用具名卷 `redis_data` 映射到 `/data`。

### 备份建议

1.  **数据库备份**: 建议定期在宿主机运行 `docker exec` 执行 `pg_dump`。
    ```bash
    docker exec prod_db pg_dump -U postgres home_decoration > backup_$(date +%F).sql
    ```
2.  **卷备份**: 可以定期停止容器并对 `/var/lib/docker/volumes` 下的相关目录进行物理备份。
3.  **云服务推荐**: 在生产环境中，强烈建议使用阿里云 RDS 等托管数据库服务，自带多可用区高可用和自动备份功能。
