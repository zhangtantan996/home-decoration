# 微信小程序端开发计划（与 APP 功能基本一致）

> 目标：在不破坏现有 `server/`、`mobile/`、`admin/` 的技术锁与依赖约束前提下，新增一套 **微信小程序端**（UI 走“品牌风格 + 微信交互习惯”），页面结构与现有 APP 基本保持一致，并尽可能复用后端 API、业务流程、IM 能力与鉴权体系。

---

## 0. 结论与范围

### 0.1 可行性结论
- **可行**：现有后端已提供手机号验证码/密码登录 + JWT/RefreshToken + 业务流/订单/支付（模拟）+ IM UserSig 接口，可作为小程序端的主要复用点。
- **必须新增**：后端目前 **没有** 微信小程序登录相关接口，需要新增“微信登录/绑定手机号”链路，并与现有用户体系（手机号为主账号）打通。

### 0.2 一期（MVP）范围（建议）
以“功能对齐 + UI 不丑 + 可上线体验版”为目标，优先交付：
- 鉴权：微信小程序登录（`wx.login`）+ 绑定手机号 + 获取并保存现有 JWT/RefreshToken
- 核心页面：与 APP 5 Tab 对齐（首页/灵感/进度/消息/我的）+ 核心二级页
- 核心业务流：服务商浏览 → 预约 → 意向金支付（模拟） → 订单/进度查看 → 售后入口
- IM：继续采用腾讯云 IM（小程序 SDK/TUIKit 小程序 UI），复用现有 `GET /api/v1/im/usersig`
- 支付：一期先用**模拟支付**（复用现有后端接口与状态机）；二期再接微信支付

### 0.3 二期（增强）范围（可选）
- 微信支付（JSAPI/小程序支付：统一下单 + `wx.requestPayment` + 回调验签）
- 更完整的消息推送：订阅消息、关键节点通知、未读数优化
- 性能专项：分包、图片策略、列表虚拟化、启动耗时/弱网体验优化

---

## 1. 现状核对（来自仓库）

### 1.1 现有认证与 Token
- API 文档已定义 JWT 认证头：`Authorization: Bearer <token>`（见 `server/docs/API接口文档.md`）
- 用户登录支持：手机号验证码/手机号密码（见 `POST /api/v1/auth/login`）
- Token 刷新：`POST /api/v1/auth/refresh`
- 服务端 JWT claims 实际生成字段：`userId`、`userType`（见 `server/internal/service/user_service.go` 中 `generateToken`）

### 1.2 现有 IM（腾讯云）
- 移动端已封装腾讯 IM，并从后端获取 `sdkAppId/userSig`（见 `mobile/src/services/TencentIMService.ts`）
- 后端提供用户端 IM 签名接口：`GET /api/v1/im/usersig`（见 `server/internal/handler/im_handler.go`）

### 1.3 现有支付（一期可用模拟）
- 意向金“支付成功”已存在模拟接口/实现（如 `PayIntentFee`，见 `server/internal/handler/booking_handler.go`）
- API 文档也包含支付意向金接口描述（见 `server/docs/API接口文档.md`）

---

## 2. 技术路线与目录规划

### 2.1 前端框架建议
- 小程序端建议使用：**Taro + React + TypeScript**
  - 目的：减少学习成本、支持 React 语法、便于抽公共业务层、可渐进实现高质量 UI。
- 状态管理：保持与项目整体一致的思路（优先 Zustand 风格）；小程序端持久化用 `wx.setStorageSync`/异步封装。

### 2.2 代码复用边界（必须先定）
**允许复用（推荐抽成 `packages/shared/`）**
- API 类型定义、DTO、校验、格式化、错误码映射
- 业务流程状态机（订单状态、项目状态等）
- 请求封装（但底层适配小程序 request）

**不直接复用（小程序端重建）**
- RN 的 UI 组件/样式实现（布局结构可借鉴，但组件实现需改写）
- RN 导航实现（小程序路由体系不同）

### 2.3 推荐目录结构（规划）
> 本节为后续落地结构建议，实施时可按阶段创建。

- `mini/`：微信小程序端项目
  - `src/pages/`：页面（与 APP 页面映射）
  - `src/components/`：基础组件库（Button/Input/Card/List/Modal/Toast/Skeleton/Empty 等）
  - `src/styles/`：tokens（颜色/字号/间距/圆角/阴影）+ 主题（品牌金色 #D4AF37 等）
  - `src/services/`：请求封装、鉴权、IM 适配
  - `src/store/`：全局状态（登录态、用户信息、未读数等）
