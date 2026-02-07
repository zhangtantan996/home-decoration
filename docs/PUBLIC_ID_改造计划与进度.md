# publicId 改造计划与进度（双 ID 方案）

更新时间：2026-02-06
负责人：Codex + 开发同学
目标：内部继续使用 `users.id(uint64)`，对外逐步切换到 `users.public_id`，避免可枚举 ID 暴露。

---

## 1. 方案原则

1. 内部主键不动：`id` 继续用于数据库关联与查询性能。
2. 对外标识切换：客户端与开放接口逐步使用 `publicId`。
3. 平滑迁移：后端保持 `id/publicId` 双兼容，客户端分批切换。
4. 可回滚：迁移分阶段发布，每阶段可独立回退。

---

## 2. 当前总体进度

- 总进度：**约 98%**
- 已完成阶段：A（数据层）、B（认证层）、C（聊天关键接口）、D1（移动端入口改造）、D2（客户端全链路收敛）、E（接口契约统一）
- 已完成阶段：F（灰度发布与观测）
- 待开始阶段：G（下线对外 `id`）

---

## 3. 已完成项（Done）

### A. 数据层

- [x] 用户模型新增 `publicId` 字段，并在创建时自动生成
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/model/model.go`
- [x] 新增数据库迁移，完成加列、历史回填、唯一索引、非空约束
  - `/Volumes/tantan/AI_project/home-decoration/server/migrations/v1.4.1_add_user_public_id.sql`
- [x] 已在本地容器数据库执行并校验通过（`total/non_null/distinct` 一致）

### B. 认证与会话层

- [x] 用户 token 增加 `sub` 与 `userPublicId`，保留 `userId` 兼容旧端
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/service/user_service.go`
- [x] access/refresh 区分加强，刷新令牌校验 `token_use=refresh`
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/service/token_service.go`
- [x] JWT 中间件写入 `userPublicId` 上下文（含 `sub` 回退）
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/middleware/middleware.go`
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/middleware/optional_jwt.go`
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/middleware/merchant_middleware.go`

### C. 关键接口兼容层

- [x] 登录/注册/用户资料返回 `publicId`
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/handler/handler.go`
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/handler/wechat_auth_handler.go`
- [x] 新增用户标识统一查询能力：支持 `id/publicId`
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/service/user_service.go`
- [x] `GET /tinode/userid/:userId` 改为支持 `id/publicId`
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/handler/tinode_handler.go`
  - `/Volumes/tantan/AI_project/home-decoration/server/internal/handler/tinode_handler_test.go`

### D1. 移动端聊天入口（首批）

- [x] 移动端 Tinode API 新增语义化方法，保留兼容别名
  - `/Volumes/tantan/AI_project/home-decoration/mobile/src/services/api.ts`
- [x] Tinode 解析逻辑改为“用户标识”语义（id/publicId）
  - `/Volumes/tantan/AI_project/home-decoration/mobile/src/services/TinodeService.ts`
- [x] 设计师/工人/公司详情页发起聊天，优先传 `publicId`，回退 `id`
  - `/Volumes/tantan/AI_project/home-decoration/mobile/src/screens/ProviderDetails.tsx`
  - `/Volumes/tantan/AI_project/home-decoration/mobile/src/types/provider.ts`

---

## 4. 下一批计划（In Progress / Next）

### D2. 客户端全链路收敛（已完成）

- [x] Message 列表进入 ChatRoom 的参数统一支持 `publicId`
- [x] ChatRoom 内 partner 标识命名统一（避免和 Tinode `usr...` 混淆）
- [x] Admin 商家 IM 页面链路统一按“用户标识”调用
- [x] 对历史缓存 key 兼容（避免老会话丢失）

### E. 接口契约统一（已完成）

- [x] 与聊天相关的列表/详情 API 补充 `publicId` 字段
- [x] 文档中明确：对外字段默认 `publicId`，`id` 仅内部/调试
- [x] 新增 DTO 层转换，防止不同 handler 返回不一致

### F. 灰度发布与观测（已完成）

- [x] 增加 `publicId` 缺失告警指标（后端日志 + 面板）
- [x] 上线灰度比例策略（先移动端小流量）
- [x] 故障回滚预案演练（恢复为只读旧 `id` 路径）

