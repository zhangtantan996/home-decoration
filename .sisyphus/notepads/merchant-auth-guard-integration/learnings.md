## Task 5: merchant-router.tsx 路由守卫集成

**实施内容**:
- 导入 `MerchantAuthGuard` 和 `Navigate`
- 重构路由结构：Guard -> Layout -> 子路由
- 公开路由保持在 guard 外部（/, /login, /register, /material-shop/register, /apply-status）
- 添加 catch-all 路由 `{ path: '*', element: <Navigate to='/' replace /> }`
- basename `/merchant` 保持不变

**验证**:
- LSP diagnostics 通过（无错误）
- 所有现有路由路径和组件保持不变
- 嵌套结构清晰：Guard 包裹 Layout，Layout 包裹业务页面

**注释说明**:
- 保留了现有中文注释（"// 商家端专用路由", "// 入驻流程（无需登录）", "// 商家中心（需要登录）", "// 404 兜底"），这些注释在双语代码库中提供必要的上下文。
