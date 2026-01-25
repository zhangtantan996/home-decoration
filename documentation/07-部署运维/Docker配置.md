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

在容器化部署中，为了确保容器重启或销毁后数据不丢失，必须配置正确的数据持久化策略。本项目主要涉及数据库数据、缓存数据以及用户上传文件的持久化。

### 持久化方式对比

| 方式 | 场景 | 优点 | 缺点 |
| :--- | :--- | :--- | :--- |
| **具名卷 (Named Volumes)** | 生产环境 (`db_data_prod`) | Docker 管理，性能好，隔离性高。 | 不易直接在宿主机查看文件。 |
| **路径映射 (Bind Mounts)** | 本地开发 (`./db_data_local`) | 方便宿主机直接查看、备份和调试。 | 依赖宿主机文件系统结构。 |

### 1. 数据库持久化 (PostgreSQL)

PostgreSQL 的数据存储在容器内的 `/var/lib/postgresql/data` 目录。

- **开发环境**: 在 `docker-compose.local.yml` 中使用路径映射，将数据保存在项目根目录下的 `db_data_local/` 中，方便开发者查看数据库状态。
- **生产环境**: 在 `deploy/docker-compose.prod.yml` 中使用具名卷 `db_data_prod`，确保数据的稳定性和安全性。

### 2. 缓存持久化 (Redis)

Redis 的数据存储在容器内的 `/data` 目录。

- **配置**: 默认镜像开启了 RDB 持久化。
- **持久化卷**: 建议使用具名卷 `redis_data` 映射到 `/data`。
- **注意**: 虽然 Redis 主要作为缓存使用，但验证码和部分 Session 数据也存储于此，建议配置持久化以防止重启后用户状态丢失。

### 3. 文件上传持久化 (Uploads)

后端服务接收的用户上传文件（如案例图片、用户头像、聊天附件）默认存储在 API 服务容器内的 `/app/uploads` 目录。

- **映射需求**: **必须** 为 `api` 服务配置 `./uploads` 目录的持久化，否则容器更新时所有上传文件将会丢失。
- **配置示例**:
  ```yaml
  services:
    api:
      volumes:
        - ./uploads:/app/uploads
  ```
- **云端方案**: 生产环境下建议通过后端配置使用阿里云 OSS 或腾讯云 COS 等对象存储服务，实现更高的可靠性和 CDN 加速。

### 4. 备份与恢复

#### 数据库定期备份
建议在宿主机配置 Cron 任务，定期执行 `pg_dump`：
```bash
# 备份到宿主机当前目录
docker exec prod_db pg_dump -U postgres home_decoration > backup_$(date +%F).sql
```

#### 数据恢复
如果需要从备份文件恢复数据：
```bash
cat backup_xxx.sql | docker exec -i prod_db psql -U postgres -d home_decoration
```

#### 迁移注意事项
- 在不同环境间迁移数据时，请确保 PostgreSQL 版本一致（本项目固定使用 `15-alpine`）。
- 迁移具名卷时，可以使用 `docker run --rm -v db_data_prod:/from -v $(pwd):/to alpine tar -cvf /to/db_data.tar /from` 进行打包。

### 5. 安全建议
- **不要将数据目录提交到 Git**: 确保 `.gitignore` 中包含 `db_data_local/` 和 `uploads/`。
- **权限控制**: 生产环境下的路径映射应确保宿主机目录权限正确（通常为 700 或 755）。
- **托管服务**: 对于生产环境，强烈推荐使用云厂商提供的托管数据库（如阿里云 RDS），它们自带自动备份、多可用区高可用和专业性能优化。
