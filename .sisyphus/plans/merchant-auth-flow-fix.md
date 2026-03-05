# 商家中心登录/注册全链路修复计划

## TL;DR
> **Summary**: 修复商家中心首页→登录/注册→完成链路中发现的 38 个 UI、交互、业务逻辑/安全问题
> **Deliverables**: 重构后的认证体系（Zustand store + 路由守卫）、修复后的 6 个核心页面、统一主题、响应式适配
> **Effort**: Large（预估 3-4 天）
> **Parallel**: YES — 6 个波次
> **Critical Path**: Task 1 → Task 2/3/4 → Task 5/6/7/8 → Task 9/10/11 → Task 12/13/14 → F1-F4

## Context

### Original Request
对商家中心从首页到登录/注册-登录/注册完成的 UI 显示、交互和业务逻辑进行评审并修复所有问题。

### Interview Summary
- 范围：仅 `admin/` 目录下商家中心（merchant）相关页面
- 不涉及平台管理员（admin）认证、不涉及 mobile/mini
- 技术栈：React 18.3.1（锁定）、Ant Design 5.x、Zustand、TypeScript、Vite
- 现有模式：`admin/src/stores/authStore.ts` 提供了 Zustand + localStorage 的参考模式
- 现有 API 层：`admin/src/services/merchantApi.ts` 已有 axios 实例和拦截器

### Metis Review (gaps addressed)
1. **Token 迁移**：merchantAuthStore 初始化时自动读取旧 localStorage 键，兼容已登录商家
2. **回滚安全**：新增的 merchantAuthStore 是增量代码，不删除旧 localStorage 逻辑直到验证通过
3. **范围边界**：响应式仅覆盖登录/注册/首页/审核状态 4 个公开页面，不涉及后台管理页
4. **CAPTCHA**：仅在前端 sendCode 调用处预留 captchaToken 参数，不实现完整验证码组件（后端未就绪）
5. **Token 刷新**：因后端无 refresh-token 端点，本次仅改为 SPA 内导航替代硬刷新

## Work Objectives

### Core Objective
修复商家中心认证链路的全部 P0/P1 问题，消除安全隐患，提升用户体验。

### Deliverables
- `admin/src/stores/merchantAuthStore.ts` — 商家认证状态中心化管理
- `admin/src/components/MerchantAuthGuard.tsx` — 路由鉴权守卫组件
- `admin/src/constants/merchantTheme.ts` — 商家中心统一主题/配色
- 修复后的 6 个页面组件（MerchantEntry/Login/Register/MaterialShopRegister/ApplyStatus/Layout）
- 修复后的 `merchantApi.ts` 拦截器和 `merchant-router.tsx` 路由

### Definition of Done (verifiable conditions)
1. `cd admin && npx tsc --noEmit` — 零 TypeScript 错误
2. `cd admin && npm run lint` — 零 ESLint 错误
3. `cd admin && npm run build` — 构建成功
4. 所有 localStorage 操作通过 merchantAuthStore 集中管理
5. 未登录访问 `/merchant/dashboard` → 无闪屏直接跳转 `/merchant/login`
6. 登录成功 → token 持久化 → 刷新页面保持登录态
7. 注册表单刷新 → 草稿自动恢复
8. 首页点击角色卡 → 模态框预选对应角色

### Must Have
- merchantAuthStore 完全替代散落的 localStorage 操作
- MerchantAuthGuard 包裹所有受保护路由
- 登录页/首页/注册页统一配色方案
- 注册表单草稿保存（sessionStorage）
- 首页角色卡片传参到模态框
- 401 拦截改用 SPA 导航
- 清除 DEV 模式验证码泄露
- Timer cleanup on unmount