### F.1 灰度配置键（已落地）

- `id.public_id_rollout_enabled`：是否启用灰度（默认 `false`）。
- `id.public_id_rollout_mobile_percent`：移动端/小程序灰度比例（默认 `5`，范围 `0-100`）。
- `id.public_id_rollout_default_percent`：其他端灰度比例（默认 `0`，范围 `0-100`）。

说明：当前灰度策略仅用于观测与打标，不改变主业务流程。

### F.2 回滚演练配置键（已落地）

- `id.public_id_rollback_drill_enabled`：是否启用回滚演练观测（默认 `false`）。
- `id.public_id_rollback_force_legacy_lookup`：紧急回滚开关，开启后 Tinode 用户查询仅按内部 `id` 解析（默认 `false`）。

说明：默认关闭且不影响现网；仅在演练/故障处置窗口按预案启用。

### G. 目标态收口（待开始）

- [ ] 新接口默认只文档化 `publicId`
- [ ] 对外页面隐藏或弱化展示内部 `id`
- [ ] 在确认全量稳定后，逐步下线对外 `id` 入参（保留内部能力）

---

## 4.1 对外 ID 契约（已落地）

- 对外默认暴露并优先消费 `publicId` / `userPublicId`。
- `id` / `userId` 继续保留用于兼容旧端与内部排障，不作为新能力默认输入。
- 聊天相关接口（列表/详情）保持双字段并行，避免存量客户端中断。

---

## 5. 风险与应对

1. **老客户端仍传 `id`**：后端保持双兼容，避免硬切。
2. **部分数据缺失 `publicId`**：签发 token 时有兜底补齐逻辑。
3. **字段命名混淆**（`partnerID` 可能是 appId 或 `usr...`）：后续统一命名与注释。
4. **跨端不一致**：按“先后端兼容、再前端分批切换”策略推进。

---

## 6. 验收标准（Definition of Done）

- [ ] 新注册/登录用户均可稳定拿到 `publicId`
- [ ] 聊天入口传 `publicId` 与传 `id` 均可建立会话
- [ ] 关键接口 E2E 不因 ID 迁移出现 4xx/5xx 回归
- [ ] 管理后台与移动端的用户标识语义一致
- [ ] 发布后 72 小时无新增高优先级告警

---

## 7. 运行与验证命令（本地）

```bash
# 后端关键测试
cd /Volumes/tantan/AI_project/home-decoration/server
go test ./internal/service -run 'TestUserService_(Register|Login|RefreshToken)'
go test ./internal/handler -run '^TestGetTinodeUserID$'

# 移动端类型检查
cd /Volumes/tantan/AI_project/home-decoration/mobile
npx tsc --noEmit
```

---

## 8. 变更记录（本轮）

- 已落地双 ID 核心能力，且完成聊天关键路径的第一批迁移。
- D2 第一批已完成：Message 会话项新增并透传 `partnerPublicId`，ChatRoom 解析 Tinode 用户时优先使用 `partnerPublicId`（回退 `partnerID`）。
- D2 第二批已完成：移动端新增 `partnerIdentifier` 语义字段（保持 `partnerID` 兼容），并在 ChatRoom / ChatSettings 举报链路统一优先 `publicId`。
- D2 第二批已完成：聊天清空标记增加历史 key 回退读取与迁移写回，降低旧版本 key 导致会话“误显示未清空”的风险。
- D2 第三批已完成：Admin 商家 IM 页面支持按 `userIdentifier/publicId/userId` 自动定位会话，并通过后端统一解析为 Tinode 用户主题。
- E 阶段已完成：聊天相关列表/详情接口补齐 `userPublicId`，并通过 `internal/dto` 统一用户标识转换，确保返回结构一致。
- F 第一批已完成：新增 `publicId` 缺失观测模块（日志+内存计数），并将统计接入 Admin 概览接口 `publicIdHealth` 字段。
- F 第二批已完成：上线配置驱动的灰度分桶策略（移动端优先），并将 `publicIdRollout` 统计接入 Admin 概览接口。
- F 第三批已完成：新增回滚演练配置（观测/强制旧 `id` 路径），并将 `publicIdRollback` 统计接入 Admin 概览接口。
- 下一步进入 G 阶段：逐步收口对外 `id` 展示与入参文档。
