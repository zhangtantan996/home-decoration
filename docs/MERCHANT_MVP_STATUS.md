# 商家中心 MVP 现状与差距分析报告

## 1. 现状概览
截止当前，商家中心已完成核心 MVP 功能开发，实现了服务商从入驻到业务管理的基础闭环。

### ✅ 已完成功能
- **入驻流程**: 支持设计师（个人/公司）/工长（个人/公司）/装修公司/主材商四类入驻，包含多步骤表单、资质上传及状态查询。
- **认证体系**: 基于 JWT 的商家独立登录体系，含短信验证码流程（目前为 mock）。
- **业务管理**:
  - **工作台**: 核心数据看板（预约、订单、财务概览）。
  - **作品集**: 案例的增删改查及排序。
  - **账户设置**: 基础信息、服务区域、擅长风格及接单状态管理。
- **财务基础**:
  - 收入明细查询。
  - 提现申请及记录查看。
  - 银行账户绑定管理。
- **安全基础**:
  - 敏感操作审计日志 (`AuditLog`).
  - 全局及敏感接口限流 (`RateLimit`).
  - 基础数据权限隔离 (基于 `provider_id`).
  - 入驻信息严格校验 (前端正则+后端验证).

### 🔄 本次统一改版范围（2026-03，v1.5.0）
- 商家入口合并为「我要入驻」，登录与入驻双主路径统一。
- 服务商申请升级为 `role + entityType` 模型，兼容旧 `applicantType`。
- `merchant/login` 新增结构化引导：`nextAction=APPLY|PENDING|RESUBMIT|CHANGE_ROLE`。
- 引入主材商独立通道：
  - 申请：`POST /api/v1/material-shop/apply`
  - 状态：`GET /api/v1/material-shop/apply/:phone/status`
  - 重提：`POST /api/v1/material-shop/apply/:id/resubmit`
  - 中心：`/api/v1/material-shop/me` + 商品 CRUD
- 单一商家身份策略落地：已有商家身份时返回 `CHANGE_ROLE`，并新增变更申请单接口。
- C 端字段兼容同步：`workTypes` 支持 JSON 数组/逗号串双格式解析。

### 🔄 本次全量缺口补齐（2026-03，v1.5.1）
- 服务商入驻字段升级为强校验：
  - `avatar` 必填；
  - 设计师 `yearsExperience` 必填（1-50）；
  - `portfolioCases[].description` 必填（1-5000）。
- 主材商入驻基础资料强制必填：
  - `contactName/contactPhone/businessHours/address`；
  - `contactPhone` 必须合法。
- 商家资料中心补齐扩展字段维护：
  - `highlightTags`、`pricing`、`graduateSchool`、`designPhilosophy`。
- C 端详情消费补齐：
  - `highlightTags`、`pricingJson`、`graduateSchool`、`designPhilosophy` 空值隐藏展示。
- 资质核验适配层接入：
  - `ID_CARD_VERIFY_PROVIDER`、`LICENSE_VERIFY_PROVIDER`（默认 `manual`），保留人工审核主流程。

### 🔄 本次条款合规留痕补齐（2026-03，v1.5.2）
- 商家入驻新增线上必勾选条款：
  - 《平台入驻协议（线上勾选版）》
  - 《平台规则》
  - 《隐私与数据处理条款》
- 服务商与主材商申请接口新增 `legalAcceptance` 入参并强校验：
  - `accepted=true`
  - 三个版本字段不能为空（长度 1-64）
- 申请表新增留痕字段：
  - `legal_acceptance_json`
  - `legal_accepted_at`
  - `legal_accept_source=merchant_web`

### 🔄 本次补齐范围（2026-02）
- 商家入口页补齐“工长/项目经理”入驻入口，修复“可登录不可入驻”断层。
- 商家注册流程新增 `foreman` 类型及施工导向字段（`workTypes`、`yearsExperience`）。
- 后端 `merchant/apply` 与 `merchant/apply/:id/resubmit` 增加 `foreman` 枚举支持。
- 审核通过映射补齐：`foreman -> provider_type=3, sub_type=foreman`，并回填 `providers.work_types`。

### 🔄 本次统一商家入驻一期试运营补充（2026-03，v1.6.x）
- 驳回重提安全闭环补齐：
  - `detail-for-resubmit` 改为 `POST` + `phone/code` 验证；
  - 返回 `resubmitToken`，后续重提优先凭 token 提交。