### Must NOT Have (guardrails)
- **不动** admin 管理员认证（`authStore.ts`）
- **不动** mobile/mini 的任何代码
- **不动** 后台管理页面（dashboard/bookings/proposals 等）的响应式
- **不引入** 新 UI 框架或新状态管理库
- **不升级** React 版本（必须保持 18.3.1）
- **不实现** 完整 CAPTCHA 组件（后端未就绪，仅预留参数）
- **不实现** Token 自动刷新（后端无 refresh-token 端点）
- **不删除** 旧 localStorage 键的读取兼容（确保已登录商家无感迁移）

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after（现有项目无前端单测基础设施）
- QA policy: 每个 Task 有 agent-executable 的验证命令
- Build 验证: `cd admin && npm run build` 每个 Wave 后执行
- Lint 验证: `cd admin && npm run lint` 每个 Wave 后执行
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.txt`

## Execution Strategy

### Parallel Execution Waves

**Wave 1 — 基础设施**（3 个任务，可全并行）
- Task 1: merchantAuthStore 状态管理
- Task 2: MerchantAuthGuard 路由守卫
- Task 3: merchantTheme 统一主题常量

**Wave 2 — 核心集成**（3 个任务，依赖 Wave 1，可互相并行）
- Task 4: merchantApi.ts 拦截器修复 + 接入 store
- Task 5: merchant-router.tsx 路由守卫 + 404 兜底
- Task 6: MerchantLayout.tsx 接入 store + 安全修复

**Wave 3 — 公开页面修复**（3 个任务，依赖 Wave 2，可互相并行）
- Task 7: MerchantLogin.tsx 全面修复
- Task 8: MerchantEntry.tsx 全面修复
- Task 9: MerchantApplyStatus.tsx 全面修复

**Wave 4 — 注册流程修复**（2 个任务，依赖 Wave 2，可互相并行）
- Task 10: MerchantRegister.tsx 全面修复
- Task 11: MaterialShopRegister.tsx 全面修复

**Wave 5 — 响应式适配**（1 个任务，依赖 Wave 3+4）
- Task 12: 公开页面响应式适配

**Wave 6 — 构建验证**（1 个任务，依赖全部）
- Task 13: 全量构建 + Lint + TypeScript 校验

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 merchantAuthStore | — | 4,5,6,7,8 |
| 2 AuthGuard | — | 5 |
| 3 Theme | — | 7,8,9,10,11 |
| 4 merchantApi | 1 | 7 |
| 5 Router | 1,2 | 7,8,9,10,11 |
| 6 Layout | 1 | 7 |
| 7 Login | 1,3,4,5,6 | 12 |
| 8 Entry | 1,3,5 | 12 |
| 9 ApplyStatus | 3,5 | 12 |
| 10 Register | 1,3,5 | 12 |
| 11 MaterialShop | 1,3,5 | 12 |
| 12 Responsive | 7,8,9,10,11 | 13 |
| 13 Build | ALL | F1-F4 |

### Agent Dispatch Summary

| Wave | Tasks | Categories |
|------|-------|------------|
| 1 | 3 | quick, quick, quick |
| 2 | 3 | unspecified-low, quick, unspecified-low |
| 3 | 3 | unspecified-high, unspecified-low, unspecified-low |
| 4 | 2 | unspecified-high, unspecified-high |
| 5 | 1 | visual-engineering |
| 6 | 1 | quick |

## TODOs

<!-- TASKS_START -->

### Wave 1 — 基础设施（全并行）

- [x] 1. **创建 merchantAuthStore（Zustand 商家认证状态管理）**

  **What to do**:
  创建 `admin/src/stores/merchantAuthStore.ts`，遵循 `authStore.ts` 的 Zustand + localStorage 模式。

  1. 定义 `MerchantAuthState` 接口：
     ```typescript
     interface MerchantProvider {
       id: number;
       name: string;
       phone: string;
       merchantKind: 'provider' | 'material_shop';
       applicantType: string;
       providerSubType: string;
       status: number;
       // ... 其他 provider 字段（参考 MerchantProviderSession 类型）
     }

     interface MerchantAuthState {
       token: string | null;
       provider: MerchantProvider | null;
       tinodeToken: string | null;
       isAuthenticated: boolean;
       // Actions
       login: (data: { token: string; provider: MerchantProvider; tinodeToken?: string }) => void;
       logout: () => void;
       updateProvider: (provider: Partial<MerchantProvider>) => void;
       getToken: () => string | null;
       checkAuth: () => boolean;
     }
     ```

  2. 实现 store：
     - `login()`: 同时写入 localStorage（`merchant_token`, `merchant_provider`, `merchant_tinode_token`）+ 更新 Zustand state
     - `logout()`: 清除 localStorage 所有 merchant 键 + 重置 state
     - `updateProvider()`: 部分更新 provider 信息
     - `getToken()`: 返回当前 token
     - `checkAuth()`: 检查 token 是否存在

  3. **Token 迁移兼容**（关键）：store 初始化时自动读取已存在的旧 localStorage 值：
     ```typescript
     const useMerchantAuthStore = create<MerchantAuthState>((set, get) => ({
       token: localStorage.getItem('merchant_token'),
       provider: safeJsonParse(localStorage.getItem('merchant_provider')),
       tinodeToken: localStorage.getItem('merchant_tinode_token'),
       isAuthenticated: !!localStorage.getItem('merchant_token'),
       // ...
     }));
     ```

  4. 添加 `safeJsonParse` 工具函数：用 try-catch 包裹 JSON.parse，malformed 数据返回 null（修复 P0#3 MerchantLayout crash 风险）

  **Must NOT do**:
  - 不修改 `authStore.ts`（admin 管理员认证）
  - 不删除现有 localStorage 键（保持向下兼容）
  - 不引入新依赖

  **Recommended Agent Profile**:
  - Category: `quick` — 单文件创建，模式清晰
  - Skills: [] — 无需特殊技能
  - Omitted: [`frontend-ui-ux`] — 纯逻辑层，无 UI

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4,5,6,7,8 | Blocked By: —

  **References**:
  - Pattern: `admin/src/stores/authStore.ts` — Zustand store 结构模板，严格遵循其 create + localStorage 同步模式
  - Type: `admin/src/services/merchantApi.ts:MerchantProviderSession` — provider 数据结构参考
  - Type: `admin/src/services/merchantApi.ts:MerchantLoginData` — login 返回数据结构（token, provider, tinodeToken, merchantKind）

  **Acceptance Criteria**:
  - [ ] 文件 `admin/src/stores/merchantAuthStore.ts` 存在
  - [ ] `cd admin && npx tsc --noEmit src/stores/merchantAuthStore.ts` — 零错误
  - [ ] 导出 `useMerchantAuthStore` hook
  - [ ] `safeJsonParse` 对 malformed JSON 返回 null 而非 throw
  - [ ] 初始化时自动读取现有 localStorage 值（迁移兼容）

  **QA Scenarios**:
  ```
  Scenario: Token 迁移兼容
    Tool: Bash
    Steps: 在 merchantAuthStore.ts 中搜索 localStorage.getItem('merchant_token') 出现在初始化代码中
    Expected: store 初始化直接读取旧 key，已登录用户无感迁移
    Evidence: .sisyphus/evidence/task-1-store.txt

  Scenario: safeJsonParse 防 crash
    Tool: Bash
    Steps: 搜索 safeJsonParse 函数，确认包含 try-catch 且 catch 返回 null
    Expected: JSON.parse 错误被安全捕获
    Evidence: .sisyphus/evidence/task-1-safe-parse.txt
  ```

  **Commit**: NO（Wave 1 结束统一提交）

---

- [x] 2. **创建 MerchantAuthGuard 路由守卫组件**

  **What to do**:
  创建 `admin/src/components/MerchantAuthGuard.tsx`。

  1. 组件逻辑：
     ```tsx
     import { Navigate, Outlet, useLocation } from 'react-router-dom';
     import { useMerchantAuthStore } from '../stores/merchantAuthStore';

     export const MerchantAuthGuard: React.FC = () => {
       const isAuthenticated = useMerchantAuthStore(s => s.isAuthenticated);
       const location = useLocation();

       if (!isAuthenticated) {
         return <Navigate to="/login" replace state={{ from: location }} />;
       }

       return <Outlet />;
     };
     ```

  2. 关键要点：
     - 使用 `<Navigate>` 组件而非 `useEffect` + `navigate()`（防止闪屏，解决 P0#2）
     - 通过 `state={{ from: location }}` 保存原始路径，登录后可跳回
     - 从 `merchantAuthStore` 读取认证状态（非直接读 localStorage）

  **Must NOT do**:
  - 不在此组件内做 token 验证请求（仅检查本地状态）
  - 不渲染 loading 状态（同步检查即可）

  **Recommended Agent Profile**:
  - Category: `quick` — 单文件，<40 行
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5 | Blocked By: —

  **References**:
  - Pattern: `admin/src/merchant-router.tsx` — 路由结构，了解 Outlet 用法
  - Pattern: `admin/src/stores/merchantAuthStore.ts`（Task 1 产出）— 认证状态来源

  **Acceptance Criteria**:
  - [ ] 文件 `admin/src/components/MerchantAuthGuard.tsx` 存在
  - [ ] 导出 `MerchantAuthGuard` 组件
  - [ ] 使用 `<Navigate>` 而非 `useEffect` 进行重定向
  - [ ] 保存来源路径到 `location.state`
  - [ ] TypeScript 编译无错

  **QA Scenarios**:
  ```
  Scenario: 未认证跳转
    Tool: Bash
    Steps: grep 确认组件中存在 <Navigate to="/login" 和 state={{ from: location }}
    Expected: 未认证用户同步重定向，无闪屏
    Evidence: .sisyphus/evidence/task-2-guard.txt

  Scenario: 已认证透传
    Tool: Bash
    Steps: grep 确认组件中存在 <Outlet />
    Expected: 已认证用户正常渲染子路由
    Evidence: .sisyphus/evidence/task-2-outlet.txt
  ```

  **Commit**: NO（Wave 1 结束统一提交）

---

- [x] 3. **创建 merchantTheme 统一主题常量**

  **What to do**:
  创建 `admin/src/constants/merchantTheme.ts`，统一商家中心配色和样式常量。

  1. 定义主题常量：
     ```typescript
     export const MERCHANT_THEME = {
       // 品牌色 — 统一使用蓝色系（当前 Entry 是紫色，Login 是蓝色，需统一）
       primaryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
       primaryColor: '#1890ff',
       primaryColorDark: '#096dd9',

       // 背景
       pageBgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',

       // 卡片
       cardWidth: 420,           // 登录卡片宽度
       cardMaxWidth: '90vw',     // 响应式最大宽度
       cardBorderRadius: 8,

       // 角色卡片
       roleCardMinHeight: 200,

       // 响应式断点
       breakpoints: {
         mobile: 576,
         tablet: 768,
         desktop: 992,
       },
     } as const;
     ```

  2. 导出 Ant Design ConfigProvider 兼容的 theme token（如需要）

  **Must NOT do**:
  - 不修改全局 Ant Design 主题
  - 不影响 admin 管理端的主题配置

  **Recommended Agent Profile**:
  - Category: `quick` — 单文件常量定义
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7,8,9,10,11 | Blocked By: —

  **References**:
  - Pattern: `admin/src/pages/merchant/MerchantEntry.tsx:L19-20` — 当前紫色渐变 `#667eea→#764ba2`
  - Pattern: `admin/src/pages/merchant/MerchantLogin.tsx:L163` — 当前蓝色渐变 `#1890ff→#096dd9`
  - 决策：统一为蓝色系主色 + 保留紫色作为页面背景（品牌区分）

  **Acceptance Criteria**:
  - [ ] 文件 `admin/src/constants/merchantTheme.ts` 存在
  - [ ] 导出 `MERCHANT_THEME` 常量
  - [ ] 包含 primaryGradient, breakpoints 等关键值
  - [ ] TypeScript 编译无错

  **QA Scenarios**:
  ```
  Scenario: 常量可用
    Tool: Bash
    Steps: cd admin && npx tsc --noEmit src/constants/merchantTheme.ts
    Expected: 编译成功，零错误
    Evidence: .sisyphus/evidence/task-3-theme.txt
  ```

  **Commit**: YES | Message: `feat(merchant): add auth store, route guard, and theme constants` | Files: `admin/src/stores/merchantAuthStore.ts`, `admin/src/components/MerchantAuthGuard.tsx`, `admin/src/constants/merchantTheme.ts`

