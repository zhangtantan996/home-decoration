# 多角色 App 端集成升级

## Context

### Original Request
将业主、设计师、工长、公司都集成到 App 端，需要对前后端数据库做升级开发。

### Interview Summary

**Key Discussions**:
- 集成模式：单 App 多角色切换（复用现有 IdentitySwitcher）
- 新增角色：设计师、工长、装修公司（不含工人端）
- 导航设计：完全独立的 Tab 结构
- 订单流程：完整流程（预约→接单→方案→签约→施工→验收）
- 开发策略：MVP 先行

**Research Findings**:
- 现有 user_identities 多身份系统已实现
- 现有 providers 表支持 designer/company/foreman 类型
- 现有 IdentitySwitcher 组件可复用

---

## Work Objectives

### Core Objective
为 Mobile App 添加设计师、工长、装修公司三个角色的完整功能模块，实现多角色切换和独立界面。

### Concrete Deliverables
- 后端：订单流程 API、收入管理 API、团队管理 API
- 前端：三个角色的独立 Tab 导航和核心页面
- 数据库：必要的表结构扩展

### Definition of Done
- [ ] 三个角色可以登录并看到各自的 Tab 导航
- [ ] 接单流程可以完整走通
- [ ] 收入统计和提现申请功能可用
- [ ] 所有核心 API 有测试覆盖

### Must Have
- 角色切换功能
- 接单管理（查看/接单/拒单）
- 收入管理（统计/明细/提现申请）
- 项目进度（查看/更新）
- 作品管理（设计师专属）
- 团队管理（公司/工长专属）
- 消息中心（通知列表）

### Must NOT Have (Guardrails)
- 实时聊天（WebSocket）
- 任务看板/甘特图
- 复杂数据分析图表
- 发票管理
- 评价系统
- 地图导航
- 视频通话
- 自动打款（支付 API 对接）

---

## Verification Strategy

### Test Decision
- Infrastructure exists: YES (Jest in mobile/)
- User wants tests: TDD
- Framework: Jest + React Native Testing Library

---

## TODOs

### Phase 1: 后端基础设施

- [ ] 1. 扩展订单状态和流程
  - What: 扩展 bookings 表支持完整订单流程
  - Files: server/internal/model/booking.go, server/internal/repository/booking_repository.go
  - Acceptance: 新状态字段可用，迁移脚本执行成功
  - Parallelizable: YES
  - Commit: feat(server): extend booking status for full order flow

- [ ] 2. 收入管理 API
  - What: 创建收入统计、明细查询、提现申请 API
  - Files: server/internal/handler/income_handler.go, server/internal/service/income_service.go
  - Acceptance: GET /api/v1/provider/income/stats 返回统计数据
  - Parallelizable: YES (with 3)
  - Commit: feat(server): add income management APIs

- [ ] 3. 团队管理 API
  - What: 创建团队成员列表、任务分配 API
  - Files: server/internal/handler/team_handler.go, server/internal/service/team_service.go
  - Acceptance: GET /api/v1/provider/team/members 返回成员列表
  - Parallelizable: YES (with 2)
  - Commit: feat(server): add team management APIs

- [ ] 4. 作品管理 API
  - What: 创建作品 CRUD API（设计师专属）
  - Files: server/internal/handler/portfolio_handler.go, server/internal/service/portfolio_service.go
  - Acceptance: POST /api/v1/designer/portfolio 可上传作品
  - Parallelizable: YES
  - Commit: feat(server): add portfolio management APIs

### Phase 2: Mobile 导航架构

- [ ] 5. 角色导航配置
  - What: 创建角色-Tab 映射配置
  - Files: mobile/src/navigation/roleTabConfig.ts
  - Acceptance: 配置文件导出三个角色的 Tab 定义
  - Parallelizable: NO (depends on 1-4)
  - Commit: feat(mobile): add role-based tab configuration

- [ ] 6. 动态 Tab Navigator
  - What: 修改 TabNavigator 根据当前角色动态渲染
  - Files: mobile/src/navigation/TabNavigator.tsx
  - Acceptance: 切换角色后 Tab 栏变化
  - Parallelizable: NO (depends on 5)
  - Commit: feat(mobile): implement dynamic tab navigator

### Phase 3: 设计师端页面

