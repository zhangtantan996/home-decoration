# 全端接口自动刷新治理检查矩阵

> 目标：防止接口在网络抖动/服务不可达时无限自动刷新。原则：自动触发有上限，超限后暂停；仅手动触发恢复。

## 统一策略

- A级（认证刷新）
  - 自动重试上限：`1`
  - 失败后：清理会话，提示重新登录
- B级（后台轮询）
  - 连续失败阈值：`3`
  - 达阈值后：暂停自动轮询，等待手动恢复
- C级（页面自动加载）
  - 自动重试上限：`0`
  - 失败后：停止自动再触发，保留手动重试入口
- D级（IM连接重连）
  - 自动重连上限：`5`
  - 指数退避：`3s -> 6s -> 12s -> 24s -> 30s`
  - 超限后：暂停自动重连，等待手动重连

## 触发源检查矩阵

| 模块 | 触发源 | 接口/动作 | 当前策略 | 自动上限 | 手动恢复入口 |
|---|---|---|---|---|---|
| admin 通知下拉 | interval(30s) | `notificationApi.getUnreadCount` | 连续失败3次暂停轮询 | 3次连续失败 | Header `重试刷新` |
| admin 商家通知下拉 | interval(30s) | `merchantNotificationApi.getUnreadCount` | 连续失败3次暂停轮询 | 3次连续失败 | Header `重试刷新` |
| admin/merchant 通知列表 | open 下拉 | `*.list` | 打开时单次拉取 | 0（无自动补偿） | 重新打开下拉或 `重试刷新` |
| mobile Auth 刷新 | 401 拦截 | `tryRefreshToken` | 单次自动刷新 + 守卫 | 1次 | 用户重新登录（会话重建） |
| mini Auth 刷新 | 401 拦截 | `refreshAuth` | 单次自动刷新 + 守卫 | 1次 | 用户重新登录（会话重建） |
| mobile Message IM | SDK disconnect | `TinodeService.reconnect` | 指数退避 + 自动上限5次 | 5次 | 空态点击 `手动重连` |
| mobile ChatRoom 历史 | useEffect 自动加载 | `loadMessages('auto')` | 自动仅1次，401内部重载仅1次 | 1次 | 空态点击手动重试 |
| mobile ChatRoom 历史 | 401 reinit 后重载 | `loadMessages('manual', skipReset)` | 不重置守卫计数，防递归 | 同上 | 同上 |

## 关键治理点

1. 自动触发与手动触发分离
   - 自动触发失败只累计失败计数，不允许无限重入
   - 手动触发显式 `resetByManual()` 后再发起请求

2. 可观测性（统一日志字段）
   - `businessKey`：业务键（如 `mobile.tinode.reconnect`）
   - `trigger`：`auto | manual`
   - `event`：`attempt | failure | paused | resumed | blocked`
   - `attempt` / `consecutiveFailures` / `pausedReason`

3. IM 状态事件（供 UI 提示）
   - `reconnect-attempt`
   - `reconnect-paused`
   - `reconnect-resumed`

## 验收清单

- [ ] 断网时 admin 通知轮询最多失败3次后暂停
- [ ] 恢复网络后不会自动恢复轮询，需手动点击 `重试刷新`
- [ ] mobile ChatRoom 401 场景不再递归自调用
- [ ] Tinode 不可用时自动重连最多5次后暂停
- [ ] `MessageScreen` 显示“自动重连已暂停”，点击后可恢复
- [ ] Auth refresh 仍是单次自动尝试，不出现循环刷新