---

### Wave 2 — 核心集成（全并行，依赖 Wave 1）

- [x] 4. **修复 merchantApi.ts 拦截器 + 接入 merchantAuthStore**

  **What to do**:
  修改 `admin/src/services/merchantApi.ts`，消除直接 localStorage 操作，接入 merchantAuthStore。

  1. **Request 拦截器改造**（约 L25-32）：
     - 当前：`localStorage.getItem('merchant_token')` 直接读取
     - 改为：`useMerchantAuthStore.getState().getToken()`
     - 注意：拦截器在 React 组件外运行，必须用 `getState()` 而非 hook

  2. **Response 拦截器 401 处理改造**（约 L38-45）：
     - 当前：`localStorage.removeItem('merchant_token'); localStorage.removeItem('merchant_provider'); window.location.href = '/merchant/login'`（硬刷新，丢 SPA 状态 — P0#4）
     - 改为：
       ```typescript
       // 使用 store 的 logout 方法清理状态
       useMerchantAuthStore.getState().logout();
       // SPA 内导航替代硬刷新
       // 由于拦截器在 React 外，使用 event 通知机制
       window.dispatchEvent(new CustomEvent('merchant-auth-expired'));
       ```
     - 在 `MerchantLayout.tsx`（Task 6）中监听此事件并 `navigate('/login')`

  3. **上传超时修复**：
     - `merchantUploadApi.uploadImage` 和 `uploadImageData` 需要独立超时设置
     - 在上传请求中添加 `{ timeout: 60000 }` 覆盖默认 10s

  4. **预留 captchaToken 参数**：
     - `merchantAuthApi.sendCode` 已有 `captchaToken?` 可选参数
     - 确认该参数在调用端也被传递（当前各页面调用时未传）

  **Must NOT do**:
  - 不删除 `MerchantApiError` 类
  - 不修改 `unwrapEnvelope` / `unwrapData` 逻辑（API 格式未变）
  - 不修改非 merchant 的 API 实例

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — 单文件修改，逻辑清晰但需要注意细节
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: 1

  **References**:
  - Source: `admin/src/services/merchantApi.ts:L25-45` — 当前拦截器代码
  - Pattern: `admin/src/stores/merchantAuthStore.ts`（Task 1 产出）— `getState().getToken()` 用法
  - Type: `admin/src/services/merchantApi.ts:MerchantLoginData` — login 返回结构

  **Acceptance Criteria**:
  - [ ] `merchantApi.ts` 中无直接 `localStorage.getItem('merchant_token')` 调用
  - [ ] 401 处理不再使用 `window.location.href`
  - [ ] 上传方法有独立的 timeout 配置（≥30s）
  - [ ] `cd admin && npx tsc --noEmit src/services/merchantApi.ts` 零错误

  **QA Scenarios**:
  ```
  Scenario: 拦截器使用 store
    Tool: Bash
    Steps: grep -n "localStorage.getItem.*merchant_token" admin/src/services/merchantApi.ts
    Expected: 零匹配（所有直接读取已替换为 store）
    Evidence: .sisyphus/evidence/task-4-no-localstorage.txt

  Scenario: 无硬刷新
    Tool: Bash
    Steps: grep -n "window.location.href" admin/src/services/merchantApi.ts
    Expected: 零匹配
    Evidence: .sisyphus/evidence/task-4-no-hard-refresh.txt
  ```

  **Commit**: NO（Wave 2 结束统一提交）

---

- [x] 5. **修复 merchant-router.tsx 路由守卫 + 404 兜底**

  **What to do**:
  修改 `admin/src/merchant-router.tsx`，使用 MerchantAuthGuard 包裹受保护路由，添加 404 路由。

  1. **引入 AuthGuard**：
     ```tsx
     import { MerchantAuthGuard } from './components/MerchantAuthGuard';
     ```

  2. **重构路由结构**（当前约 L16-60）：
     - 当前：受保护路由直接 `element: <MerchantLayout />`，无守卫
     - 改为：
       ```tsx
       {
         element: <MerchantAuthGuard />,
         children: [
           {
             element: <MerchantLayout />,
             children: [
               { path: 'dashboard', element: <MerchantDashboard /> },
               // ... 其他受保护路由
             ],
           },
         ],
       },
       ```

  3. **添加 404 兜底路由**：
     ```tsx
     { path: '*', element: <Navigate to="/" replace /> }
     ```
     放在路由数组末尾，将未匹配路由重定向到首页。

  **Must NOT do**:
  - 不修改公开路由（`/`, `/login`, `/register`, `/material-shop/register`, `/apply-status`）
  - 不修改 `basename` 配置

  **Recommended Agent Profile**:
  - Category: `quick` — 单文件，结构调整
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7,8,9,10,11 | Blocked By: 1,2

  **References**:
  - Source: `admin/src/merchant-router.tsx` — 当前完整路由配置
  - Component: `admin/src/components/MerchantAuthGuard.tsx`（Task 2 产出）

  **Acceptance Criteria**:
  - [ ] `MerchantAuthGuard` 出现在路由配置中包裹所有受保护路由
  - [ ] 公开路由（/login, /register 等）不在 AuthGuard 内
  - [ ] 存在 `path: '*'` 的 404 兜底路由
  - [ ] `cd admin && npx tsc --noEmit src/merchant-router.tsx` 零错误

  **QA Scenarios**:
  ```
  Scenario: 守卫包裹
    Tool: Bash
    Steps: grep -n "MerchantAuthGuard" admin/src/merchant-router.tsx
    Expected: 至少 1 次匹配（import + 使用）
    Evidence: .sisyphus/evidence/task-5-guard.txt

  Scenario: 404 兜底
    Tool: Bash
    Steps: grep -n "path.*\*" admin/src/merchant-router.tsx
    Expected: 存在通配符路由
    Evidence: .sisyphus/evidence/task-5-404.txt
  ```

  **Commit**: NO（Wave 2 结束统一提交）

---