- [ ] 7. 设计师首页
  - What: 创建设计师首页（订单概览、收入概览）
  - Files: mobile/src/screens/designer/DesignerHomeScreen.tsx
  - Acceptance: 页面渲染，显示模拟数据
  - Parallelizable: YES (with 8, 9)
  - Commit: feat(mobile): add designer home screen

- [ ] 8. 设计师订单页
  - What: 创建订单列表和详情页
  - Files: mobile/src/screens/designer/OrderListScreen.tsx, OrderDetailScreen.tsx
  - Acceptance: 可查看订单列表，点击进入详情
  - Parallelizable: YES (with 7, 9)
  - Commit: feat(mobile): add designer order screens

- [ ] 9. 设计师作品页
  - What: 创建作品集管理页面
  - Files: mobile/src/screens/designer/PortfolioScreen.tsx
  - Acceptance: 可查看作品列表，上传新作品
  - Parallelizable: YES (with 7, 8)
  - Commit: feat(mobile): add designer portfolio screen

### Phase 4: 工长端页面

- [ ] 10. 工长首页
  - What: 创建工长首页（项目概览、团队概览）
  - Files: mobile/src/screens/foreman/ForemanHomeScreen.tsx
  - Acceptance: 页面渲染，显示模拟数据
  - Parallelizable: YES (with 11, 12)
  - Commit: feat(mobile): add foreman home screen

- [ ] 11. 工长订单页
  - What: 创建订单列表和详情页
  - Files: mobile/src/screens/foreman/OrderListScreen.tsx, OrderDetailScreen.tsx
  - Acceptance: 可查看订单列表，接单/拒单
  - Parallelizable: YES (with 10, 12)
  - Commit: feat(mobile): add foreman order screens

- [ ] 12. 工长进度页
  - What: 创建项目进度管理页面
  - Files: mobile/src/screens/foreman/ProgressScreen.tsx
  - Acceptance: 可查看进度，更新状态
  - Parallelizable: YES (with 10, 11)
  - Commit: feat(mobile): add foreman progress screen

### Phase 5: 公司端页面

- [ ] 13. 公司首页
  - What: 创建公司首页（项目统计、团队统计）
  - Files: mobile/src/screens/company/CompanyHomeScreen.tsx
  - Acceptance: 页面渲染，显示模拟数据
  - Parallelizable: YES (with 14, 15)
  - Commit: feat(mobile): add company home screen

- [ ] 14. 公司项目页
  - What: 创建项目管理页面
  - Files: mobile/src/screens/company/ProjectListScreen.tsx
  - Acceptance: 可查看项目列表和详情
  - Parallelizable: YES (with 13, 15)
  - Commit: feat(mobile): add company project screen

- [ ] 15. 公司团队页
  - What: 创建团队管理页面
  - Files: mobile/src/screens/company/TeamScreen.tsx
  - Acceptance: 可查看团队成员，分配任务
  - Parallelizable: YES (with 13, 14)
  - Commit: feat(mobile): add company team screen

### Phase 6: 共享模块

- [ ] 16. 收入管理页（共享）
  - What: 创建收入统计和提现页面（三角色共用）
  - Files: mobile/src/screens/shared/IncomeScreen.tsx, WithdrawScreen.tsx
  - Acceptance: 显示收入统计，可申请提现
  - Parallelizable: YES
  - Commit: feat(mobile): add shared income screens

- [ ] 17. 消息中心页（共享）
  - What: 创建消息通知列表页面
  - Files: mobile/src/screens/shared/NotificationScreen.tsx
  - Acceptance: 显示通知列表，可标记已读
  - Parallelizable: YES
  - Commit: feat(mobile): add shared notification screen

### Phase 7: 集成测试

- [ ] 18. 端到端流程测试
  - What: 测试完整订单流程（业主预约→服务商接单→完成）
  - Files: mobile/__tests__/e2e/orderFlow.test.ts
  - Acceptance: 测试通过
  - Parallelizable: NO (depends on all above)
  - Commit: test(mobile): add e2e order flow tests

---

## Success Criteria

### Verification Commands
- cd server && make test
- cd mobile && npm test
- 手动测试：登录不同角色账号，验证 Tab 切换

### Final Checklist
- [ ] 三个角色的 Tab 导航正确显示
- [ ] 接单流程可完整走通
- [ ] 收入统计数据正确
- [ ] 所有 API 有测试覆盖
- [ ] 无 Must NOT Have 功能被引入
