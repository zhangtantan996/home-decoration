# MVP 交易闭环 — 实施细节与 UI 布局方案

## Context

本文档是 `docs/mvp-implementation-plan.md`（总体方案）的实施细节补充，聚焦每个 Phase 的具体实现：数据库字段定义、后端接口契约、三端页面 UI 布局（含 ASCII 线框图）。

设计原则：
- User Web：复用现有设计令牌 (`web/src/app/tokens.css`) 和组件模式（card/section-card/split-layout/form-grid/timeline）
- Merchant Web：复用 Ant Design 5.x + 现有 MerchantLayout 侧边栏模式
- Admin Web：复用 Ant Design 5.x + ProTable/Card/Modal/Drawer 模式

---

## 一、数据库详细设计

### 1.1 demands 表

```sql
CREATE TABLE demands (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    demand_type     VARCHAR(30) NOT NULL DEFAULT 'renovation',
    -- 枚举: renovation(整装), design(纯设计), partial(局部翻新), material(选材)
    title           VARCHAR(200) NOT NULL DEFAULT '',
    city            VARCHAR(50)  NOT NULL DEFAULT '',
    district        VARCHAR(50)  NOT NULL DEFAULT '',
    address         VARCHAR(300) NOT NULL DEFAULT '',
    area            DECIMAL(10,2),                          -- 建筑面积 m²
    budget_min      DECIMAL(12,2),                          -- 预算下限
    budget_max      DECIMAL(12,2),                          -- 预算上限
    timeline        VARCHAR(30)  NOT NULL DEFAULT '',       -- 枚举: urgent/1month/3month/flexible
    style_pref      VARCHAR(100) NOT NULL DEFAULT '',       -- 风格偏好，逗号分隔
    description     TEXT         NOT NULL DEFAULT '',
    attachments     JSONB        NOT NULL DEFAULT '[]',     -- [{url, name, size}]
    -- 状态机
    status          VARCHAR(20)  NOT NULL DEFAULT 'draft',
    -- 枚举: draft → submitted → reviewing → approved → matching → matched → closed
    reviewer_id     BIGINT REFERENCES admins(id),
    review_note     TEXT         NOT NULL DEFAULT '',
    reviewed_at     TIMESTAMPTZ,
    matched_count   INT          NOT NULL DEFAULT 0,        -- 已匹配商家数
    max_match       INT          NOT NULL DEFAULT 3,        -- 最大匹配数
    closed_reason   VARCHAR(50)  NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_demands_user_id ON demands(user_id);
CREATE INDEX idx_demands_status  ON demands(status);
```

### 1.2 demand_matches 表

```sql
CREATE TABLE demand_matches (
    id                BIGSERIAL PRIMARY KEY,
    demand_id         BIGINT NOT NULL REFERENCES demands(id),
    provider_id       BIGINT NOT NULL REFERENCES providers(id),
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 枚举: pending → accepted/declined → quoted
    assigned_by       BIGINT REFERENCES admins(id),         -- 分配人
    assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_deadline TIMESTAMPTZ,                          -- 响应截止时间
    responded_at      TIMESTAMPTZ,
    decline_reason    VARCHAR(300) NOT NULL DEFAULT '',
    proposal_id       BIGINT REFERENCES proposals(id),      -- 关联报价/方案
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(demand_id, provider_id)
);

CREATE INDEX idx_demand_matches_demand   ON demand_matches(demand_id);
CREATE INDEX idx_demand_matches_provider ON demand_matches(provider_id, status);
```

### 1.3 contracts 表

```sql
CREATE TABLE contracts (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT REFERENCES projects(id),
    demand_id       BIGINT REFERENCES demands(id),
    provider_id     BIGINT NOT NULL REFERENCES providers(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    contract_no     VARCHAR(50) NOT NULL DEFAULT '',        -- 合同编号
    title           VARCHAR(200) NOT NULL DEFAULT '',
    total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_plan    JSONB NOT NULL DEFAULT '[]',
    -- [{phase, name, amount, percentage, trigger_event}]
    attachment_urls JSONB NOT NULL DEFAULT '[]',            -- 合同附件
    terms_snapshot  JSONB NOT NULL DEFAULT '{}',            -- 条款快照
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- 枚举: draft → pending_confirm → confirmed → active → completed → terminated
    confirmed_at    TIMESTAMPTZ,
    activated_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    terminated_at   TIMESTAMPTZ,
    terminate_reason VARCHAR(300) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_project  ON contracts(project_id);
CREATE INDEX idx_contracts_user     ON contracts(user_id);
CREATE INDEX idx_contracts_provider ON contracts(provider_id);
```

### 1.4 Phase 2 新增表（预览）

```sql
-- 变更单
CREATE TABLE change_orders (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id),
    contract_id     BIGINT REFERENCES contracts(id),
    initiator_type  VARCHAR(20) NOT NULL,  -- user / provider
    initiator_id    BIGINT NOT NULL,
    title           VARCHAR(200) NOT NULL DEFAULT '',
    reason          TEXT NOT NULL DEFAULT '',
    items           JSONB NOT NULL DEFAULT '[]',
    -- [{description, original_amount, new_amount, diff}]
    amount_impact   DECIMAL(12,2) NOT NULL DEFAULT 0,
    timeline_impact INT NOT NULL DEFAULT 0,  -- 天数
    evidence_urls   JSONB NOT NULL DEFAULT '[]',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending → user_confirmed/user_rejected/admin_intervened
    resolved_by     BIGINT REFERENCES admins(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 投诉/争议
CREATE TABLE complaints (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT REFERENCES projects(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    provider_id     BIGINT REFERENCES providers(id),
    category        VARCHAR(50) NOT NULL,
    -- quality/delay/price/attitude/safety/other
    title           VARCHAR(200) NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    evidence_urls   JSONB NOT NULL DEFAULT '[]',
    status          VARCHAR(20) NOT NULL DEFAULT 'submitted',
    -- submitted → processing → resolved → closed
    resolution      TEXT NOT NULL DEFAULT '',
    admin_id        BIGINT REFERENCES admins(id),
    freeze_payment  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 项目评价
CREATE TABLE evaluations (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    provider_id     BIGINT NOT NULL REFERENCES providers(id),
    overall_score   DECIMAL(2,1) NOT NULL,  -- 1.0 ~ 5.0
    dimension_scores JSONB NOT NULL DEFAULT '{}',
    -- {design, quality, schedule, communication, value}
    content         TEXT NOT NULL DEFAULT '',
    image_urls      JSONB NOT NULL DEFAULT '[]',
    is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);
```

---

## 二、后端接口契约（Phase 1）

### 2.1 用户端 — 需求 CRUD

#### POST /api/v1/demands — 创建需求

```json
// Request
{
  "demand_type": "renovation",
  "title": "三室两厅现代简约装修",
  "city": "北京",
  "district": "朝阳区",
  "address": "望京SOHO T3 1201",
  "area": 120,
  "budget_min": 150000,
  "budget_max": 300000,
  "timeline": "3month",
  "style_pref": "现代简约,北欧",
  "description": "三室两厅，希望整体风格简洁明亮...",
  "attachments": [{"url": "...", "name": "户型图.jpg", "size": 1024000}]
}

// Response 201
{
  "id": 1,
  "status": "draft",
  "created_at": "2026-03-13T10:00:00Z"
}
```

#### POST /api/v1/demands/:id/submit — 提交草稿

```json
// Response 200
{ "id": 1, "status": "submitted" }
```

#### GET /api/v1/demands — 用户需求列表

```
Query: ?status=submitted&page=1&page_size=10
Response: { "items": [...], "total": 5, "page": 1, "page_size": 10 }
```

#### GET /api/v1/demands/:id — 需求详情（含匹配商家）

```json
{
  "id": 1,
  "status": "matched",
  "title": "三室两厅现代简约装修",
  "matches": [
    {
      "id": 10,
      "provider": { "id": 5, "name": "张设计师", "avatar": "...", "rating": 4.8 },
      "status": "quoted",
      "proposal": { "id": 20, "total_amount": 180000, "created_at": "..." }
    }
  ],
  ...
}
```

### 2.2 管理端 — 需求审核/分配

#### GET /api/v1/admin/demands — 需求列表

```
Query: ?status=submitted&page=1&page_size=20
```

#### POST /api/v1/admin/demands/:id/review — 审核

```json
// Request
{ "action": "approve", "note": "需求信息完整" }
// action 枚举: approve / reject
```

#### POST /api/v1/admin/demands/:id/assign — 分配商家

```json
// Request
{
  "provider_ids": [5, 12, 18],
  "response_deadline_hours": 48
}
```

#### GET /api/v1/admin/demands/:id/candidates — 匹配候选商家

```
Query: ?city=北京&type=designer&page=1
Response: { "items": [{ provider info + match score }], "total": 30 }
```