- [x] 6. **修复 MerchantLayout.tsx 接入 store + 安全修复**

  **What to do**:
  修改 `admin/src/layouts/MerchantLayout.tsx`，接入 merchantAuthStore，修复安全问题。

  1. **替换直接 localStorage 读取**（约 L30-35）：
     - 当前：`JSON.parse(localStorage.getItem('merchant_provider') || '{}')` — 无 try-catch（P0#3）
     - 改为：`useMerchantAuthStore(s => s.provider)`
     - 删除所有直接 localStorage.getItem 调用

  2. **修复 logout**（约 L90-98）：
     - 当前：`localStorage.removeItem(...)` + `navigate('/login')`
     - 改为：`useMerchantAuthStore.getState().logout()` + `navigate('/login')`

  3. **监听 auth-expired 事件**（配合 Task 4 的 401 拦截器）：
     ```tsx
     useEffect(() => {
       const handler = () => navigate('/login', { replace: true });
       window.addEventListener('merchant-auth-expired', handler);
       return () => window.removeEventListener('merchant-auth-expired', handler);
     }, [navigate]);
     ```

  4. **修复 `as any` 类型断言**（约 L80, L120）：
     - 为 menu items 和 dropdown menu 定义正确的类型
     - 使用 Ant Design 5.x 的 `MenuProps['items']` 类型

  5. **修复 /im-test 不可达问题**：
     - 要么在 availableKeys 中添加 `/im-test`
     - 要么从 router 中移除该路由（建议保留，添加到 availableKeys）

  **Must NOT do**:
  - 不修改侧边栏/菜单的视觉设计
  - 不修改菜单项的业务逻辑分支（provider vs material_shop）

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — 单文件，多处修改但逻辑清晰
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: 1

  **References**:
  - Source: `admin/src/layouts/MerchantLayout.tsx` — 完整组件代码
  - Store: `admin/src/stores/merchantAuthStore.ts`（Task 1 产出）
  - Event: Task 4 中定义的 `merchant-auth-expired` 自定义事件

  **Acceptance Criteria**:
  - [ ] 无直接 `localStorage.getItem('merchant_provider')` 调用
  - [ ] 无直接 `JSON.parse` 调用（改用 store）
  - [ ] `as any` 被替换为正确类型
  - [ ] 存在 `merchant-auth-expired` 事件监听 + cleanup
  - [ ] `cd admin && npx tsc --noEmit src/layouts/MerchantLayout.tsx` 零错误

  **QA Scenarios**:
  ```
  Scenario: 无直接 localStorage
    Tool: Bash
    Steps: grep -n "localStorage" admin/src/layouts/MerchantLayout.tsx
    Expected: 零匹配（所有操作通过 store）
    Evidence: .sisyphus/evidence/task-6-no-localstorage.txt

  Scenario: 无 as any
    Tool: Bash
    Steps: grep -n "as any" admin/src/layouts/MerchantLayout.tsx
    Expected: 零匹配
    Evidence: .sisyphus/evidence/task-6-no-any.txt
  ```

  **Commit**: YES | Message: `refactor(merchant): integrate auth store into API, router, and layout` | Files: `admin/src/services/merchantApi.ts`, `admin/src/merchant-router.tsx`, `admin/src/layouts/MerchantLayout.tsx`

---

### Wave 3 — 公开页面修复（全并行，依赖 Wave 2）

- [x] 7. **MerchantLogin.tsx 全面修复**

  **What to do**:
  修改 `admin/src/pages/merchant/MerchantLogin.tsx`，修复 8 个已识别问题。

  1. **接入 merchantAuthStore**（替代直接 localStorage）：
     - 当前 `onFinish`（约 L125-145）：`localStorage.setItem('merchant_token', ...)` 等 3 处
     - 改为：`useMerchantAuthStore.getState().login({ token, provider, tinodeToken })`
     - 删除所有直接 localStorage 写入

  2. **清除 DEV 模式验证码泄露**（P0#6，约 L95）：
     - 当前：`if (import.meta.env.DEV && debugCode) { message.success(\`验证码: ${debugCode}\`) }`
     - 改为：`if (import.meta.env.DEV && debugCode) { console.debug('[DEV] SMS code:', debugCode); }`
     - 只输出到 console，不在 UI 上显示

  3. **修复 countdown timer 内存泄漏**（约 L75-90）：
     - 当前：`setInterval` 无 cleanup
     - 改为：使用 `useEffect` + `useRef` 管理 interval，组件卸载时 `clearInterval`
     ```tsx
     const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
     
     const startCountdown = useCallback(() => {
       setCountdown(60);
       timerRef.current = setInterval(() => {
         setCountdown(prev => {
           if (prev <= 1) {
             clearInterval(timerRef.current!);
             timerRef.current = null;
             return 0;
           }
           return prev - 1;
         });
       }, 1000);
     }, []);

     useEffect(() => {
       return () => { if (timerRef.current) clearInterval(timerRef.current); };
     }, []);
     ```

  4. **修复导航延迟**（约 L110-120）：
     - 当前：`setTimeout(() => navigate('/register', ...), 1200)` — 硬编码 1.2s 延迟
     - 改为：`message.info(...)` 后直接 `navigate()`，或使用 `message.info(...).then(() => navigate(...))`

  5. **修复表单验证触发时机**：
     - 当前：`validateTrigger={['onBlur', 'onChange']}` — 每次按键触发验证
     - 改为：`validateTrigger="onBlur"` — 仅失焦时验证

  6. **引入主题常量**：
     - 导入 `MERCHANT_THEME`，替换硬编码的颜色值和卡片宽度
     - `background: MERCHANT_THEME.primaryGradient`
     - `width: MERCHANT_THEME.cardWidth, maxWidth: MERCHANT_THEME.cardMaxWidth`

  7. **修复 error 类型处理**（约 L100-108）：
     - 当前：`(error as { response?: ... })` 不安全类型断言
     - 改为：使用 `instanceof MerchantApiError` 或 axios `isAxiosError` 判断

  8. **Input 数字限制优化**：
     - 手机号 Input 添加 `inputMode="numeric"` 属性（移动端弹出数字键盘）
     - 验证码 Input 同理

  **Must NOT do**:
  - 不修改登录 API 调用逻辑（`merchantAuthApi.login`）
  - 不修改 handleLoginGuide 的业务分支（409 处理）
  - 不添加密码登录功能

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — 单文件但修改点多，需仔细协调
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12 | Blocked By: 1,3,4,5,6

  **References**:
  - Source: `admin/src/pages/merchant/MerchantLogin.tsx` — 完整组件代码（223 行）
  - Store: `admin/src/stores/merchantAuthStore.ts`（Task 1 产出）
  - Theme: `admin/src/constants/merchantTheme.ts`（Task 3 产出）
  - API: `admin/src/services/merchantApi.ts:MerchantApiError` — 错误类型

  **Acceptance Criteria**:
  - [ ] 无直接 `localStorage` 操作
  - [ ] 无 `message.success` 显示验证码（DEV 模式用 console.debug）
  - [ ] setInterval 有对应的 cleanup（useEffect return 或 useRef）
  - [ ] 无 `setTimeout` 用于导航延迟
  - [ ] validateTrigger 改为 `"onBlur"`
  - [ ] 颜色/宽度引用 MERCHANT_THEME 常量
  - [ ] `cd admin && npx tsc --noEmit src/pages/merchant/MerchantLogin.tsx` 零错误

  **QA Scenarios**:
  ```
  Scenario: 无验证码泄露
    Tool: Bash
    Steps: grep -n "message.success.*验证码\|message.success.*debugCode\|message.success.*code" admin/src/pages/merchant/MerchantLogin.tsx
    Expected: 零匹配
    Evidence: .sisyphus/evidence/task-7-no-code-leak.txt

  Scenario: Timer 安全清理
    Tool: Bash
    Steps: grep -n "clearInterval" admin/src/pages/merchant/MerchantLogin.tsx
    Expected: 至少 2 次匹配（countdown 到 0 清理 + unmount 清理）
    Evidence: .sisyphus/evidence/task-7-timer-cleanup.txt
  ```

  **Commit**: NO（Wave 3 结束统一提交）

