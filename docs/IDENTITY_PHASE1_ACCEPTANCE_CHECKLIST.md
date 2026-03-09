# 多身份 Phase 1 验收清单（Web 一期）

## 1. 验收目标
- 验证“申请 → 审核 → 激活 → 切换 → 权限生效”闭环。
- 验证统一模型：`owner | provider | admin`，`providerSubType=designer|company|foreman`。
- 验证兼容策略：历史 `worker/homeowner` 可读，响应统一归一化。

## 2. 前置条件
- 后端已部署包含身份审核 API 的版本。
- 已执行迁移脚本（历史阶段记录）：`server/scripts/history/004_migrate_worker_to_provider_foreman.sql`。当前正式 schema 发布目录统一为 `server/migrations/`。
- 准备 3 类测试账号：仅业主、历史 worker、已通过 provider。

## 3. 核心场景（必须通过）

### 3.1 申请与审核
- [ ] 用户提交申请：`identityType=provider` 且 `providerSubType` 仅可为 `designer/company/foreman`。
- [ ] 禁止新增 `worker` 申请（返回明确错误）。
- [ ] 管理端可查询待审列表。
- [ ] 管理端可查看申请详情。
- [ ] 审核通过后，申请状态变更为 `approved`，并生成/更新 provider 身份。
- [ ] 审核拒绝后，申请状态变更为 `rejected`，保留驳回原因。

### 3.2 身份切换与会话
- [ ] `POST /identities/switch` 支持 `identityId` 主入参。
- [ ] 切换成功返回新 `token + refreshToken`。
- [ ] 切换成功返回 `activeRole/providerSubType/providerId`。
- [ ] refresh 后保持当前激活身份，不回退默认身份。
- [ ] 切换频率限制生效（超过阈值返回限制提示）。

### 3.3 兼容与迁移
- [ ] 历史 worker 账号登录后展示为 `provider + foreman` 语义。
- [ ] 历史 token（仅 `userType`）仍可被服务端识别。
- [ ] 权限判断依据 `activeRole + providerSubType` 生效。
- [ ] 迁移后 `user_identities` 中无新增 `worker` 授权来源。

### 3.4 Web 端行为
- [ ] 商家 Web 登录后根据 `providerSubType` 展示对应工作台入口。
- [ ] foreman 不显示不属于本身份的入口（如作品集/方案等按规则限制）。
- [ ] 切换身份后菜单与权限即时生效。

## 4. P0 质量门槛
- [ ] 无“切换后权限错乱”问题。
- [ ] 无“refresh 后身份回退”问题。
- [ ] 迁移一致性校验 100%。
- [ ] 关键链路成功率 ≥ 99%。

## 5. 回滚演练
- [ ] 已验证回滚脚本可执行（历史阶段记录）：`server/scripts/history/004_migrate_worker_to_provider_foreman_rollback.sql`。
- [ ] 已验证 RBAC 回滚脚本可执行（历史阶段记录）：`server/scripts/history/005_add_identity_application_audit_menu_rollback.sql`。
- [ ] 回滚后可恢复 worker 标识（仅用于应急，不建议长期运行）。

## 6. 交付物
- [ ] 上线与回滚 SOP（执行顺序）：`docs/IDENTITY_PHASE1_RELEASE_SOP.md`。
- [ ] 自动化验收执行文档：`docs/IDENTITY_PHASE1_AUTOMATED_ACCEPTANCE.md`。
- [ ] 接口变更说明（字段与兼容策略）。
- [ ] 审核页面操作手册（审核通过/驳回流程）。
- [ ] 上线后监控项（切换失败率、审核积压、refresh 异常）。