### 2.3 商家端 — 线索管理

#### GET /api/v1/merchant/leads — 分配线索列表

```
Query: ?status=pending&page=1&page_size=10
Response: { "items": [{ demand summary + match info }], "total": 3 }
```

#### POST /api/v1/merchant/leads/:id/accept — 接受线索

```json
// Response 200
{ "id": 10, "status": "accepted" }
```

#### POST /api/v1/merchant/leads/:id/decline — 拒绝线索

```json
// Request
{ "reason": "近期排期已满" }
```

### 2.4 合同相关（Phase 1 预埋）

#### POST /api/v1/contracts — 创建合同（商家发起）

```json
// Request
{
  "demand_id": 1,
  "user_id": 100,
  "title": "三室两厅现代简约装修合同",
  "total_amount": 180000,
  "payment_plan": [
    { "phase": 1, "name": "签约定金", "amount": 18000, "percentage": 10, "trigger_event": "contract_confirmed" },
    { "phase": 2, "name": "开工款", "amount": 54000, "percentage": 30, "trigger_event": "construction_start" },
    { "phase": 3, "name": "中期验收款", "amount": 54000, "percentage": 30, "trigger_event": "midterm_acceptance" },
    { "phase": 4, "name": "竣工验收款", "amount": 45000, "percentage": 25, "trigger_event": "final_acceptance" },
    { "phase": 5, "name": "质保金", "amount": 9000, "percentage": 5, "trigger_event": "warranty_end" }
  ],
  "attachment_urls": ["https://..."]
}

// Response 201
{ "id": 1, "contract_no": "CT-20260313-0001", "status": "draft" }
```

#### POST /api/v1/contracts/:id/confirm — 用户确认合同

```json
// Response 200
{ "id": 1, "status": "confirmed", "confirmed_at": "2026-03-14T10:00:00Z" }
```

---

## 三、User Web UI 布局方案（Phase 1）

> 复用：`tokens.css` 设计令牌 + `app.scss` 全局组件类（card / section-card / form-grid / split-shell / timeline / status-chip）

### 3.1 需求提交页 `/demands/new`

**布局**：单栏表单页，使用 `form-grid` 模式。

```
┌─────────────────────────────────────────────────────┐
│  AuthenticatedAppLayout (header + nav)              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ container page-stack ─────────────────────────┐ │
│  │                                                 │ │
│  │  ┌─ section-card ────────────────────────────┐  │ │
│  │  │  page-title: "发布装修需求"                │  │ │
│  │  │  kicker: "描述您的装修需求，平台将为您…"   │  │ │
│  │  └───────────────────────────────────────────┘  │ │
│  │                                                 │ │
│  │  ┌─ card section-card ───────────────────────┐  │ │
│  │  │  section-title: "基本信息"                 │  │ │
│  │  │  ┌─ form-grid ──────────────────────────┐  │  │ │
│  │  │  │  [需求类型 ▼]     [城市 ▼]           │  │  │ │
│  │  │  │  [区域 ▼]         [面积 _____ m²]    │  │  │ │
│  │  │  │  [预算范围 _____ ~ _____ 元]         │  │  │ │
│  │  │  │  [期望工期 ▼]                        │  │  │ │
│  │  │  └──────────────────────────────────────┘  │  │ │
│  │  └───────────────────────────────────────────┘  │ │
│  │                                                 │ │
│  │  ┌─ card section-card ───────────────────────┐  │ │
│  │  │  section-title: "风格偏好"                 │  │ │
│  │  │  ┌─ filter-chip 组 ─────────────────────┐  │  │ │
│  │  │  │ [现代简约] [北欧] [日式] [中式]      │  │  │ │
│  │  │  │ [轻奢] [工业风] [美式] [法式]        │  │  │ │
│  │  │  └──────────────────────────────────────┘  │  │ │
│  │  └───────────────────────────────────────────┘  │ │
│  │                                                 │ │
│  │  ┌─ card section-card ───────────────────────┐  │ │
│  │  │  section-title: "需求描述"                 │  │ │
│  │  │  [textarea ________________________]       │  │ │
│  │  │  [textarea ________________________]       │  │ │
│  │  │  field-help: "0/500"                       │  │ │
│  │  └───────────────────────────────────────────┘  │ │
│  │                                                 │ │
│  │  ┌─ card section-card ───────────────────────┐  │ │
│  │  │  section-title: "附件上传"                 │  │ │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐              │  │ │
│  │  │  │ +上传 │ │ 图1  │ │ 图2  │              │  │ │
│  │  │  └──────┘ └──────┘ └──────┘              │  │ │
│  │  │  field-help: "支持户型图、参考图片"        │  │ │
│  │  └───────────────────────────────────────────┘  │ │
│  │                                                 │ │
│  │  ┌─ 操作栏 (sticky bottom) ──────────────────┐  │ │
│  │  │  [button-outline: 保存草稿]  [button: 提交需求] │ │
│  │  └───────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**组件映射**：
| 区域 | CSS 类 / 组件 |
|------|--------------|
| 外层容器 | `.container .page-stack` |
| 表单分区 | `.card .section-card` |
| 表单网格 | `.form-grid` (2列) + `.field` |
| 风格选择 | `.filter-chip[data-active]` 多选 |
| 附件上传 | 自定义 `FileUpload` 组件 |
| 操作按钮 | `.button` / `.button-outline` |

---

### 3.2 我的需求列表 `/me/demands`

**布局**：个人中心工作区列表页，复用 `ProfileWorkspaceLayout` + `workspace-shell` 模式。

```
┌─ ProfileWorkspaceLayout ────────────────────────────┐
│  sidebar │  workspace-shell                         │
│          │                                          │
│  我的预约 │  ┌─ card section-card (过滤栏) ────────┐ │
│  我的报价 │  │  [filter-chip: 全部]                 │ │
│  我的项目 │  │  [filter-chip: 待审核]               │ │
│  我的订单 │  │  [filter-chip: 已匹配]               │ │
│ *我的需求*│  │  [filter-chip: 已关闭]               │ │
│  我的消息 │  └──────────────────────────────────────┘ │
│  售后服务 │                                          │
│  设置    │  ┌─ card section-card (列表) ────────────┐ │
│          │  │  ┌─ list-stack ───────────────────┐   │ │
│          │  │  │                                 │   │ │
│          │  │  │  ┌─ list-card ───────────────┐  │   │ │
│          │  │  │  │  三室两厅现代简约装修      │  │   │ │
│          │  │  │  │  北京·朝阳 | 120m² | 15-30万│  │  │ │
│          │  │  │  │  [status-chip: 已匹配]     │  │   │ │
│          │  │  │  │  已匹配 2/3 家  2026-03-13 │  │   │ │
│          │  │  │  └────────────────────────────┘  │   │ │
│          │  │  │                                 │   │ │
│          │  │  │  ┌─ list-card ───────────────┐  │   │ │
│          │  │  │  │  ...                       │  │   │ │
│          │  │  │  └────────────────────────────┘  │   │ │
│          │  │  └─────────────────────────────────┘   │ │
│          │  │  Pagination                            │ │
│          │  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**组件映射**：
| 区域 | CSS 类 / 组件 |
|------|--------------|
| 布局 | `ProfileWorkspaceLayout` → `.workspace-shell` |
| 过滤栏 | `.filter-chip[data-active]` |
| 列表 | `.list-stack` > `.list-card` |
| 状态标签 | `.status-chip[data-tone="brand/success/warning"]` |
| 分页 | `Pagination` 组件 |

---

### 3.3 需求详情页 `/demands/:id`

**布局**：双栏分割，复用 `split-shell` 模式（同 ProjectDetailPage）。

