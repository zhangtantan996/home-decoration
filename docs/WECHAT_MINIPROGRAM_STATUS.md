# 微信小程序端开发进度与后续安排

> 本文档用于记录当前“小程序端（Taro）”已落地的代码改动、可验证的闭环、以及下一阶段的开发安排，便于后续持续迭代。  
> 对应总体规划请参考：`docs/WECHAT_MINIPROGRAM_DEV_PLAN.md`。

## 1. 当前结论（范围与复用）

- 小程序与 APP **共用同一套后端（server）与同一个 PostgreSQL 数据库**：业务数据（用户/服务商/预约/订单/项目/IM 用户签名等）通用。
- 小程序新增的主要是“登录入口链路”：`wx.login(code)` → 后端换 `openid` → 未绑定则返回 `bindToken` → `wx.getPhoneNumber(code)` → 后端绑定手机号并下发 **与 APP 一致的** `JWT/RefreshToken`。

## 2. 已完成内容（当前进度）

### 2.1 后端（server）— 微信小程序登录/绑定链路

已落地：
- 数据模型：`server/internal/model/model.go` 新增 `UserWechatBinding`
- 数据迁移：`server/scripts/migrations/v1.4.0_add_user_wechat_bindings.sql`
- 配置项：`server/internal/config/config.go` 新增 `wechat_mini` 配置段
- 配置文件：`server/config.yaml`、`server/config.docker.yaml` 增加 `wechat_mini` 配置
- 环境变量示例：根目录 `.env.example` 增加 `WECHAT_MINI_APPID`、`WECHAT_MINI_SECRET`
- 服务层：`server/internal/service/wechat_auth_service.go`
  - `code2Session`：使用 `wx.login` 的 code 换取 `openid`
  - `getPhoneNumber`：使用 `wx.getPhoneNumber` 的 code 换取手机号
  - `bindToken`：短期绑定凭证（JWT 形式，默认 5 分钟）
- Handler：`server/internal/handler/wechat_auth_handler.go`
- 路由：`server/internal/router/router.go` 已注册接口（带登录限流中间件）
  - `POST /api/v1/auth/wechat/mini/login`
  - `POST /api/v1/auth/wechat/mini/bind-phone`

注意：
- 敏感字段（`code/session_key/phoneCode/access_token`）不写入日志，避免泄露。

### 2.2 小程序端（mini）— 工程脚手架与基础能力

已落地工程目录：`mini/`
- Taro 工程基本配置：`mini/config/*`、`mini/project.config.json`、`mini/tsconfig.json`
- 主题/样式：`mini/src/theme/*`、`mini/src/styles/base.scss`
- 5 个 Tab 页面壳：`mini/src/pages/*`（首页/灵感/进度/消息/我的）
- 请求封装（含 401 自动 refresh）：`mini/src/utils/request.ts`
- 登录态（Zustand + 持久化）：`mini/src/store/auth.ts`
- 微信登录/绑定 API：`mini/src/services/auth.ts`
- 运行说明：`mini/README.md`

当前可验证的最小闭环（MVP-Auth）：
- 在“我的”页面触发：微信一键登录 → 如需绑定手机号则授权手机号 → 获取 token 并写入 store。

## 3. 目前待验证/待补齐（阻塞点清单）

### 3.1 运行前置（必须完成）

- 配置后端环境变量（不要提交到仓库）：
  - `WECHAT_MINI_APPID`
  - `WECHAT_MINI_SECRET`
  - `JWT_SECRET`（已有体系依赖）
- 执行迁移 `user_wechat_bindings`（二选一）：
  1) 使用项目既有迁移机制（如果已有脚本/流程）  
  2) 直接执行：`server/scripts/migrations/v1.4.0_add_user_wechat_bindings.sql`
- 真实微信能力需要在微信后台配置并在真机/开发者工具中验证：
  - `wx.getPhoneNumber` 能力开通
  - 域名/合法 request 域名配置（小程序侧）

### 3.2 已知“还没做”的业务部分（按计划逐步推进）

- Week3：核心业务流（服务商浏览/预约/意向金模拟/订单/项目进度）
- Week4：IM（小程序 SDK/TUIKit 或自研最小 UI）
- Week5：补齐 P1 + 性能与体验（分包、图片策略、弱网提示等）

## 4. 下一步开发安排（建议按顺序）

### Step A：先把“登录闭环”跑通（验收入口）

目标：新用户/老用户两条路径都能走通：
- 新用户：`/wechat/mini/login` → needBindPhone → `/wechat/mini/bind-phone` → 拿到 JWT
- 老用户：`/wechat/mini/login` 直接返回 JWT

验收要点：
- `bindToken` 过期后提示合理（需重新登录）
- 同一个 openid 不可绑定到多个账号；同一个账号不可绑定多个 openid（已在服务层做了保护）

### Step B：对齐 P0 页面与 API（Week3）

建议优先顺序（从“能走通主链路”出发）：
1) 服务商列表/详情（复用现有 `/providers` & 详情接口）
2) 预约（创建/列表/详情）
3) 意向金模拟支付（复用后端接口与状态机）
4) 订单列表/详情
5) 项目列表/详情/进度（Project + Phases/Logs）

### Step C：IM（Week4）

方案建议：
- 先做最小可用：会话列表 + 聊天页 + 未读数
- 复用后端 `GET /api/v1/im/usersig`，小程序端接入腾讯云 IM 小程序 SDK

### Step D：性能与提审（Week5）

- 分包策略：主包只保留 Tab 与登录必需页；业务页按模块分包
- 图片策略：压缩/占位/懒加载；长列表虚拟化（可选）
- 审核合规：手机号授权文案、权限最小化、隐私合规说明

## 5. 开发运行速记

小程序端：
- 进入 `mini/` 安装依赖后：`npm run dev:weapp`（生成 `mini/dist`，导入微信开发者工具）
- API 基地址：通过 `TARO_APP_API_BASE` 配置，默认 `http://localhost:8080/api/v1`

后端：
- 保证 `server` 正常启动并可访问 `/api/v1/health`

## 6. 后续文档维护规则

- 每完成一个“可验收闭环”，更新本文档：
  - 新增“已完成内容”
  - 将对应项从“待补齐”移除
  - 记录关键决策（例如：IM 采用 TUIKit 还是自研）

