# 前端 UI Skill 路由矩阵

## 目的

本文件只定义 **前端 UI 相关 skill** 的路由规则，不覆盖文档、数据库、安全、自动化、调试器等非 UI skill。

目标是让后续 UI 请求不再按 skill 名字猜，而是先按统一维度归类，再选主 owner 和 sidecar。

统一前提：

- `ui-orchestrator` 是总入口，但只负责分流和设计前置，不是默认实现 owner。
- 同一轮最多 1 个主 owner，sidecar 只补充，不抢主导权。
- 已安装重复能力在路由层视为同类，不单独分叉：
  - `frontend-skill` 本地版 + `build-web-apps:frontend-skill`
  - `shadcn` 本地版 + `build-web-apps:shadcn`

## 路由接口

每个前端 UI 请求，先用以下 4 个字段归类：

- `surface`
  - `web-react`
  - `swiftui`
- `phase`
  - `discover`
  - `design`
  - `implement`
  - `refactor`
  - `review`
  - `polish`
- `page_kind`
  - `marketing`
  - `product_state`
  - `component_system`
  - `audit`
  - `performance`
- `constraints`
  - `uses_shadcn`
  - `needs_brand_context`
  - `needs_liquid_glass`
  - `needs_react_perf`
  - `needs_high_taste_guardrails`

## Canonical Routes

### 1. 总入口

- `ui-orchestrator`
  - 适用：用户说不清页面方向、要先看方案、是新页面/大改版、跨端分类不明确、想先用 Stitch 出设计。
  - 不适用：目标 UI 已经明确，只差直接实现、重构、审查或收尾。
  - 角色：只做分流、研究、设计前置和 Stitch 审稿，不做默认实现 owner。

### 2. Web / React 主 owner

- `ui-ux-pro-max`
  - 默认 owner：`admin`、`merchant`、`dashboard`、`form`、`table`、`detail`、`approval`、`订单详情`、`列表页`、`工作台` 等状态型产品页面。
  - 适用：信息架构、状态层级、交互区优先级、表单/表格/详情/审核流、响应式产品页。
  - 在本仓库里，它是 `merchant / admin / web` 业务页的默认主技能。

- `frontend-design`
  - 默认 owner：代码导向的高设计质量 Web 页面。
  - 适用：品牌页、官网、专题页、下载页、活动页、产品介绍页，或用户明确要求“设计感很强且直接落代码”。
  - 前提：需要明确设计上下文；若缺品牌/受众/语气，先触发 `teach-impeccable`。
  - 不作为 state-heavy 产品页默认 owner。

- `frontend-skill`
  - 默认 owner：构图/叙事/首屏视觉风险最高的页面。
  - 适用：landing page、prototype、demo、showcase、game UI、视觉先行页面。
  - 与 `frontend-design` 的边界：
    - 更偏“海报式首屏、强构图、少量但有记忆点”时优先它。
    - 更偏“高质量成品代码 + 明确设计上下文 + 整页独特风格”时优先 `frontend-design`。

- `design-taste-frontend`
  - 不是主 owner，是高审美约束 sidecar。
  - 适用：用户明确要求“别有 AI 味”“更高级”“更有设计品味”，或页面很容易做成模板味时。
  - 推荐搭配：
    - `frontend-design + design-taste-frontend`
    - `ui-ux-pro-max + design-taste-frontend`
  - 不建议单独作为第一页路由。

### 3. Web 组件 / 实现 sidecar

- `shadcn`
  - 只在以下情况调用：
    - 项目本来就是 `shadcn/ui`
    - 用户明确要求 shadcn 组件 / registry / preset
    - 任务是补 `dialog` / `sheet` / `form` / `table` 等 shadcn 组件
  - 不要用于：
    - Ant Design 项目
    - 普通 CSS / Tailwind 但没 shadcn 的项目

- `build-web-apps:react-best-practices`
  - 不是 UI 主 owner，是 React / Next 实现 sidecar。
  - 只在以下情况附加：
    - React / Next 页面实现
    - 组件拆分、rerender、bundle、data fetching、Suspense、性能/架构优化
  - 推荐搭配：
    - `ui-ux-pro-max + react-best-practices`
    - `frontend-design + react-best-practices`

### 4. Web 审查与收尾

- `build-web-apps:web-design-guidelines`
  - 适用：用户要 review UI、检查可访问性、响应式或 guideline compliance。
  - 定位：轻量规范检查，聚焦 Web guideline。

- `audit`
  - 适用：用户要完整界面审计，覆盖 accessibility、performance、theming、responsive。
  - 定位：正式综合审计，比 `web-design-guidelines` 更重。

- `typeset`
  - 适用：主要问题在字体、字重、层级、行长、可读性。
  - 定位：只修 typography，不接管整页结构。