```
┌─ container page-stack ──────────────────────────────────┐
│                                                         │
│  ┌─ StatusBanner ─────────────────────────────────────┐ │
│  │  status-chip: "已匹配" | "平台已为您匹配3家商家"   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ split-shell ──────────────────────────────────────┐ │
│  │                                                     │ │
│  │  ┌─ dashboard-shell (主栏 1.35fr) ──────────────┐  │ │
│  │  │                                               │  │ │
│  │  │  ┌─ section-card: "需求信息" ──────────────┐  │  │ │
│  │  │  │  detail-grid-two                         │  │  │ │
│  │  │  │  需求类型:  整装装修                     │  │  │ │
│  │  │  │  城市区域:  北京·朝阳                    │  │  │ │
│  │  │  │  建筑面积:  120 m²                       │  │  │ │
│  │  │  │  预算范围:  15-30万                      │  │  │ │
│  │  │  │  期望工期:  3个月内                      │  │  │ │
│  │  │  │  风格偏好:  [tag:现代简约] [tag:北欧]    │  │  │ │
│  │  │  │  描述:  三室两厅，希望整体风格简洁…      │  │  │ │
│  │  │  │  附件:  [户型图.jpg] [参考图.png]        │  │  │ │
│  │  │  └──────────────────────────────────────────┘  │  │ │
│  │  │                                               │  │ │
│  │  │  ┌─ section-card: "匹配商家" ──────────────┐  │  │ │
│  │  │  │  ┌─ surface-card ─────────────────────┐  │  │  │ │
│  │  │  │  │  [avatar] 张设计师  ★4.8           │  │  │  │ │
│  │  │  │  │  [status-chip: 已报价]              │  │  │  │ │
│  │  │  │  │  报价: ¥180,000                     │  │  │  │ │
│  │  │  │  │  [button-outline: 查看方案]         │  │  │  │ │
│  │  │  │  └────────────────────────────────────┘  │  │  │ │
│  │  │  │  ┌─ surface-card ─────────────────────┐  │  │  │ │
│  │  │  │  │  [avatar] 李工长  ★4.5             │  │  │  │ │
│  │  │  │  │  [status-chip: 待响应]              │  │  │  │ │
│  │  │  │  └────────────────────────────────────┘  │  │  │ │
│  │  │  └──────────────────────────────────────────┘  │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  ┌─ dashboard-shell (侧栏 0.85fr) ──────────────┐  │ │
│  │  │                                               │  │ │
│  │  │  ┌─ section-card: "需求状态" ──────────────┐  │  │ │
│  │  │  │  timeline-list                           │  │  │ │
│  │  │  │  ● 已匹配     2026-03-14               │  │  │ │
│  │  │  │  ● 审核通过   2026-03-13               │  │  │ │
│  │  │  │  ● 已提交     2026-03-13               │  │  │ │
│  │  │  │  ○ 已创建     2026-03-13               │  │  │ │
│  │  │  └──────────────────────────────────────────┘  │  │ │
│  │  │                                               │  │ │
│  │  │  ┌─ section-card: "操作" ──────────────────┐  │  │ │
│  │  │  │  [button: 对比报价]                      │  │  │ │
│  │  │  │  [button-outline: 编辑需求]              │  │  │ │
│  │  │  │  [button-ghost: 关闭需求]                │  │  │ │
│  │  │  └──────────────────────────────────────────┘  │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

### 3.4 报价/方案对比页 `/demands/:id/compare`

**布局**：全宽对比视图，使用 `grid-3` 响应式网格。

```
┌─ container page-stack ──────────────────────────────────┐
│                                                         │
│  ┌─ section-card ───────────────────────────────────┐   │
│  │  page-title: "报价方案对比"                       │   │
│  │  kicker: "三室两厅现代简约装修 · 3家商家报价"     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ grid-3 ─────────────────────────────────────────┐   │
│  │                                                   │   │
│  │  ┌─ card ──────┐  ┌─ card ──────┐  ┌─ card ────┐ │   │
│  │  │ [avatar]    │  │ [avatar]    │  │ [avatar]  │ │   │
│  │  │ 张设计师    │  │ 王装饰公司  │  │ 李工长    │ │   │
│  │  │ ★4.8       │  │ ★4.6       │  │ ★4.5     │ │   │
│  │  │             │  │             │  │           │ │   │
│  │  │ ¥180,000   │  │ ¥210,000   │  │ ¥155,000 │ │   │
│  │  │             │  │             │  │           │ │   │
│  │  │ 工期: 75天  │  │ 工期: 90天  │  │ 工期: 60天│ │   │
│  │  │             │  │             │  │           │ │   │
│  │  │ 设计费     │  │ 设计费     │  │ --        │ │   │
│  │  │ ¥15,000    │  │ ¥20,000    │  │           │ │   │
│  │  │             │  │             │  │           │ │   │
│  │  │ 施工费     │  │ 施工费     │  │ 施工费    │ │   │
│  │  │ ¥120,000   │  │ ¥140,000   │  │ ¥115,000 │ │   │
│  │  │             │  │             │  │           │ │   │
│  │  │ 主材费     │  │ 主材费     │  │ 主材费    │ │   │
│  │  │ ¥45,000    │  │ ¥50,000    │  │ ¥40,000  │ │   │
│  │  │             │  │             │  │           │ │   │
│  │  │ [button:    │  │ [button-   │  │ [button- │ │   │
│  │  │  选择此方案]│  │  outline:  │  │  outline: │ │   │
│  │  │             │  │  查看详情] │  │  查看详情]│ │   │
│  │  └─────────────┘  └─────────────┘  └──────────┘ │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ section-card: "对比明细" ────────────────────────┐   │
│  │  table (横向对比表)                                │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┐    │   │
│  │  │ 对比项    │ 张设计师  │ 王装饰    │ 李工长   │    │   │
│  │  ├──────────┼──────────┼──────────┼──────────┤    │   │
│  │  │ 总价      │ 18万     │ 21万     │ 15.5万   │    │   │
│  │  │ 工期      │ 75天     │ 90天     │ 60天     │    │   │
│  │  │ 设计方案  │ ✓        │ ✓        │ ✗        │    │   │
│  │  │ 主材包含  │ ✓        │ ✓        │ ✓        │    │   │
│  │  │ 质保期    │ 2年      │ 3年      │ 1年      │    │   │
│  │  │ 增项控制  │ ≤5%      │ ≤8%      │ 不承诺   │    │   │
│  │  └──────────┴──────────┴──────────┴──────────┘    │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

### 3.5 首页 CTA 入口修改

在 `HomePage.tsx` 的 hero 区域或快捷入口 `quick-grid` 中新增：

```
┌─ quick-grid (现有) ─────────────────────────┐
│  [找设计师]  [找装修公司]  [找工长]          │
│  [*发布需求*]  [我的项目]  [预约记录]        │  ← 新增 "发布需求" 入口
└──────────────────────────────────────────────┘
```

---

## 四、Merchant Web UI 布局方案（Phase 1）

> 复用：Ant Design 5.x + `MerchantLayout`（Sider + Header + Content）

### 4.1 分配线索页 `/leads`

**布局**：标准 Ant Design 列表页，嵌入 `MerchantLayout` 内容区。

```
┌─ MerchantLayout ─────────────────────────────────────────┐
│  ┌─ Sider ─┐  ┌─ Content (max-w 1600px, p-24) ───────┐  │
│  │ 禾泽云   │  │                                       │  │
│  │          │  │  ┌─ Card title="分配需求" ──────────┐  │  │
│  │ 工作台   │  │  │                                   │  │  │
│  │ *分配需求*│  │  │  ┌─ Space (过滤栏) ────────────┐  │  │  │
│  │ 预约管理 │  │  │  │ [Select: 全部状态 ▼]        │  │  │  │
│  │ 方案管理 │  │  │  │ [Button: 刷新]              │  │  │  │
│  │ 报价清单 │  │  │  └──────────────────────────────┘  │  │  │
│  │ 订单管理 │  │  │                                   │  │  │
│  │ 客户消息 │  │  │  ┌─ Table ─────────────────────┐  │  │  │
│  │ 财务中心 │  │  │  │ ID  需求标题  类型   城市   │  │  │  │
│  │ 作品集   │  │  │  │     面积  预算  截止时间     │  │  │  │
│  │ 设置     │  │  │  │     状态  操作               │  │  │  │
│  │          │  │  │  ├─────────────────────────────┤  │  │  │
│  │          │  │  │  │ 10  三室两厅…  整装  北京    │  │  │  │
│  │          │  │  │  │     120m²  15-30万           │  │  │  │
│  │          │  │  │  │     2026-03-15               │  │  │  │
│  │          │  │  │  │     [Tag:待响应]             │  │  │  │
│  │          │  │  │  │     [接受] [拒绝] [详情]     │  │  │  │
│  │          │  │  │  ├─────────────────────────────┤  │  │  │
│  │          │  │  │  │ ...                          │  │  │  │
│  │          │  │  │  └─────────────────────────────┘  │  │  │
│  │          │  │  │  Pagination: 共 5 条              │  │  │
│  │          │  │  └───────────────────────────────────┘  │  │
│  │          │  │                                       │  │
│  │          │  │  ┌─ Modal: "需求详情" (w=800) ─────┐  │  │
│  │          │  │  │  Descriptions                    │  │  │
│  │          │  │  │  需求类型: 整装装修               │  │  │
│  │          │  │  │  城市区域: 北京·朝阳             │  │  │
│  │          │  │  │  面积: 120 m²                    │  │  │
│  │          │  │  │  预算: 15-30万                   │  │  │
│  │          │  │  │  工期: 3个月内                   │  │  │
│  │          │  │  │  风格: 现代简约, 北欧            │  │  │
│  │          │  │  │  描述: 三室两厅…                 │  │  │
│  │          │  │  │  附件: [户型图.jpg]              │  │  │
│  │          │  │  │                                  │  │  │
│  │          │  │  │  footer: [接受线索] [拒绝]       │  │  │
│  │          │  │  └──────────────────────────────────┘  │  │
│  │          │  │                                       │  │
│  │          │  │  ┌─ Modal: "拒绝线索" ─────────────┐  │  │
│  │          │  │  │  Form layout="vertical"          │  │  │
│  │          │  │  │  [TextArea: 拒绝原因 ____]       │  │  │
│  │          │  │  │  footer: [取消] [确认拒绝]       │  │  │
│  │          │  │  └──────────────────────────────────┘  │  │
│  └──────────┘  └───────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**Table 列定义**：
| 列名 | dataIndex | width | render |
|------|-----------|-------|--------|
| ID | id | 80 | - |
| 需求标题 | demand_title | 200 | ellipsis |
| 类型 | demand_type | 100 | Tag |
| 城市 | city + district | 120 | - |
| 面积 | area | 80 | `{v} m²` |
| 预算 | budget_min + budget_max | 120 | `{min}~{max}万` |
| 截止时间 | response_deadline | 140 | 倒计时/日期 |
| 状态 | status | 100 | Tag (orange/green/red) |
| 操作 | - | 180 | Button.Link × 3 |

---

### 4.2 工作台修改 — MerchantDashboard 新增模块

在现有 4 个统计卡片之后，新增"新分配需求"模块：

```
┌─ Content ────────────────────────────────────────┐
│  Row gutter={16}                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───┐│
│  │ 预约管理   │ │ 设计方案   │ │ 项目管理   │ │…  ││
│  │ 今日+3     │ │ 待确认 2   │ │ 进行中 5   │ │   ││
│  └───────────┘ └───────────┘ └───────────┘ └───┘│
│                                                  │
│  ┌─ Card title="新分配需求" extra="查看全部→" ─┐  │  ← 新增
│  │  ┌─ List ──────────────────────────────────┐│  │
│  │  │ ● 三室两厅现代简约   北京·朝阳          ││  │
│  │  │   15-30万 | 截止: 2天后                 ││  │
│  │  │   [Button.Link: 查看] [Button.Link: 接受]│  │
│  │  │                                          ││  │
│  │  │ ● 两室一厅北欧风格   上海·浦东          ││  │
│  │  │   10-20万 | 截止: 1天后                 ││  │
│  │  │   [Button.Link: 查看] [Button.Link: 接受]│  │
│  │  └──────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 五、Admin Web UI 布局方案（Phase 1）

