# 业务闭环补全方案（一）

## 1. 结论

当前项目**已有业务骨架，但主链路尚未完整闭环**。

已具备能力：
- 客户线索/预约：`Booking`、`Demand`、`DemandMatch`
- 设计方案：`Proposal`
- 订单与分期：`Order`、`PaymentPlan`
- 项目与施工：`Project`、`ProjectPhase`、`Milestone`、`WorkLog`
- 灵感案例：`ProviderCase` / `CaseAudit`

当前主要断点：
1. **线索/预约 → 方案 → 项目** 两条链并存，但规则不统一
2. **设计确认后未形成“选工长/定价确认”独立闭环**
3. **项目创建后缺少“正式开工”动作与状态闸门**
4. **节点验收与支付计划之间未建立强绑定**
5. **完工后的方案沉淀到灵感案例缺少标准入口与数据映射**

因此判断：**现状不是“业务流完整”，而是“流程元素齐了，但关键衔接未闭环”。**

---

## 2. 目标范围

本次要补齐的业务主链如下：

1. 客户提交线索/需求
2. 平台或客户选择设计师并进入谈单
3. 设计师提交设计图/报价预算
4. 客户确认设计方案
5. 选择工长 / 确认施工方与施工报价
6. 创建项目并确认开工
7. 按节点施工、验收、放款/结算
8. 完工后将本次方案沉淀为灵感案例

本次方案优先解决：
- 主状态机不清
- 阶段切换靠前端拼装
- 设计/施工/验收/案例沉淀之间缺少服务端闭环约束

---

## 3. 当前实现盘点

## 3.1 获客入口

### A. 预约链路 Booking
适合用户直接找设计师/服务商。

当前能力：
- 可创建预约
- 商家可确认预约
- 设计师可基于预约提交 `Proposal`

问题：
- 更偏“直连设计师”，不是完整商机状态机
- 后续“施工方选择/定价确认”没有显式节点

### B. 需求线索链路 Demand / DemandMatch
适合平台派单、多商家抢答或匹配。

当前能力：
- 用户发布需求 `Demand`
- 平台分配 `DemandMatch`
- 商家接受后可提交 `Proposal`

问题：
- `ConfirmProposal` 对 `Demand` 来源直接返回“下一阶段开放”
- 即**线索链进入报价后无法正式成交闭环**

---

## 3.2 方案阶段 Proposal

当前已有：
- 方案提交
- 用户确认/拒绝
- 拒绝后重提版本
- 最多拒绝 3 次后进入争议

问题：
- Booking 来源能确认，Demand 来源不能确认
- 方案确认后，没有统一进入“施工准备/工长选择”状态
- `Proposal` 只承载设计费、施工费、材料费汇总，**缺少工长确认结果**

---

## 3.3 项目阶段 Project

当前已有：
- 可从 `ProposalID` 创建项目
- 初始化默认阶段 `ProjectPhase`
- 初始化默认验收节点 `Milestone`
- 可记录施工日志 `WorkLog`
- 可做节点验收 `AcceptMilestone`

问题：
- `CreateProject` 一创建就默认进入“准备阶段”，但**没有开工确认动作**
- `CurrentPhase` 文案值混乱：既有中文“准备阶段”，又有英文流程值如 `selecting` / `billing`
- `OrderService.GenerateBill()` 要求 `project.CurrentPhase == "selecting"`，但 `ProjectService.CreateProject()` 默认写的是“准备阶段”，**状态不一致，实际容易断链**
- `AcceptMilestone()` 只更新节点状态和项目展示文案，**未驱动支付计划或结算**

---

## 3.4 支付与验收

当前已有：
- 设计费订单
- 施工费订单
- 分期计划 `PaymentPlan`
- 验收节点 `Milestone`

问题：
- `PaymentPlan` 与 `Milestone` 只是“结构相似”，**没有强绑定关系**
- 验收成功后不会自动推进对应分期状态
- 托管账户 `EscrowAccount` / 交易流水 `Transaction` 已有模型，但闭环还不完整

---

## 3.5 灵感案例沉淀

当前已有：
- 商家案例主表 `ProviderCase`
- 审核草稿表 `CaseAudit`
- `QuoteItems / QuoteTotalCent / ShowInInspiration`
- 商家案例管理页面

