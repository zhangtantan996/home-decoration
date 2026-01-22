# Tinode IM 集成 - 阶段 1 工作计划

> **创建日期**: 2026-01-22
> **预计工期**: 4 周
> **目标**: 使用 Tinode 替换腾讯云 IM，独立部署方式

---

## 工作目标

### 核心目标
替换腾讯云 IM 为 Tinode 开源 IM 系统，实现成本节省和数据自主可控。

### 具体交付物
- ✅ Tinode 服务运行在 Docker 中
- ✅ 移动端使用 Tinode SDK 收发消息
- ✅ 管理后台使用 Tinode Web SDK
- ✅ 用户登录时自动同步到 Tinode
- ✅ 保留腾讯云 IM 代码作为备份
- ✅ 本地 Mac 环境可运行测试

### 必须不做（范围限制）
- ❌ 不删除腾讯云 IM 代码
- ❌ 不删除现有 WebSocket 代码
- ❌ 不迁移历史消息
- ❌ 不添加新功能（仅平替现有功能）
- ❌ 不重构无关代码

---

## 验证策略

### 手动验证（无测试基础设施）

每个 TODO 包含详细的手动验证步骤，使用以下工具：
- **移动端**: React Native 模拟器/真机测试
- **管理后台**: Chrome 浏览器测试
- **后端**: curl 命令测试 API
- **数据库**: psql 命令查询验证
- **Docker**: docker logs 查看日志

---

## 任务流程

```
Task 0 (准备) → Task 1 (Git分支) → Task 2 (数据库) → Task 3 (Docker)
                                                          ↓
Task 7 (验收) ← Task 6 (管理后台) ← Task 5 (移动端) ← Task 4 (后端认证)
```

---

## TODOs

### Task 0: 功能审计（前置任务）

**目标**: 确认腾讯云 IM 当前使用的功能清单

**操作步骤**:
1. 阅读 `mobile/src/services/TencentIMService.ts`
2. 阅读 `mobile/src/hooks/useTencentIM.ts`  
3. 阅读 `mobile/src/screens/MessageScreen.tsx`
4. 阅读 `mobile/src/screens/ChatRoomScreen.tsx`
5. 列出所有调用的 IM 方法

**输出**: 创建 `docs/tinode-feature-parity-checklist.md` 包含：
- 当前使用的功能列表
- Tinode 对应功能映射
- 不支持的功能（标记为 Phase 2）

**验收标准**:
- [ ] 文档已创建
- [ ] 至少包含 10 个功能项
- [ ] 每个功能标注优先级（P0/P1/P2）

**并行性**: NO（必须先完成）

---

### Task 1: 创建 Git 分支

**目标**: 创建功能分支，保持主分支稳定

**操作步骤**:
```bash
cd /Volumes/tantan/AI_project/home-decoration
git checkout -b feature/tinode-im
git push -u origin feature/tinode-im
```

**验收标准**:
- [ ] 分支已创建: `git branch` 显示 `feature/tinode-im`
- [ ] 分支已推送: `git branch -r` 显示 `origin/feature/tinode-im`
- [ ] 当前在新分支: `git rev-parse --abbrev-ref HEAD` 输出 `feature/tinode-im`

**并行性**: NO（后续任务依赖此分支）

---

### Task 2: 设计数据库 Schema

**目标**: 创建 Tinode 所需的数据库表（带 tinode_ 前缀）

**参考文档**: `docs/TINODE_IM_INTEGRATION_GUIDE.md` 第 4 节

**操作步骤**:
1. 创建迁移文件 `server/scripts/migrations/001_create_tinode_tables.sql`
2. 定义表结构（参考集成文档）:
   - `tinode_users` - 用户表
   - `tinode_topics` - 会话表
   - `tinode_messages` - 消息表
   - `tinode_subscriptions` - 订阅关系表
3. 添加索引
4. 创建用户同步触发器（可选）

**SQL 示例**:
```sql
-- tinode_users 表
CREATE TABLE tinode_users (
    id BIGSERIAL PRIMARY KEY,
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    state INT NOT NULL DEFAULT 0,
    public JSONB,
    trusted JSONB,
    tags TEXT[]
);

-- 其他表参考文档...
```

**验收标准**:
- [ ] SQL 文件已创建
- [ ] 包含 4 个核心表定义
- [ ] 包含必要索引
- [ ] SQL 语法正确: `psql -f 001_create_tinode_tables.sql --dry-run`

**并行性**: YES（可与 Task 3 并行）

---

### Task 3: 配置 Tinode Docker 服务

**目标**: 在 Docker Compose 中添加 Tinode 服务

**参考文档**: `docs/TINODE_IM_INTEGRATION_GUIDE.md` 第 5.1 节