- 入驻验证码前置校验统一：
  - 首次申请与驳回重提统一在第一步完成手机号验证码真实校验；
  - 第一步校验成功后返回 `verificationToken`，前端保存“手机号已验证”状态；
  - 手机号未变化时允许返回步骤编辑，手机号变化时强制重新验证。
- 正式商家实体增加来源追溯：
  - `providers.source_application_id`
  - `material_shops.source_application_id`
- 审核后台详情补充统一商家体系字段：
  - `merchantKind`
  - `sourceApplicationId`
  - 公司主体 / 主材商的法人（经营者）资料展示
- 试运营 SOP 与数据治理补齐：
  - 迁移权威目录固定为 `server/migrations/`
  - 认证/短信审计/商家入驻统一补洞迁移固定为 `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`
  - 固定验证码模式用于联调与 E2E
  - 测试手机号使用 `19` 前缀随机号并要求场景级隔离

### ✅ 阶段1执行状态（2026-02-09）
- 后端契约统一完成：`dashboard/login/info/service-settings` 已对齐最新 Web 消费结构。
- 商家 Web 已切换到统一 API 解包与强类型调用，减少页面级响应解析分叉。
- 工长经营闭环完成：入驻、登录、设置、案例菜单（“施工案例”）可达。
- 财务高风险操作补齐：提现与银行卡新增均接入短信验证码字段与交互。
- 文档同步进行中：以 `API_CHANGES.md` 与本报告作为阶段1落地基线。

---

## 2. 关键风险与问题 (P0 - 需立即修复)

根据代码审查及架构对比，当前系统存在以下**极高风险**，需在上线前优先解决：

### ❌ 安全漏洞
1.  **验证码硬编码**: 注册与登录接口使用固定验证码 `123456`，在生产环境将导致任意账号接管风险。
2.  **敏感信息明文**: 身份证号、银行卡号在数据库中可能以明文存储（虽有 `crypto` 工具但需确认是否全链路应用），违反合规要求。
3.  **资金并发安全**: 提现扣减余额操作缺乏数据库锁或分布式锁，在高并发下存在资金“双花”或扣减为负的风险。

### ❌ 架构缺陷
4.  **数据隔离不严**: 尽管有中间件，但部分查询接口可能未强制追加 `provider_id` 过滤，存在越权查询风险。
5.  **OSS 未集成**: 图片上传目前仅模拟返回 URL，未实际上传到云存储，数据无法持久化。

---

## 3. 功能缺失清单 (Vs 设计方案)

与原定《商家中心技术设计方案》相比，以下功能尚未实现或仅为 Mock 状态：

### 🚧 核心功能缺失
- **真实短信服务**: 未对接阿里云/腾讯云短信网关。
- **支付/转账集成**: 提现仅记录数据，未对接微信支付/支付宝企业付款或银行银企直连 API。
- **即时通讯 (IM)**: 后端 WebSocket 基础已就绪，但前端商家端未开发聊天界面，无法与用户直接沟通。
- **消息通知中心**: 缺乏站内信、审核结果通知、新订单推送功能。
- **合同/电子签**: 入驻及交易过程中的电子合同签署模块缺失。

### 📉 运营与管理缺失
- **子账号体系**: 缺乏装修公司内部的角色管理（如管理员、普通设计师、财务）。
- **数据分析**: 缺乏详细的流量、转化率、营收报表。
- **风控系统**: 缺乏对异常登录、大额提现、频繁操作的自动风控拦截。

---

## 4. 改进计划建议

### 第一阶段：P0 安全修复 (预计 3-5 天)
1.  **对接短信网关**: 移除 `123456`，实现真实手机号验证。
2.  **数据加密升级**: 确保所有 PII (个人隐私信息) 字段落库前必经过 `AES-256` 加密。
3.  **资金事务锁**: 在 `Withdraw` Handler 中引入数据库排他锁 (`FOR UPDATE`) 或 Redis 分布式锁。
4.  **OSS 集成**: 替换前端 Mock Upload 为真实 OSS 直传或后端中转上传。

### 第二阶段：业务完善 (预计 1-2 周)
1.  **提现工作流**: 完善 Admin 端的提现审核、打款确认流程。
2.  **数据权限复查**: 全面 Review 所有商家端 API，确保 SQL 均包含 `WHERE provider_id = ?`。
3.  **消息中心**: 实现基础的站内信通知。

### 第三阶段：长期规划 (3-6 个月)
1.  **子账号与 RBAC**: 支持企业级权限管理。
2.  **对账与税务**: 自动生成月度对账单，支持发票管理。
3.  **BI 数据看板**: 深度业务洞察。