---

- [x] 8. **MerchantEntry.tsx 全面修复**

  **What to do**:
  修改 `admin/src/pages/merchant/MerchantEntry.tsx`，修复角色卡片预选和 UI 问题。

  1. **修复角色卡片不传参问题**（P0#7，约 L181）：
     - 当前：4 个 MerchantTypeCard 的 onClick 都调用 `openApplyFlow()`，不传角色
     - 改为：每个卡片传递角色参数
     ```tsx
     <MerchantTypeCard ... onClick={() => openApplyFlow('designer')} />
     <MerchantTypeCard ... onClick={() => openApplyFlow('foreman')} />
     <MerchantTypeCard ... onClick={() => openApplyFlow('company')} />
     <MerchantTypeCard ... onClick={() => openApplyFlow('material_shop')} />
     ```

  2. **修改 openApplyFlow 接受预选角色**：
     - 当前签名：`openApplyFlow()` — 无参数，重置 selectedRole=''
     - 改为：`openApplyFlow(role?: string)` — 预选角色
     ```tsx
     const openApplyFlow = (role?: string) => {
       setSelectedRole(role || '');
       setEntityType(role === 'company' || role === 'material_shop' ? 'company' : 'personal');
       setIsModalVisible(true);
     };
     ```

  3. **引入主题常量**：
     - 导入 `MERCHANT_THEME`
     - 替换背景渐变色、卡片高度等硬编码值

  4. **添加角色说明文案**：
     - 每个角色卡片的 `description` 应更明确地说明该角色的定位/权益
     - 设计师："提供设计方案，获取设计订单"
     - 工长："承接施工项目，管理工程进度"
     - 装修公司："全屋装修服务，企业级管理"
     - 建材商："上架建材商品，在线销售"

  5. **修复 entityType 重置逻辑**：
     - 当 role 已从卡片传入时，entityType 应根据 role 自动确定
     - company/material_shop → entityType 固定为 'company'
     - designer/foreman → 默认 'personal'，允许用户在 Modal 中切换

  **Must NOT do**:
  - 不修改 Modal 中的 handleStartApply 导航逻辑
  - 不修改角色卡片的图标选择

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — 单文件，逻辑修复为主
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12 | Blocked By: 1,3,5

  **References**:
  - Source: `admin/src/pages/merchant/MerchantEntry.tsx` — 完整组件代码（248 行）
  - Theme: `admin/src/constants/merchantTheme.ts`（Task 3 产出）
  - Target: `admin/src/pages/merchant/MerchantRegister.tsx` — 接收 URL params（role, entityType）

  **Acceptance Criteria**:
  - [ ] 4 个角色卡片的 onClick 各自传递不同的 role 参数
  - [ ] `openApplyFlow` 函数签名接受 `role?: string` 参数
  - [ ] Modal 打开时 selectedRole 已预选
  - [ ] 颜色/尺寸引用 MERCHANT_THEME 常量
  - [ ] TypeScript 编译无错

  **QA Scenarios**:
  ```
  Scenario: 角色卡片传参
    Tool: Bash
    Steps: grep -n "openApplyFlow(" admin/src/pages/merchant/MerchantEntry.tsx | wc -l
    Expected: 至少 4 次调用，且每次参数不同（designer/foreman/company/material_shop）
    Evidence: .sisyphus/evidence/task-8-role-params.txt

  Scenario: 函数接受参数
    Tool: Bash
    Steps: grep -n "openApplyFlow.*role" admin/src/pages/merchant/MerchantEntry.tsx
    Expected: 函数定义包含 role 参数
    Evidence: .sisyphus/evidence/task-8-function-sig.txt
  ```

  **Commit**: NO（Wave 3 结束统一提交）

---

- [x] 9. **MerchantApplyStatus.tsx 全面修复**

  **What to do**:
  修改 `admin/src/pages/merchant/MerchantApplyStatus.tsx`，修复查询逻辑和 lint 错误。

  1. **修复 useEffect 依赖缺失**（lint 错误，约 L25-31）：
     - 当前：`useEffect(() => { ... }, [phone])` — 缺少 `form.setFieldsValue` 和 `handleQuery`
     - 修复方案：
       - 将 `handleQuery` 用 `useCallback` 包裹
       - 依赖数组添加 `handleQuery`
       - `form.setFieldsValue` 来自 Ant Design Form，稳定引用，可安全忽略（添加 eslint-disable 注释说明原因）
       - 或者将 form 操作移到 handleQuery 外部

  2. **修复 sequential try-catch 查询逻辑**（约 L36-42）：
     - 当前：先试 merchantApplyApi.status，catch 后试 materialShopApplyApi.status — 若第一个返回非 404 错误（如网络超时），仍会 fallback
     - 改为：使用 `Promise.allSettled` 并行查询两个 API
     ```tsx
     const handleQuery = useCallback(async (phone: string) => {
       setLoading(true);
       try {
         const results = await Promise.allSettled([
           merchantApplyApi.status(phone),
           materialShopApplyApi.status(phone),
         ]);
         
         const merchantResult = results[0].status === 'fulfilled' ? results[0].value : null;
         const materialResult = results[1].status === 'fulfilled' ? results[1].value : null;
         
         if (merchantResult) {
           setApplicationData({ ...merchantResult, type: 'merchant' });
         } else if (materialResult) {
           setApplicationData({ ...materialResult, type: 'material_shop' });
         } else {
           message.warning('未找到相关申请记录');
         }
       } catch {
         message.error('查询失败，请稍后重试');
       } finally {
         setLoading(false);
       }
     }, []);
     ```

  3. **添加 pending 状态自动轮询**：
     - 当查询结果为 pending（status === 0）时，添加 30s 轮询
     ```tsx
     useEffect(() => {
       if (applicationData?.status !== 0) return;
       const timer = setInterval(() => handleQuery(currentPhone), 30000);
       return () => clearInterval(timer);
     }, [applicationData?.status, currentPhone, handleQuery]);
     ```

  4. **修复重新提交按钮参数映射**：
     - 当前参数映射无 fallback — 若 applicantType 为未知值，导航参数丢失
     - 添加 fallback：未知 applicantType 默认映射为 `{ role: 'designer', entityType: 'personal' }`

  5. **引入主题常量**：
     - 使用 `MERCHANT_THEME` 替换硬编码样式值

  **Must NOT do**:
  - 不修改审核状态的渲染逻辑（approved/rejected/pending 的 UI）
  - 不修改重新提交的导航目标路径

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — 单文件修复
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12 | Blocked By: 3,5

  **References**:
  - Source: `admin/src/pages/merchant/MerchantApplyStatus.tsx` — 完整组件代码（264 行）
  - API: `admin/src/services/merchantApi.ts:merchantApplyApi.status` — 查询接口
  - API: `admin/src/services/merchantApi.ts:materialShopApplyApi.status` — 建材商查询接口

  **Acceptance Criteria**:
  - [ ] useEffect 依赖数组完整（lint 无警告）
  - [ ] 使用 `Promise.allSettled` 替代 sequential try-catch
  - [ ] pending 状态有 30s 轮询 + cleanup
  - [ ] 重新提交参数映射有 fallback
  - [ ] `cd admin && npx tsc --noEmit src/pages/merchant/MerchantApplyStatus.tsx` 零错误

  **QA Scenarios**:
  ```
  Scenario: 并行查询
    Tool: Bash
    Steps: grep -n "Promise.allSettled" admin/src/pages/merchant/MerchantApplyStatus.tsx
    Expected: 至少 1 次匹配
    Evidence: .sisyphus/evidence/task-9-parallel-query.txt

  Scenario: 轮询 cleanup
    Tool: Bash
    Steps: grep -n "clearInterval" admin/src/pages/merchant/MerchantApplyStatus.tsx
    Expected: 至少 1 次匹配（useEffect return 清理）
    Evidence: .sisyphus/evidence/task-9-polling-cleanup.txt
  ```

  **Commit**: YES | Message: `fix(merchant): fix login, entry, and apply-status pages` | Files: `admin/src/pages/merchant/MerchantLogin.tsx`, `admin/src/pages/merchant/MerchantEntry.tsx`, `admin/src/pages/merchant/MerchantApplyStatus.tsx`

