# Architecture

Mission-level architecture notes for the quote ERP integration work.

**What belongs here:** domain truth, workflow boundaries, entity relationships, implementation constraints discovered during execution.  
**What does NOT belong here:** temporary debugging notes or validation evidence.

---

## Workflow Truth

- 成交点 A（设计确认）与成交点 B（工长确认）必须保持分离。
- 项目只能在用户确认施工报价后创建。
- `BusinessFlow`, `QuoteList`, `QuoteSubmission`, `Project`, `Order`, `PaymentPlan` 必须收口到单一施工真相。

## Domain Direction

- 引入工程量基础表 / 源清单层，避免 `QuoteListItem` 同时承担输入层与成交层语义。
- 当前只支持半包：
  - `pricing_mode = half_package`
  - `material_included = false`

## Surface Responsibilities

- User Web：第一用户验证面，承接报价确认后待开工与支付推进
- Merchant：主履约端，负责源清单、施工报价、履约资料
- Admin：主治理端，负责桥接编排、风控、异常与轻量治理面

## Guardrail Focus

- 监理在本 mission 中是轻角色，只负责证据与记录，不承担成交或裁决权。
- 变更单只做轻量闭环；若正式入口未完成，也必须阻止隐式编辑改写真相。
- 人工放款不能绕过未验收或冻结状态。
