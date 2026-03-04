# Task 6: MerchantLayout.tsx 修复完成

## 执行摘要
成功完成 MerchantLayout.tsx 的 store 接入和安全修复，所有 5 个子任务均已实现。

## 完成的修改

### 1. 替换直接 localStorage 读取
- **原代码**: `JSON.parse(localStorage.getItem('merchant_provider') || '{}')`（L35，无 try-catch）
- **新代码**: `useMerchantAuthStore(s => s.provider)`（L37）
- **影响**: 消除 P0#3 crash 风险，通过 store 的 safeJsonParse 安全处理

### 2. 修复 logout 逻辑
- **原代码**: 直接 `localStorage.removeItem(...)` + `navigate('/login')`（L196-199）
- **新代码**: `useMerchantAuthStore.getState().logout()` + `navigate('/login')`（L198-199）
- **影响**: 状态管理集中化，确保 logout 清理所有相关状态

### 3. 添加 auth-expired 事件监听
- **新增**: useEffect 监听 `merchant-auth-expired` 事件（L191-195）
- **清理**: 组件卸载时自动移除监听器
- **影响**: 配合 Task 4 的 401 拦截器，实现 SPA 内导航而非硬刷新

### 4. 修复 `as any` 类型断言
- **Menu items**: 从 `as any` 改为 `as MenuProps['items']`（L186）
- **Dropdown menu**: 从 `as any` 改为显式 `MenuProps` 类型（L202）
- **新增导入**: `import type { MenuProps } from 'antd';`（L3）
- **影响**: 类型安全，消除潜在运行时错误

### 5. 修复 /im-test 不可达问题
- **新增**: 在 availableKeys 中添加 `/im-test`（L93）
- **影响**: IM 测试页面现在可通过菜单访问

### 6. 处理 provider null 安全
- **修复**: `provider?.avatar` 和 `provider?.name`（L296-297）
- **影响**: 防止 provider 为 null 时的运行时错误

## 验证结果

### LSP 诊断
```bash
lsp_diagnostics --severity=error
# 结果: No diagnostics found
```

### 代码检查
- ✅ 无 localStorage 直接操作
- ✅ 无 `as any` 类型断言
- ✅ useMerchantAuthStore 正确集成（3 处使用）
- ✅ merchant-auth-expired 事件监听 + cleanup
- ✅ /im-test 已添加到 availableKeys

## 技术细节

### Store 集成模式
```typescript
// 读取状态（组件内）
const provider = useMerchantAuthStore(s => s.provider);

// 调用 action（非 React 上下文）
useMerchantAuthStore.getState().logout();
```

### 事件监听模式
```typescript
useEffect(() => {
  const handler = () => navigate('/login', { replace: true });
  window.addEventListener('merchant-auth-expired', handler);
  return () => window.removeEventListener('merchant-auth-expired', handler);
}, [navigate]);
```

## 遗留问题
无。所有 Task 6 要求均已完成。

## 下一步
等待 Wave 2 其他任务（Task 4, Task 5）完成后统一提交。

---

## 补充修复: 移除残留 `any` 类型注解

### 问题
初次修复遗漏了 menu filtering 回调中的 `: any` 注解：
- `.map((item: any) => ...)` (L167)
- `.filter((child: any) => ...)` (L172)

### 解决方案
使用类型守卫替代显式 `any` 注解：

```typescript
// 移除显式类型注解，依赖 TypeScript 推断
.map((item) => {
  if (!item || typeof item !== 'object' || !('key' in item)) {
    return item;
  }
  // 运行时类型检查确保安全
  if (item.key === 'finance' && 'children' in item) {
    const children = (item.children || []).filter((child) => 
      child && typeof child === 'object' && 'key' in child && 
      typeof child.key === 'string' && availableKeys.has(child.key)
    );
    // ...
  }
  // ...
})
```

### 验证
- ✅ `grep ":\s*any"` 零匹配
- ✅ LSP 零错误
- ✅ 行为不变（类型守卫保持原有逻辑）

### 技术决策
**为何不用 `MenuProps['items'][number]`？**
- `menuItems` 原始数组是手动构造的对象字面量，不完全符合 AntD 的严格联合类型
- 显式类型注解会导致结构不兼容错误
- 类型推断 + 运行时守卫更灵活，保持类型安全的同时避免过度约束