> 复用：Ant Design 5.x + ProLayout (BasicLayout) + Card / Table / Modal / Descriptions 模式

### 5.1 需求管理页 `/demands/list`

**布局**：标准列表 + 详情 Modal + 审核 Modal，复用 `IdentityApplicationAudit` 模式。

```
┌─ BasicLayout (ProLayout) ────────────────────────────────┐
│  ┌─ Sider ─────┐  ┌─ PageContainer ─────────────────┐   │
│  │ 禾泽云管理   │  │                                  │   │
│  │              │  │  ┌─ Card title="需求管理" ────┐  │   │
│  │ 仪表盘       │  │  │                             │  │   │
│  │ 用户管理     │  │  │  Space (工具栏)              │  │   │
│  │ 服务商管理   │  │  │  [Select: 状态 ▼]           │  │   │
│  │ 审核中心     │  │  │  [Select: 需求类型 ▼]       │  │   │
│  │ *需求管理*   │  │  │  [Input.Search: 搜索...]    │  │   │
│  │ 项目管理     │  │  │  [Button: 刷新]              │  │   │
│  │ 财务管理     │  │  │                             │  │   │
│  │ 风险管理     │  │  │  Table                       │  │   │
│  │ 系统设置     │  │  │  ┌──────────────────────┐    │  │   │
│  │              │  │  │  │ID  标题  用户  类型  │    │  │   │
│  │              │  │  │  │城市  面积  预算      │    │  │   │
│  │              │  │  │  │状态  提交时间  操作  │    │  │   │
│  │              │  │  │  ├──────────────────────┤    │  │   │
│  │              │  │  │  │1  三室两厅…  user#100│    │  │   │
│  │              │  │  │  │北京·朝阳  120m²      │    │  │   │
│  │              │  │  │  │15-30万               │    │  │   │
│  │              │  │  │  │[Tag:待审核]           │    │  │   │
│  │              │  │  │  │2026-03-13            │    │  │   │
│  │              │  │  │  │[详情][审核][分配]     │    │  │   │
│  │              │  │  │  └──────────────────────┘    │  │   │
│  │              │  │  │  Pagination                  │  │   │
│  │              │  │  └──────────────────────────────┘  │   │
│  └──────────────┘  └────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**详情 Modal (width=900)**：

```
┌─ Modal: "需求详情 #1" ─────────────────────────────────┐
│  bodyStyle: { maxHeight: '70vh', overflowY: 'auto' }   │
│                                                         │
│  ┌─ Alert (状态摘要) ───────────────────────────────┐   │
│  │  [Tag: 待审核]  提交于 2026-03-13                │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Card size="small" title="基本信息" ─────────────┐   │
│  │  Descriptions (column=2)                          │   │
│  │  需求类型: 整装装修    城市: 北京                 │   │
│  │  区域: 朝阳区          面积: 120 m²               │   │
│  │  预算: 15-30万          工期: 3个月内             │   │
│  │  风格: [Tag:现代简约] [Tag:北欧]                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Card size="small" title="需求描述" ─────────────┐   │
│  │  三室两厅，希望整体风格简洁明亮…                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Card size="small" title="附件" ─────────────────┐   │
│  │  Image.PreviewGroup                               │   │
│  │  [户型图.jpg]  [参考图.png]                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Card size="small" title="匹配记录" ─────────────┐   │
│  │  (状态为 approved 以上时显示)                      │   │
│  │  Table (mini): 商家 | 状态 | 分配时间 | 响应时间  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  footer: [审核通过] [驳回] [关闭]                       │
│  (根据 status 条件渲染按钮)                             │
└─────────────────────────────────────────────────────────┘
```

---

### 5.2 匹配/分配页 `/demands/:id/assign`

**布局**：独立页面（非 Modal），使用 Card + 双栏布局。

```
┌─ PageContainer title="需求匹配分配" ─────────────────────┐
│                                                           │
│  ┌─ Row gutter={24} ────────────────────────────────────┐ │
│  │                                                       │ │
│  │  ┌─ Col span={10}: 需求摘要 ────────────────────┐    │ │
│  │  │  Card title="需求信息"                        │    │ │
│  │  │  Descriptions (column=1, small)               │    │ │
│  │  │  标题: 三室两厅现代简约装修                   │    │ │
│  │  │  类型: 整装  城市: 北京·朝阳                  │    │ │
│  │  │  面积: 120m²  预算: 15-30万                   │    │ │
│  │  │  风格: 现代简约, 北欧                         │    │ │
│  │  │  状态: [Tag: 已审核]                          │    │ │
│  │  │                                               │    │ │
│  │  │  Card title="已分配商家" (0/3)                │    │ │
│  │  │  (空 / List of assigned providers)            │    │ │
│  │  └───────────────────────────────────────────────┘    │ │
│  │                                                       │ │
│  │  ┌─ Col span={14}: 候选商家 ────────────────────┐    │ │
│  │  │  Card title="候选商家列表"                    │    │ │
│  │  │                                               │    │ │
│  │  │  Space (过滤)                                 │    │ │
│  │  │  [Select: 商家类型 ▼] [Select: 城市 ▼]       │    │ │
│  │  │  [Input.Search: 搜索商家...]                  │    │ │
│  │  │                                               │    │ │
│  │  │  Table                                        │    │ │
│  │  │  ☐ | 商家名称 | 类型 | 评分 | 城市            │    │ │
│  │  │     | 在手订单 | 匹配度 | 操作                │    │ │
│  │  │  ┌────────────────────────────────────────┐   │    │ │
│  │  │  │ ☐  张设计师  设计师  ★4.8  北京        │   │    │ │
│  │  │  │    在手3单  [Tag:匹配度高]              │   │    │ │
│  │  │  │    [Button.Link: 查看详情]              │   │    │ │
│  │  │  │ ☐  王装饰公司  公司  ★4.6  北京        │   │    │ │
│  │  │  │    在手5单  [Tag:匹配度中]              │   │    │ │
│  │  │  └────────────────────────────────────────┘   │    │ │
│  │  │  Pagination                                   │    │ │
│  │  │                                               │    │ │
│  │  │  ┌─ 底部操作栏 ──────────────────────────┐   │    │ │
│  │  │  │  已选: 2 家                            │   │    │ │
│  │  │  │  响应截止: [DatePicker] (默认 48h)     │   │    │ │
│  │  │  │  [Button primary: 确认分配]            │   │    │ │
│  │  │  └────────────────────────────────────────┘   │    │ │
│  │  └───────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

## 六、后端接口契约（Phase 2）

