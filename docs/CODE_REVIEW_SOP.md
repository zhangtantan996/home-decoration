# 代码审查 SOP（home-decoration 项目版）

本 SOP 用于 `home-decoration` 的代码审查、复审和审查后修复。目标不是把审查做成流程表演，而是在 3 轮内把高风险问题收敛到可验证状态。

适用场景：
- 未提交 diff 审查
- PR / patch 审查
- 审查后修复与复审
- 高风险模块变更前的风险识别

默认原则：
- 只审本次变更及其关键联通点，不做无边界全仓扫描。
- 先报 P0/P1，再报必要 P2；不要用低价值建议淹没阻塞问题。
- 修复阶段一次只修 P0/P1，避免边修边扩大范围。
- 超过 3 轮仍持续出现新阻塞问题，进入范围冻结，拆成新任务。

---

## 0. 项目规则优先级

审查前先遵守这些项目规则：

1. 仓库根 `AGENTS.md`
2. `docs/CLAUDE_DEV_GUIDE.md`
3. `docs/CODEX_WORKFLOW.md`
4. `docs/SECURITY.md`
5. 本 SOP

如果本 SOP 与可执行代码、脚本或 CI 配置冲突，以可执行事实为准，并在审查结果里说明冲突。

---

## 1. 本次审查边界（每次必填）

审查前必须先确定：

- 需求目标：`________________________`
- 变更范围（文件 / 模块）：`________________________`
- 涉及端：
  - [ ] `server`
  - [ ] `admin`
  - [ ] `merchant`
  - [ ] `supervisor`
  - [ ] `web`
  - [ ] `website`
  - [ ] `mini`
  - [ ] `mobile`
  - [ ] `deploy`
  - [ ] `tests/e2e`
  - [ ] `ops/docs`
- 涉及风险域：
  - [ ] `auth`
  - [ ] `identity`
  - [ ] `payment/escrow`
  - [ ] `im`
  - [ ] `public-web`
  - [ ] `deploy`
  - [ ] `legal/privacy`
  - [ ] `rbac`
  - [ ] `sms`
  - [ ] `none`
- 本次只允许改动的类型：
  - [ ] bug 修复
  - [ ] 小优化
  - [ ] 功能增量
  - [ ] 重构（需说明原因）
  - [ ] 文档 / 配置
- 本轮不允许改动：`________________________`
- 预期验证方式：`________________________`

边界不清时，先输出“审查边界确认”，不要直接开始改代码。

---

## 2. 严重级别定义

### P0：必须阻断

出现以下任一问题，默认 P0：

- 鉴权绕过、JWT / token / session 泄漏、权限越权。
- `payment/escrow` 金额、状态机、幂等、回调、退款、释放、结算、对账逻辑错误。
- 破坏项目核心业务流：设计确认（成交点 A）→ 报价基线 → 施工主体选择 → 施工报价 → 用户确认施工报价（成交点 B）→ 项目创建。
- 项目创建提前到成交点 B 之前，或把设计确认和工长确认混为一个交易点。
- 硬编码密钥、真实账号、API key、短信 / 支付 / OSS / RAM 凭证。
- 前端向用户暴露 SQL、数据库、JWT、token、WebSocket、localhost、Docker、npm、堆栈、原始后端错误等技术细节。
- 破坏性数据库变更、数据丢失风险、迁移不可回滚，且没有确认。
- deploy / 网关 / 环境变量变更可能影响生产、回调域名、证书、容器启动或回滚。
- CI / 分支保护 / 发布流程被绕过，或把 `main` 当作本地开发分支累积改动。

### P1：本轮必须修

出现以下任一问题，默认 P1：

- `identity`、商家认证、运营审核、RBAC、菜单权限、角色授权出现回归。
- `server` 跳过 `handler -> service -> repository` 分层，或在请求路径中 `panic`。
- API 错误处理不符合业务可读输出，或前后端契约不一致。
- migration / fixture / schema 与代码不一致，导致 `db:check` 或 smoke 失败。
- `admin` / `merchant` / `supervisor` 关键页面流程阻塞。
- `mini` 主交易链路、支付结果、报价确认、项目创建入口阻塞。
- `web` / H5 登录门控、支付结果、辅助浏览路径破坏。
- Nginx / gateway 路由导致 admin、merchant、web、website、API 任一入口不可达。
- 前端页面缺少关键 loading / empty / error / disabled 状态，导致核心流程不可判断。

### P2：建议项

默认 P2：

