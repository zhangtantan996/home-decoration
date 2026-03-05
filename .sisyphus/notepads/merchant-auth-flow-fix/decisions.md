
## Task 1: merchantAuthStore 架构决策

- **状态结构**: `token` + `provider` + `tinodeToken` + `isAuthenticated`，与后端 `MerchantLoginData` 对齐
- **Actions**: `login/logout/updateProvider/getToken/checkAuth`，覆盖核心认证流程
- **防御性解析**: `safeJsonParse` 使用 try/catch 返回 `null`，避免 JSON.parse 异常
- **迁移兼容**: 初始化时读取现有 localStorage keys，后续任务将逐步迁移调用方

## Task 3: Theme Constants Design

### Color Scheme Decision
- **Primary**: Blue gradient (#1890ff → #096dd9)
  - Rationale: MerchantLogin.tsx already uses blue; unifying reduces visual inconsistency
  - MerchantEntry.tsx had purple buttons, will be updated in later tasks
- **Background**: Purple gradient (#667eea → #764ba2)
  - Rationale: Provides brand differentiation from admin panel, maintains existing visual identity

### Breakpoint Alignment
- Used Ant Design Grid's default breakpoints (576/768/992)
- Ensures consistency with existing responsive components
- No custom breakpoints needed for this project scope

### Type Safety
- Exported `MerchantTheme` type for consuming components
- `as const` ensures literal types for gradient strings and numeric values
- Prevents accidental mutations at runtime

## Task 2: 守卫组件设计决策

- **声明式 vs 命令式**：选择 `<Navigate />` 而非 `useEffect(() => navigate())`，符合 React Router v6 最佳实践
- **状态来源**：直接使用 `isAuthenticated` 而非重复调用 `checkAuth()`，避免冗余逻辑
- **无 loading 状态**：localStorage 读取是同步的，无需异步等待或 loading UI
- **无 docstring**：函数名 + 代码结构已自解释，移除冗余注释


## F1 审计结论（2026-03-04）
- Task 1-12 代码实现总体匹配，但 Task 10 存在草稿自动保存/类型约束偏差；Task 13 仅 build 与 tsc 满足，全量 lint 未达标（存在大量历史 error）。
