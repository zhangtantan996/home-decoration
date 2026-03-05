# Task 10: MerchantRegister.tsx 全面修复

## 完成时间
2026-03-04

## 实施内容

### 1. 草稿保存/恢复/清除 (Draft Management)
- 添加 `DRAFT_STORAGE_KEY = 'merchant_register_draft'` 常量
- 添加 `DRAFT_EXPIRY_MS = 2 * 60 * 60 * 1000` (2小时过期)
- 实现 `saveDraft()`: 在每次 handleNext 时保存表单状态到 sessionStorage
- 实现 `restoreDraft()`: 组件加载时检测草稿,弹出 Modal.confirm 询问是否恢复
- 实现 `clearDraft()`: 提交成功后清除草稿
- 草稿包含: timestamp, currentStep, formValues, portfolioCases

### 2. useEffect 依赖修复
- 将 `loadStyleOptions`, `loadAreaOptions`, `restoreDraft` 改为 useCallback
- 在 useEffect 依赖数组中正确声明这些函数
- 函数声明顺序调整到 useEffect 之前,避免 TDZ 错误

### 3. 倒计时定时器清理
- 添加 `countdownTimerRef = useRef<number | null>(null)`
- 在 handleSendCode 中使用 ref 存储 timer
- 添加 useEffect cleanup 函数,在组件卸载时清理定时器
- 倒计时结束时也清理 ref

### 4. DEV 调试代码清理
- 移除 UI 中的 `debugSuffix` 拼接逻辑
- 改为仅在 DEV 环境下 `console.debug('[DEV] 验证码: ...')`
- 用户界面只显示 "验证码已发送"

### 5. 设计师专属字段条件显示
- 将 graduateSchool 和 designPhilosophy 字段包裹在 `{role === 'designer' && (...)}`
- 仅设计师角色显示这两个字段

### 6. 案例面积字段改为 Select
- 将 `<Input placeholder="例如：120㎡" />` 改为 `<Select placeholder="选择区域">`
- 绑定到 `areaOptions` (从 regionApi 加载的区域列表)
- 保持 value/onChange 逻辑不变

### 7. 城市代码常量化
- 添加 `DEFAULT_CITY_CODE = '610100'` 常量
- 替换 loadAreaOptions 中的硬编码 '610100'

### 8. 提交确认弹窗
- 在 handleSubmit 中添加 `Modal.confirm`
- 确认后才执行实际提交逻辑
- 区分 resubmit 和首次提交的提示文案

### 9. 案例卡片 key 修复
- 为 PortfolioCase 接口添加 `id: string` 字段
- 初始化时使用 `crypto.randomUUID()` 生成唯一 id
- 将 `key={index}` 改为 `key={caseItem.id}`
- 使用 `portfolioCases.indexOf(caseItem)` 获取索引用于回调

### 10. 类型断言移除
- 移除 `form.getFieldsValue() as Record<string, any>`
- 改为直接使用 `form.getFieldsValue()` (Ant Design 已有类型推断)

## 验证结果
- lsp_diagnostics: 无错误
- 所有目标模式已验证存在:
  - merchant_register_draft ✓
  - Modal.confirm ✓ (2处)
  - clearInterval ✓ (2处)
  - console.debug ✓
  - key={caseItem.id} ✓
  - DEFAULT_CITY_CODE ✓ (2处)

## 未修改部分
- 保留 4 步结构
- 保留 API 调用逻辑
- 保留 upload 行为
- 保留 resolveApplyMeta 映射语义
- 未添加新依赖
- 未修改其他文件
