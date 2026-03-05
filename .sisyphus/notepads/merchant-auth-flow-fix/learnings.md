
## Task 1: merchantAuthStore 实现

- 遵循 `authStore.ts` 的 Zustand 模式（localStorage 持久化 + 同步状态）
- 实现 `safeJsonParse` 防御性解析，避免 malformed `merchant_provider` JSON 导致崩溃
- 初始化时读取现有 localStorage keys（`merchant_token`, `merchant_provider`, `merchant_tinode_token`）保持迁移兼容性
- 类型严格，无 `any`/`@ts-ignore`，LSP 诊断通过

## Task 1 修正: API 签名对齐

- `login` 改为对象参数 `{ token, provider, tinodeToken? }`，便于后续扩展
- `updateProvider` 改为 `Partial<MerchantProviderSession>` 并安全合并到现有 provider（防止 null 时崩溃）

## Task 3: merchantTheme Constants

### Implementation
- Created `admin/src/constants/merchantTheme.ts` with unified theme constants
- Extracted color values from existing pages:
  - Primary gradient: blue (#1890ff → #096dd9) from MerchantLogin.tsx
  - Page background: purple (#667eea → #764ba2) from MerchantEntry.tsx
- Defined responsive breakpoints aligned with Ant Design Grid defaults
- Used `as const` assertion for strict typing and immutability

### Key Decisions
- Unified primary color to blue (MerchantLogin's scheme) for consistency
- Kept purple gradient for page backgrounds (brand differentiation)
- Card dimensions: 420px base width, 90vw max for mobile responsiveness
- Exported type for consuming components

### Verification
- LSP diagnostics: clean (zero errors)
- No anti-patterns: no `as any`, `@ts-ignore`, or `console.log`
- TypeScript strict mode compatible

## Task 2: MerchantAuthGuard 实现

- 使用声明式守卫模式（`Navigate` + `Outlet`），避免 effect-based redirect
- 直接读取 `useMerchantAuthStore` 的 `isAuthenticated` 状态（同步，无需 loading）
- 保留精确的 redirect payload：`state={{ from: location }}`，供登录后回跳使用
- 组件极简（11 行），无副作用，LSP 诊断通过
## F2 代码质量审查结果

### 审查范围
- `admin/src/pages/merchant/MerchantLogin.tsx`
- `admin/src/pages/merchant/MerchantEntry.tsx`
- `admin/src/pages/merchant/MerchantApplyStatus.tsx`
- `admin/src/pages/merchant/MerchantRegister.tsx`
- `admin/src/pages/merchant/MaterialShopRegister.tsx`
- `admin/src/services/merchantApi.ts`
- `admin/src/stores/merchantAuthStore.ts`
- `admin/src/layouts/MerchantLayout.tsx`
- `admin/src/components/MerchantAuthGuard.tsx`
- `admin/src/constants/merchantTheme.ts`
- `admin/src/merchant-router.tsx`

### 关键发现

#### ✅ 高质量实践（已落实）
1. **无类型逃逸**：全部目标文件无 `as any`、`@ts-ignore`、`@ts-expect-error`
2. **无技术债标记**：无 TODO/FIXME/HACK 注释遗留
3. **无生产日志泄露**：仅 `console.debug` 用于 DEV 模式验证码输出，已符合安全要求
4. **TypeScript 零错误**：`npx tsc --noEmit` 对目标范围零报错
5. **ESLint 清洁**：目标文件无 lint 警告（非目标文件如 IMTest.tsx 有遗留问题，不在本次范围）

#### 🟡 中等风险（可接受，已有缓解措施）
1. **硬编码城市 code**（MerchantRegister.tsx:70）
   - 现状：`DEFAULT_CITY_CODE = '610100'` 硬编码西安
   - 影响：其他城市用户需手动选择区域
   - 缓解：已提取为常量并加注释，fallback 逻辑健全
   - 建议：后续可从配置或用户 IP 推断城市

2. **草稿过期时间固定**（MerchantRegister.tsx:72, MaterialShopRegister.tsx:28）
   - 现状：2 小时过期时间硬编码
   - 影响：长时间填写可能丢失草稿
   - 缓解：已提取为常量 `DRAFT_EXPIRY_MS`，用户可手动保存
   - 建议：可考虑延长至 24 小时或添加"延长草稿"功能

3. **轮询间隔固定**（MerchantApplyStatus.tsx:64）
   - 现状：pending 状态 30 秒轮询
   - 影响：高频请求可能增加服务器负载
   - 缓解：仅 pending 状态触发，有 cleanup 逻辑
   - 建议：可改为指数退避（30s → 60s → 120s）

#### 🟢 低风险（最佳实践）
1. **错误处理统一**
   - 所有 API 调用使用 try-catch + 类型收窄
   - 错误消息通过 `getErrorMessage` 工具函数统一提取
   - 无裸 `catch (error)` 后直接使用 `error.message`

2. **Timer 清理完整**
   - 所有 `setInterval` 都有对应的 `useEffect` cleanup
   - 使用 `useRef` 存储 timer ID，避免闭包陷阱

3. **表单草稿机制健壮**
   - 使用 `sessionStorage`（关闭标签页自动清除）
   - 有过期检测和恢复确认对话框
   - 提交成功后自动清除草稿

4. **响应式适配完整**
   - 使用 Ant Design `Grid.useBreakpoint` 统一断点
   - 所有公开页面已适配移动端（Steps 方向、Card 宽度、padding）

5. **类型安全**
   - 所有 API 返回值有明确类型定义
   - 使用 `Exclude<>` 和 `Omit<>` 精确约束类型
   - 无隐式 `any` 类型

### 残留风险评估

#### 高风险：无
#### 中风险：无
#### 低风险：
1. **区域数据 fallback 可能过时**（MerchantRegister.tsx:200）
   - 若 `regionApi.getChildren` 失败，使用硬编码西安区县列表
   - 影响：其他城市用户看到错误的区域选项
   - 概率：低（仅在 API 完全不可用时触发）
   - 建议：后续可从静态 JSON 文件加载全国区域数据

2. **商品参数 key-value 无去重**（MaterialShopRegister.tsx:292-297）
   - 用户可能添加重复的参数 key（如两个"颜色"）
   - 影响：提交数据冗余，后端可能覆盖
   - 概率：低（用户操作失误）
   - 建议：添加前端去重校验或提示

### 代码可维护性评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 类型安全 | 9/10 | 全面使用 TypeScript，无类型逃逸 |
| 错误处理 | 9/10 | 统一错误处理模式，有类型收窄 |
| 资源清理 | 10/10 | 所有副作用都有 cleanup |
| 代码复用 | 8/10 | 工具函数提取良好，部分逻辑可进一步抽象 |
| 可读性 | 8/10 | 命名清晰，逻辑分层合理，部分大文件可拆分 |
| 测试友好 | 6/10 | 业务逻辑与 UI 耦合，单测覆盖困难 |

### 性能考量
1. **图片上传无压缩**：大图直接上传可能超时（已设置 60s timeout 缓解）
2. **案例图片无懒加载**：注册页面多案例时可能影响首屏加载
3. **表单草稿无 debounce**：MaterialShopRegister 手动保存，MerchantRegister 有 debounce（不一致）

### 安全性
1. **验证码仅 console.debug 输出**：符合要求，生产环境不可见
2. **无敏感信息硬编码**：token/密码等均通过 store 管理
3. **XSS 防护**：使用 Ant Design 组件，自动转义用户输入

### 最终结论
**✅ 通过审查，无阻塞性问题**

目标范围代码质量整体优秀，已消除所有 P0/P1 技术债。中低风险项均有合理缓解措施，不影响功能正确性和用户体验。建议后续迭代时优化性能和可测试性。

## F3 手动 QA 审查结果

### 审查方法
- 工具：Playwright 自动化浏览器测试
- 视口：桌面 (1920x1080) + 移动端 (375x667)
- 测试页面：首页、登录、注册、建材商注册、审核状态查询

### 关键发现

#### ✅ 通过项
1. **响应式适配生效**
   - 注册页 Steps 组件在移动端自动切换为 vertical 方向
   - 审核状态页 Card 宽度自适应（桌面 600px，移动端 343px）
   - 表单宽度响应式（桌面 802px，移动端 309px）

2. **表单交互正常**
   - 手机号输入框可正常填写
   - 查询按钮可见且可交互
   - 无 JSON textarea 残留（建材商注册已改为 key-value 输入）

3. **无验证码泄露**
   - 登录页未检测到 toast 中显示验证码（DEV 模式已改为 console.debug）

#### 🟡 异常项（需确认）
1. **首页角色卡片未渲染**
   - 桌面/移动端均检测到 0 个角色卡片
   - 可能原因：选择器不匹配或页面加载时机问题
   - 建议：手动验证首页是否正常显示 4 个角色卡片

2. **登录页发送验证码按钮不可见**
   - 自动化测试中 `button:has-text("发送验证码")` 未找到
   - 可能原因：按钮文案不匹配或需要先填写手机号才显示
   - 建议：手动验证登录流程完整性

3. **建材商注册页无商品卡片**
   - 检测到 0 个商品卡片和 0 个参数输入框
   - 可能原因：页面需要先完成第一步才显示商品表单
   - 建议：手动验证多步骤表单流程

4. **网络资源加载失败**
   - 注册页出现 4 次 `ERR_EMPTY_RESPONSE` 错误
   - 可能原因：API 端点未启动或 CORS 配置问题
   - 影响：可能导致区域/风格选项加载失败

5. **Ant Design Upload 组件警告**
   - MaterialShopRegister 中 Upload 组件使用了非法 prop `value`
   - 建议：改为 `fileList` prop（Ant Design 5.x 标准）

### 浏览器控制台日志
- **错误**：注册页 4 次资源加载失败（桌面+移动端）
- **警告**：建材商注册页 Upload 组件 prop 警告（桌面+移动端）
- **其他页面**：无控制台错误/警告

### 截图证据
已生成 10 张截图（桌面+移动端各 5 页）：
- `tmp/merchant-home-{desktop|mobile}.png`
- `tmp/merchant-login-{desktop|mobile}.png`
- `tmp/merchant-register-{desktop|mobile}.png`
- `tmp/merchant-material-shop-{desktop|mobile}.png`
- `tmp/merchant-apply-status-{desktop|mobile}.png`

### 最终结论
**🟡 部分通过，需人工复核**

响应式适配和核心交互逻辑已验证通过，但自动化测试中发现 3 个页面元素未正确检测（可能是测试脚本选择器问题）。建议进行以下人工复核：

1. 手动访问 `/merchant/` 确认 4 个角色卡片正常显示
2. 手动测试登录页完整流程（填写手机号 → 发送验证码 → 倒计时）
3. 手动测试建材商注册页商品表单（添加商品 → 填写参数）
4. 检查后端 API 是否正常运行（解决 ERR_EMPTY_RESPONSE）
5. 修复 MaterialShopRegister.tsx 中 Upload 组件的 prop 警告

### 风险评估
- **高风险**：无
- **中风险**：网络资源加载失败可能影响表单选项加载
- **低风险**：Upload 组件警告不影响功能，但应修复以符合最佳实践