- 视觉层级、文案、布局密度、动效、轻微响应式问题。
- 非关键性能问题。
- 可维护性改进、重复代码、命名不清。
- 文档缺口或验证说明不足。
- 已有技术债未被本次变更扩大。

P2 不应阻塞本轮交付，除非它会放大 P0/P1 风险。

---

## 3. 项目专项审查清单

### 3.1 后端 `server`

必须检查：

- 是否保持 `router -> handler -> service -> repository` 分层。
- handler 是否只做解析和响应，不承载业务逻辑。
- service 是否承载业务状态流转、幂等、校验和事务边界。
- repository 是否只做 DB 访问。
- 是否使用 `server/pkg/response` 输出统一响应。
- 错误是否 `fmt.Errorf("...: %w", err)` 包装，且用户侧不暴露技术细节。
- 鉴权、身份、RBAC、支付、托管、短信、IM 相关改动是否有最小验证。
- schema-sensitive 变更是否配套 migration、fixture、`npm run db:check`。

### 3.2 管理端 `admin`

必须检查：

- 是否保持 React 18.3.1、Ant Design 5、Zustand，不引入新 UI 框架或状态库。
- 审核、身份、权限、菜单、法务、配置项是否遵守 RBAC 和路由权限。
- 列表 / 详情 / 审核页是否覆盖 loading、empty、error、disabled、长文本、窄屏。
- 是否避免展示原始后端错误、接口路径、调试信息。

### 3.3 商家端 `merchant`

必须检查：

- 是否保持 React 18.3.1、Ant Design 5、Zustand。
- 履约、订单、报价、项目、商家认证、资金状态展示是否和后端状态语义一致。
- 按钮显隐是否会误导商家执行错误操作。
- 状态标签、结果回填、异常提示是否业务可读。

### 3.4 监理端 `supervisor`

必须检查：

- 项目执行、监理任务、进度、验收入口是否与权限一致。
- 不要把运营 / 商家 / 用户权限混入监理角色。
- 任务状态变更是否有清晰来源和回显。

### 3.5 用户侧 `web` / `mini` / `mobile`

必须检查：

- `mini` 是主交易面；不要破坏报价确认、支付、项目创建、订单状态主链路。
- `web` / H5 默认是登录门控后的辅助浏览、支付结果和落地入口。
- `mobile` 使用 React 19.2 / RN 0.83，不要和其他端统一 React 版本。
- `mini` / `mobile` 默认 iOS-like 简洁风格，不走 Android Material 大色块和重 FAB 风格。
- 小程序 UI 不使用 emoji 图标。
- 支付、订单、状态页必须覆盖失败、取消、重复点击、长文本、空状态。

### 3.6 官网 / 公共页 `website`

必须检查：

- 官网和用户端入口边界是否清楚。
- 公共页面不泄漏后台入口、调试信息、内部路径。
- 法务、隐私、用户协议版本和链接一致。

### 3.7 前端工程约束

所有前端改动必须检查：

- 不新增 hardcoded Hex / RGB / HSL 颜色。
- 不新增临时 spacing / radius / shadow 系统。
- 设计值来自 `shared/design-tokens/tokens.json` 及生成产物。
- 不手写业务按钮、输入框、弹窗、卡片、状态原语：
  - `admin` / `merchant` / `supervisor` 使用 Ant Design。
  - `mini` 使用 `mini/src/components`。
  - `web` / `website` 使用生成 CSS / token primitives。
  - `mobile` 使用 `mobile/src/components/primitives`。
- UI 覆盖 loading、empty、error、disabled、narrow-width、long-text、multi-item。

### 3.8 部署 / 网关 `deploy`

必须检查：

- Nginx / gateway 路由是否仍能访问 admin、merchant、supervisor、web、website、API。
- 环境变量、回调域名、证书、容器端口是否和代码版本一致。
- 不在配置中写入真实密钥。
- 生产影响动作必须先确认，不在审查修复中顺手发布。
- deploy 变更要给出最小回滚说明。

---

## 4. 审查输出格式（固定）

### 4.1 Findings

按严重级别排序，先 P0，再 P1，再 P2。

格式：

```text
[P0/P1/P2] 文件:行号 | 问题 | 影响 | 建议修复 | 可验证点
```

要求：

- 每条 finding 必须能落到具体文件 / 行号 / 逻辑位置。
- 不确定的问题要标为“待确认”，不要伪装成确定 bug。
- 没有 P0/P1 时，明确写“未发现阻塞项”。

### 4.2 Open Questions

只列会影响修复策略的问题，例如：