**操作步骤**:
1. 创建 `docker-compose.tinode.yml`
2. 定义 Tinode 服务:
   - 镜像: `tinode/tinode-postgres:latest`
   - 端口: 6060 (HTTP), 6061 (WebSocket)
   - 环境变量: 数据库连接、JWT 密钥
3. 创建 Tinode 配置文件 `server/config/tinode.conf`
4. 更新 `.env.example` 添加 Tinode 相关变量

**Docker Compose 示例**:
```yaml
services:
  tinode:
    image: tinode/tinode-postgres:latest
    container_name: tinode-server
    ports:
      - "6060:6060"
      - "6061:6061"
    environment:
      - POSTGRES_HOST=db
      - POSTGRES_DATABASE=home_decoration
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./server/config/tinode.conf:/tinode.conf
    depends_on:
      - db
    networks:
      - app-network
```

**验收标准**:
- [ ] `docker-compose.tinode.yml` 已创建
- [ ] `server/config/tinode.conf` 已创建
- [ ] 启动成功: `docker-compose -f docker-compose.tinode.yml up -d`
- [ ] 健康检查通过: `curl http://localhost:6060/v0/version` 返回版本信息
- [ ] WebSocket 可连接: `wscat -c ws://localhost:6061/v0/channels` 不报错

**并行性**: YES（可与 Task 2 并行）

---

### Task 4: 后端认证集成

**目标**: 在用户登录时生成 Tinode Token 并同步用户

**参考文档**: `docs/TINODE_IM_INTEGRATION_GUIDE.md` 第 5.2 节

**操作步骤**:
1. 创建 `server/internal/tinode/auth_adapter.go`
2. 实现 `GenerateTinodeToken(userID uint) (string, error)`
3. 实现 `SyncUserToTinode(user *model.User) error`
4. 修改 `server/internal/handler/auth_handler.go` 的 Login 方法
5. 在登录响应中添加 `tinodeToken` 字段

**代码示例**:
```go
// auth_handler.go Login 方法中添加
tinodeToken, err := h.tinodeAuth.GenerateTinodeToken(user.ID)
if err != nil {
    log.Printf("生成 Tinode Token 失败: %v", err)
}

// 同步用户
h.tinodeAuth.SyncUserToTinode(user)

// 返回响应
response.Success(c, gin.H{
    "token": token,
    "tinodeToken": tinodeToken,  // 新增
    "user": user,
})
```

**验收标准**:
- [ ] `auth_adapter.go` 已创建
- [ ] 编译通过: `cd server && go build ./cmd/api`
- [ ] 登录测试:
  ```bash
  curl -X POST http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone":"13800138000","password":"test123"}'
  ```
  响应包含 `tinodeToken` 字段
- [ ] 数据库验证: `SELECT * FROM tinode_users WHERE id = 1;` 有数据

**并行性**: NO（依赖 Task 2, 3）

---

### Task 5: 移动端集成 Tinode SDK

**目标**: 替换 TencentIMService 为 TinodeService

**参考文档**: `docs/TINODE_IM_INTEGRATION_GUIDE.md` 第 6 节

**操作步骤**:
1. 安装依赖: `cd mobile && npm install tinode-sdk`
2. 创建 `mobile/src/services/TinodeService.ts`（参考文档示例）
3. 修改 `mobile/src/store/authStore.ts` 添加 `tinodeToken` 字段
4. 修改 `mobile/src/screens/LoginScreen.tsx` 保存 tinodeToken
5. 修改 `mobile/src/screens/MessageScreen.tsx` 使用 TinodeService
6. 修改 `mobile/src/screens/ChatRoomScreen.tsx` 使用 TinodeService
7. **注释掉**（不删除）TencentIMService 的导入和调用

**代码示例**:
```typescript
// MessageScreen.tsx
// import TencentIMService from '../services/TencentIMService';  // 注释掉
import TinodeService from '../services/TinodeService';  // 新增

// 初始化
useEffect(() => {
    const init = async () => {
        const success = await TinodeService.init(tinodeToken);
        if (success) {
            loadConversations();
        }
    };
    init();
}, [tinodeToken]);
```

**验收标准**:
- [ ] 依赖已安装: `mobile/package.json` 包含 `tinode-sdk`
- [ ] `TinodeService.ts` 已创建
- [ ] 编译通过: `cd mobile && npm run android` 或 `npm run ios`
- [ ] 登录测试: 
  - 打开 App，登录成功
  - 查看日志: `[Tinode] 初始化成功`
- [ ] 会话列表测试:
  - 进入消息页面
  - 能看到会话列表（如果有）
- [ ] 发送消息测试:
  - 进入聊天室
  - 发送文本消息
  - 对方能收到

**并行性**: YES（可与 Task 6 并行）

---