- `packages/shared/`：跨端共享的纯 TS 业务包（可选但强烈建议）

---

## 3. 页面映射（以现有 APP 为准）

### 3.1 Tab（一级页面，保持一致）
来自 `mobile/src/navigation/AppNavigator.tsx`：
- 首页：`HomeScreen`
- 灵感：`InspirationScreen`
- 进度/工地：`MySiteScreen`（Tab 名为 Progress）
- 消息：`MessageScreen`
- 我的：`ProfileScreen`

### 3.2 常用二级页面（按优先级建议）
> 页面文件来自 `mobile/src/screens/`，小程序端按“功能等价 + 微信交互习惯”实现。

**P0（一期必做）**
- `LoginScreen`（小程序端替换为：微信登录 + 绑定手机号）
- 服务商详情：`ProviderDetails`（Designer/Worker/Company）
- 预约：`BookingScreen`
- 支付：`PaymentScreen` / `DesignFeePaymentScreen`（一期先走模拟支付或订单状态推进）
- 订单：`OrderListScreen`、`OrderDetailScreen`、`BillScreen`
- 项目：`ProjectDetailScreen`、`ProjectListScreen`、`ProjectTimelineScreen`
- 消息/聊天：`MessageScreen`、`ChatRoomScreen`、`ChatSettingsScreen`
- 我的：`SettingsScreen`、`PersonalInfoScreen`、`AccountSecurityScreen`、`ChangePasswordScreen`
- 通知：`NotificationScreen`
- 方案：`ProposalDetailScreen`、`ProposalPaidDetailScreen`
- 设计文件：`DesignFilesScreen`
- 评价：`ReviewsScreen`

**P1（一期可延后）**
- `CaseScreens`（CaseGallery/CaseDetail）
- `InspirationDetails`
- `MaterialShopDetailScreen`
- `AfterSalesScreen`
- `CreateProjectScreen`

**P2（可不做/仅内部调试）**
- `PullToRefreshDemo`
- `ScanQRScreen`（如无明确业务依赖可后置）
- `PendingScreen`（看业务是否需要）

---

## 4. 后端改造计划（新增微信小程序登录）

### 4.1 目标
在不改变现有“手机号为主账号”的前提下，实现：
- 小程序端用户可通过微信登录并绑定手机号
- 绑定后，后端下发与 APP **同一套** JWT/RefreshToken，业务接口完全复用

### 4.2 新增配置（环境变量/配置中心）
严禁硬编码，建议新增：
- `WECHAT_MINI_APPID`
- `WECHAT_MINI_SECRET`

### 4.3 建议新增数据模型（示例）
可选两种实现方式（选其一即可）：

**方案 A：在 `users` 表扩展字段（简单）**
- `wechat_openid`（小程序 openid）
- `wechat_unionid`（如可获取）
- `wechat_bound_at`

**方案 B：单独绑定表（更规范）**
- `user_wechat_bindings`：`id/user_id/openid/unionid/appid/created_at/updated_at`

### 4.4 建议新增接口（示例设计）
> 路径可按项目现有 `/api/v1/auth` 风格落地；最终以实现最小闭环为准。

1) `POST /api/v1/auth/wechat/mini/login`
- 入参：`{ code: string }`（来自 `wx.login`）
- 行为：调用 `code2Session` 获取 `openid/session_key`；若已绑定用户 → 直接签发 JWT；未绑定 → 返回 `needBindPhone=true` + 一个短期 `bindToken`（服务端签名/加密，不存敏感信息到日志）

2) `POST /api/v1/auth/wechat/mini/bind-phone`
- 入参：`{ bindToken: string, phoneCode: string }`（`phoneCode` 来自 `wx.getPhoneNumber`）
- 行为：服务端用 `phoneCode` 换取手机号（需要 `access_token`），然后：
  - 查找/创建用户（手机号为 key）
  - 绑定 openid/unionid
  - 签发 JWT/RefreshToken（与现有 `auth/login` 一致结构）

3) （可选）`POST /api/v1/auth/wechat/mini/unbind`（不建议一期做）

### 4.5 安全与风控
- 不记录：`code/session_key/phoneCode/access_token` 等敏感值
- 接口限流：同手机号/同 IP/同 openid 做频控，避免暴力滥用
- bindToken 有效期短（例如 5 分钟），并绑定客户端标识（可选）

