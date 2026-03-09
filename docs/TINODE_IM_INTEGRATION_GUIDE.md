仅反映当时路径，不代表当前正式发布规范。当前正式业务 schema 发布目录以 `server/migrations/` 为准；专题脚本仍按各自文档执行。

# Tinode IM 集成实施方案

> **文档版本**: v1.0.0
> **创建日期**: 2026-01-22
> **适用项目**: 家装设计平台 - 设计师与客户沟通系统
> **技术栈**: Go 1.23 + React Native 0.83 + PostgreSQL 15

---

## 📋 执行摘要

本文档提供了将 **Tinode 开源 IM 系统**集成到现有家装平台的完整技术方案，替代当前的双 IM 架构（自研 WebSocket + 腾讯云 IM），实现**成本降低 85%**（从 ¥20,000/年 降至 ¥3,000/年），同时保持完整功能并提升可控性。

**预计开发周期**: 4 周
**技术风险**: 低（Tinode 已在生产环境验证，12k+ GitHub Stars）
**投资回报**: 第一年节省 ¥17,000，并获得 100% 代码控制权

---

## 📋 目录

- [1. 项目背景](#1-项目背景)
- [2. 技术选型](#2-技术选型)
- [3. 架构设计](#3-架构设计)
- [4. 数据库设计](#4-数据库设计)
- [5. 后端集成](#5-后端集成)
- [6. 前端集成](#6-前端集成)
- [7. 部署方案](#7-部署方案)
- [8. 测试验证](#8-测试验证)
- [9. 常见问题](#9-常见问题)
- [10. 参考资源](#10-参考资源)

---

## 1. 项目背景

### 1.1 业务需求

**核心场景**: 设计师/工长/装修公司 ↔ 业主客户的实时沟通

**功能需求**:
- ✅ 一对一聊天（设计师 ↔ 客户）
- ✅ 文本消息（支持 Emoji）
- ✅ 图片分享（案例图、现场照片）
- ✅ 文件传输（报价单、合同 PDF）
- ✅ 已读回执
- ✅ 离线消息推送（iOS APNs + Android FCM）
- ✅ 消息历史记录
- ⏳ 消息撤回（2分钟内）
- ⏳ 语音消息（60秒内）
- ⏳ 视频通话（后期扩展）

### 1.2 现状问题

**当前系统存在的严重问题**:

| 问题 | 影响 | 严重程度 |
|------|------|---------|
| **架构冗余** | 自研 WebSocket（后端 Go）+ 腾讯云 IM SDK（前端）双系统并存 | 🔴 P0 |
| **数据割裂** | 消息分别存储在 PostgreSQL 和腾讯云，无法统一管理 | 🔴 P0 |
| **成本高** | 腾讯云 IM 收费约 ¥20,000/年 | 🟡 P1 |
| **功能受限** | 腾讯云 IM 无法深度定制（如消息加密、敏感词过滤） | 🟡 P1 |
| **维护困难** | 需要同时维护两套系统的用户体系、消息同步 | 🟡 P1 |

**代码示例（当前混乱状态）**:

```typescript
// mobile/src/screens/MessageScreen.tsx
import TencentIMService from '../services/TencentIMService';  // 腾讯云 IM

// 但后端有完整的 WebSocket 实现
// server/internal/ws/* - 未被使用！
```

### 1.3 解决方案对比

| 对比项 | 腾讯云 IM | Tinode（推荐） | 自研 WebSocket（现有） |
|-------|----------|---------------|---------------------|
| **技术栈** | 黑盒（不可控） | **Go（完全匹配）** | Go（需完善） |
| **移动端 SDK** | React Native SDK | **React Native SDK** | 无（需自研） |
| **数据库** | 腾讯云私有 | **PostgreSQL（已使用）** | PostgreSQL |
| **成本** | ¥20,000/年 | **¥0（开源）** | ¥0 |
| **定制性** | 受限 | **100% 可控** | 100% 可控 |
| **多端同步** | ✅ 支持 | **✅ 支持** | ❌ 未实现 |
| **离线推送** | ✅ 支持 | **✅ 支持** | ❌ 未实现 |
| **开发周期** | 已集成 | **4 周** | 8-12 周 |
| **社区支持** | 官方文档 | **12k+ Stars** | 无 |

**推荐方案**: **Tinode** - 平衡了成本、功能、开发周期

---

## 2. 技术选型

### 2.1 Tinode 简介

- **项目地址**: [github.com/tinode/chat](https://github.com/tinode/chat)
- **官网**: [tinode.co](https://tinode.co)
- **Star 数**: 12,000+
- **开发语言**: Go 1.21+
- **协议**: GPL 3.0（允许商用，需开源修改部分）
- **最新版本**: v0.23.x（2024 年 12 月更新）

### 2.2 核心特性清单

```
✅ 纯 Go 实现（与现有后端技术栈一致）
✅ WebSocket + gRPC 双协议（高性能）
✅ 支持 PostgreSQL/MySQL/MongoDB
✅ 多端同步（移动端 + Web + 桌面）
✅ 离线消息存储
✅ 推送通知（FCM + APNs）
✅ 权限控制（公开/私有会话，细粒度权限）
✅ 文件传输（内置文件服务器或集成 OSS）
✅ 已读状态（精确到每条消息）
✅ 在线状态（实时更新）
✅ 群聊支持（最多 200 人）
✅ 自定义认证（复用现有 JWT）
✅ 消息搜索（全文索引）
✅ 视频通话集成（WebRTC）
```

### 2.3 技术架构图

```
┌────────────────────────────────────────────────────┐
│                  Tinode 技术架构                    │
├────────────────────────────────────────────────────┤
│ 客户端层     │ React Native SDK / Web SDK         │
│              │ (tinode-sdk npm package)           │
├────────────────────────────────────────────────────┤
│ 协议层       │ WebSocket (实时) / gRPC (API)      │
│              │ JSON over WebSocket                │
├────────────────────────────────────────────────────┤
│ 服务层       │ Go Server (支持水平扩展)            │
│              │ - Hub (消息分发)                   │
│              │ - Store (存储抽象层)                │
│              │ - Push (推送服务)                  │
├────────────────────────────────────────────────────┤
│ 存储层       │ PostgreSQL (消息/用户)             │
│              │ Redis (在线状态/会话缓存)           │
├────────────────────────────────────────────────────┤
│ 推送层       │ FCM (Android)                      │
│              │ APNs (iOS)                         │
└────────────────────────────────────────────────────┘
```

---

## 3. 架构设计

### 3.1 整体系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户端                                  │
├──────────────┬──────────────────────────────────────────────┤
│ iOS App      │ Android App         │ Web (管理后台)          │
│ React Native │ React Native        │ React 18.3.1           │
└──────┬───────┴───────┬─────────────┴──────┬─────────────────┘
       │               │                    │
       │  ┌────────────┴────────────┐       │
       └──┤   Tinode SDK (RN)       │───────┘
          └────────────┬────────────┘
                       │ WebSocket (wss://api.domain.com/tinode/ws)
       ┌───────────────┴────────────────────┐
       │     Tinode Go Server (Port 6061)   │
       │  ┌──────────────────────────────┐  │
       │  │  Hub (消息分发中心)           │  │
       │  │  - Register/Unregister        │  │
       │  │  - Broadcast                  │  │
       │  ├──────────────────────────────┤  │
       │  │  Store (数据存储层)           │  │
       │  │  - PostgreSQL Adapter         │  │
       │  ├──────────────────────────────┤  │
       │  │  Push (离线推送)              │  │
       │  │  - FCM / APNs                 │  │
       │  └──────────────────────────────┘  │
       └───────────────┬────────────────────┘
                       │
       ┌───────────────┴────────────────────┐
       │      数据存储层                     │
       ├────────────────┬────────────────────┤
       │  PostgreSQL    │  Redis Cache       │
       │  (消息/用户)    │  (在线状态/会话)    │
       │  - users       │  - online_users    │
       │  - topics      │  - session_cache   │
       │  - messages    │                    │
       │  - subscriptions│                   │
       └────────────────┴────────────────────┘
              │
       ┌──────┴──────┐
       │  现有后端 API │ (Port 8080)
       │  Go + Gin    │
       │  - JWT 认证   │
       │  - 业务逻辑   │
       └──────────────┘
```

### 3.2 集成策略对比

#### 方案 A: 独立部署 Tinode（✅ 推荐快速上线）

```yaml
优势:
✅ 快速部署（1-2 天完成 POC）
✅ 功能完整（无需开发）
✅ 官方持续更新（安全补丁、新功能）
✅ 社区支持（遇到问题可求助）

劣势:
⚠️ 需要维护两套 Go 服务（现有后端 + Tinode）
⚠️ 用户体系需要同步（额外开发同步逻辑）

适用场景:
- 快速上线（1 个月内）
- 团队对 Tinode 不熟悉
- 希望保持系统稳定性
```

#### 方案 B: 融合到现有后端（⏳ 推荐长期维护）

```yaml
优势:
✅ 统一服务（单一后端，运维简单）
✅ 用户体系一致（无需同步）
✅ 更容易定制（直接修改代码）
✅ 节省服务器资源（单进程）

劣势:
⚠️ 开发周期长（2-3 周代码适配）
⚠️ 需要深入理解 Tinode 源码
⚠️ 升级困难（需手动 merge 上游更新）

适用场景:
- 长期项目（2+ 年）
- 有专职 Go 开发者
- 需要深度定制（如端到端加密）
```

**本文档采用方案 A（独立部署）**

---

## 4. 数据库设计

### 4.1 Tinode 核心表结构

#### 4.1.1 users 表（用户）

```sql
-- Tinode 原生用户表
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    state INT NOT NULL DEFAULT 0,  -- 0:正常 1:禁用
    stateat TIMESTAMP,

    -- 基础信息
    public JSONB,     -- 公开资料 {"fn": "昵称", "photo": "头像URL"}
    trusted JSONB,    -- 可信资料（如手机号）
    tags TEXT[],      -- 标签（如 "designer", "customer"）

    -- 认证
    passhash BYTEA,   -- 密码哈希（如果使用密码登录）

    -- 设备
    deviceids TEXT[]  -- 推送设备 Token
);

CREATE INDEX idx_users_state ON users(state);
CREATE INDEX idx_users_tags ON users USING gin(tags);

-- 示例数据
INSERT INTO users (id, public, trusted, tags) VALUES
(1, '{"fn": "李明设计师", "photo": "https://cdn.example.com/avatar/1.jpg"}', '{"tel": "13800138000"}', ARRAY['designer']),
(2, '{"fn": "王女士", "photo": "https://cdn.example.com/avatar/2.jpg"}', '{"tel": "13900139000"}', ARRAY['customer']);
```

#### 4.1.2 topics 表（会话主题）

```sql
-- 会话表（一对一会话格式: usrXXX_usrYYY）
CREATE TABLE topics (
    id BIGSERIAL PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 主题名称（会话ID）
    name VARCHAR(255) NOT NULL UNIQUE,  -- "usr1_usr2"

    -- 访问控制
    access JSONB,     -- {"auth": "JRWPS", "anon": "N"}
                      -- J: Join, R: Read, W: Write, P: Presence, S: Share
    owner BIGINT,

    -- 元数据
    public JSONB,     -- 公开信息
    trusted JSONB,    -- 私有信息
    tags TEXT[],

    -- 最后消息
    seqid INT NOT NULL DEFAULT 0,  -- 最新消息序列号
    touchedat TIMESTAMP            -- 最后活跃时间
);

CREATE INDEX idx_topics_name ON topics(name);
CREATE INDEX idx_topics_owner ON topics(owner);
CREATE INDEX idx_topics_touchedat ON topics(touchedat DESC);

-- 示例数据（李明设计师 ↔ 王女士的会话）
INSERT INTO topics (name, access, seqid, touchedat) VALUES
('usr1_usr2', '{"auth": "JRWPS", "anon": "N"}', 0, NOW());
```

#### 4.1.3 messages 表（消息）

```sql
-- 消息表
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 会话信息
    topic VARCHAR(255) NOT NULL,  -- 关联 topics.name
    from_user BIGINT NOT NULL,    -- 发送者 user.id

    -- 消息内容
    head JSONB,        -- 消息头（元数据，如 MIME 类型）
    content JSONB,     -- 消息体 {"txt": "文本", "fmt": [格式]}

    -- 序列号（用于排序和已读状态）
    seqid INT NOT NULL,

    -- 删除标记
    delid INT DEFAULT 0,
    deletedfor TEXT[]  -- 已删除该消息的用户列表
);

CREATE INDEX idx_messages_topic_seqid ON messages(topic, seqid DESC);
CREATE INDEX idx_messages_topic_createdat ON messages(topic, createdat DESC);
CREATE INDEX idx_messages_from_user ON messages(from_user);

-- 示例数据
INSERT INTO messages (topic, from_user, content, seqid) VALUES
('usr1_usr2', 1, '{"txt": "您好，我想了解一下装修方案", "fmt": null}', 1),
('usr1_usr2', 2, '{"txt": "您好！我可以为您提供专业的设计服务", "fmt": null}', 2);
```

#### 4.1.4 subscriptions 表（订阅关系）

```sql
-- 订阅表（用户 ↔ 会话的关系）
CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 关系
    topic VARCHAR(255) NOT NULL,
    user_id BIGINT NOT NULL,

    -- 权限
    modewant VARCHAR(32),   -- 期望权限 "JRWPS"
    modegiven VARCHAR(32),  -- 实际权限 "JRWPS"

    -- 已读状态
    readseqid INT DEFAULT 0,    -- 已读到的消息序列号
    recvseqid INT DEFAULT 0,    -- 已接收的消息序列号

    -- 清除状态
    clearid INT DEFAULT 0,      -- 清除历史消息的序列号

    -- 用户资料（在该会话中的昵称/头像）
    private JSONB,

    UNIQUE(topic, user_id)
);

CREATE INDEX idx_subs_topic ON subscriptions(topic);
CREATE INDEX idx_subs_user ON subscriptions(user_id);
CREATE INDEX idx_subs_user_updated ON subscriptions(user_id, updatedat DESC);

-- 示例数据（李明 和 王女士 都订阅了会话）
INSERT INTO subscriptions (topic, user_id, modewant, modegiven, readseqid) VALUES
('usr1_usr2', 1, 'JRWPS', 'JRWPS', 2),  -- 李明已读到第 2 条消息
('usr1_usr2', 2, 'JRWPS', 'JRWPS', 2);  -- 王女士已读到第 2 条消息
```

### 4.2 与现有系统的映射关系

**现有表 → Tinode 表映射**:

| 现有表 | Tinode 表 | 映射方式 | 说明 |
|--------|----------|---------|------|
| `users` | `users` | 保留现有表，Tinode 用户 ID = `usr{user.id}` | 不需要删除现有 users 表 |
| `conversations` | `topics` | 迁移会话数据，ID 格式统一为 `usr{id1}_usr{id2}` | 历史会话可迁移 |
| `chat_messages` | `messages` | 迁移历史消息，重新生成 seqid | 历史消息可迁移 |
| - | `subscriptions` | 新增（记录用户订阅关系） | 从 conversations 生成 |

### 4.3 数据迁移脚本

```sql
-- 文件（历史示意，当前请查看目录说明）: server/scripts/topics/tinode/README.md

-- ============================================================
-- 数据迁移脚本：现有系统 → Tinode
-- 执行前请备份数据库！
-- ============================================================

BEGIN;

-- 1. 同步用户数据到 Tinode users 表
INSERT INTO users (id, createdat, updatedat, state, public, trusted, tags)
SELECT
    u.id,
    u.created_at,
    u.updated_at,
    CASE WHEN u.status = 1 THEN 0 ELSE 1 END AS state,  -- 状态映射
    jsonb_build_object(
        'fn', COALESCE(u.nickname, '用户' || u.id),
        'photo', COALESCE(u.avatar, 'https://via.placeholder.com/100')
    ) AS public,
    jsonb_build_object(
        'tel', u.phone
    ) AS trusted,
    CASE
        WHEN u.user_type = 2 THEN ARRAY['designer']  -- 设计师
        WHEN u.user_type = 3 THEN ARRAY['worker']    -- 工长
        ELSE ARRAY['customer']                       -- 普通用户
    END AS tags
FROM users AS u
ON CONFLICT (id) DO UPDATE SET
    updatedat = EXCLUDED.updatedat,
    public = EXCLUDED.public,
    trusted = EXCLUDED.trusted,
    tags = EXCLUDED.tags;

-- 2. 迁移会话数据到 Tinode topics 表
INSERT INTO topics (name, createdat, updatedat, seqid, touchedat, access)
SELECT
    c.id AS name,  -- 使用原会话 ID（格式: "1_2"）
    c.created_at,
    c.updated_at,
    0 AS seqid,    -- 初始序列号（后续会更新）
    c.last_message_time,
    jsonb_build_object(
        'auth', 'JRWPS',  -- 认证用户有完整权限
        'anon', 'N'       -- 匿名用户无权限
    ) AS access
FROM conversations c
ON CONFLICT (name) DO UPDATE SET
    updatedat = EXCLUDED.updatedat,
    touchedat = EXCLUDED.touchedat;

-- 3. 创建订阅关系（每个会话有两个订阅）
INSERT INTO subscriptions (topic, user_id, createdat, updatedat, modewant, modegiven, readseqid, recvseqid)
SELECT
    c.id AS topic,
    CAST(c.user1_id AS BIGINT) AS user_id,
    c.created_at,
    c.updated_at,
    'JRWPS' AS modewant,
    'JRWPS' AS modegiven,
    CASE WHEN c.user1_unread = 0 THEN 999999 ELSE 0 END AS readseqid,  -- 已读则设置大值
    0 AS recvseqid
FROM conversations c
UNION ALL
SELECT
    c.id AS topic,
    CAST(c.user2_id AS BIGINT) AS user_id,
    c.created_at,
    c.updated_at,
    'JRWPS' AS modewant,
    'JRWPS' AS modegiven,
    CASE WHEN c.user2_unread = 0 THEN 999999 ELSE 0 END AS readseqid,
    0 AS recvseqid
FROM conversations c
ON CONFLICT (topic, user_id) DO NOTHING;

-- 4. 迁移消息数据
INSERT INTO messages (topic, from_user, createdat, content, seqid, head)
SELECT
    cm.conversation_id AS topic,
    CAST(cm.sender_id AS BIGINT) AS from_user,
    cm.created_at,
    -- 构建消息内容
    CASE
        WHEN cm.msg_type = 1 THEN  -- 文本消息
            jsonb_build_object('txt', cm.content)
        WHEN cm.msg_type = 2 THEN  -- 图片消息
            jsonb_build_object(
                'txt', '[图片]',
                'ent', jsonb_build_array(
                    jsonb_build_object(
                        'tp', 'IM',
                        'data', jsonb_build_object(
                            'mime', 'image/jpeg',
                            'val', cm.content  -- 图片 URL
                        )
                    )
                )
            )
        ELSE
            jsonb_build_object('txt', cm.content)
    END AS content,
    -- 生成序列号（按时间排序）
    ROW_NUMBER() OVER (PARTITION BY cm.conversation_id ORDER BY cm.created_at) AS seqid,
    -- 消息头（空）
    NULL AS head
FROM chat_messages cm
ORDER BY cm.conversation_id, cm.created_at;

-- 5. 更新 topics 的最新序列号
UPDATE topics t
SET seqid = (
    SELECT COALESCE(MAX(seqid), 0)
    FROM messages m
    WHERE m.topic = t.name
);

-- 6. 更新 subscriptions 的接收序列号
UPDATE subscriptions s
SET recvseqid = (
    SELECT COALESCE(MAX(seqid), 0)
    FROM messages m
    WHERE m.topic = s.topic
);

COMMIT;

-- 验证迁移结果
SELECT '用户数量' AS item, COUNT(*) AS count FROM users
UNION ALL
SELECT '会话数量', COUNT(*) FROM topics
UNION ALL
SELECT '订阅关系', COUNT(*) FROM subscriptions
UNION ALL
SELECT '消息数量', COUNT(*) FROM messages;
```

---

## 5. 后端集成

### 5.1 快速部署 Tinode（Docker 方式）

#### Step 1: 创建 Docker Compose 配置

```yaml
# docker-compose.tinode.yml
version: '3.8'

services:
  tinode:
    image: tinode/tinode-postgres:latest
    container_name: tinode-server
    ports:
      - "6060:6060"  # gRPC API
      - "6061:6061"  # WebSocket
    environment:
      # 数据库连接（使用现有 PostgreSQL）
      - POSTGRES_HOST=db
      - POSTGRES_PORT=5432
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DATABASE=tinode

      # JWT 密钥（与现有后端统一）
      - JWT_SECRET=${JWT_SECRET}

      # 推送配置
      - FCM_SERVER_KEY=${FCM_SERVER_KEY}          # Android 推送
      - APNS_CERT_FILE=/certs/apns.p12            # iOS 推送证书
      - APNS_KEY_PASSWORD=${APNS_KEY_PASSWORD}

      # 其他配置
      - TINODE_LISTEN=:6060
      - TINODE_GRPC_LISTEN=:6061

    volumes:
      - ./server/tinode-data:/data                # 数据目录
      - ./server/certs:/certs:ro                  # 证书目录（只读）
      - ./server/scripts/tinode.conf:/tinode.conf # 自定义配置

    depends_on:
      - db
    restart: unless-stopped
    networks:
      - app-network

  db:
    image: postgres:15-alpine
    # ... (使用现有数据库配置)

networks:
  app-network:
    external: true  # 使用现有网络
```

#### Step 2: 创建自定义配置文件

```json
// server/scripts/tinode.conf

{
  "listen": ":6060",
  "grpc_listen": ":6061",
  "api_path": "/",
  "cache_control": 39600,

  // 数据库配置
  "store_config": {
    "use_adapter": "postgres",
    "postgres": {
      "dsn": "postgres://postgres:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/tinode?sslmode=disable",
      "database": "tinode"
    }
  },

  // 认证配置
  "auth_config": {
    "token": {
      "key": "${JWT_SECRET}",
      "expire_in": 604800  // 7 天
    },
    "basic": {
      "add_to_tags": true
    }
  },

  // 推送通知配置
  "push": [
    {
      "name": "fcm",
      "config": {
        "enabled": true,
        "credentials": {
          "api_key": "${FCM_SERVER_KEY}"
        },
        "time_to_live": 3600,
        "android": {
          "enabled": true,
          "icon": "ic_notification",
          "color": "#D4AF37"
        }
      }
    },
    {
      "name": "apns",
      "config": {
        "enabled": true,
        "cert_file": "/certs/apns.p12",
        "key_password": "${APNS_KEY_PASSWORD}",
        "bundle_id": "com.homeDecoration.app",
        "production": false  // 开发环境，生产环境改为 true
      }
    }
  ],

  // 限制配置
  "max_message_size": 4194304,      // 4MB
  "max_subscriber_count": 32,       // 每个会话最多 32 人
  "max_tag_count": 16,
  "max_tag_length": 96,

  // 媒体上传配置
  "media": {
    "use_handler": "fs",            // 使用文件系统存储（也可改为 s3）
    "max_size": 10485760,           // 10MB
    "gc_period": 60,
    "gc_block_size": 100,
    "handlers": {
      "fs": {
        "upload_dir": "/data/uploads"
      }
    }
  },

  // TLS 配置（生产环境启用）
  "tls": {
    "enabled": false,
    "cert_file": "/certs/server.crt",
    "key_file": "/certs/server.key"
  }
}
```

#### Step 3: 启动服务

```bash
#!/bin/bash
# scripts/start_tinode.sh

set -e

echo "🚀 启动 Tinode IM 系统..."

# 1. 创建必要的目录
mkdir -p server/tinode-data/uploads
mkdir -p server/certs

# 2. 创建 Tinode 数据库
echo "📦 创建 Tinode 数据库..."
docker-compose exec db psql -U postgres -c "CREATE DATABASE IF NOT EXISTS tinode;" || true

# 3. 启动 Tinode 服务
echo "🔧 启动 Tinode 容器..."
docker-compose -f docker-compose.tinode.yml up -d

# 4. 等待服务就绪
echo "⏳ 等待 Tinode 启动（30 秒）..."
sleep 30

# 5. 健康检查
echo "🏥 健康检查..."
if curl -f http://localhost:6060/v0/version; then
    echo "✅ Tinode 启动成功！"
    echo ""
    echo "📱 WebSocket 地址: ws://localhost:6061"
    echo "🌐 HTTP API 地址: http://localhost:6060"
    echo "📖 API 文档: http://localhost:6060/x/tos.html"
else
    echo "❌ Tinode 启动失败，请检查日志："
    docker-compose -f docker-compose.tinode.yml logs tinode
    exit 1
fi

# 6. 运行数据迁移（可选）
read -p "是否运行数据迁移？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📊 运行数据迁移..."
    查看 `server/scripts/topics/tinode/README.md` 中的专题脚本说明，再按实际脚本执行
    echo "✅ 数据迁移完成！"
fi
```

**执行启动脚本**:

```bash
chmod +x scripts/start_tinode.sh
./scripts/start_tinode.sh
```

### 5.2 集成现有认证系统

Tinode 支持**自定义认证**，可以复用现有的 JWT Token，无需用户重新登录。

#### 方案：Token 认证（推荐）

创建认证适配器，在用户登录时同时生成 Tinode Token：

```go
// server/internal/tinode/auth_adapter.go

package tinode

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "time"

    "home-decoration-server/internal/model"
    "home-decoration-server/internal/repository"
)

// TinodeAuthAdapter Tinode 认证适配器
type TinodeAuthAdapter struct {
    jwtSecret string
    db        *repository.Database
}

// NewTinodeAuthAdapter 创建认证适配器
func NewTinodeAuthAdapter(secret string, db *repository.Database) *TinodeAuthAdapter {
    return &TinodeAuthAdapter{
        jwtSecret: secret,
        db:        db,
    }
}

// GenerateTinodeToken 为用户生成 Tinode Token
// 注意：Tinode Token 格式与标准 JWT 相同，但 sub 必须是 "usr{id}" 格式
func (a *TinodeAuthAdapter) GenerateTinodeToken(userID uint) (string, error) {
    // JWT Header
    header := map[string]string{
        "alg": "HS256",
        "typ": "JWT",
    }

    // JWT Payload
    payload := map[string]interface{}{
        "iss": "home-decoration",                    // 签发者
        "sub": fmt.Sprintf("usr%d", userID),         // 用户 ID（Tinode 格式）
        "iat": time.Now().Unix(),                    // 签发时间
        "exp": time.Now().Add(7 * 24 * time.Hour).Unix(), // 7 天过期
    }

    // 编码 Header
    headerJSON, _ := json.Marshal(header)
    headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

    // 编码 Payload
    payloadJSON, _ := json.Marshal(payload)
    payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)

    // 生成签名
    message := headerB64 + "." + payloadB64
    mac := hmac.New(sha256.New, []byte(a.jwtSecret))
    mac.Write([]byte(message))
    signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

    return message + "." + signature, nil
}

// SyncUserToTinode 同步用户到 Tinode
// 在用户注册或更新资料时调用
func (a *TinodeAuthAdapter) SyncUserToTinode(user *model.User) error {
    // 构建 Tinode 用户数据
    publicData := map[string]interface{}{
        "fn":    user.Nickname,
        "photo": user.Avatar,
    }
    trustedData := map[string]interface{}{
        "tel": user.Phone,
    }
    tags := []string{}
    if user.UserType == 2 {
        tags = append(tags, "designer")
    } else if user.UserType == 3 {
        tags = append(tags, "worker")
    } else {
        tags = append(tags, "customer")
    }

    publicJSON, _ := json.Marshal(publicData)
    trustedJSON, _ := json.Marshal(trustedData)

    // 插入或更新 Tinode users 表
    query := `
        INSERT INTO users (id, createdat, updatedat, state, public, trusted, tags)
        VALUES ($1, NOW(), NOW(), 0, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
            updatedat = NOW(),
            public = $2,
            trusted = $3,
            tags = $4
    `
    _, err := a.db.Exec(query, user.ID, publicJSON, trustedJSON, tags)
    return err
}
```

#### 在登录接口中使用

```go
// server/internal/handler/auth_handler.go

func (h *AuthHandler) Login(c *gin.Context) {
    var req LoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.Error(c, "参数错误")
        return
    }

    // 1. 验证用户名密码
    user, err := h.userService.Login(req.Phone, req.Password)
    if err != nil {
        response.Error(c, "用户名或密码错误")
        return
    }

    // 2. 生成现有系统的 JWT Token
    token, err := h.jwtService.GenerateToken(user.ID)
    if err != nil {
        response.Error(c, "生成 Token 失败")
        return
    }

    // 3. 生成 Tinode Token
    tinodeToken, err := h.tinodeAuth.GenerateTinodeToken(user.ID)
    if err != nil {
        log.Printf("⚠️ 生成 Tinode Token 失败: %v", err)
        // 不阻塞登录流程，IM 功能可稍后重试
    }

    // 4. 同步用户到 Tinode
    if err := h.tinodeAuth.SyncUserToTinode(user); err != nil {
        log.Printf("⚠️ 同步用户到 Tinode 失败: %v", err)
    }

    // 5. 返回登录结果
    response.Success(c, gin.H{
        "token":       token,
        "tinodeToken": tinodeToken,  // ✅ 新增
        "user":        user,
    })
}
```

### 5.3 配置 Nginx 反向代理

在现有 Nginx 配置中添加 Tinode 路由：

```nginx
# deploy/nginx.conf

upstream backend {
    server api:8080;
}

upstream tinode_http {
    server tinode:6060;
}

upstream tinode_ws {
    server tinode:6061;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL 证书（生产环境）
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # 现有 API 路由
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Tinode HTTP API
    location /tinode/v0/ {
        proxy_pass http://tinode_http/v0/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Tinode WebSocket（重要：单独配置）
    location /tinode/ws {
        proxy_pass http://tinode_ws/v0/channels;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;  # 24 小时（保持长连接）
    }

    # Tinode 文件上传
    location /tinode/file/ {
        proxy_pass http://tinode_http/v0/file/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        client_max_body_size 10M;  # 允许上传 10MB 文件
    }
}
```

**重启 Nginx 生效**:

```bash
docker-compose restart web
```

---

## 6. 前端集成

### 6.1 安装 Tinode SDK

```bash
cd mobile
npm install tinode-sdk
```

**package.json 依赖**:

```json
{
  "dependencies": {
    "tinode-sdk": "^0.23.0",
    "@react-native-async-storage/async-storage": "^1.x.x"
  }
}
```

### 6.2 创建 Tinode Service

创建统一的 Tinode 服务封装：

```typescript
// mobile/src/services/TinodeService.ts

import { Tinode } from 'tinode-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';

// 配置
const CONFIG = {
    SERVER_URL: __DEV__
        ? 'ws://localhost:6061/v0/channels'  // 开发环境
        : 'wss://api.yourdomain.com/tinode/ws',  // 生产环境
    API_KEY: 'AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K',  // Tinode 默认 API Key
    APP_NAME: 'HomeDecoration',
};

/**
 * Tinode IM 服务（单例）
 */
class TinodeService extends EventEmitter {
    private static instance: TinodeService;
    private tinode: Tinode | null = null;
    private connected: boolean = false;
    private reconnectTimer: NodeJS.Timeout | null = null;

    private constructor() {
        super();
    }

    static getInstance(): TinodeService {
        if (!TinodeService.instance) {
            TinodeService.instance = new TinodeService();
        }
        return TinodeService.instance;
    }

    /**
     * 初始化并连接到 Tinode 服务器
     */
    async init(tinodeToken: string): Promise<boolean> {
        try {
            console.log('[Tinode] 初始化中...');

            // 创建 Tinode 实例
            this.tinode = new Tinode({
                appName: CONFIG.APP_NAME,
                host: CONFIG.SERVER_URL,
                apiKey: CONFIG.API_KEY,
                transport: 'ws',
                secure: !__DEV__,  // 生产环境使用 WSS
            });

            // 绑定事件监听器
            this.tinode.onConnect = this.onConnect.bind(this);
            this.tinode.onDisconnect = this.onDisconnect.bind(this);
            this.tinode.onMessage = this.onMessage.bind(this);

            // 连接到服务器
            await this.tinode.connect();
            console.log('[Tinode] WebSocket 已连接');

            // 使用 Token 登录
            const loginResult = await this.tinode.loginToken(tinodeToken);
            console.log('[Tinode] 登录成功:', loginResult);

            this.connected = true;

            // 订阅 "me" topic（必需，用于接收会话列表）
            const me = this.tinode.getMeTopic();
            await me.subscribe();

            return true;
        } catch (error) {
            console.error('[Tinode] 初始化失败:', error);
            this.connected = false;
            return false;
        }
    }

    /**
     * 连接成功回调
     */
    private onConnect() {
        console.log('[Tinode] ✅ 已连接');
        this.connected = true;
        this.emit('connected');

        // 清除重连定时器
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * 断开连接回调
     */
    private onDisconnect(error?: any) {
        console.log('[Tinode] ❌ 已断开:', error);
        this.connected = false;
        this.emit('disconnected', error);

        // 自动重连（3 秒后）
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => this.reconnect(), 3000);
        }
    }

    /**
     * 收到消息回调
     */
    private onMessage(message: any) {
        console.log('[Tinode] 📩 收到消息:', message);
        this.emit('message', message);
    }

    /**
     * 重新连接
     */
    private async reconnect() {
        if (this.connected) return;

        console.log('[Tinode] 🔄 尝试重连...');

        try {
            const tinodeToken = await AsyncStorage.getItem('tinodeToken');
            if (tinodeToken) {
                await this.init(tinodeToken);
            }
        } catch (error) {
            console.error('[Tinode] 重连失败:', error);
            // 5 秒后再次尝试
            this.reconnectTimer = setTimeout(() => this.reconnect(), 5000);
        }
    }

    /**
     * 获取会话列表
     */
    async getConversationList(): Promise<any[]> {
        if (!this.tinode) {
            console.warn('[Tinode] 未初始化，返回空列表');
            return [];
        }

        try {
            const me = this.tinode.getMeTopic();
            const contacts = me.contacts();

            // 转换为数组并排序（按最后消息时间）
            const list = Object.values(contacts).sort((a: any, b: any) => {
                const aTime = a.touched ? new Date(a.touched).getTime() : 0;
                const bTime = b.touched ? new Date(b.touched).getTime() : 0;
                return bTime - aTime;
            });

            console.log('[Tinode] 会话列表:', list.length);
            return list;
        } catch (error) {
            console.error('[Tinode] 获取会话列表失败:', error);
            return [];
        }
    }

    /**
     * 订阅会话（进入聊天室）
     */
    async subscribeToConversation(topicName: string) {
        if (!this.tinode) throw new Error('Tinode not initialized');

        console.log('[Tinode] 订阅会话:', topicName);

        const topic = this.tinode.getTopic(topicName);

        // 订阅（获取历史消息）
        await topic.subscribe({
            get: {
                data: { limit: 50 }  // 获取最近 50 条消息
            }
        });

        return topic;
    }

    /**
     * 发送文本消息
     */
    async sendTextMessage(topicName: string, text: string): Promise<void> {
        if (!this.tinode) throw new Error('Tinode not initialized');

        const topic = this.tinode.getTopic(topicName);
        await topic.publishMessage(text);

        console.log('[Tinode] 消息已发送:', text.substring(0, 20));
    }

    /**
     * 发送图片消息
     */
    async sendImageMessage(topicName: string, imageUri: string): Promise<void> {
        if (!this.tinode) throw new Error('Tinode not initialized');

        const topic = this.tinode.getTopic(topicName);

        // 1. 上传图片
        const uploadResult = await this.uploadFile(imageUri, 'image/jpeg');

        // 2. 发送图片消息（使用 Drafty 格式）
        await topic.publishMessage({
            txt: '[图片]',
            ent: [{
                tp: 'IM',
                data: {
                    mime: 'image/jpeg',
                    val: uploadResult.url,
                    width: uploadResult.width,
                    height: uploadResult.height,
                }
            }]
        });

        console.log('[Tinode] 图片已发送:', uploadResult.url);
    }

    /**
     * 上传文件到 Tinode 服务器
     */
    private async uploadFile(fileUri: string, mimeType: string): Promise<any> {
        if (!this.tinode) throw new Error('Tinode not initialized');

        // 读取文件（React Native）
        const formData = new FormData();
        formData.append('file', {
            uri: fileUri,
            type: mimeType,
            name: 'upload.' + (mimeType === 'image/jpeg' ? 'jpg' : 'png'),
        } as any);

        // 使用 Tinode 内置上传
        const helper = this.tinode.getLargeFileHelper();
        const result = await helper.upload(formData);

        return result;
    }

    /**
     * 标记消息已读
     */
    async markAsRead(topicName: string, messageSeqId: number): Promise<void> {
        if (!this.tinode) return;

        const topic = this.tinode.getTopic(topicName);
        await topic.noteRead(messageSeqId);

        console.log('[Tinode] 标记已读:', messageSeqId);
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.tinode) {
            this.tinode.disconnect();
            this.tinode = null;
            this.connected = false;
            console.log('[Tinode] 已断开连接');
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * 获取连接状态
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * 获取 Tinode 实例（高级用法）
     */
    getTinode(): Tinode | null {
        return this.tinode;
    }
}

export default TinodeService.getInstance();
```

### 6.3 更新 AuthStore

添加 `tinodeToken` 字段：

```typescript
// mobile/src/store/authStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
    user: any | null;
    token: string | null;
    tinodeToken: string | null;  // ✅ 新增

    setAuth: (user: any, token: string, tinodeToken: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            tinodeToken: null,

            setAuth: (user, token, tinodeToken) => {
                set({ user, token, tinodeToken });
                // 保存 tinodeToken 到 AsyncStorage（供重连使用）
                AsyncStorage.setItem('tinodeToken', tinodeToken);
            },

            logout: () => {
                set({ user: null, token: null, tinodeToken: null });
                AsyncStorage.removeItem('tinodeToken');
            },
        }),
        {
            name: 'auth-storage',
            getStorage: () => AsyncStorage,
        }
    )
);
```

### 6.4 修改登录流程

```typescript
// mobile/src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const LoginScreen = ({ navigation }: any) => {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const setAuth = useAuthStore(state => state.setAuth);

    const handleLogin = async () => {
        if (!phone || !password) {
            Alert.alert('提示', '请输入手机号和密码');
            return;
        }

        setLoading(true);

        try {
            // 调用后端登录接口
            const response = await api.post('/auth/login', { phone, password });

            if (response.data.code === 0) {
                const { token, tinodeToken, user } = response.data.data;

                // 保存认证信息（包含 tinodeToken）
                setAuth(user, token, tinodeToken);

                // 导航到主页
                navigation.replace('Main');
            } else {
                Alert.alert('登录失败', response.data.message);
            }
        } catch (error: any) {
            console.error('登录错误:', error);
            Alert.alert('登录失败', error.message || '网络错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ padding: 20 }}>
            <TextInput
                placeholder="手机号"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
            />
            <TextInput
                placeholder="密码"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button
                title={loading ? '登录中...' : '登录'}
                onPress={handleLogin}
                disabled={loading}
            />
        </View>
    );
};

export default LoginScreen;
```

### 6.5 修改 MessageScreen（会话列表）

```typescript
// mobile/src/screens/MessageScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import TinodeService from '../services/TinodeService';
import { useAuthStore } from '../store/authStore';

const MessageScreen = ({ navigation }: any) => {
    const [conversations, setConversations] = useState<any[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
    const tinodeToken = useAuthStore(state => state.tinodeToken);

    // 初始化 Tinode
    useEffect(() => {
        const initTinode = async () => {
            if (!tinodeToken) {
                console.warn('[MessageScreen] 未找到 Tinode Token');
                return;
            }

            setConnectionStatus('connecting');
            const success = await TinodeService.init(tinodeToken);
            setConnectionStatus(success ? 'connected' : 'disconnected');

            if (success) {
                loadConversations();
            }
        };

        initTinode();

        // 监听连接状态
        TinodeService.on('connected', () => setConnectionStatus('connected'));
        TinodeService.on('disconnected', () => setConnectionStatus('disconnected'));
        TinodeService.on('message', () => loadConversations());  // 收到新消息时刷新列表

        return () => {
            TinodeService.removeAllListeners();
        };
    }, [tinodeToken]);

    // 页面聚焦时刷新
    useFocusEffect(
        useCallback(() => {
            if (connectionStatus === 'connected') {
                loadConversations();
            }
        }, [connectionStatus])
    );

    // 加载会话列表
    const loadConversations = async () => {
        const list = await TinodeService.getConversationList();
        setConversations(list);
    };

    // 渲染会话项
    const renderConversation = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={{ padding: 15, borderBottomWidth: 1, borderColor: '#eee' }}
            onPress={() => navigation.navigate('ChatRoom', {
                topicName: item.topic,
                partnerName: item.public?.fn || '未知用户',
            })}
        >
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.public?.fn}</Text>
            <Text style={{ color: '#666', marginTop: 5 }}>{item.lastMessage?.content?.txt || ''}</Text>
            {item.unread > 0 && (
                <View style={{ position: 'absolute', right: 15, top: 15, backgroundColor: '#D4AF37', borderRadius: 10, padding: 5 }}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>{item.unread}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    // 空状态
    if (connectionStatus === 'connecting') {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#D4AF37" />
                <Text style={{ marginTop: 10 }}>正在连接...</Text>
            </View>
        );
    }

    if (connectionStatus === 'disconnected') {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#999' }}>连接失败，请检查网络</Text>
                <TouchableOpacity onPress={loadConversations} style={{ marginTop: 20, padding: 10, backgroundColor: '#D4AF37', borderRadius: 5 }}>
                    <Text style={{ color: '#fff' }}>重试</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', padding: 20 }}>消息</Text>
            <FlatList
                data={conversations}
                renderItem={renderConversation}
                keyExtractor={(item) => item.topic}
                ListEmptyComponent={
                    <View style={{ padding: 50, alignItems: 'center' }}>
                        <Text style={{ color: '#999' }}>暂无会话</Text>
                    </View>
                }
            />
        </View>
    );
};

export default MessageScreen;
```

### 6.6 修改 ChatRoomScreen（聊天室）

```typescript
// mobile/src/screens/ChatRoomScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import TinodeService from '../services/TinodeService';
import { useAuthStore } from '../store/authStore';

const ChatRoomScreen = ({ route }: any) => {
    const { topicName, partnerName } = route.params;
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [topic, setTopic] = useState<any>(null);
    const currentUser = useAuthStore(state => state.user);
    const flatListRef = useRef<FlatList>(null);

    // 订阅会话
    useEffect(() => {
        const subscribe = async () => {
            try {
                const t = await TinodeService.subscribeToConversation(topicName);
                setTopic(t);

                // 监听新消息
                t.onData = (data: any) => {
                    console.log('[ChatRoom] 收到消息:', data);
                    setMessages(prev => [...prev, data]);
                    // 标记已读
                    TinodeService.markAsRead(topicName, data.seq);
                    // 滚动到底部
                    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
                };

                // 获取历史消息
                const history = t.messages || [];
                setMessages(history);

                // 标记已读
                if (history.length > 0) {
                    const lastSeq = history[history.length - 1].seq;
                    TinodeService.markAsRead(topicName, lastSeq);
                }
            } catch (error) {
                console.error('[ChatRoom] 订阅失败:', error);
            }
        };

        subscribe();

        return () => {
            if (topic) {
                topic.leave();
            }
        };
    }, [topicName]);

    // 发送消息
    const handleSendMessage = async () => {
        if (!inputText.trim() || !topic) return;

        try {
            await TinodeService.sendTextMessage(topicName, inputText.trim());
            setInputText('');
        } catch (error) {
            console.error('[ChatRoom] 发送失败:', error);
        }
    };

    // 渲染消息气泡
    const renderMessage = ({ item }: { item: any }) => {
        const isMe = item.from === `usr${currentUser?.id}`;

        return (
            <View style={{
                padding: 10,
                alignItems: isMe ? 'flex-end' : 'flex-start',
            }}>
                <View style={{
                    backgroundColor: isMe ? '#D4AF37' : '#f0f0f0',
                    padding: 12,
                    borderRadius: 16,
                    maxWidth: '75%',
                }}>
                    <Text style={{ color: isMe ? '#fff' : '#000' }}>
                        {item.content?.txt || '[非文本消息]'}
                    </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 5 }}>
                    {new Date(item.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={{ flex: 1, backgroundColor: '#fff' }}>
                {/* Header */}
                <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#eee' }}>
                    <Text style={{ fontSize: 18, fontWeight: '600' }}>{partnerName}</Text>
                </View>

                {/* 消息列表 */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => String(item.seq)}
                    contentContainerStyle={{ padding: 10 }}
                />

                {/* 输入框 */}
                <View style={{ flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#eee' }}>
                    <TextInput
                        style={{ flex: 1, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 20 }}
                        placeholder="输入消息..."
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity
                        onPress={handleSendMessage}
                        style={{ marginLeft: 10, backgroundColor: '#D4AF37', borderRadius: 20, padding: 10, justifyContent: 'center' }}
                        disabled={!inputText.trim()}
                    >
                        <Text style={{ color: '#fff', fontWeight: '600' }}>发送</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default ChatRoomScreen;
```

---

## 7. 部署方案

### 7.1 生产环境部署清单

```bash
# 1. 环境变量配置
cp .env.example .env.production
vim .env.production  # 填写生产环境配置

# 2. 构建 Docker 镜像
docker-compose -f docker-compose.prod.yml build

# 3. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 4. 验证服务
curl https://api.yourdomain.com/tinode/v0/version
```

### 7.2 监控与日志

```bash
# 查看 Tinode 日志
docker-compose logs -f tinode

# 监控连接数
docker exec tinode curl http://localhost:6060/v0/stats

# 查看资源使用
docker stats tinode
```

---

## 8. 测试验证

### 8.1 功能测试清单

```markdown
## 基础功能
- [ ] 用户登录获取 Tinode Token
- [ ] 移动端连接 Tinode WebSocket
- [ ] 会话列表显示
- [ ] 进入聊天室
- [ ] 发送文本消息
- [ ] 接收文本消息
- [ ] 消息已读状态
- [ ] 未读消息角标

## 进阶功能
- [ ] 发送图片消息
- [ ] 文件上传下载
- [ ] 离线消息推送
- [ ] 网络断开重连
```

---

## 9. 常见问题

### Q1: WebSocket 连接失败？

**排查步骤**:
```bash
# 1. 检查 Tinode 服务状态
docker-compose ps tinode

# 2. 测试端口连通性
telnet api.yourdomain.com 6061

# 3. 查看日志
docker-compose logs tinode | grep ERROR
```

### Q2: Token 认证失败？

**解决方案**:
1. 检查 `JWT_SECRET` 是否一致
2. 验证 Token 格式（必须是 `usr{id}` 格式的 sub）
3. 查看 Tinode 日志中的认证错误

---

## 10. 参考资源

### 官方文档
- **Tinode GitHub**: https://github.com/tinode/chat
- **JavaScript SDK**: https://github.com/tinode/tinode-js
- **API 文档**: https://github.com/tinode/chat/blob/master/docs/API.md

### 示例项目
- **React Native Example**: https://github.com/tinode/example-react-native
- **Web Example**: https://github.com/tinode/webapp

---

## 附录：项目里程碑

```markdown
## 第 1 周：环境搭建与 POC (5 天)
- [ ] Day 1-2: 部署 Tinode 测试环境
- [ ] Day 3: 数据库迁移脚本
- [ ] Day 4: 移动端 SDK 集成测试
- [ ] Day 5: POC 验证（发送/接收消息）

## 第 2 周：核心功能开发 (5 天)
- [ ] Day 1: 用户体系对接（登录返回 tinodeToken）
- [ ] Day 2-3: 会话列表页面开发
- [ ] Day 4-5: 聊天室页面开发

## 第 3 周：高级功能 (5 天)
- [ ] Day 1-2: 图片消息支持
- [ ] Day 3: 已读回执
- [ ] Day 4: 离线推送集成
- [ ] Day 5: Bug 修复

## 第 4 周：测试与上线 (5 天)
- [ ] Day 1-2: 功能测试
- [ ] Day 3: 性能测试
- [ ] Day 4: 灰度发布
- [ ] Day 5: 正式上线
```

---

**文档维护**: 本文档将持续更新

**最后更新**: 2026-01-22
**文档作者**: Claude AI
**审核人**: [待填写]
**版本**: v1.0.0