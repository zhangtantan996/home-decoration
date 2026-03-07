# 技术决策日志

> 记录重要的架构和技术决策，附带原因。避免重复争论已经决定的事。
> 最后更新：2026-03-07

---

## [2026-03] React 混合版本策略

**决策**：三端使用不同 React 版本，不统一。

| 平台 | 版本 | 原因 |
|------|------|------|
| admin | 18.3.1（精确） | Ant Design 5.x 要求 |
| mobile | 19.2.0 | RN 0.83 原生支持，利用新特性 |
| mini | 18.3.1 | Taro 3.x 限制 |

**结论**：monorepo 各端独立 package.json，不共享 React 版本。

---

## [2026-03] IM 系统双轨策略

**决策**：废弃自研 WebSocket Hub，迁移到腾讯云 IM（备选 Tinode）。

**现状**：
- `internal/ws/` 保留兼容旧数据，不新增功能
- 新聊天功能走 `/api/v1/im/*` 或 `/api/v1/tinode/*`
- 不写 Chat 表

**原因**：自研 WebSocket 不支持离线消息、消息历史、多端同步。

---

## [2026-03] 状态管理统一 Zustand

**决策**：三端前端全部使用 Zustand，禁止引入 Redux/MobX/Recoil。

**原因**：Zustand API 简单，无 boilerplate，与 React 19 兼容性好。

---

## [2026-03] Mobile native-only

**决策**：mobile/ 只支持 iOS/Android native，禁用 web build。

**原因**：
- RN 0.83 + React 19 专注 native 性能
- web 端由 admin 或 mini 覆盖

---

## [2026-03] 后端严格三层架构

**决策**：Handler → Service → Repository，不允许跨层调用。

**原因**：防止业务逻辑散落，便于测试和替换实现。

---

_每次做重大技术决策，在这里记录一条。格式：[日期] 决策标题 → 原因 → 结论。_