问题：
- 没有“从本次成交方案/项目一键沉淀为案例”的入口
- `MerchantPortfolioCase` 前端类型过于简化，和服务端能力不一致
- 方案中的预算/报价、项目中的面积/风格/图片，缺少标准映射到案例

---

## 4. 核心缺口

### 缺口 1：两条前置链路没有统一收口
- Booking 与 Demand 都能产出 Proposal
- 但只有 Booking 能确认成交
- 导致线索模式无法走完整链

### 缺口 2：缺少“选工长 / 定施工方 / 定施工价”明确业务节点
你提出的核心业务顺序里，这一步是必须的，但现在代码中只隐含在：
- `Project.CrewID`
- `GenerateBill(ConstructionFee + MaterialFee)`

也就是说：**数据字段有，业务动作没有。**

### 缺口 3：缺少“正式开工”闸门
现在项目创建 ≠ 开工，项目创建后也没有：
- 开工前条件校验
- 开工确认
- 开工时间锁定
- 项目状态推进

### 缺口 4：验收没有驱动结算
业务上应是：
- 阶段完工
- 提交验收
- 客户通过
- 对应节点款项释放 / 分期更新

当前只实现了“客户点击验收成功”，没接资金侧。

### 缺口 5：方案结果没有沉淀为平台资产
完工后好的方案和报价，应该成为：
- 灵感案例内容资产
- 后续获客素材
- 标准报价参考样本

当前没有自动/半自动沉淀闭环。

---

## 5. 补全后的标准业务流

## 5.1 一级状态机（推荐）

统一抽象主链状态：

- `lead_pending` 线索待处理
- `lead_contacting` 谈单中
- `proposal_pending` 待提交方案
- `proposal_review` 方案待客户确认
- `construction_provider_selecting` 施工方待确定
- `construction_quote_confirming` 施工报价待确认
- `project_preparing` 项目准备中
- `project_ready_to_start` 待开工
- `project_in_progress` 施工中
- `project_acceptance` 验收中
- `project_completed` 已完工
- `project_closed` 已闭环归档
- `project_disputed` 争议中
- `project_cancelled` 已取消

建议不要再混用“中文展示值”和“流程状态值”。

---

## 5.2 业务主链（目标口径）

### 阶段 A：客户流线索
入口可为：
- 预约 Booking
- 需求 Demand

统一要求：
- 最终都要收口到一个“业务机会/商机上下文”
- 至少要能唯一定位：客户、设计师、地址、面积、预算、来源

### 阶段 B：设计师谈单
- 设计师接受线索 / 确认预约
- 完成沟通记录
- 提交初版方案与预算

### 阶段 C：提交设计图和报价预算
- 产出 `Proposal`
- 附件中存设计图、效果图、预算附件
- 用户确认 / 拒绝 / 退回修改

### 阶段 D：选工长 & 确认工长价格
新增独立步骤：
- 选择施工负责人（工长 / 服务商）
- 确认施工报价（必要时可与设计报价分离）
- 锁定施工周期和进场时间

### 阶段 E：项目创建 & 开工
- 基于已确认的设计方案 + 已确认的施工方创建项目
- 满足条件后执行“确认开工”
- 自动进入施工阶段

### 阶段 F：节点验收
- 工长/商家提交节点完成
- 客户验收
- 验收通过后释放节点资金，推进下个节点

### 阶段 G：竣工 & 沉淀案例
- 项目完成后
- 支持一键“保存本次方案数据到灵感案例”
- 默认进入案例草稿/待审核

---

## 6. 数据与实现建议

## 6.1 最小改动方案（推荐先做）

不先大改表结构，先在现有模型基础上补业务动作：

### 方案 A：保守补全
1. **允许 Demand 来源 Proposal 被确认**
   - 让 `ConfirmProposal()` 支持 demand 来源
   - 生成设计费订单或直接进入施工方确认阶段

2. **新增施工确认接口**
   例如：
   - `POST /projects/:id/construction-selection`
   - 入参：`crewId / providerId / constructionFee / materialFee / startDate`

3. **新增开工接口**
   例如：
   - `POST /projects/:id/start`
   - 校验：施工方已定、预算已定、开工时间已确认