---

### Wave 4 — 注册流程修复（全并行，依赖 Wave 2）

- [x] 10. **MerchantRegister.tsx 全面修复**

  **What to do**:
  修改 `admin/src/pages/merchant/MerchantRegister.tsx`（929 行），修复 14 个已识别问题。

  1. **添加草稿保存功能**（P0#8 — 最重要修复）：
     - 使用 `sessionStorage` 保存表单草稿（关闭标签页后自动清除，适合注册流程）
     - Key: `merchant_register_draft`
     - 保存时机：每次 step 切换 + 表单 onChange debounce（500ms）
     - 恢复时机：组件 mount 时检查 sessionStorage
     ```tsx
     const DRAFT_KEY = 'merchant_register_draft';

     // 保存草稿
     const saveDraft = useMemo(() => 
       debounce(() => {
         const formValues = form.getFieldsValue();
         const draft = {
           step: currentStep,
           formValues,
           portfolioCases,
           timestamp: Date.now(),
         };
         sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
       }, 500),
     [form, currentStep, portfolioCases]);

     // 恢复草稿
     useEffect(() => {
       const raw = sessionStorage.getItem(DRAFT_KEY);
       if (!raw) return;
       try {
         const draft = JSON.parse(raw);
         // 检查草稿是否过期（超过 2 小时）
         if (Date.now() - draft.timestamp > 2 * 60 * 60 * 1000) {
           sessionStorage.removeItem(DRAFT_KEY);
           return;
         }
         form.setFieldsValue(draft.formValues);
         setCurrentStep(draft.step);
         if (draft.portfolioCases) setPortfolioCases(draft.portfolioCases);
       } catch {
         sessionStorage.removeItem(DRAFT_KEY);
       }
     }, []);

     // 提交成功后清除草稿
     // 在 handleSubmit 成功分支末尾添加：
     sessionStorage.removeItem(DRAFT_KEY);
     ```

  2. **修复 useEffect 依赖缺失**（lint 错误，约 L176）：
     - 当前：`useEffect(() => { loadStyleOptions(); loadAreaOptions(); }, [])` — 缺少函数依赖
     - 改为：将 `loadStyleOptions` 和 `loadAreaOptions` 用 `useCallback` 包裹，添加到依赖数组
     - 或在 useEffect 内部直接定义 async 函数（避免依赖问题）

  3. **修复 countdown timer 内存泄漏**（约 L309-317）：
     - 同 Task 7 方案：使用 useRef + useEffect cleanup

  4. **清除 DEV 模式验证码泄露**（约 L306-307）：
     - 同 Task 7：改为 `console.debug`

  5. **条件渲染毕业院校/设计理念字段**（约 L850-861）：
     - 当前：`graduateSchool` 和 `designPhilosophy` 对所有角色都显示（包括 company/foreman）
     - 改为：仅 `role === 'designer'` 时显示
     ```tsx
     {resolvedMeta.role === 'designer' && (
       <>
         <Form.Item name="graduateSchool" label="毕业院校">...</Form.Item>
         <Form.Item name="designPhilosophy" label="设计理念">...</Form.Item>
       </>
     )}
     ```

  6. **修复案例区域字段**（约 L720-726）：
     - 当前：案例的 `area` 字段是纯文本 Input，未联动已加载的 `areaOptions`
     - 改为：使用 `Select` 组件，options 来源于 `areaOptions`
     ```tsx
     <Select
       placeholder="选择区域"
       options={areaOptions.map(a => ({ label: a.name, value: a.name }))}
       showSearch
       filterOption={(input, option) => 
         (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
       }
     />
     ```

  7. **修复城市硬编码**（约 L196-202）：
     - 当前：`regionApi.getChildren('610100')` 硬编码西安
     - 改为：从配置或 URL 参数获取城市 code，或提供城市选择器
     - 最小改动方案：将 `'610100'` 提取为常量 `DEFAULT_CITY_CODE` 并加注释说明

  8. **添加提交确认对话框**：
     - 在 handleSubmit 之前弹出 Modal.confirm
     ```tsx
     Modal.confirm({
       title: '确认提交',
       content: '提交后将进入审核流程，审核期间无法修改。确认提交？',
       onOk: () => doSubmit(),
     });
     ```

  9. **修复 portfolioCases key**（lint 错误，约 L696）：
     - 当前：`key={index}` — 数组 index 作为 key
     - 改为：为每个 case 添加唯一 id（`crypto.randomUUID()` 或递增计数器）

  10. **修复 form.getFieldsValue 类型断言**（约 L392）：
      - 当前：`form.getFieldsValue() as Record<string, any>`
      - 改为：定义 `RegisterFormValues` 接口，用 `Form.useForm<RegisterFormValues>()`

  **Must NOT do**:
  - 不修改 4 步骤结构（保持 0-3 的步骤流程）
  - 不修改上传逻辑（保持现有图片上传方式）
  - 不修改 API 调用（merchantApplyApi.apply/resubmit）
  - 不修改 resolveApplyMeta 的映射逻辑

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — 大文件（929 行），10 个修改点需要仔细协调
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 12 | Blocked By: 1,3,5

  **References**:
  - Source: `admin/src/pages/merchant/MerchantRegister.tsx` — 完整组件代码（929 行）
  - Store: `admin/src/stores/merchantAuthStore.ts`（Task 1 产出）
  - Theme: `admin/src/constants/merchantTheme.ts`（Task 3 产出）
  - API: `admin/src/services/merchantApi.ts:merchantApplyApi` — 申请相关 API
  - Pattern: `admin/src/stores/authStore.ts` — Zustand 使用模式参考

  **Acceptance Criteria**:
  - [ ] sessionStorage 草稿保存/恢复逻辑存在
  - [ ] useEffect 依赖数组完整（lint 无警告）
  - [ ] timer 有 cleanup
  - [ ] 无 DEV 模式 UI 验证码泄露
  - [ ] graduateSchool/designPhilosophy 仅 designer 角色显示
  - [ ] 案例 area 字段使用 Select 而非 Input
  - [ ] 城市 code 提取为常量
  - [ ] 提交前有确认对话框
  - [ ] 无 `key={index}`
  - [ ] `cd admin && npx tsc --noEmit src/pages/merchant/MerchantRegister.tsx` 零错误

  **QA Scenarios**:
  ```
  Scenario: 草稿保存
    Tool: Bash
    Steps: grep -n "sessionStorage.*merchant_register_draft\|DRAFT_KEY" admin/src/pages/merchant/MerchantRegister.tsx
    Expected: 至少 3 次匹配（保存+恢复+清除）
    Evidence: .sisyphus/evidence/task-10-draft-save.txt

  Scenario: 条件渲染
    Tool: Bash
    Steps: grep -A2 "graduateSchool\|designPhilosophy" admin/src/pages/merchant/MerchantRegister.tsx | grep -i "designer"
    Expected: 字段在 designer 条件块内
    Evidence: .sisyphus/evidence/task-10-conditional-fields.txt

  Scenario: 提交确认
    Tool: Bash
    Steps: grep -n "Modal.confirm" admin/src/pages/merchant/MerchantRegister.tsx
    Expected: 至少 1 次匹配
    Evidence: .sisyphus/evidence/task-10-confirm-dialog.txt
  ```

  **Commit**: NO（Wave 4 结束统一提交）