### 6.1 合同/里程碑

#### POST /api/v1/contracts — 创建合同

```json
// Request (商家发起)
{
  "demand_id": 1,
  "user_id": 100,
  "title": "三室两厅现代简约装修合同",
  "total_amount": 180000,
  "payment_plan": [
    { "phase": 1, "name": "签约定金", "amount": 18000, "percentage": 10, "trigger_event": "contract_confirmed" },
    { "phase": 2, "name": "开工款", "amount": 54000, "percentage": 30, "trigger_event": "construction_start" },
    { "phase": 3, "name": "中期验收款", "amount": 54000, "percentage": 30, "trigger_event": "midterm_acceptance" },
    { "phase": 4, "name": "竣工验收款", "amount": 45000, "percentage": 25, "trigger_event": "final_acceptance" },
    { "phase": 5, "name": "质保金", "amount": 9000, "percentage": 5, "trigger_event": "warranty_end" }
  ],
  "attachment_urls": ["https://oss.example.com/contracts/draft-001.pdf"]
}

// Response 201
{
  "id": 1,
  "contract_no": "CT-20260313-0001",
  "status": "draft",
  "created_at": "2026-03-13T10:00:00Z"
}
```

#### POST /api/v1/contracts/:id/confirm — 用户确认合同

```json
// Response 200
{
  "id": 1,
  "status": "confirmed",
  "confirmed_at": "2026-03-14T10:00:00Z"
}
```

#### GET /api/v1/projects/:id/milestones — 里程碑列表

```json
// Response 200
{
  "items": [
    {
      "id": 1,
      "phase": 1,
      "name": "签约定金",
      "amount": 18000,
      "status": "paid",
      "delivered_at": null,
      "accepted_at": null,
      "payment_status": "released"
    },
    {
      "id": 2,
      "phase": 2,
      "name": "开工款",
      "amount": 54000,
      "status": "in_progress",
      "delivered_at": null,
      "accepted_at": null,
      "payment_status": "pending"
    }
  ]
}
```

#### POST /api/v1/projects/:id/milestones/:mid/deliver — 商家提交交付

```json
// Request
{
  "description": "水电改造完成，附验收照片",
  "evidence_urls": ["https://oss.example.com/delivery/photo1.jpg"],
  "actual_amount": 54000
}

// Response 200
{ "id": 2, "status": "delivered", "delivered_at": "2026-04-01T15:00:00Z" }
```

#### POST /api/v1/projects/:id/milestones/:mid/accept — 用户验收

```json
// Request
{ "comment": "验收通过，水电走线规范" }

// Response 200
{ "id": 2, "status": "accepted", "accepted_at": "2026-04-02T10:00:00Z" }
```

#### POST /api/v1/projects/:id/milestones/:mid/reject — 用户拒绝

```json
// Request
{
  "reason": "卫生间防水未达标",
  "evidence_urls": ["https://oss.example.com/reject/photo1.jpg"]
}

// Response 200
{ "id": 2, "status": "rejected" }
```

### 6.2 变更单

#### POST /api/v1/change-orders — 发起变更

```json
// Request
{
  "project_id": 1,
  "contract_id": 1,
  "title": "客厅吊顶方案变更",
  "reason": "业主现场确认后希望调整吊顶样式",
  "items": [
    { "description": "原石膏板平顶改为双层叠级吊顶", "original_amount": 3000, "new_amount": 5500, "diff": 2500 }
  ],
  "amount_impact": 2500,
  "timeline_impact": 3,
  "evidence_urls": ["https://oss.example.com/change/sketch.jpg"]
}

// Response 201
{ "id": 1, "status": "pending", "created_at": "2026-04-05T09:00:00Z" }
```

#### GET /api/v1/change-orders/:id — 变更详情

```json
// Response 200
{
  "id": 1,
  "project_id": 1,
  "initiator_type": "provider",
  "initiator": { "id": 5, "name": "张设计师" },
  "title": "客厅吊顶方案变更",
  "reason": "...",
  "items": [...],
  "amount_impact": 2500,
  "timeline_impact": 3,
  "evidence_urls": [...],
  "status": "pending",
  "created_at": "2026-04-05T09:00:00Z"
}
```

#### POST /api/v1/change-orders/:id/confirm — 确认变更

```json
// Request
{ "comment": "同意变更" }
// Response 200
{ "id": 1, "status": "user_confirmed" }
```

#### POST /api/v1/change-orders/:id/reject — 拒绝变更

```json
// Request
{ "reason": "预算超出，不接受" }
// Response 200
{ "id": 1, "status": "user_rejected" }
```

### 6.3 投诉/争议

#### POST /api/v1/complaints — 发起投诉

```json
// Request
{
  "project_id": 1,
  "provider_id": 5,
  "category": "quality",
  "title": "卫生间瓷砖铺贴不平整",
  "description": "发现多处空鼓和不平整...",
  "evidence_urls": [
    "https://oss.example.com/complaint/photo1.jpg",
    "https://oss.example.com/complaint/photo2.jpg"
  ]
}

// Response 201
{ "id": 1, "status": "submitted", "created_at": "2026-04-10T14:00:00Z" }
```

#### GET /api/v1/complaints/:id — 投诉详情

```json
// Response 200
{
  "id": 1,
  "project_id": 1,
  "user": { "id": 100, "name": "张先生", "phone": "138****1234" },
  "provider": { "id": 5, "name": "张设计师" },
  "category": "quality",
  "title": "卫生间瓷砖铺贴不平整",
  "description": "...",
  "evidence_urls": [...],
  "status": "processing",
  "freeze_payment": true,
  "admin": { "id": 1, "name": "管理员A" },
  "resolution": "",
  "created_at": "2026-04-10T14:00:00Z"
}
```

#### POST /api/v1/admin/complaints/:id/resolve — 管理员处理投诉

```json
// Request
{
  "resolution": "经现场核实，瓷砖空鼓率超标，要求商家返工",
  "freeze_payment": true,
  "action": "require_rework"
}
// Response 200
{ "id": 1, "status": "resolved" }
```

#### POST /api/v1/merchant/complaints/:id/respond — 商家回应

```json
// Request
{
  "response": "已安排工人周末返工，预计3天完成",
  "evidence_urls": ["https://oss.example.com/response/plan.pdf"]
}
// Response 200
{ "id": 1, "merchant_responded": true }
```

### 6.4 评价

#### POST /api/v1/evaluations — 提交评价

```json
// Request
{
  "project_id": 1,
  "provider_id": 5,
  "overall_score": 4.5,
  "dimension_scores": {
    "design": 5.0,
    "quality": 4.0,
    "schedule": 4.5,
    "communication": 5.0,
    "value": 4.0
  },
  "content": "整体很满意，设计方案落地效果好，工期控制到位…",
  "image_urls": ["https://oss.example.com/review/finished1.jpg"],
  "is_anonymous": false
}

// Response 201
{ "id": 1, "created_at": "2026-05-01T10:00:00Z" }
```

#### GET /api/v1/evaluations/project/:id — 项目评价

```json
// Response 200
{
  "evaluation": {
    "id": 1,
    "overall_score": 4.5,
    "dimension_scores": { ... },
    "content": "...",
    "image_urls": [...],
    "user": { "id": 100, "name": "张先生", "avatar": "..." },
    "created_at": "2026-05-01T10:00:00Z"
  }
}
```

---

## 七、User Web UI 布局方案（Phase 2）

### 7.1 合同确认页 `/projects/:id/contract`

**布局**：分割布局 `split-shell`。