---

## 5. 小程序端实现计划（前端）

### 5.1 鉴权与会话
- 登录态存储：保存 `token/refreshToken/expiresIn`（结构对齐 `server/docs/API接口文档.md`）
- 请求封装：
  - 自动附带 `Authorization`
  - 401 时自动走 refresh（复用 `/api/v1/auth/refresh`），失败则清理登录态并回到登录流程

### 5.2 UI 质量保障（不丑的关键）
先做“设计系统”，再堆页面：
- `tokens`：颜色（主色金 #D4AF37 及中性色阶）、字号、间距、圆角、阴影、z-index、动效时长
- 基础组件：Button / Input / Cell / Card / Tag / Tabs / Modal / Toast / Skeleton / Empty / Divider / Badge
- 页面只组合基础组件；避免页面里各自写一套样式导致视觉分裂

### 5.3 IM（腾讯云）
一期目标：能用、好看、体验稳定
- 继续复用后端：`GET /api/v1/im/usersig`
- 小程序端使用腾讯 IM 小程序 SDK（与 RN/Web SDK 不同，需要单独集成）
- 若 TUIKit 小程序 UI 引入成本过高：可先做“会话列表 + 基础聊天页”最小实现，再迭代 UI

### 5.4 支付（一期模拟）
- 复用后端支付状态推进接口（意向金/订单/分期等）
- 小程序端 UI 上按微信习惯展示“确认支付/支付成功/支付失败”

---

## 6. 里程碑与交付物（建议排期）

> 以 5 周为参考，可按人力压缩/拉长。

### Week 1：脚手架 + 设计系统
- 交付：`mini/` 项目可启动；完成 tokens + 6~10 个基础组件；实现 5 Tab 路由壳与空页面
- 验收：页面骨架与导航完整；UI 统一；lint/构建通过

### Week 2：微信登录/绑定（前后端打通）
- 交付：后端新增微信登录接口；小程序端完成登录与绑定手机号流程；拿到 JWT 后可访问受保护接口
- 验收：新用户/老用户两种路径都能闭环；token 刷新可用

### Week 3：核心业务流（预约/订单/进度）
- 交付：服务商详情 → 预约 → 意向金支付（模拟） → 订单列表/详情 → 项目进度页
- 验收：P0 主流程可走通；异常态/空态/弱网提示可用

### Week 4：IM 与消息
- 交付：会话列表、聊天页、未读数；IM 登录与断线重连策略
- 验收：能稳定收发消息；退到后台/切前台不崩；UI 观感可接受

### Week 5：补齐 P1 + 性能与体验版发布
- 交付：补齐剩余 P1 页面；分包；首屏性能优化；体验版提审材料准备
- 验收：体验版可发；关键指标达标（启动、页面切换、列表滚动）

---

## 7. 开发执行清单（后续按此逐项完成）

### 7.1 准备阶段
- [ ] 明确一期 P0 页面范围（按本计划默认清单，可微调）
- [ ] 明确是否“一期必须 IM”（默认：是）
- [ ] 明确支付一期仅模拟（默认：是）

### 7.2 后端任务（server）
- [ ] 设计并落地微信绑定数据结构（方案 A 或 B）
- [ ] 新增 `POST /api/v1/auth/wechat/mini/login`
- [ ] 新增 `POST /api/v1/auth/wechat/mini/bind-phone`
- [ ] 接入限流与日志脱敏
- [ ] 本地/测试环境可验证（不引入硬编码密钥）

### 7.3 小程序端任务（mini）
- [ ] 初始化项目与基础工程能力（路由、请求、store、样式系统）
- [ ] 完成 tokens + 基础组件库
- [ ] 登录/绑定手机号闭环 + token 刷新
- [ ] 核心页面 P0 实现并打通接口
- [ ] IM 集成并对齐消息页体验
- [ ] 性能与分包、发布流程

---

## 8. 风险与应对

- IM SDK 适配成本：优先“能用”再“更好看”；必要时先用自研聊天 UI，后续再替换 TUIKit
- 小程序性能：严格分包、图片压缩、长列表优化；避免一次性大 JSON/大图片
- 微信审核：权限申请最小化；手机号授权引导文案合规

---

## 9. 备注（变更原则）
- 不改动既有技术锁（尤其 `admin/` 与 `mobile/` 的 React 版本与依赖策略）
- 后端遵守分层：`handler -> service -> repository`
- 任何密钥走环境变量/配置，不进仓库