---

- [x] 11. **MaterialShopRegister.tsx 全面修复**

  **What to do**:
  修改 `admin/src/pages/merchant/MaterialShopRegister.tsx`（522 行），修复 7 个已识别问题。

  1. **改造商品参数输入**（最重要修复）：
     - 当前：`paramsText` 是原始 JSON TextArea，默认值 `'{}'` — 极度不友好
     - 改为：动态 key-value 表单
     ```tsx
     // 替换 paramsText TextArea 为：
     <Form.List name={['products', index, 'params']}>
       {(fields, { add, remove }) => (
         <>
           {fields.map(field => (
             <Space key={field.key} align="baseline">
               <Form.Item {...field} name={[field.name, 'key']} rules={[{ required: true }]}>
                 <Input placeholder="参数名（如：颜色）" />
               </Form.Item>
               <Form.Item {...field} name={[field.name, 'value']} rules={[{ required: true }]}>
                 <Input placeholder="参数值（如：白色）" />
               </Form.Item>
               <MinusCircleOutlined onClick={() => remove(field.name)} />
             </Space>
           ))}
           <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
             添加参数
           </Button>
         </>
       )}
     </Form.List>
     ```
     - 提交时将 params 数组转为 JSON object：
     ```typescript
     const paramsObj = product.params?.reduce((acc, p) => ({ ...acc, [p.key]: p.value }), {}) ?? {};
     ```

  2. **减少默认商品数量**：
     - 当前：初始化 5 个空商品 — 过于拥挤
     - 改为：初始化 1 个空商品，用户可手动添加
     - 保持最低 5 个的**提交**要求不变（validateProducts 逻辑不变）
     - 添加提示文案："至少需要 5 个商品才能提交"

  3. **添加商品删除功能**：
     - 当前：无法删除商品
     - 在每个商品卡片右上角添加删除按钮（至少保留 1 个商品）
     ```tsx
     <Card
       title={`商品 ${index + 1}`}
       extra={products.length > 1 ? (
         <Button danger size="small" icon={<DeleteOutlined />} onClick={() => removeProduct(index)} />
       ) : null}
     >
     ```

  4. **修复 entityType 显示**（约 L351-356）：
     - 当前：disabled Select 显示 entityType — 令人困惑
     - 改为：纯文本显示 + 说明："企业/个体工商户"，不可编辑
     - 或直接隐藏该字段（如果对用户无信息价值）

  5. **修复 countdown timer 内存泄漏**（约 L139-147）：
     - 同 Task 7 方案：useRef + useEffect cleanup

  6. **清除 DEV 模式验证码泄露**（约 L136-137）：
     - 同 Task 7：改为 `console.debug`

  7. **修复商品卡片 key**（lint 错误，约 L438）：
     - 当前：`key={index}`
     - 改为：为每个 product 添加唯一 id

  8. **添加草稿保存**（与 Task 10 类似）：
     - sessionStorage key: `material_shop_register_draft`
     - 保存/恢复/清除逻辑同 Task 10

  9. **添加提交确认对话框**（同 Task 10）

  **Must NOT do**:
  - 不修改 materialShopApplyApi 的调用方式
  - 不修改 2 步骤结构
  - 不修改图片上传逻辑

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — 单文件但修改点多
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 12 | Blocked By: 1,3,5

  **References**:
  - Source: `admin/src/pages/merchant/MaterialShopRegister.tsx` — 完整组件代码（522 行）
  - Pattern: Task 10 的草稿保存方案 — 复用 sessionStorage 模式
  - Store: `admin/src/stores/merchantAuthStore.ts`（Task 1 产出）
  - Theme: `admin/src/constants/merchantTheme.ts`（Task 3 产出）

  **Acceptance Criteria**:
  - [ ] paramsText（JSON TextArea）被替换为 key-value 动态表单
  - [ ] 默认商品数量从 5 改为 1
  - [ ] 存在商品删除按钮（至少保留 1 个）
  - [ ] timer 有 cleanup
  - [ ] 无 DEV 模式 UI 验证码泄露
  - [ ] 无 `key={index}`
  - [ ] 存在草稿保存/恢复逻辑
  - [ ] 提交前有确认对话框
  - [ ] `cd admin && npx tsc --noEmit src/pages/merchant/MaterialShopRegister.tsx` 零错误

  **QA Scenarios**:
  ```
  Scenario: 参数输入改造
    Tool: Bash
    Steps: grep -n "paramsText\|TextArea.*JSON\|TextArea.*params" admin/src/pages/merchant/MaterialShopRegister.tsx
    Expected: 零匹配（JSON TextArea 已被替换）
    Evidence: .sisyphus/evidence/task-11-no-json-textarea.txt

  Scenario: 商品删除
    Tool: Bash
    Steps: grep -n "removeProduct\|DeleteOutlined\|删除" admin/src/pages/merchant/MaterialShopRegister.tsx
    Expected: 至少 1 次匹配
    Evidence: .sisyphus/evidence/task-11-product-delete.txt

  Scenario: 默认 1 个商品
    Tool: Bash
    Steps: grep -n "createEmptyProduct" admin/src/pages/merchant/MaterialShopRegister.tsx | head -5
    Expected: 初始化数组仅包含 1 个元素（非 5 个）
    Evidence: .sisyphus/evidence/task-11-default-products.txt
  ```

  **Commit**: YES | Message: `fix(merchant): fix registration and material-shop flows` | Files: `admin/src/pages/merchant/MerchantRegister.tsx`, `admin/src/pages/merchant/MaterialShopRegister.tsx`

---

### Wave 5 — 响应式适配（依赖 Wave 3+4）

