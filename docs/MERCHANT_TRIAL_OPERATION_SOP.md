# 统一商家入驻一期试运营 SOP

## 目标
- 统一试运营口径：用户与商家可同号共存，商家子类型互斥，主材商纳入统一商家体系。
- 确保发布可灰度、可回滚、可追溯。

## 迁移权威路径
- **发布权威目录**：`server/migrations/`
- `server/scripts/migrations/` 仅保留历史/本地辅助用途，不作为正式发版唯一依据。
- 一期当前涉及：
  - `server/migrations/v1.6.2_freeze_merchant_identity_support.sql`
  - `server/migrations/v1.6.3_add_source_application_id.sql`

## 发布前阻断项
1. 同号共存验收通过
2. 驳回回填验收通过
3. 主材商审核链路验收通过
4. `detail-for-resubmit` 安全校验验收通过
5. `source_application_id` 写入与回查验收通过
6. 回滚演练通过

## 回滚与补偿原则
- 若新主体创建失败，旧主体必须保持 active，不允许出现双冻结。
- 若审核切换后回滚：
  - 恢复旧 `provider/material_shop` 的 active 状态
  - 恢复旧 `user_identities` 的 active/verified 状态
  - 下线新创建主体
- 回滚时优先依据 `source_application_id` 回查来源申请单。

## E2E 测试数据治理
- 测试手机号统一使用 `19` 前缀随机号。
- 默认固定验证码模式：`SMS_FIXED_CODE_MODE=true`，验证码默认 `123456`。
- 每个 E2E 场景应独立生成手机号，禁止复用长期固定测试手机号。
- 审核/申请相关用例需在用例内自行完成“申请 -> 审核 -> 清理/失效”闭环，避免状态串场。

## 观测与审计建议
- 重点观察：
  - 登录 `nextAction` 分布
  - `detail-for-resubmit` 成功率 / 验证码失败率
  - 重提提交成功率
  - 审核通过后冻结旧主体结果
- 审核日志至少记录：
  - 申请单 ID
  - 旧主体类型/ID
  - 新主体类型/ID
  - 审核管理员 ID
