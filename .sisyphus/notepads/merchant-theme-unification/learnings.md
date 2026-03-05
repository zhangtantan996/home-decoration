## MerchantEntry.tsx 修复完成

### 实施内容
1. **角色预选逻辑**：
   - `openApplyFlow` 现在接受可选的 `role?: MerchantApplyRole` 参数
   - 当传入 role 时，自动预选该角色并设置对应的 entityType
   - company/material_shop → entityType='company'
   - designer/foreman → entityType='personal'（仍可在模态框中切换）

2. **调用点修复**：
   - 角色卡片点击：`onClick={() => openApplyFlow(item.role)}` - 传入明确角色
   - "我要入驻"按钮：`onClick={() => openApplyFlow()}` - 不传参数，保持原有行为

3. **主题常量应用**：
   - 页面背景：`MERCHANT_THEME.pageBgGradient`
   - 主操作卡片背景：`MERCHANT_THEME.primaryGradient`
   - 角色卡片高度：`MERCHANT_THEME.roleCardMinHeight`
   - 图标颜色：`MERCHANT_THEME.primaryColor`
   - 标题颜色：`MERCHANT_THEME.primaryColor`

4. **角色描述优化**：
   - 设计师：独立设计师或设计工作室，提供专业设计服务
   - 工长：个人工长或施工团队，承接装修施工项目
   - 装修公司：具备企业资质的装修公司，提供一站式服务
   - 主材商：主材门店或供应商，提供建材产品销售

### 验证结果
- LSP diagnostics: 无错误
- 所有 openApplyFlow 调用点已更新
- 主题常量已全面应用
- 保持了 handleStartApply 的导航逻辑不变

### 关键决策
- 保留了图标选择（UserOutlined, ToolOutlined, BankOutlined, ShopOutlined）
- 保留了模态框中的主体类型切换功能（designer/foreman 可选 personal/company）
- 未修改 MerchantRegister.tsx 或路由目标