- 业务口径不清
- 是否允许改接口契约
- 是否允许 migration
- 是否允许触碰 deploy
- 是否需要兼容历史数据

### 4.3 Verification Plan

写本次最小验证组合：

```text
最小验证：
- command / path / manual step

未覆盖：
- reason
```

---

## 5. 审查后修复约束

修复阶段必须遵守：

- 一次只修 P0/P1。
- 不顺手扩大接口、schema、UI 框架、状态库或 deploy 范围。
- 不修改与 finding 无关的用户改动。
- 每处修复后补一条验证说明。
- 如发现同类模式问题，先定位共性根因，再决定是否一次性修复。
- 若修复会触发高风险域，先暂停并确认。

禁止：

- 为了修一个 bug 顺手升级 React、AntD、Taro、RN、Go 或数据库版本。
- 为了审查顺手清理大批旧代码。
- 为了让测试过而弱化权限、状态机、金额校验或风控。
- 未确认就执行破坏性 schema、生产 deploy、`git push origin main`。

---

## 6. 项目验证矩阵

按变更范围选择最小有意义验证。

| 变更范围 | 首选验证 |
|----------|----------|
| `server` 局部逻辑 | `cd server && go test ./internal/<pkg>/...` |
| `server` 广泛改动 | `cd server && make test` 或 `npm run verify:backend` |
| schema / migration | `npm run db:check` + 相关后端测试 |
| `identity` / 认证 / 商家认证 | `npm run test:identity:acceptance` |
| `merchant` 关键流程 | `npm run verify:merchant` 或 `npm run test:e2e:merchant:smoke` |
| `admin` | `npm run verify:admin` |
| `supervisor` | `npm run verify:supervisor` |
| `web` / 用户 H5 | `npm run verify:user-web` |
| `website` | `cd website && npm run check && npm run build` |
| `mini` | `npm run verify:mini` |
| `mobile` | `npm run verify:mobile` |
| 前端视觉 / token | `npm run check:frontend-style:<scope>`；若无 scoped script，用 `npm run check:frontend-style -- --scope <scope>` |
| release / gateway / 跨端回归 | `npm run smoke:release`，必要时 `npm run smoke:test` |

执行 Playwright 前必须确认目标服务正在正确端口提供页面。

无法执行验证时，必须说明：

- 未执行命令
- 阻塞原因
- 风险
- 替代依据

---

## 7. 3 轮止损机制

### 第 1 轮：只审查

输出：

- P0/P1/P2 findings
- open questions
- 最小验证计划
- 是否建议进入修复

不做：

- 不主动改代码
- 不顺手重构
- 不扩大扫描范围

### 第 2 轮：只修 P0/P1

输出：

- 修复清单
- 每条 finding 对应修复点
- 最小验证结果
- 未覆盖风险

不做：

- 不处理非必要 P2
- 不修改本轮 finding 之外的文件，除非是同一根因的最小公共入口

### 第 3 轮：只复审本次 patch

输出：

- 是否还有阻塞项
- 是否出现新 P0/P1
- 回归点是否通过

如果第 3 轮后仍有新阻塞项：

- 冻结当前范围
- 不继续无限修
- 拆成新任务单独处理

---

## 8. 标准提示词

### 8.1 只审查，不改代码

```text
本次仅做代码审查，不改代码。
请只审当前 diff 及关键联通点。
按 P0/P1/P2 输出 findings，P0/P1 需要明确可验证点。
请结合 home-decoration 的 AGENTS.md、CODE_REVIEW_SOP.md、业务主流程、权限、支付/托管、部署、前端 token 约束进行判断。
```

### 8.2 审查后修复

```text
请只修本次审查确认的 P0/P1。
不要扩大接口、schema、UI 框架、状态库或 deploy 范围。
每处修复后说明对应 finding 和验证方式。
如果发现需要触碰 auth/identity/payment/escrow/deploy/legal/privacy/rbac/sms，请先暂停说明风险。
```

### 8.3 复审

```text
请只复审本次 patch 和关键联通点。
不要做全量二次审查，除非出现新 P0。
输出剩余阻塞项、验证结果和是否可以收口。
```

---

## 9. 交付格式

最终交付必须包含：

- 本次结论：`通过 / 有阻塞 / 环境阻塞 / 状态未知`
- 关键 findings 或“未发现阻塞项”
- 已修复内容（如有）
- 已验证命令与结果
- 未验证项与原因
- 后续建议（仅当确有必要）

不要把“代码写完了”当作“验证通过”。
