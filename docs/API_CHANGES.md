# API 接口变更清单

> **文档版本**: v2.0 (与 PRD v2.0 对齐)
> **创建日期**: 2026-03-17
> **文档状态**: API 变更记录与 PRD 对齐说明
> **适用范围**: 全体研发、测试人员

---

## 0. 与新版 PRD 对齐原则

### 0.1 主链路接口定义

本文档记录的所有 API 接口变更，必须与 [产品需求文档(PRD).md](./产品需求文档(PRD).md) v2.0 和 [BUSINESS_FLOW.md](./BUSINESS_FLOW.md) v2.0 保持一致。

**主链路接口**（属于基线，必须实现）：

| 主链路节点 | 关键接口 | 是否基线 |
|-----------|---------|---------|
| 商家入驻与能力配置 | `POST /api/v1/merchant/apply` | ✅ 是 |
| 用户需求进入线索/预约 | `POST /api/v1/bookings` | ✅ 是 |
| 设计沟通、量房、预算确认 | `POST /api/v1/bookings/:id/site-survey` | ✅ 是 |
| 设计方案/报价提交与确认 | `POST /api/v1/proposals`, `POST /api/v1/proposals/:id/confirm` | ✅ 是 |
| 工长选择与确认 | `POST /api/v1/quote-tasks`, `POST /api/v1/quote-tasks/:id/confirm` | ✅ 是 |
| 订单生成、业务闭环与项目创建 | `POST /api/v1/orders`, `POST /api/v1/projects` | ✅ 是 |
| 项目阶段执行与资金流转 | `POST /api/v1/projects/:id/milestones/:milestoneId/submit` | ✅ 是 |
| 验收、放款、退款、关闭 | `POST /api/v1/projects/:id/milestones/:milestoneId/approve` | ✅ 是 |

---

### 0.2 历史兼容接口

**历史兼容接口**（非基线，但需保留兼容）：

| 接口 | 说明 | 是否基线 |
|------|------|---------|
| `GET /api/v1/notifications` | 通知列表（支撑性能力） | ❌ 否 |
| `POST /api/v1/merchant/withdraws` | 商家提现（支撑性能力） | ❌ 否 |
| `GET /api/v1/admin/system/cron-metrics` | 定时任务监控（运营工具） | ❌ 否 |

---

### 0.3 非基线接口

**非基线接口**（增项，暂不实现）：

| 接口 | 说明 | 是否基线 |
|------|------|---------|
| `POST /api/v1/ai/design` | AI 免费设计 | ❌ 否（增项） |
| `GET /api/v1/bim/viewer` | BIM 协同查看器 | ❌ 否（增项） |
| `POST /api/v1/ar/try-on` | AR 试衣间 | ❌ 否（增项） |

---

## 1. 最新变更（2026-03-17）

### 1.1 与 PRD v2.0 对齐

**变更范围**：
- 所有主链路接口必须与 PRD v2.0 定义的 9 个节点对齐
- 所有接口必须支持两个独立成交点（设计确认、工长确认）
- 所有接口必须支持分阶段验收/整体验收双模式
- 所有接口必须支持异常收口（退款/关闭/审计）

**行为变更**：
- 设计方案确认后，业务不再停留在 proposal，自然推进到施工确认链路
- 现有 `quote workflow` 正式承接"施工方确认 + 施工报价确认"
- 用户确认施工报价后：锁定施工方与报价版本，项目进入 `ready_to_start`，主链进入 `ready_to_start`
- 最后一个节点验收通过后，项目进入 `completed`
- 用户或平台触发完工收口后，生成项目对应的灵感案例草稿；默认不自动公开，只进入审核链

---

## 2. 历史变更记录

### 2.1 2026-03-16 业务闭环主链一期（完工 + 案例草稿）

**变更范围**：
- 新增聚合表：`business_flows`
- 新增迁移：
  - `server/migrations/v1.9.7_add_business_flows.sql`
  - `server/migrations/v1.10.5_backfill_business_flows.sql`
- 新增/增强接口：
  - `POST /api/v1/projects/:id/start`
  - `POST /api/v1/projects/:id/milestones/:milestoneId/submit`
  - `POST /api/v1/projects/:id/milestones/:milestoneId/approve`
  - `POST /api/v1/projects/:id/milestones/:milestoneId/reject`
  - `POST /api/v1/projects/:id/complete`
  - `POST /api/v1/projects/:id/inspiration-draft`
  - `GET /api/v1/quote-tasks/:id/user-view`
  - 既有 `quote-list / quote-task / project detail` 接口补充闭环摘要字段

**数据模型变更**：
- `business_flows` 作为主链聚合根，负责串联：
  - 预约/需求来源
  - 设计确认
  - 施工方确认
  - 施工报价确认
  - 项目开工与验收
  - 完工后的案例草稿沉淀
- `projects` 新增：
  - `selected_quote_submission_id`
  - `construction_quote_snapshot`
  - `inspiration_case_draft_id`
- `milestones` 新增：
  - `rejection_reason`
- `case_audits` 新增来源追溯字段：
  - `source_type`
  - `source_project_id`
  - `source_proposal_id`