```
┌─ container page-stack ──────────────────────────────────┐
│                                                         │
│  ┌─ StatusBanner ─────────────────────────────────────┐ │
│  │  "合同待确认" | "请仔细阅读合同条款和付款计划"     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ split-shell ──────────────────────────────────────┐ │
│  │  ┌─ 主栏 (1.35fr) ─────────────────────────────┐  │ │
│  │  │                                               │  │ │
│  │  │  ┌─ section-card: "合同信息" ──────────────┐  │  │ │
│  │  │  │  合同编号: CT-20260313-0001             │  │  │ │
│  │  │  │  项目名称: 三室两厅现代简约装修         │  │  │ │
│  │  │  │  商家: 张设计师                         │  │  │ │
│  │  │  │  合同总额: ¥180,000                     │  │  │ │
│  │  │  │  合同附件: [📄 合同.pdf]                │  │  │ │
│  │  │  └──────────────────────────────────────────┘  │  │ │
│  │  │                                               │  │ │
│  │  │  ┌─ section-card: "付款计划" ──────────────┐  │  │ │
│  │  │  │  timeline-list                           │  │  │ │
│  │  │  │                                         │  │  │ │
│  │  │  │  ● 签约定金   ¥18,000 (10%)            │  │  │ │
│  │  │  │    触发: 合同确认后                     │  │  │ │
│  │  │  │                                         │  │  │ │
│  │  │  │  ○ 开工款     ¥54,000 (30%)            │  │  │ │
│  │  │  │    触发: 施工开始                       │  │  │ │
│  │  │  │                                         │  │  │ │
│  │  │  │  ○ 中期验收款 ¥54,000 (30%)            │  │  │ │
│  │  │  │    触发: 中期验收通过                   │  │  │ │
│  │  │  │                                         │  │  │ │
│  │  │  │  ○ 竣工验收款 ¥45,000 (25%)            │  │  │ │
│  │  │  │    触发: 竣工验收通过                   │  │  │ │
│  │  │  │                                         │  │  │ │
│  │  │  │  ○ 质保金     ¥9,000 (5%)              │  │  │ │
│  │  │  │    触发: 质保期结束                     │  │  │ │
│  │  │  └──────────────────────────────────────────┘  │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  ┌─ 侧栏 (0.85fr) ────────────────────────────┐   │ │
│  │  │  ┌─ section-card: "确认操作" ────────────┐   │   │ │
│  │  │  │  ☑ 我已阅读并同意合同条款              │   │   │ │
│  │  │  │  [button: 确认合同]                    │   │   │ │
│  │  │  │  [button-ghost: 拒绝合同]              │   │   │ │
│  │  │  └────────────────────────────────────────┘   │   │ │
│  │  │                                               │   │ │
│  │  │  ┌─ section-card: "商家信息" ────────────┐   │   │ │
│  │  │  │  [avatar] 张设计师                     │   │   │ │
│  │  │  │  ★4.8  北京·朝阳                      │   │   │ │
│  │  │  │  已完成 23 个项目                      │   │   │ │
│  │  │  └────────────────────────────────────────┘   │   │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

### 7.2 里程碑验收页 `/projects/:id/milestones/:mid/accept`

**布局**：单栏居中表单。

```
┌─ container page-stack (max-w: 800px, centered) ─────────┐
│                                                         │
│  ┌─ section-card ───────────────────────────────────┐   │
│  │  page-title: "里程碑验收"                         │   │
│  │  kicker: "中期验收 · ¥54,000"                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ section-card: "交付内容" ────────────────────────┐   │
│  │  商家提交时间: 2026-04-01 15:00                   │   │
│  │  说明: 水电改造完成，附验收照片                    │   │
│  │                                                   │   │
│  │  ┌─ ProofGrid ─────────────────────────────────┐  │   │
│  │  │  [photo1]  [photo2]  [photo3]  [photo4]     │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ section-card: "验收操作" ────────────────────────┐   │
│  │                                                   │   │
│  │  [textarea: 验收意见 __________________________]  │   │
│  │                                                   │   │
│  │  ┌─ 操作按钮 ───────────────────────────────────┐ │   │
│  │  │  [button: 验收通过]  [button-danger: 拒绝验收]│ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ section-card: "拒绝验收" (条件显示) ─────────────┐   │
│  │  拒绝原因: [textarea ________________________]    │   │
│  │  上传凭证: [+上传] [photo1]                       │   │
│  │  [button-danger: 确认拒绝]                        │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

### 7.3 变更单页 `/projects/:id/change-orders`

**布局**：列表 + 详情展开模式。

```
┌─ container page-stack ──────────────────────────────────┐
│                                                         │
│  ┌─ section-card ───────────────────────────────────┐   │
│  │  page-title: "变更记录"                           │   │
│  │  kicker: "三室两厅现代简约装修"                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ list-stack ─────────────────────────────────────┐   │
│  │                                                   │   │
│  │  ┌─ card section-card (变更项) ───────────────┐   │   │
│  │  │  [status-chip: 待确认]                      │   │   │
│  │  │  客厅吊顶方案变更                           │   │   │
│  │  │  发起方: 商家·张设计师  2026-04-05          │   │   │
│  │  │  金额影响: +¥2,500  工期影响: +3天          │   │   │
│  │  │                                             │   │   │
│  │  │  detail-grid-two                            │   │   │
│  │  │  原方案: 石膏板平顶 ¥3,000                  │   │   │
│  │  │  新方案: 双层叠级吊顶 ¥5,500                │   │   │
│  │  │                                             │   │   │
│  │  │  [button: 同意变更]  [button-outline: 拒绝] │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                   │   │
│  │  ┌─ card section-card (已处理) ───────────────┐   │   │
│  │  │  [status-chip data-tone="success": 已确认]  │   │   │
│  │  │  卫生间防水方案调整                         │   │   │
│  │  │  确认于 2026-04-02                          │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

### 7.4 投诉页 `/complaints/new`

**布局**：单栏表单，复用 `AfterSalesCreatePage` 模式。

```
┌─ container page-stack (max-w: 800px) ───────────────────┐
│                                                         │
│  ┌─ section-card ───────────────────────────────────┐   │
│  │  page-title: "发起投诉"                           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ card section-card ──────────────────────────────┐   │
│  │  form-grid                                        │   │
│  │  关联项目: [Select: 选择项目 ▼]                   │   │
│  │  投诉类型: [Select ▼]                             │   │
│  │    (质量问题/工期延误/价格争议/态度问题/安全问题)  │   │
│  │  投诉标题: [input ________________________]       │   │
│  │  详细描述: [textarea _____________________]       │   │
│  │            [textarea _____________________]       │   │
│  │  上传凭证:                                        │   │
│  │  [+上传] [photo1] [photo2]                        │   │
│  │                                                   │   │
│  │  [button: 提交投诉]                               │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

### 7.5 评价页 `/projects/:id/evaluate`

**布局**：单栏居中。

```
┌─ container page-stack (max-w: 800px) ───────────────────┐
│                                                         │
│  ┌─ section-card ───────────────────────────────────┐   │
│  │  page-title: "项目评价"                           │   │
│  │  kicker: "三室两厅现代简约装修 · 张设计师"        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ card section-card: "评分" ──────────────────────┐   │
│  │                                                   │   │
│  │  综合评分    ★ ★ ★ ★ ☆  4.0                     │   │
│  │                                                   │   │
│  │  ┌─ grid-2 (维度评分) ────────────────────────┐   │   │
│  │  │  设计方案  ★★★★★ 5.0                       │   │   │
│  │  │  施工质量  ★★★★☆ 4.0                       │   │   │
│  │  │  工期控制  ★★★★☆ 4.5                       │   │   │
│  │  │  沟通态度  ★★★★★ 5.0                       │   │   │
│  │  │  性价比    ★★★★☆ 4.0                       │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ card section-card: "评价内容" ──────────────────┐   │
│  │  [textarea: 分享您的装修体验… _______________]    │   │
│  │  [textarea ________________________________]      │   │
│  │                                                   │   │
│  │  上传图片:                                        │   │
│  │  [+上传] [完工照1] [完工照2]                      │   │
│  │                                                   │   │
│  │  ☐ 匿名评价                                      │   │
│  │                                                   │   │
│  │  [button: 提交评价]                               │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 八、Merchant Web UI 布局方案（Phase 2）

### 8.1 里程碑交付页 `/projects/:id/deliver`

```
┌─ MerchantLayout Content ─────────────────────────────────┐
│                                                           │
│  ┌─ Card title="里程碑交付" ────────────────────────────┐ │
│  │                                                       │ │
│  │  ┌─ Descriptions title="项目信息" (bordered) ──────┐  │ │
│  │  │  项目: 三室两厅现代简约装修                      │  │ │
│  │  │  客户: 张先生                                    │  │ │
│  │  │  当前里程碑: 中期验收款 ¥54,000                  │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                       │ │
│  │  ┌─ Card size="small" title="里程碑进度" ──────────┐  │ │
│  │  │  Steps (Ant Design)                              │  │ │
│  │  │  [✓ 签约定金] → [✓ 开工款] → [● 中期验收]       │  │ │
│  │  │  → [○ 竣工验收] → [○ 质保金]                    │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                       │ │
│  │  ┌─ Card size="small" title="提交交付" ────────────┐  │ │
│  │  │  Form layout="vertical"                          │  │ │
│  │  │                                                  │  │ │
│  │  │  交付说明:                                       │  │ │
│  │  │  [TextArea rows={4} _________________________]   │  │ │
│  │  │                                                  │  │ │
│  │  │  验收凭证:                                       │  │ │
│  │  │  [Upload.Dragger: 拖拽或点击上传照片/文件]       │  │ │
│  │  │  [photo1] [photo2] [photo3]                      │  │ │
│  │  │                                                  │  │ │
│  │  │  实际金额: [InputNumber: 54000] 元               │  │ │
│  │  │  (默认=里程碑约定金额)                           │  │ │
│  │  │                                                  │  │ │
│  │  │  [Button type="primary": 提交交付]               │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

### 8.2 变更单处理页 `/change-orders`