- `arrange`
  - 适用：主要问题在 spacing、布局节奏、栅格、间距松紧。
  - 定位：只修 layout rhythm，不接管风格定义。

- `polish`
  - 适用：页面主体已对，只差最后一轮细节质量提升。
  - 定位：最终收尾技能。
  - 推荐顺序：`typeset / arrange` 之后再 `polish`。

- `teach-impeccable`
  - 仅作为 `frontend-design` 的前置上下文收集器。
  - 不作为独立 UI 路由入口。

### 5. SwiftUI 主 owner

- `swiftui-ui-patterns`
  - 默认 owner：新 SwiftUI 页面、新组件、导航结构、Tab / Stack / Sheet、状态归属设计。
  - 这是 SwiftUI 构建默认主技能。

- `swiftui-view-refactor`
  - 默认 owner：既有 SwiftUI 大文件拆分、提炼子视图、整理状态、清理 view body。
  - 适用：已有页面太大、太乱、MVVM / MV 边界混乱。

- `swiftui-liquid-glass`
  - 只在以下情况调用：
    - 用户明确要 iOS 26 Liquid Glass
    - 要把现有 SwiftUI UI 改成 glass 风格
  - 不应作为普通 SwiftUI 页面默认技能。

### 6. SwiftUI 审查与性能

- `swiftui-pro`
  - 适用：SwiftUI 代码审查、现代 API、HIG、一致性、可维护性。
  - 定位：SwiftUI 全面 review skill。

- `swiftui-performance-audit`
  - 适用：卡顿、掉帧、CPU、内存、布局抖动、重绘过多。
  - 定位：只做 SwiftUI 性能问题。
  - 不要在普通 UI 开发时默认附加。

## 调用规则

- 规则 1：先判 `surface`
  - `web-react` 走 Web 矩阵
  - `swiftui` 走 SwiftUI 矩阵
- 规则 2：再判 `phase`
  - `discover / design` 优先 `ui-orchestrator`
  - `implement` 选主 owner
  - `review` 选 guideline / audit / pro
  - `polish` 选 `typeset` / `arrange` / `polish`
- 规则 3：`product_state` 页面默认 `ui-ux-pro-max`
- 规则 4：`marketing` 页面默认 `frontend-design` 或 `frontend-skill`
- 规则 5：`shadcn`、`react-best-practices`、`design-taste-frontend` 都是附加器，不是默认总入口
- 规则 6：同一轮最多 1 个主 owner + 少量 sidecar，避免多个技能同时争夺页面主导权

## 仓库默认路由

本仓库遵守以下前端路由基线：

- `ui-orchestrator`：方向不清时先走
- `frontend-design / frontend-skill`：品牌、landing、营销、下载、强视觉页面
- `ui-ux-pro-max`：`merchant` / `admin` / `dashboard` / `form` / `table` / `detail` / `approval`
- `shadcn`：仅限目标项目本身已用 shadcn；不要默认往 Ant Design 项目上套

## 示例

- “帮我先设计一个 merchant 订单详情页，再决定做不做”
  - 路由：`ui-orchestrator`
- “直接做一个很强视觉的品牌 landing page”
  - 路由：`frontend-design`
  - 若高审美要求明显，再加 `design-taste-frontend`
- “这个官网首屏构图太普通，帮我重做视觉结构”
  - 路由：`frontend-skill`
- “重构后台审核详情页 / 订单详情页 / 表单页”
  - 路由：`ui-ux-pro-max`
- “这个 Next.js 页面 rerender 太多、包太大”
  - 路由：`ui-ux-pro-max + react-best-practices`
- “这个项目本来就是 shadcn，补一个 Sheet 和 Form”
  - 路由：`shadcn`
- “帮我审一下这个 Web 页面可访问性和响应式问题”
  - 路由：`build-web-apps:web-design-guidelines`
  - 若要更完整审计，再换 `audit`
- “页面结构已经对了，只是排版丑、间距乱、最后收一轮”
  - 路由：`typeset / arrange / polish`
- “新建一个 SwiftUI 详情页和导航结构”
  - 路由：`swiftui-ui-patterns`
- “这个 SwiftUI View 1200 行，帮我拆干净”
  - 路由：`swiftui-view-refactor`
- “给我做 iOS 26 玻璃态 tab bar / card”
  - 路由：`swiftui-liquid-glass`
- “SwiftUI 列表滚动掉帧，帮我定位”
  - 路由：`swiftui-performance-audit`
- “帮我 review 一遍 SwiftUI 页面是否现代、规范、可访问”
  - 路由：`swiftui-pro`

## 非目标

- 不分析非 UI skill。
- 不在这里设计新的 routing skill 文件或自动化编排器。
- 不把 sidecar 扩展成第二个主 owner。