**新增统一闭环字段**：
以下详情/列表接口开始统一返回：
- `businessStage`
- `flowSummary`
- `availableActions`

项目详情额外返回：
- `selectedQuoteTaskId`
- `selectedForemanProviderId`
- `selectedQuoteSubmissionId`
- `inspirationCaseDraftId`

**阶段口径**：
统一主链阶段枚举：
- `lead_pending`
- `consulting`
- `proposal_pending`
- `proposal_confirmed`
- `constructor_pending`
- `construction_quote_pending`
- `ready_to_start`
- `in_progress`
- `milestone_review`
- `completed`
- `archived`
- `disputed`
- `cancelled`

---

### 2.2 2026-03-09 入驻验证码前置校验统一（v1.6.x）

**变更范围**：
- `POST /api/v1/merchant/onboarding/verify-phone`
- `POST /api/v1/merchant/apply`
- `POST /api/v1/material-shop/apply`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `POST /api/v1/material-shop/apply/:id/resubmit`

**行为变更**：
- 首次入驻与驳回重提统一为"第一步真实验证码校验"
- 第一步校验成功后返回：
  - `verificationToken`
  - `verifiedPhone`
  - `expiresAt`
- 驳回重提模式下，`verify-phone` 校验成功后可同时返回 `form` 回填数据
- `apply / resubmit` 主路径改为优先校验 `verificationToken`；兼容窗口内仍允许 `code` 兜底，但不允许无凭据提交

**前端交互统一**：
- 用户点击第一步"下一步"时立即校验验证码
- 验证码错误时停留在当前步骤内直接修改，不再等到最终提交时才报错
- 手机号未变化时，返回前序步骤不要求重复验证；手机号变化时自动清空已验证状态

---

### 2.3 2026-03-08 驳回重提详情回填安全修复（P0/P1）

**变更范围**：
- `POST /api/v1/merchant/apply/:id/detail-for-resubmit`
- `POST /api/v1/material-shop/apply/:id/detail-for-resubmit`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `POST /api/v1/material-shop/apply/:id/resubmit`

**行为变更**：
- `detail-for-resubmit` 从匿名 GET 升级为带 `phone + code` 的 POST，必须先通过 `identity_apply` 验证码校验后才返回原申请表单详情
- `detail-for-resubmit` 响应新增 `resubmitToken`，用于保护后续重提提交链路
- 两个 `resubmit` 接口优先校验 `resubmitToken`；兼容窗口内仍允许 `code` 作为后备凭据，但不允许无 token / 无验证码直接重提

**影响说明**：
- 前端重提回填必须先调用新的 POST 详情接口，再使用返回的 `resubmitToken` 提交
- 旧的匿名详情路径不再继续使用，避免按申请 ID 直接读取敏感回填信息

---

### 2.4 2026-03-09 认证/入驻 schema 统一修复（v1.6.4）

**背景**：
- 部分环境存在认证链路与商家入驻链路 schema 漂移：`users.public_id/last_login_*` 缺失、`sms_audit_logs` 缺失、历史入驻字段未补齐
- 旧 dump 文件可能把过期 schema 再导回环境，导致本地与生产重复出现 `column does not exist`

**变更范围**：
- 新增统一幂等迁移脚本：
  - `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`
- 健康检查新增：
  - `checks.userAuthSchema`
  - `checks.merchantOnboardingSchema`
- 生产环境新增关键 schema 启动前预检，缺失时 fail-fast

**修复内容**：
- 补齐 `users.public_id`、`users.last_login_at`、`users.last_login_ip`
- 补齐 `sms_audit_logs` 及索引
- 补齐商家入驻与主材商入驻关键字段/表，并统一纳入 `server/migrations/`
- 认证/入驻链路在 schema mismatch 时返回 `503`，不再误报为 `400`

**执行建议**：
- 本地/测试/预发/生产统一优先执行 `v1.6.4`（幂等，可重复执行）
- 执行后重启 API，并检查 `/api/v1/health` 中 `smsAuditLog/userAuthSchema/merchantOnboardingSchema` 均为 `ok`

---

### 2.5 2026-03-05 入驻条款勾选留痕（v1.5.2）

**变更范围**：
- `POST /api/v1/merchant/apply`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `POST /api/v1/material-shop/apply`
- `POST /api/v1/material-shop/apply/:id/resubmit`
- `merchant_applications` 表结构
- `material_shop_applications` 表结构

**请求字段新增**：
所有入驻提交接口新增必填字段：

```json
"legalAcceptance": {
  "accepted": true,
  "onboardingAgreementVersion": "v1.0.0-20260305",
  "platformRulesVersion": "v1.0.0-20260305",
  "privacyDataProcessingVersion": "v1.0.0-20260305"
}
```

**后端硬校验**：
- `accepted` 必须为 `true`
- 三个条款版本字段不能为空，且长度限制为 `1-64`
- 任意不满足时返回 `400` 与明确错误信息