```
┌─ MerchantLayout Content ─────────────────────────────────┐
│                                                           │
│  ┌─ Card title="变更单管理" ────────────────────────────┐ │
│  │                                                       │ │
│  │  Space (工具栏)                                       │ │
│  │  [Select: 状态 ▼] [Button: 发起变更] [Button: 刷新]  │ │
│  │                                                       │ │
│  │  Table                                                │ │
│  │  ┌────────────────────────────────────────────────┐   │ │
│  │  │ ID  项目  标题  发起方  金额影响               │   │ │
│  │  │    工期影响  状态  操作                         │   │ │
│  │  ├────────────────────────────────────────────────┤   │ │
│  │  │ 1  三室两厅…  客厅吊顶方案变更  商家            │   │ │
│  │  │    +¥2,500  +3天  [Tag:待用户确认]              │   │ │
│  │  │    [详情]                                       │   │ │
│  │  └────────────────────────────────────────────────┘   │ │
│  │  Pagination                                           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─ Modal: "发起变更" (width=700) ──────────────────────┐ │
│  │  Form layout="vertical"                               │ │
│  │  关联项目: [Select ▼]                                 │ │
│  │  变更标题: [Input ________________________]           │ │
│  │  变更原因: [TextArea ______________________]          │ │
│  │  变更明细:                                            │ │
│  │  ┌────────────────────────────────────────────────┐   │ │
│  │  │ [+ 添加条目]                                   │   │ │
│  │  │ 描述: [___]  原金额: [___]  新金额: [___]      │   │ │
│  │  └────────────────────────────────────────────────┘   │ │
│  │  工期影响: [InputNumber] 天                           │ │
│  │  上传凭证: [Upload]                                   │ │
│  │  footer: [取消] [提交变更]                            │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

### 8.3 投诉响应页 `/complaints`

```
┌─ MerchantLayout Content ─────────────────────────────────┐
│                                                           │
│  ┌─ Card title="投诉/售后" ─────────────────────────────┐ │
│  │                                                       │ │
│  │  Space: [Select: 状态 ▼] [Button: 刷新]              │ │
│  │                                                       │ │
│  │  Table                                                │ │
│  │  ┌────────────────────────────────────────────────┐   │ │
│  │  │ ID  项目  投诉标题  类型  冻结付款             │   │ │
│  │  │    状态  时间  操作                             │   │ │
│  │  ├────────────────────────────────────────────────┤   │ │
│  │  │ 1  三室两厅…  瓷砖铺贴不平整  [Tag:质量问题]   │   │ │
│  │  │    [Tag red:已冻结]  [Tag:处理中]               │   │ │
│  │  │    2026-04-10  [回应] [详情]                    │   │ │
│  │  └────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─ Modal: "投诉详情 & 回应" (width=800) ───────────────┐ │
│  │                                                       │ │
│  │  ┌─ Card size="small" title="投诉信息" ────────────┐  │ │
│  │  │  Descriptions                                    │  │ │
│  │  │  投诉人: 张先生  类型: 质量问题                  │  │ │
│  │  │  标题: 卫生间瓷砖铺贴不平整                      │  │ │
│  │  │  描述: 发现多处空鼓和不平整…                     │  │ │
│  │  │  凭证: [Image.PreviewGroup]                      │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                       │ │
│  │  ┌─ Card size="small" title="我的回应" ────────────┐  │ │
│  │  │  Form layout="vertical"                          │  │ │
│  │  │  回应内容:                                       │  │ │
│  │  │  [TextArea rows={4} _________________________]   │  │ │
│  │  │  上传凭证: [Upload]                              │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                       │ │
│  │  footer: [提交回应]                                   │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

### 8.4 工作台修改 — 新增待办模块

在 MerchantDashboard 统计卡片下方新增三个待办 Card：

```
┌─ Row gutter={16} (新增) ──────────────────────────────┐
│  ┌─ Col span={8} ─────┐ ┌─ Col span={8} ──┐ ┌─ Col ┐│
│  │ Card: 待交付里程碑  │ │ Card: 待处理变更 │ │ 待回应││
│  │                     │ │                  │ │ 投诉  ││
│  │ Alert type="warning"│ │ List.Item        │ │ List  ││
│  │ "中期验收款 待交付"  │ │ · 吊顶方案变更   │ │ ...   ││
│  │                     │ │   +¥2,500        │ │       ││
│  │ [Button: 提交交付]  │ │ [查看]           │ │       ││
│  └─────────────────────┘ └──────────────────┘ └──────┘│
└────────────────────────────────────────────────────────┘
```

---

## 九、Admin Web UI 布局方案（Phase 2）

### 9.1 合同/项目管理页 `/projects/:id/contract`

**布局**：详情页 + Tabs 分栏。

```
┌─ PageContainer title="合同/项目管理" ──────────────────┐
│                                                         │
│  ┌─ Card ──────────────────────────────────────────────┐│
│  │  Tabs                                                ││
│  │  [合同信息] [付款计划] [里程碑] [变更记录] [操作日志]││
│  │                                                      ││
│  │  === Tab: 合同信息 ===                               ││
│  │  Descriptions (bordered, column=2)                   ││
│  │  合同编号: CT-20260313-0001                          ││
│  │  状态: [Tag: 已确认]                                 ││
│  │  项目: 三室两厅现代简约装修                          ││
│  │  用户: 张先生 (#100)    商家: 张设计师 (#5)          ││
│  │  合同总额: ¥180,000                                  ││
│  │  确认时间: 2026-03-14                                ││
│  │  附件: [📄 合同.pdf]                                 ││
│  │                                                      ││
│  │  === Tab: 付款计划 ===                               ││
│  │  Table (bordered)                                    ││
│  │  阶段 | 名称 | 金额 | 比例 | 触发事件 | 支付状态    ││
│  │  1 | 签约定金 | ¥18,000 | 10% | 合同确认 | [已释放]  ││
│  │  2 | 开工款 | ¥54,000 | 30% | 施工开始 | [已释放]    ││
│  │  3 | 中期验收 | ¥54,000 | 30% | 中期验收 | [待验收]  ││
│  │  4 | 竣工验收 | ¥45,000 | 25% | 竣工验收 | [未触发]  ││
│  │  5 | 质保金 | ¥9,000 | 5% | 质保期满 | [未触发]      ││
│  │                                                      ││
│  │  === Tab: 里程碑 ===                                 ││
│  │  Table                                               ││
│  │  阶段 | 名称 | 状态 | 交付时间 | 验收时间 | 操作     ││
│  │  2 | 开工款 | [已验收] | 03-20 | 03-21 | [查看]      ││
│  │  3 | 中期验收 | [已交付] | 04-01 | - | [查看][介入]  ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

### 9.2 投诉/争议处理页 `/complaints`

```
┌─ PageContainer title="投诉/争议管理" ──────────────────┐
│                                                         │
│  ┌─ Card ──────────────────────────────────────────────┐│
│  │  Space (工具栏)                                      ││
│  │  [Select: 状态 ▼] [Select: 类型 ▼]                  ││
│  │  [Select: 是否冻结 ▼] [Button: 刷新]                ││
│  │                                                      ││
│  │  Table                                               ││
│  │  ID | 项目 | 投诉人 | 商家 | 类型 | 标题            ││
│  │     | 冻结付款 | 状态 | 提交时间 | 处理人 | 操作     ││
│  │  ┌────────────────────────────────────────────────┐  ││
│  │  │ 1 | 三室两厅… | 张先生 | 张设计师               │  ││
│  │  │   | [Tag:质量] | 瓷砖不平整                     │  ││
│  │  │   | [Tag red:已冻结] | [Tag:处理中]             │  ││
│  │  │   | 2026-04-10 | 管理员A                        │  ││
│  │  │   | [详情] [处理]                               │  ││
│  │  └────────────────────────────────────────────────┘  ││
│  │  Pagination                                          ││
│  └──────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ Modal: "投诉处理" (width=900) ────────────────────┐ │
│  │  bodyStyle: { maxHeight: '70vh', overflowY: 'auto' }│ │
│  │                                                     │ │
│  │  ┌─ Card size="small" title="投诉信息" ──────────┐  │ │
│  │  │  Descriptions                                  │  │ │
│  │  │  投诉人: 张先生  商家: 张设计师                │  │ │
│  │  │  类型: 质量问题  项目: 三室两厅…               │  │ │
│  │  │  描述: 发现多处空鼓…                           │  │ │
│  │  │  凭证: [Image.PreviewGroup]                    │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  ┌─ Card size="small" title="商家回应" ──────────┐  │ │
│  │  │  (若已回应) 回应内容 + 凭证                    │  │ │
│  │  │  (若未回应) [Tag: 待回应]                      │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  ┌─ Card size="small" title="处理操作" ──────────┐  │ │
│  │  │  Form layout="vertical"                        │  │ │
│  │  │  处理结果:                                     │  │ │
│  │  │  [TextArea rows={4} ________________________]  │  │ │
│  │  │  处理措施: [Select ▼]                          │  │ │
│  │  │    (要求返工/部分退款/全额退款/警告商家/无效投诉)│ │ │
│  │  │  冻结付款: [Switch]                            │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  footer: [处理完成] [关闭]                           │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

