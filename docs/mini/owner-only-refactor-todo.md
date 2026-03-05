# Mini 端 Owner-Only 收口 TODO（后续阶段）

本阶段仅完成 `mobile/` 端 owner-only 改造，`mini/` 保持现状。以下为后续执行清单：

1. 清理身份状态与接口调用
- `mini/src/store/identity.ts`
- `mini/src/services/identity.ts`
- 移除身份切换、身份申请、activeRole/providerSubType 相关状态。

2. 删除身份页面与入口
- `mini/src/pages/identity/apply/index.tsx`
- `mini/src/components/IdentitySwitcher/index.tsx`
- `mini/src/pages/profile/index.tsx` 中的身份管理入口与身份徽章。

3. 收敛认证请求模型
- `mini/src/services/auth.ts`
- `mini/src/store/auth.ts`
- 统一按业主端模型保留用户基础字段，去除商家身份相关字段。

4. 导航与菜单回归
- 全量检查路由表与页面跳转，确认不存在身份申请/切换入口。
- 保留业主核心链路：登录、服务商浏览、预约、订单、消息、个人中心。

5. 联调与验收
- 校验 mini 端不再请求 `identities/*`。
- 验证 owner-only 场景完整可用。
- 对比 mobile owner-only 行为，确保体验一致。