**留痕字段**：
两张申请表新增：
- `legal_acceptance_json`（TEXT，存版本快照）
- `legal_accepted_at`（TIMESTAMP，记录服务端确认时间）
- `legal_accept_source`（VARCHAR，默认 `merchant_web`）

**版本管理规则**：
- 条款版本号由前端常量统一维护（本期：`v1.0.0-20260305`）
- 条款正文更新时，需同步更新：
  - `admin/src/constants/merchantLegal.ts`
  - `docs/legal/*.md`
  - `server/docs/API接口文档.md`

---

### 2.6 2026-03-05 商家入驻字段全量补齐（v1.5.1）

**变更范围**：
- `POST /api/v1/merchant/apply`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `POST /api/v1/material-shop/apply`
- `POST /api/v1/material-shop/apply/:id/resubmit`
- `GET /api/v1/merchant/info`
- `PUT /api/v1/merchant/info`
- `GET /api/v1/designers/:id` / `GET /api/v1/foremen/:id` / `GET /api/v1/companies/:id`（字段消费对齐）

**服务商入驻升级**：
- 新增并强制必填：`avatar: string`
- `yearsExperience` 强化为设计师/工长必填，范围 `1-50`
- `portfolioCases[].description` 改为必填，长度 `1-5000`
- 审核通过映射补齐：`avatar/highlightTags/pricing/graduateSchool/designPhilosophy` 写入 `providers`

**主材商入驻升级**：
- 强制必填：`contactName`、`contactPhone`、`businessHours`、`address`
- `contactPhone` 必须通过手机号格式校验
- 继续维持主材商品硬校验：`products` 数量 `5-20`，每商品至少 1 图，参数对象与价格必填

**校验与安全**：
- 服务端硬校验优先，前端仅做提前校验与提示
- 新增资质核验适配层（默认 `manual`）：
  - `ID_CARD_VERIFY_PROVIDER=manual|xxx`
  - `LICENSE_VERIFY_PROVIDER=manual|xxx`
  - `VERIFY_TIMEOUT_MS`
- 证件号继续走加密存储逻辑（`encryptSensitiveOrPlain`），日志禁止明文输出证件号与手机号

**兼容性说明**：
- 旧字段 `applicantType` 继续兼容，灰度期内与 `role/entityType` 并存
- C 端接口结构不破坏，新增字段按"有值显示、空值隐藏"策略消费

---

### 2.7 2026-03-03 商家入驻与登录统一改版（v1.5.0）

**变更范围**：
- `POST /api/v1/merchant/login`
- `POST /api/v1/merchant/apply`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `GET /api/v1/merchant/apply/:phone/status`
- `POST /api/v1/merchant/change-application`（新增）
- `POST /api/v1/material-shop/apply`（新增）
- `GET /api/v1/material-shop/apply/:phone/status`（新增）
- `POST /api/v1/material-shop/apply/:id/resubmit`（新增）
- `GET /api/v1/material-shop/me`（新增）
- `PUT /api/v1/material-shop/me`（新增）
- `GET /api/v1/material-shop/me/products`（新增）
- `POST /api/v1/material-shop/me/products`（新增）
- `PUT /api/v1/material-shop/me/products/:id`（新增）
- `DELETE /api/v1/material-shop/me/products/:id`（新增）

**关键变更**：
- `merchant/login` 成功时返回新增：
  - `merchantKind: provider|material_shop`
  - `role`
  - `entityType`
  - 兼容字段 `provider.applicantType/provider.providerSubType`
- `merchant/login` 失败时支持结构化引导：
  - `data.nextAction: APPLY|PENDING|RESUBMIT|CHANGE_ROLE`
  - `data.applyStatus`（可选）
- 服务商申请模型升级：
  - 新增 `role: designer|foreman|company`
  - 新增 `entityType: personal|company`
  - 新增 `highlightTags: string[]`
  - 新增 `pricing: object`
  - 新增 `graduateSchool?: string`
  - 新增 `designPhilosophy?: string`
  - 继续兼容旧字段 `applicantType`
- 主材商申请改为独立通道，不再并入 `merchant/apply`

**校验规则**：
- 服务商规则由后端硬校验：
  - 设计师：3套案例，每套3-6图，风格1-3，报价需平层/复式/其他
  - 工长：3套案例，每套8-12图，亮点1-3，工种>=1，报价需 `perSqm`
  - 装修公司：3套案例，报价需全包/半包，企业执照必填
- 主材商规则由后端硬校验：
  - 商品数 5-20
  - 每个商品至少1图，且必须包含参数对象与价格
  - 营业执照号与执照图片必填

**兼容性说明**：
- 旧 `applicantType` 仍保留并在服务端映射到新模型
- `providers.work_types` 支持 JSON 数组与逗号串双格式读取，保证 C 端兼容

---

## 3. 附录

### 3.1 变更记录

| 版本 | 日期 | 变更内容 | 变更人 |
|------|------|---------|-------|
| v2.0 | 2026-03-17 | 增加"与新版 PRD 对齐原则"，明确主链路接口、历史兼容接口、非基线接口 | 产品团队 |
| v1.0 | 2025-12-30 | 初版，记录历史 API 变更 | 研发团队 |

---

**文档结束**