- [x] 12. **公开页面响应式适配**

  **What to do**:
  为商家中心 4 个公开页面添加响应式适配（仅公开页面，不涉及后台管理页面）。

  目标页面：
  - `MerchantEntry.tsx` — 首页
  - `MerchantLogin.tsx` — 登录页
  - `MerchantRegister.tsx` — 服务商注册页
  - `MaterialShopRegister.tsx` — 建材商注册页
  - `MerchantApplyStatus.tsx` — 审核状态页

  1. **MerchantLogin.tsx 响应式**：
     - Card 宽度：`width: MERCHANT_THEME.cardWidth, maxWidth: MERCHANT_THEME.cardMaxWidth`
     - 已在 Task 7 中引入主题常量，此处确认 `maxWidth: '90vw'` 生效
     - 页面 padding 在移动端减小：`padding: window.innerWidth < 576 ? '20px' : '50px'`
     - 使用 CSS media query 或 Ant Design Grid 的 `useBreakpoint`

  2. **MerchantEntry.tsx 响应式**：
     - 角色卡片网格：桌面 2x2 → 平板 2x1 → 手机 1x1
     - 使用 Ant Design `<Row gutter={[16, 16]}><Col xs={24} sm={12} md={12} lg={6}>` 布局
     - 角色卡片高度从固定 200px 改为 `minHeight: MERCHANT_THEME.roleCardMinHeight`

  3. **MerchantRegister.tsx 响应式**：
     - Steps 组件在移动端切换为 `direction="vertical"` + `size="small"`
     - Form 宽度在移动端占满屏幕
     - 案例图片上传区域在移动端缩小 grid

  4. **MaterialShopRegister.tsx 响应式**：
     - 商品卡片在移动端单列布局
     - 参数 key-value 输入在移动端竖排

  5. **MerchantApplyStatus.tsx 响应式**：
     - Card 宽度同登录页处理

  6. **实现方式**：推荐使用 Ant Design Grid 的 `useBreakpoint` hook
     ```tsx
     import { Grid } from 'antd';
     const screens = Grid.useBreakpoint();
     // screens.md === true 表示 ≥768px
     ```

  **Must NOT do**:
  - 不为后台管理页面（dashboard/bookings/orders 等）添加响应式
  - 不引入 CSS-in-JS 库（如 styled-components）
  - 不修改 Ant Design 全局 breakpoint 配置

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — UI/样式密集型任务
  - Skills: [`frontend-ui-ux`] — 需要 UI 设计感
  - Omitted: [`dev-browser`] — 不需要浏览器自动化

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: 13 | Blocked By: 7,8,9,10,11

  **References**:
  - Theme: `admin/src/constants/merchantTheme.ts`（Task 3 产出）— breakpoints, cardMaxWidth
  - Ant Design Grid: https://ant.design/components/grid — Row/Col/useBreakpoint
  - Source: 5 个目标页面（均已在 Wave 3-4 中修改）

  **Acceptance Criteria**:
  - [ ] 所有 5 个公开页面使用 `MERCHANT_THEME.breakpoints` 或 `useBreakpoint`
  - [ ] 登录页卡片有 `maxWidth` 限制
  - [ ] 首页角色卡片使用 Row/Col 响应式网格
  - [ ] 注册页 Steps 在移动端为 vertical
  - [ ] 无固定像素宽度导致的水平滚动
  - [ ] `cd admin && npm run build` 构建成功

  **QA Scenarios**:
  ```
  Scenario: 响应式断点
    Tool: Bash
    Steps: grep -rn "useBreakpoint\|maxWidth.*vw\|xs={24}" admin/src/pages/merchant/
    Expected: 至少 5 次匹配（每个页面至少 1 处响应式代码）
    Evidence: .sisyphus/evidence/task-12-responsive.txt

  Scenario: 无固定宽度溢出
    Tool: Bash
    Steps: grep -n "width:.*420\|width:.*px" admin/src/pages/merchant/ | grep -v maxWidth | grep -v minWidth | grep -v Height
    Expected: 零匹配或所有固定宽度都有对应 maxWidth
    Evidence: .sisyphus/evidence/task-12-no-overflow.txt
  ```

  **Commit**: YES | Message: `style(merchant): add responsive design for public pages` | Files: `admin/src/pages/merchant/MerchantEntry.tsx`, `admin/src/pages/merchant/MerchantLogin.tsx`, `admin/src/pages/merchant/MerchantRegister.tsx`, `admin/src/pages/merchant/MaterialShopRegister.tsx`, `admin/src/pages/merchant/MerchantApplyStatus.tsx`

---

### Wave 6 — 构建验证（依赖全部）

- [x] 13. **全量构建 + Lint + TypeScript 校验**

  **What to do**:
  执行全量构建验证，确保所有修改不引入编译错误或 lint 问题。

  1. **TypeScript 类型检查**：
     ```bash
     cd admin && npx tsc --noEmit
     ```
     - 预期：零错误
     - 若有错误：定位并修复

  2. **ESLint 检查**：
     ```bash
     cd admin && npm run lint
     ```
     - 预期：零错误（允许现有 warning）
     - 若有新增错误：定位并修复

  3. **Vite 构建**：
     ```bash
     cd admin && npm run build
     ```
     - 预期：构建成功，产出 dist 目录
     - 若失败：定位并修复

  4. **验证 React 版本未变**：
     ```bash
     grep '"react"' admin/package.json
     ```
     - 预期：`"react": "18.3.1"` 或 `"react": "^18.3.1"`

  5. **验证无新增依赖**：
     ```bash
     git diff admin/package.json | grep "^+"
     ```
     - 预期：无新增 dependencies

  **Must NOT do**:
  - 不修复非本次任务引入的 lint 错误
  - 不升级任何依赖

  **Recommended Agent Profile**:
  - Category: `quick` — 执行验证命令
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: F1-F4 | Blocked By: ALL

  **References**:
  - Config: `admin/tsconfig.app.json` — TypeScript 配置（strict: true）
  - Config: `admin/eslint.config.js` — ESLint flat config
  - Config: `admin/vite.config.ts` — Vite 构建配置

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` 零错误
  - [ ] `npm run lint` 零新增错误
  - [ ] `npm run build` 构建成功
  - [ ] React 版本未变
  - [ ] 无新增 dependencies

  **QA Scenarios**:
  ```
  Scenario: 完整构建
    Tool: Bash
    Steps: cd admin && npm run build 2>&1 | tail -5
    Expected: 输出包含 "build" 成功标识，exit code 0
    Evidence: .sisyphus/evidence/task-13-build.txt

  Scenario: TypeScript 检查
    Tool: Bash
    Steps: cd admin && npx tsc --noEmit 2>&1 | tail -10
    Expected: 无 error 输出
    Evidence: .sisyphus/evidence/task-13-tsc.txt
  ```

  **Commit**: YES | Message: `chore(merchant): verify build and lint pass` | Files: 仅修复文件（如有）

## Final Verification Wave (4 parallel agents, ALL must APPROVE)

- [x] F1. **Plan Compliance Audit** — oracle
  - Verify all 38 issues from review report are addressed
  - Cross-reference each P0/P1 issue with task acceptance criteria
  - Evidence: `.sisyphus/evidence/f1-compliance.md`

- [x] F2. **Code Quality Review** — unspecified-high
  - `cd admin && npx tsc --noEmit` → 0 errors
  - `cd admin && npm run lint` → 0 errors
  - No `any` type without justification comment
  - No `as any` type assertions
  - Evidence: `.sisyphus/evidence/f2-quality.txt`

- [x] F3. **Manual QA** — unspecified-high
  - Test full flow: Entry → Login → Dashboard → Logout → Entry
  - Test: Entry → Register → 4 steps → Submit
  - Test: Refresh during registration → draft restored
  - Test: Unauthenticated `/merchant/dashboard` → redirect without flash
  - Evidence: `.sisyphus/evidence/f3-qa.md`

- [x] F4. **Scope Fidelity Check** — deep
  - Verify NO files outside `admin/src/` were modified
  - Verify `admin/src/stores/authStore.ts` (admin auth) unchanged
  - Verify `package.json` React version still 18.3.1
  - Verify no new dependencies added
  - Evidence: `.sisyphus/evidence/f4-scope.txt`

## Commit Strategy
每个 Wave 完成后提交一次，commit message 格式：
- Wave 1: `feat(merchant): add auth store, route guard, and theme constants`
- Wave 2: `refactor(merchant): integrate auth store into API, router, and layout`
- Wave 3: `fix(merchant): fix login, entry, and apply-status pages`
- Wave 4: `fix(merchant): fix registration and material-shop flows`
- Wave 5: `style(merchant): add responsive design for public pages`
- Wave 6: `chore(merchant): verify build and lint pass`

## Success Criteria
1. 38 个评审问题全部解决或有明确的「预留/不修」标注
2. `npm run build` + `npm run lint` + `tsc --noEmit` 全部通过
3. 已登录商家部署后无感迁移（不被强制登出）
4. 未登录访问受保护页面无闪屏
5. 注册表单草稿可恢复
6. 首页角色卡片正确传参