### Task 6: 管理后台集成 Tinode Web SDK

**目标**: 管理后台使用 Tinode Web SDK

**参考文档**: `docs/TINODE_IM_INTEGRATION_GUIDE.md` 第 6 节

**操作步骤**:
1. 安装依赖: `cd admin && npm install tinode-sdk`
2. 创建 `admin/src/services/TinodeService.ts`
3. 修改相关页面使用 TinodeService
4. **注释掉**（不删除）Tencent IM 相关代码

**验收标准**:
- [ ] 依赖已安装: `admin/package.json` 包含 `tinode-sdk`
- [ ] `TinodeService.ts` 已创建
- [ ] 编译通过: `cd admin && npm run build`
- [ ] 开发环境测试: `npm run dev`
  - 打开 http://localhost:5173
  - 登录成功
  - 能访问消息功能

**并行性**: YES（可与 Task 5 并行）

---

### Task 7: 本地 Mac 环境测试

**目标**: 在本地完整测试所有功能

**测试清单**:

#### 7.1 后端测试
- [ ] Docker 服务启动: `docker-compose -f docker-compose.tinode.yml up -d`
- [ ] Tinode 健康检查: `curl http://localhost:6060/v0/version`
- [ ] 数据库表存在: `psql -d home_decoration -c "\dt tinode_*"`
- [ ] 登录返回 tinodeToken: `curl -X POST http://localhost:8080/api/v1/auth/login ...`

#### 7.2 移动端测试
- [ ] App 启动成功
- [ ] 登录成功，日志显示 `[Tinode] 初始化成功`
- [ ] 会话列表加载
- [ ] 发送文本消息
- [ ] 接收文本消息
- [ ] 发送图片消息（如果支持）
- [ ] 在线状态显示（如果支持）

#### 7.3 管理后台测试
- [ ] 后台启动: `cd admin && npm run dev`
- [ ] 登录成功
- [ ] 消息功能可用

#### 7.4 跨端测试
- [ ] 移动端发消息 → 管理后台收到
- [ ] 管理后台发消息 → 移动端收到
- [ ] 消息延迟 < 2 秒

**验收标准**:
- [ ] 所有测试项通过
- [ ] 无阻塞性 Bug
- [ ] 日志无严重错误

**并行性**: NO（依赖所有前置任务）

---

## 提交策略

### 提交时机
每完成一个 Task 提交一次：

```bash
# Task 1 完成后
git add .
git commit -m "feat(tinode): 创建功能分支"

# Task 2 完成后
git add server/scripts/migrations/
git commit -m "feat(tinode): 添加数据库 Schema"

# Task 3 完成后
git add docker-compose.tinode.yml server/config/
git commit -m "feat(tinode): 配置 Docker 服务"

# Task 4 完成后
git add server/internal/tinode/ server/internal/handler/
git commit -m "feat(tinode): 后端认证集成"

# Task 5 完成后
git add mobile/
git commit -m "feat(tinode): 移动端集成 SDK"

# Task 6 完成后
git add admin/
git commit -m "feat(tinode): 管理后台集成 SDK"

# Task 7 完成后
git add docs/
git commit -m "docs(tinode): 添加测试报告"
```

### 推送策略
每个 commit 后立即推送：
```bash
git push origin feature/tinode-im
```

---

## 成功标准

### 功能完整性
- ✅ 用户可以正常收发消息
- ✅ 消息延迟 < 2 秒
- ✅ 会话列表正常显示
- ✅ 在线状态正常（如果支持）

### 代码质量
- ✅ 编译无错误
- ✅ 无 ESLint 严重警告
- ✅ 腾讯云 IM 代码保留（注释状态）

### 部署就绪
- ✅ Docker Compose 一键启动
- ✅ 环境变量文档完整
- ✅ 本地 Mac 环境可运行

---

## 风险与缓解

### 风险 1: Tinode 启动失败
**缓解**: 先在本地测试 Docker 镜像，确认配置正确

### 风险 2: Token 格式不匹配
**缓解**: 参考文档示例代码，使用标准 JWT 格式

### 风险 3: 移动端 SDK 集成问题
**缓解**: 查阅 Tinode 官方文档和 GitHub Issues

### 风险 4: 消息延迟过高
**缓解**: 检查 Docker 网络配置，确保 Tinode 和 DB 在同一网络

---

## 参考资源

- **Tinode 官方文档**: https://tinode.co
- **Tinode GitHub**: https://github.com/tinode/chat
- **集成指南**: `docs/TINODE_IM_INTEGRATION_GUIDE.md`
- **现有代码**: 
  - `mobile/src/services/TencentIMService.ts`
  - `server/internal/ws/`

---

**计划创建时间**: 2026-01-22
**预计完成时间**: 2026-02-19（4 周后）