### 9.3 变更单管理页 `/change-orders`

```
┌─ PageContainer title="变更单管理" ─────────────────────┐
│                                                         │
│  ┌─ Card ──────────────────────────────────────────────┐│
│  │  Space: [Select: 状态 ▼] [Select: 发起方 ▼]        ││
│  │         [Button: 刷新]                               ││
│  │                                                      ││
│  │  Table                                               ││
│  │  ID | 项目 | 标题 | 发起方 | 金额影响               ││
│  │     | 工期影响 | 状态 | 创建时间 | 操作              ││
│  │                                                      ││
│  │  Pagination                                          ││
│  └──────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ Modal: "变更详情" (width=800) ────────────────────┐ │
│  │  Descriptions (bordered)                             │ │
│  │  项目 | 发起方 | 变更标题 | 变更原因                │ │
│  │  金额影响 | 工期影响 | 状态                         │ │
│  │                                                     │ │
│  │  Table title="变更明细"                              │ │
│  │  描述 | 原金额 | 新金额 | 差额                      │ │
│  │                                                     │ │
│  │  凭证: [Image.PreviewGroup]                          │ │
│  │                                                     │ │
│  │  footer: (status=pending)                            │ │
│  │    [介入处理] [关闭]                                 │ │
│  │  footer: (status≠pending) [关闭]                     │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

### 9.4 付款/提现监管页 `/finance/supervision`

```
┌─ PageContainer title="付款监管" ───────────────────────┐
│                                                         │
│  ┌─ Row gutter={16} (统计卡片) ────────────────────┐    │
│  │  [Card: 待释放款项 ¥324,000]                     │    │
│  │  [Card: 已冻结款项 ¥54,000]                      │    │
│  │  [Card: 本月释放 ¥1,280,000]                     │    │
│  │  [Card: 待处理提现 3笔]                           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─ Tabs ──────────────────────────────────────────────┐│
│  │  [付款记录] [提现申请] [冻结记录]                    ││
│  │                                                      ││
│  │  === Tab: 付款记录 ===                               ││
│  │  Table                                               ││
│  │  项目 | 里程碑 | 金额 | 用户 | 商家                 ││
│  │  触发事件 | 状态 | 时间 | 操作                      ││
│  │  (操作: [释放] [冻结] 根据权限和状态)                ││
│  │                                                      ││
│  │  === Tab: 提现申请 ===                               ││
│  │  Table                                               ││
│  │  商家 | 金额 | 银行卡 | 申请时间 | 状态 | 操作      ││
│  │  (操作: [审核通过] [驳回])                           ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

## 十、文件清单与路由注册汇总

### 10.1 Phase 1 新增文件

**Backend**：
| 文件路径 | 用途 |
|---------|------|
| `server/migrations/v1.8.0_add_demand_system.sql` | 数据库迁移 |
| `server/internal/model/demand.go` | Demand + DemandMatch 模型 |
| `server/internal/model/contract.go` | Contract 模型 |
| `server/internal/service/demand_service.go` | 需求业务逻辑 |
| `server/internal/handler/demand_handler.go` | 用户端需求接口 |
| `server/internal/handler/admin_demand_handler.go` | 管理端需求接口 |
| `server/internal/handler/merchant_lead_handler.go` | 商家端线索接口 |

**User Web**：
| 文件路径 | 用途 |
|---------|------|
| `web/src/pages/DemandCreatePage.tsx` | 需求提交页 |
| `web/src/pages/profile/DemandsPage.tsx` | 我的需求列表 |
| `web/src/pages/DemandDetailPage.tsx` | 需求详情页 |
| `web/src/pages/DemandComparePage.tsx` | 报价对比页 |
| `web/src/services/demands.ts` | 需求 API 服务 |

**Merchant Web**：
| 文件路径 | 用途 |
|---------|------|
| `merchant/src/pages/merchant/MerchantLeads.tsx` | 分配线索页 |

**Admin Web**：
| 文件路径 | 用途 |
|---------|------|
| `admin/src/pages/demands/DemandList.tsx` | 需求管理页 |
| `admin/src/pages/demands/DemandAssign.tsx` | 匹配分配页 |

### 10.2 Phase 2 新增文件

**Backend**：
| 文件路径 | 用途 |
|---------|------|
| `server/migrations/v1.9.0_add_transaction_trust_loop.sql` | 数据库迁移 |
| `server/internal/model/change_order.go` | 变更单模型 |
| `server/internal/model/complaint.go` | 投诉模型 |
| `server/internal/model/evaluation.go` | 评价模型 |
| `server/internal/service/contract_service.go` | 合同业务逻辑 |
| `server/internal/service/change_order_service.go` | 变更单业务逻辑 |
| `server/internal/service/complaint_service.go` | 投诉业务逻辑 |
| `server/internal/service/evaluation_service.go` | 评价业务逻辑 |
| `server/internal/handler/contract_handler.go` | 合同接口 |
| `server/internal/handler/change_order_handler.go` | 变更单接口 |
| `server/internal/handler/complaint_handler.go` | 投诉接口 |
| `server/internal/handler/evaluation_handler.go` | 评价接口 |

**User Web**：
| 文件路径 | 用途 |
|---------|------|
| `web/src/pages/ContractConfirmPage.tsx` | 合同确认页 |
| `web/src/pages/MilestoneAcceptPage.tsx` | 里程碑验收页 |
| `web/src/pages/ChangeOrdersPage.tsx` | 变更单列表 |
| `web/src/pages/ComplaintCreatePage.tsx` | 发起投诉 |
| `web/src/pages/profile/ComplaintsPage.tsx` | 我的投诉 |
| `web/src/pages/EvaluationPage.tsx` | 评价页 |
| `web/src/services/contracts.ts` | 合同 API |
| `web/src/services/changeOrders.ts` | 变更单 API |
| `web/src/services/complaints.ts` | 投诉 API |
| `web/src/services/evaluations.ts` | 评价 API |

**Merchant Web**：
| 文件路径 | 用途 |
|---------|------|
| `merchant/src/pages/merchant/MerchantDeliver.tsx` | 里程碑交付页 |
| `merchant/src/pages/merchant/MerchantChangeOrders.tsx` | 变更单管理 |
| `merchant/src/pages/merchant/MerchantComplaints.tsx` | 投诉响应 |

**Admin Web**：
| 文件路径 | 用途 |
|---------|------|
| `admin/src/pages/projects/ContractManagement.tsx` | 合同管理 |
| `admin/src/pages/complaints/ComplaintManagement.tsx` | 投诉处理 |
| `admin/src/pages/projects/ChangeOrderManagement.tsx` | 变更单管理 |
| `admin/src/pages/finance/PaymentSupervision.tsx` | 付款监管 |

### 10.3 路由注册

**User Web** (`web/src/router/index.tsx`)：
```typescript
// Phase 1
{ path: 'demands/new', element: <DemandCreatePage /> }
{ path: 'demands/:id', element: <DemandDetailPage /> }
{ path: 'demands/:id/compare', element: <DemandComparePage /> }
// ProfileWorkspaceLayout children:
{ path: 'demands', element: <DemandsPage /> }

// Phase 2
{ path: 'projects/:id/contract', element: <ContractConfirmPage /> }
{ path: 'projects/:id/milestones/:mid/accept', element: <MilestoneAcceptPage /> }
{ path: 'projects/:id/change-orders', element: <ChangeOrdersPage /> }
{ path: 'complaints/new', element: <ComplaintCreatePage /> }
{ path: 'projects/:id/evaluate', element: <EvaluationPage /> }
// ProfileWorkspaceLayout children:
{ path: 'complaints', element: <ComplaintsPage /> }
```

**Merchant Web** (`merchant/src/router/index.tsx`)：
```typescript
// Phase 1
{ path: 'leads', element: <MerchantLeads /> }

// Phase 2
{ path: 'projects/:id/deliver', element: <MerchantDeliver /> }
{ path: 'change-orders', element: <MerchantChangeOrders /> }
{ path: 'complaints', element: <MerchantComplaints /> }
```

**Admin Web** (`admin/src/router.tsx`)：
```typescript
// Phase 1
{ path: 'demands/list', element: <DemandList /> }
{ path: 'demands/:id/assign', element: <DemandAssign /> }

// Phase 2
{ path: 'projects/:id/contract', element: <ContractManagement /> }
{ path: 'complaints', element: <ComplaintManagement /> }
{ path: 'change-orders', element: <ChangeOrderManagement /> }
{ path: 'finance/supervision', element: <PaymentSupervision /> }
```
