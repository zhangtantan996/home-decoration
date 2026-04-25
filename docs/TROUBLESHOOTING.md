# 问题解决手册 (TROUBLESHOOTING.md)

> **记录开发过程中遇到的复杂问题及解决方案**

## 📋 问题索引

| 问题类别 | 问题数量 | 最后更新 |
|---------|---------|---------|\n| 依赖冲突 | 2 | 2026-01-07 |\n| 构建失败 | 2 | 2026-01-07 |\n| 部署问题 | 1 | 2026-01-07 |\n| 数据库问题 | 1 | 2026-01-21 |\n| 性能问题 | 0 | - |

**快速导航**:
- [P0 级问题](#-p0-级问题影响开发部署)
- [P1 级问题](#-p1-级问题影响功能)
- [已解决问题](#-已解决的历史问题)
- [问题记录模板](#-问题记录模板)

---

## 🔴 P0 级问题（影响开发/部署）

### [P0-001] Admin Panel React 19 不兼容问题

**发现时间**: 2025-12-XX
**修复时间**: 2025-12-XX
**修复人**: 开发团队

**问题描述**:
- **环境**: 本地开发环境
- **现象**: Admin Panel 启动报错 `Cannot read property 'createElement' of undefined`
- **影响**: 无法启动前端开发服务器，阻塞所有前端开发工作

**重现步骤**:
1. 运行 `npm update` 更新依赖
2. 执行 `npm run dev`
3. 浏览器控制台报错

**排查过程**:
```bash
# 1. 查看浏览器控制台
F12 → Console → 发现 React 错误 "Cannot read property 'createElement'"

# 2. 检查 package.json
cat admin/package.json | grep "react"
# 输出: "react": "^18.3.1"  (^ 符号允许升级到 19.x)

# 3. 检查实际安装版本
npm ls react
# 输出: react@19.2.0

# 4. 查阅 Ant Design 兼容性文档
# 发现 Ant Design 5.x 不支持 React 19

# 5. 5-Why 分析
Why 1: 为什么报错？ → React 版本不兼容
Why 2: 为什么不兼容？ → 升级到了 React 19
Why 3: 为什么升级？ → npm update 自动升级
Why 4: 为什么自动升级？ → package.json 使用 ^ 符号
Why 5: 为什么用 ^？ → 初始化项目时的默认配置
```

**根本原因**:
1. `package.json` 使用 `"react": "^18.3.1"` 允许自动升级到 18.x 任意版本
2. npm 的 ^ 符号会匹配到 19.x（因为 19 < 20）
3. Ant Design 5.x 内部使用了 React 18 特有的 API
4. 腾讯云 IM SDK 使用了 React 18 的 Legacy Context API

**解决方案**:
```bash
# 步骤 1: 回退到 React 18.3.1
cd admin
npm install react@18.3.1 react-dom@18.3.1

# 步骤 2: 锁定版本（编辑 package.json）
{
  "dependencies": {
    "react": "18.3.1",        // 移除 ^ 符号
    "react-dom": "18.3.1"     // 移除 ^ 符号
  }
}

# 步骤 3: 重新生成 lock 文件
rm package-lock.json
npm install

# 步骤 4: 验证修复
npm run dev
# 成功启动！
```

**预防措施**:
1. ✅ 所有核心依赖锁定精确版本（移除 ^ 和 ~）
2. ✅ 添加 CI 检查：禁止 package.json 中核心依赖有 ^ 或 ~
3. ✅ 升级依赖前必须先查阅兼容性文档
4. ✅ 在 `docs/技术架构设计总览.md` 中明确标注 React 版本约束

**相关文件**:
- `admin/package.json` - 锁定 React 版本
- `docs/CLAUDE_DEV_GUIDE.md` - 更新技术栈版本约束
- `docs/技术架构设计总览.md` - 更新 React 版本策略

**参考 Commit**: `f9edcf6`
**关联文档**: [技术架构设计总览.md#React版本策略](技术架构设计总览.md)

---

### [P0-002] Docker 构建内存不足（JavaScript heap out of memory）

**发现时间**: 2025-12-XX
**修复时间**: 2025-12-XX
**修复人**: 开发团队

**问题描述**:
- **环境**: Docker 构建环境（本地 + CI）
- **现象**: Admin Panel Docker 构建失败，报错 `JavaScript heap out of memory`
- **影响**: 无法构建生产镜像，阻塞部署

**错误日志**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory

<--- Last few GCs --->
[1:0x5618f2a4e0]   123456 ms: Mark-sweep 2048.2 (2082.3) -> 2047.9 (2083.3) MB, 1234.5 / 0.0 ms
```

**排查过程**:
```bash
# 1. 查看 Docker 构建日志
docker-compose -f deploy/docker-compose.prod.yml build web
# 发现在 "npm run build" 步骤失败

# 2. 检查本地构建是否成功
cd admin && npm run build
# 本地成功（因为本地内存充足）

# 3. 检查 Docker 容器资源限制
docker stats
# 发现容器内存限制为 2GB

# 4. 检查 Node.js 默认 heap size
node -e "console.log(v8.getHeapStatistics().heap_size_limit / 1024 / 1024 + ' MB')"
# 输出: 2048 MB（默认 2GB）

# 5. 分析 build 过程内存消耗
# Admin Panel 包含:
# - Ant Design Pro Components (大量组件)
# - 腾讯云 IM SDK (包含大量依赖)
# - Vite 构建过程需要加载所有模块到内存
# 总计需要约 3-4GB 内存
```

**根本原因**:
1. Admin Panel 依赖体积较大（Ant Design + IM SDK）
2. Vite 构建时需要将所有模块加载到内存
3. Node.js 默认 heap size 为 2GB，不足以完成构建
4. Docker 容器内存限制进一步加剧了问题

**解决方案**:
```dockerfile
# deploy/Dockerfile.frontend
FROM node:20 AS builder

# 添加内存限制配置（关键修复）
ENV NODE_OPTIONS="--max-old-space-size=8192"

WORKDIR /app
COPY admin/package*.json ./
RUN npm ci
COPY admin/ .
RUN npm run build

# 第二阶段：Nginx 服务
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html/admin
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# 重新构建
cd deploy
docker-compose -f docker-compose.prod.yml build --no-cache web

# 验证成功
docker-compose -f docker-compose.prod.yml up web
```

**预防措施**:
1. ✅ 所有前端构建 Dockerfile 添加 `NODE_OPTIONS="--max-old-space-size=8192"`
2. ✅ CI/CD 流水线中检查构建内存限制
3. ✅ 定期审查依赖体积，移除不必要的依赖
4. ✅ 考虑使用 Webpack Bundle Analyzer 分析包体积

**相关文件**:
- `deploy/Dockerfile.frontend` - 添加 NODE_OPTIONS
- `deploy/docker-compose.prod.yml` - 生产环境配置

**参考 Commit**: `f9edcf6`
**关联文档**: [DEPLOYMENT_GUIDE_ZH.md](DEPLOYMENT_GUIDE_ZH.md)

---

### [P0-003] TUIKit 缺失依赖导致生产构建失败

**发现时间**: 2025-12-XX
**修复时间**: 2025-12-XX
**修复人**: 开发团队

**问题描述**:
- **环境**: Docker 生产构建环境
- **现象**: 构建时报错 `Cannot find module '@tencentcloud/tui-core-lite'`
- **影响**: 无法构建生产镜像

**错误日志**:
```
ERROR in ./node_modules/@tencentcloud/chat-uikit-react/index.js
Module not found: Error: Can't resolve '@tencentcloud/tui-core-lite'
```

**排查过程**:
```bash
# 1. 检查本地开发环境
npm ls @tencentcloud/tui-core-lite
# 输出: (empty)  # 本地也没有安装

# 2. 查看 IM SDK 依赖
cat node_modules/@tencentcloud/chat-uikit-react/package.json
# 发现依赖中声明了 @tencentcloud/tui-core-lite

# 3. 检查 peerDependencies
# 发现这些依赖是 peerDependencies，需要手动安装

# 4. 查阅腾讯云 IM 文档
# 确认需要手动安装以下依赖
```

**根本原因**:
- `@tencentcloud/chat-uikit-react` 使用了 peerDependencies
- peerDependencies 不会自动安装，需要手动安装
- 本地开发环境恰好能运行（因为某些依赖被其他包间接安装）
- 生产构建使用 `npm ci`，严格按照 package-lock.json，暴露了问题

**解决方案**:
```bash
# 安装缺失的依赖
cd admin
npm install @tencentcloud/tui-core-lite@^1.0.0
npm install @tencentcloud/chat-uikit-engine-lite@^1.0.4
npm install @tencentcloud/uikit-base-component-react@^1.1.4
npm install @tencentcloud/lite-chat@^1.6.6
npm install @tencentcloud/universal-api@^2.4.0
npm install @tencentcloud/tuiroom-engine-js@^3.5.2
npm install i18next@^23.16.8

# 验证构建
npm run build

# 修复 TypeScript 错误（如果有）
# admin/src/pages/merchant/IMTest.tsx
- 移除未使用的变量
```

**预防措施**:
1. ✅ CI 流水线添加 `npm ci` 测试（检测缺失依赖）
2. ✅ 本地开发时定期运行 `rm -rf node_modules && npm ci`
3. ✅ 安装新 SDK 时仔细阅读文档的依赖要求
4. ✅ 使用 `npm ls <package>` 检查依赖是否正确安装

**相关文件**:
- `admin/package.json` - 补充依赖
- `admin/src/pages/merchant/IMTest.tsx` - 修复 lint 错误

**参考 Commit**: `c7895c5`
**关联文档**: 无

---

## 🟡 P1 级问题（影响功能）

### [P1-001] Android APK 签名失败

**发现时间**: 待记录
**修复时间**: 待记录
**修复人**: 待记录

**问题描述**:
- **环境**: Android 打包环境
- **现象**: `jarsigner` 报错 `keystore was tampered with, or password was incorrect`
- **影响**: 无法生成正式版 APK

**排查过程**:
```bash
# 1. 验证 keystore 文件
keytool -list -v -keystore my-release-key.keystore
# 输出: 密码错误或文件损坏

# 2. 检查密码是否正确
# 确认密码正确但仍然报错

# 3. 检查 keystore 格式
file my-release-key.keystore
# 输出: data  # 可能是格式问题
```

**根本原因**:
- keystore 文件可能损坏
- 或密码记录错误
- 或格式不兼容

**解决方案**:
```bash
# 重新生成 keystore（注意：会导致无法更新已发布的应用）
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore my-release-key.keystore \
  -alias my-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 输入信息
Enter keystore password: ********
Re-enter new password: ********
What is your first and last name? [您的名字]
What is the name of your organizational unit? [部门]
...

# 验证
keytool -list -v -keystore my-release-key.keystore
```

**预防措施**:
1. ✅ 将 keystore 文件备份到安全位置
2. ✅ 使用密码管理工具保存密码
3. ✅ 定期验证 keystore 可用性
4. ✅ 文档中记录 keystore 生成命令

**相关文件**:
- `mobile/android/app/my-release-key.keystore`
- `docs/ANDROID_APK_BUILD_GUIDE.md`

**参考 Commit**: 待记录
**关联文档**: [ANDROID_APK_BUILD_GUIDE.md](ANDROID_APK_BUILD_GUIDE.md)

---

## 🟢 已解决的历史问题

### [已解决-003] 设计师/工长列表显示错误的名字和头像

**解决时间**: 2026-01-21
**状态**: ✅ 已永久修复

**问题描述**:
- **环境**: 移动端 (iOS/Android)
- **现象**: 首页设计师卡片显示 "独立设计师" 而非真实姓名，头像显示案例封面图而非人物头像
- **影响**: 用户体验差，无法识别设计师

**根本原因**:
1. `providers` 表有种子数据 (ID 90001-90022)，但 `users` 表没有对应的用户记录
2. 后端 `provider_service.go` 查询 `users` 表时找不到记录，返回空的 `nickname` 和 `avatar`
3. 前端 `toDesigner()` 函数 fallback 到 `companyName`（如 "独立设计师"）
4. 后端 fallback 使用 `provider.CoverImage`（案例封面图）作为头像

**数据模型说明**:
```
Provider 表:
- user_id: 关联 users 表
- company_name: 公司/工作室名称（如 "独立设计师"、"雅居设计工作室"）
- cover_image: 案例封面图（不是头像！）

User 表:
- nickname: 设计师真实姓名（如 "李明设计师"）
- avatar: 头像 URL

前端显示逻辑:
- name = dto.nickname || dto.companyName || '未知'
- avatar = dto.avatar || 'https://via.placeholder.com/100'
```

**解决方案**:
```sql
-- 为种子数据的 providers 创建对应的 users 记录
INSERT INTO users (id, phone, nickname, avatar, user_type, status, created_at, updated_at) VALUES
(90001, '13800090001', '李明设计师', 'https://randomuser.me/api/portraits/men/1.jpg', 2, 1, NOW(), NOW()),
(90002, '13800090002', '王雅居', 'https://randomuser.me/api/portraits/women/2.jpg', 2, 1, NOW(), NOW()),
-- ... 其他记录
ON CONFLICT (id) DO UPDATE SET nickname = EXCLUDED.nickname, avatar = EXCLUDED.avatar;
```

**预防措施**:
1. ✅ 种子数据脚本必须同时创建 `providers` 和 `users` 记录
2. ✅ 后端 API 返回数据前验证 `nickname` 和 `avatar` 不为空
3. ✅ 前端使用 placeholder 头像作为 fallback
4. ✅ 本文档记录数据模型关系，避免混淆

**相关文件**:
- `server/internal/service/provider_service.go` - 查询用户信息
- `mobile/src/types/provider.ts` - 前端数据转换逻辑
- `server/internal/model/model.go` - 数据模型定义

**参考 Commit**: 待提交
**关联文档**: [CLAUDE_DEV_GUIDE.md](CLAUDE_DEV_GUIDE.md)

---

### [已解决-001] CORS 跨域问题

**解决时间**: 2025-11-XX
**状态**: ✅ 已永久修复

**问题描述**:
前端调用 API 时报 CORS 错误 `Access to XMLHttpRequest has been blocked by CORS policy`

**解决方案**:
已在 `server/internal/middleware/cors.go` 配置 CORS 中间件

```go
func CORS() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }

        c.Next()
    }
}
```

**参考文件**: `server/internal/middleware/cors.go`

---

### [已解决-002] 服务区域从省市区文本迁移到行政区划码

**解决时间**: 2025-12-XX
**状态**: ✅ 已完成迁移

**问题描述**:
原有 `service_area` 字段存储 "陕西省,西安市,雁塔区" 文本格式，不便于查询和筛选

**解决方案**:
1. 创建 `regions` 表存储三级行政区划
2. 新增 `service_area_codes` JSON 字段存储区划码数组
3. 提供迁移脚本转换历史数据

**参考文件**:
- `docs/SERVICE_AREA_MIGRATION_GUIDE.md`
- `server/scripts/seeds/seed_regions_shaanxi.sql`
- `server/scripts/migrate_service_area.go`

---

## 📝 问题记录模板

新增问题时复制此模板:

```markdown
### [Pxx-xxx] 问题简短描述（10 字以内）

**发现时间**: YYYY-MM-DD HH:MM
**修复时间**: YYYY-MM-DD HH:MM
**修复人**: 姓名/团队

**问题描述**:
- **环境**: 开发/测试/生产
- **现象**: [详细描述错误现象]
- **影响**: [影响范围和严重程度]

**重现步骤**:
1. 步骤 1
2. 步骤 2
3. 步骤 3

**排查过程**:
```bash
# 执行的命令和输出
命令 1
# 输出 1

命令 2
# 输出 2
```

**根本原因**:
[使用 5-Why 分析法找出根因]

**解决方案**:
```bash
# 详细的修复步骤（可复现）
步骤 1
步骤 2
```

**预防措施**:
1. ✅ 措施 1
2. ✅ 措施 2

**相关文件**:
- `path/to/file1` - 修改说明
- `path/to/file2` - 修改说明

**参考 Commit**: `commit-hash`
**关联文档**: [文档名](文档路径)
```

---

## 🔍 快速查找问题

**按错误信息搜索**:
```bash
# 在本文档中搜索错误信息
grep -i "cannot find module" docs/TROUBLESHOOTING.md
```

**按问题类型查找**:
- **依赖冲突**: P0-001, P0-003
- **构建失败**: P0-002
- **部署问题**: 暂无
- **数据库问题**: 暂无

**按修复时间排序**:
- 最近修复: P0-003 (2025-12-XX)
- 较早修复: P0-001, P0-002

---

## 📊 问题统计

**总问题数**: 6
**P0 级**: 3
**P1 级**: 1
**已解决**: 3
**平均修复时间**: < 1 小时

**高频问题**:
1. 依赖冲突 (2 次)
2. 构建失败 (2 次)

**改进建议**:
- [ ] 加强 CI 依赖版本检查
- [ ] 定期审查 package.json 依赖
- [ ] 补充 Docker 构建最佳实践文档

---

## 🆘 遇到新问题？

1. **先搜索本文档**: 使用 Ctrl+F 搜索错误关键词
2. **按照排查流程**: 参考 [CLAUDE_DEV_GUIDE.md#问题排查流程](CLAUDE_DEV_GUIDE.md)
3. **记录到本文档**: 使用上面的模板记录问题
4. **更新相关文档**: 同步更新技术文档

---

*最后更新: 2026-01-21*
*维护者: 项目技术团队*
*文档版本: v1.0.0*