4. **新增节点提交验收接口**
   例如：
   - `POST /projects/:id/milestones/:milestoneId/submit`
   - 先“提交验收”，再由用户“验收通过”

5. **新增案例沉淀接口**
   例如：
   - `POST /projects/:id/save-to-inspiration`
   - 从 Proposal / Project / WorkLog 提取数据生成 `CaseAudit`

这个方案改动小、可落地快。

---

## 6.2 推荐新增字段

### Project 建议新增
- `FlowStatus string`：统一流程状态机值
- `SourceType string`：booking / demand
- `SourceID uint64`：原始业务来源ID
- `ConstructionProviderID uint64`：最终施工方
- `ConstructionConfirmedAt *time.Time`
- `StartedAt *time.Time`
- `CompletedAt *time.Time`

### Milestone 建议新增
- `PaymentPlanID uint64`：绑定支付计划
- `SubmittedBy uint64`
- `SubmitNote string`
- `SubmitImages string`

### ProviderCase / CaseAudit 建议新增（如后续需要增强追溯）
- `SourceProjectID uint64`
- `SourceProposalID uint64`
- `SourceType string`

这样后续就能知道案例来源于哪个真实成交项目。

---

## 7. 灵感案例沉淀方案

## 7.1 保存逻辑

“保存本次方案数据到灵感案例里”建议走：

- 来源：`Project + Proposal + WorkLog`
- 目标：优先写入 `CaseAudit`（待审核草稿），而不是直接公开 `ProviderCase`

理由：
- 案例属于对外展示资产，应经过审核
- 避免未脱敏/未完工/质量差内容直接公开

## 7.2 字段映射建议

### Project / Proposal → CaseAudit
- `title`：`Project.Name` 或 `Address + 风格/阶段摘要`
- `coverImage`：优先取完工图，其次取方案图第一张
- `style`：从 Proposal 摘要或前端传入补充
- `layout`：可从预约/需求补齐，当前无则允许空
- `area`：`Project.Area`
- `price`：`Project.Budget`
- `quoteTotalCent`：`(Proposal.ConstructionFee + Proposal.MaterialFee + Proposal.DesignFee) * 100`
- `quoteItems`：若已有预算明细则直接带入，否则生成汇总条目
- `description`：方案概述 + 项目亮点 + 验收结果摘要
- `images`：施工日志图片 + 方案图 + 完工图

## 7.3 保存触发时机

推荐两个入口：
1. **完工后手动保存**（首选）
2. 后续可支持“完工后提示保存”

不建议默认自动公开。

---

## 8. L2 交付建议（实施优先级）

## P0：必须补
1. 打通 `Demand -> Proposal Confirm`
2. 引入“施工方确认/报价确认”业务步骤
3. 项目增加“确认开工”动作
4. 节点验收前增加“提交验收”动作
5. 新增“保存到灵感案例”接口

## P1：应该补
1. 统一 `Project.CurrentPhase` 与流程状态字段
2. 绑定 `Milestone` 与 `PaymentPlan`
3. 完工后自动提示案例沉淀

## P2：可优化
1. 抽象统一商机表（如 Opportunity）
2. 引入完整合同、变更单、补充报价闭环
3. 案例自动提炼卖点文案/预算摘要

---

## 9. 对当前项目的最终判断

如果严格按你给的链路标准：

> 从客户流线索 → 设计师谈单 → 出设计图和报价预算 → 选工长/工长价格确定 → 开工 → 节点验收 → 完工 → 保存方案到灵感案例

那么当前项目状态是：

- **前半段 60%-70% 已有基础**
- **中段（选工长/定价/开工）是最大断点**
- **后段（验收驱动结算、沉淀灵感案例）还缺关键闭环动作**

结论：**现在还不能算“完整业务流”，只能算“已具备可补齐的主干框架”。**

---

## 10. 本次建议落地项

本轮建议直接实现：

1. 新增“保存本次方案数据到灵感案例”服务端接口
2. 该接口从项目/方案生成 `CaseAudit` 草稿
3. 输出当前业务流缺口文档（本文件）

下一轮再补：

1. 施工方确认接口
2. 开工接口
3. 节点提交验收接口
4. 验收驱动支付计划联动
