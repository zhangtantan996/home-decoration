# 商家中心登录/注册全链路评审报告与修复计划

## TL;DR
> **Summary**: 对商家中心「首页(MerchantEntry) → 登录(MerchantLogin) → 注册(MerchantRegister/MaterialShopRegister) → 审核状态(MerchantApplyStatus)」全链路进行 UI/交互/业务逻辑评审，共发现 **38 个问题**，按严重程度分为 P0(必修) / P1(重要) / P2(改进)。
> **涉及文件**: 8 个核心文件
> **Effort**: Large
> **Parallel**: YES - 5 waves

## 评审范围

| 文件 | 路径 | 角色 |
|------|------|------|
| MerchantEntry.tsx | `admin/src/pages/merchant/` | 商家中心首页，角色选择入口 |
| MerchantLogin.tsx | `admin/src/pages/merchant/` | 短信验证码登录 |
| MerchantRegister.tsx | `admin/src/pages/merchant/` | 设计师/工长/公司 4步注册向导 |
| MaterialShopRegister.tsx | `admin/src/pages/merchant/` | 建材商注册 2步向导 |
| MerchantApplyStatus.tsx | `admin/src/pages/merchant/` | 审核进度查询 |
| MerchantLayout.tsx | `admin/src/layouts/` | 认证后布局（侧边栏+头部） |
| merchant-router.tsx | `admin/src/` | 路由配置 |
| merchantApi.ts | `admin/src/services/` | API 服务层 |

---

## 一、UI 显示问题 (12 个)

### 【P0-UI-1】品牌视觉不一致 — 首页与登录页配色冲突
- **现状**: MerchantEntry 背景渐变 `#667eea→#764ba2`（紫色），MerchantLogin 背景渐变 `#1890ff→#096dd9`（蓝色），视觉割裂严重
- **位置**: `MerchantEntry.tsx` background / `MerchantLogin.tsx` background
- **方案**: 统一为同一组品牌色，建议提取到 `admin/src/styles/merchantTheme.ts` 作为主题常量，所有商家端页面引用

### 【P1-UI-2】登录卡片固定宽度，移动端不可用
- **现状**: MerchantLogin 登录卡片 `width: 420px` 硬编码，小屏设备溢出
- **位置**: `MerchantLogin.tsx` Card style
- **方案**: 改为 `width: '100%', maxWidth: 420, margin: '0 auto'`，外层容器加 `padding: '0 16px'`

### 【P1-UI-3】首页角色卡片高度固定，小屏裁剪
- **现状**: MerchantTypeCard 高度 `height: 200px` 固定，内容在小屏被裁切
- **位置**: `MerchantEntry.tsx` Card style
- **方案**: 改为 `minHeight: 200` 并加 `overflow: visible`

### 【P1-UI-4】注册页无响应式布局
- **现状**: MerchantRegister 使用 `Form layout='vertical'`，步骤条和表单在窄屏下无适配
- **位置**: `MerchantRegister.tsx` 整体布局
- **方案**: 步骤条加 `direction={isMobile ? 'vertical' : 'horizontal'}`；表单容器加 `maxWidth: 800` 居中

### 【P1-UI-5】角色卡片无角色说明
- **现状**: 4 张角色卡片（设计师/工长/装修公司/建材商）只有标题和图标，无入驻条件、权益说明
- **位置**: `MerchantEntry.tsx` MerchantTypeCard 组件
- **方案**: 每张卡片增加 2-3 行说明文案（如「需提供设计资质证书，享受平台接单、案例展示」），数据配置化

### 【P1-UI-6】建材商注册商品参数要求用户输入 JSON
- **现状**: MaterialShopRegister 商品参数 `paramsText` 字段默认 `'{}'`，期望用户手写 JSON 格式
- **位置**: `MaterialShopRegister.tsx` step 1 产品表单
- **方案**: 替换为动态键值对表单（Add Key/Value 按钮），内部序列化为 JSON 提交

### 【P1-UI-7】建材商默认展示 5 个空产品表单
- **现状**: 初始化 5 个空白产品条目，页面臃肿
- **位置**: `MaterialShopRegister.tsx` 产品列表初始化
- **方案**: 默认展示 1 个空产品 + "添加产品"按钮，最多支持 10 个

### 【P2-UI-8】建材商 entityType 字段禁用但可见
- **现状**: `entityType` 字段显示为 disabled 但写死 company，用户困惑为何不可选
- **位置**: `MaterialShopRegister.tsx` step 0
- **方案**: 隐藏该字段或改为纯文本提示「建材商仅支持企业入驻」

### 【P2-UI-9】注册表单毕业院校/设计理念对非设计师角色显示
- **现状**: `graduateSchool` / `designPhilosophy` 对所有角色（包括公司/工长）都显示
- **位置**: `MerchantRegister.tsx` step 0
- **方案**: 条件渲染 `{role === 'designer' && <Form.Item .../>}`

### 【P2-UI-10】案例图片数量限制因角色不同但 UI 未明确提示
- **现状**: 设计师需 ≥3 张，工长 ≥1 张，公司 ≥5 张，但上传组件未显示各角色要求
- **位置**: `MerchantRegister.tsx` step 2
- **方案**: Upload 组件上方加文案 `至少上传 {min} 张案例图片（{role}角色要求）`

### 【P2-UI-11】审核状态页缺少自动刷新
- **现状**: 用户查看 pending 状态后无法自动更新
- **位置**: `MerchantApplyStatus.tsx`
- **方案**: pending 状态下加 30s 轮询 + 手动"刷新"按钮

### 【P2-UI-12】建材商注册无商品删除功能
- **现状**: 产品表单无删除按钮，添加后无法移除
- **位置**: `MaterialShopRegister.tsx` 产品列表
- **方案**: 每个产品卡片右上角加删除按钮（至少保留 1 个）

---

## 二、交互体验问题 (12 个)

### 【P0-IX-1】首页角色卡片点击未关联角色
- **现状**: 4 张卡片的 onClick 都调用同一个 `openApplyFlow()`，不传角色参数。用户点了"设计师"卡片但弹窗未预选设计师
- **位置**: `MerchantEntry.tsx` MerchantTypeCard onClick
- **方案**: `openApplyFlow(role: string)` 接收角色参数，弹窗中 `setRole(role)` 预选对应选项

### 【P0-IX-2】注册多步表单无草稿保存，刷新丢失全部数据
- **现状**: MerchantRegister 4 步长表单（涉及大量上传）无任何持久化。用户在 step 3 上传完案例后刷新浏览器 → 全部丢失
- **位置**: `MerchantRegister.tsx` 整体
- **方案**:
  1. 每步切换时将 Form values 持久化到 `localStorage`（key=`merchant_register_draft_{phone}`）
  2. 页面加载时检测草稿 → 提示「检测到未完成的入驻申请，是否继续？」
  3. 提交成功后清除草稿

### 【P0-IX-3】注册提交前无确认对话框
- **现状**: Step 3 "提交" 直接发送 API 请求，无二次确认
- **位置**: `MerchantRegister.tsx` handleSubmit
- **方案**: 提交前 `Modal.confirm({ title: '确认提交入驻申请？', content: '提交后将进入审核流程，请确认信息填写完整。' })`

### 【P1-IX-4】登录表单验证过于激进
- **现状**: `validateTrigger=['onBlur','onChange']`，用户每输入一个字符都触发校验，频繁弹出错误提示
- **位置**: `MerchantLogin.tsx` Form.Item
- **方案**: 手机号改为 `validateTrigger='onBlur'`，验证码保持 `onChange`（因为固定 6 位可做即时校验）

### 【P1-IX-5】登录成功引导动画使用硬编码延迟
- **现状**: `handleLoginGuide` 使用 `window.setTimeout(1200)` 做页面跳转延迟，网络慢时可能跳转时用户还在看 loading
- **位置**: `MerchantLogin.tsx` handleLoginGuide
- **方案**: 使用 `message.success` 的 `onClose` 回调触发跳转，不依赖固定时间

### 【P1-IX-6】审核状态页自动查询无用户感知
- **现状**: URL 带 phone 参数时自动发起查询，无 loading 提示
- **位置**: `MerchantApplyStatus.tsx` useEffect
- **方案**: 自动查询时显示 Spin loading + 「正在查询您的审核进度...」

### 【P1-IX-7】审核状态页「重新提交」参数映射可能出错
- **现状**: 重新提交按钮拼接 URL query，applicantType → role 映射通过硬编码对象进行，缺少容错
- **位置**: `MerchantApplyStatus.tsx` 重新提交按钮
- **方案**: 增加 fallback 处理，映射失败时默认跳到 `/` 首页让用户重新选择角色

### 【P1-IX-8】注册表单案例 area 字段未联动城区下拉
- **现状**: 案例的「区域」是自由文本 Input，但注册表单中已经有 areaOptions 数据
- **位置**: `MerchantRegister.tsx` step 2 案例表单
- **方案**: 改为 Select 组件，复用 areaOptions 数据源

### 【P2-IX-9】验证码倒计时组件卸载未清理
- **现状**: countdown 使用 `setInterval`，组件卸载时未清除定时器（内存泄漏）
- **位置**: `MerchantLogin.tsx` sendCode 相关
- **方案**: 使用 `useEffect` 管理 interval 生命周期，返回 cleanup 函数

### 【P2-IX-10】建材商注册无商品图片预览和排序
- **现状**: 商品图片上传后无预览、无拖拽排序
- **位置**: `MaterialShopRegister.tsx` Upload 组件
- **方案**: 使用 Ant Design Upload 的 `listType="picture-card"` + `onPreview` + 可选 `dnd-kit` 排序

### 【P2-IX-11】登录页底部「我要入驻」跳回首页逻辑冗余
- **现状**: 登录页底部「我要入驻」链接跳转到 `/`（首页），但用户可能从首页来的，形成循环
- **位置**: `MerchantLogin.tsx` 底部链接
- **方案**: 改为直接展示角色选择弹窗或跳到 `/register` 并带上默认角色参数

### 【P2-IX-12】注册 resubmitId 存在但不回填历史数据
- **现状**: URL 中传入 `resubmitId` 后表单是空白的，用户需全部重填
- **位置**: `MerchantRegister.tsx` URL params
- **方案**: 检测 `resubmitId` 时调用 API 拉取上次申请数据，回填表单

---

## 三、业务逻辑与安全问题 (14 个)

### 【P0-BIZ-1】无商家认证状态中心化管理（最严重）
- **现状**: 商家端 token 直接操作 `localStorage`（`merchant_token`、`merchant_provider`），散落在 MerchantLogin、merchantApi 拦截器、MerchantLayout 中。无 Zustand store，无统一的登录态管理
- **位置**: 全局
- **方案**:
  1. 创建 `admin/src/stores/merchantAuthStore.ts`（Zustand + localStorage persist）
  2. 统一管理: `token`, `provider`, `isAuthenticated`, `login()`, `logout()`, `checkAuth()`
  3. 所有组件通过 store 读写，不再直接操作 localStorage

### 【P0-BIZ-2】路由无鉴权守卫
- **现状**: `merchant-router.tsx` 中受保护路由仅由 MerchantLayout 的 `useEffect` 做 localStorage 检查跳转，存在闪屏（先渲染再跳走）
- **位置**: `merchant-router.tsx` + `MerchantLayout.tsx`
- **方案**:
  1. 创建 `MerchantAuthGuard` 组件，包裹受保护路由
  2. Guard 内检查 merchantAuthStore.isAuthenticated
  3. 未认证 → 立即 `<Navigate to="/merchant/login" />`，不渲染子组件
  4. 认证中 → 显示全屏 Spin

### 【P0-BIZ-3】MerchantLayout 认证检查不安全
- **现状**: `JSON.parse(localStorage.getItem('merchant_provider'))` — 如果值被篡改为非法 JSON，直接 crash（白屏）
- **位置**: `MerchantLayout.tsx` useEffect
- **方案**: try-catch 包裹 JSON.parse，失败时清除 localStorage 并跳转登录页。更好方案见 P0-BIZ-1

### 【P0-BIZ-4】401 响应处理导致 SPA 状态丢失
- **现状**: merchantApi 拦截器遇到 401 后执行 `window.location.href = '/merchant/login'`（硬刷新），丢失所有 SPA 内存状态
- **位置**: `merchantApi.ts` response interceptor
- **方案**: 改为 `merchantAuthStore.getState().logout()` → React Router navigate（SPA 内跳转）

### 【P0-BIZ-5】无 Token 刷新机制
- **现状**: Token 过期直接 401 → 跳登录。用户正在填写复杂表单时突然被踢出
- **位置**: `merchantApi.ts`
- **方案**:
  1. 后端提供 refresh token 接口
  2. 前端 401 拦截器先尝试 refresh，成功后重放原请求
  3. refresh 也失败才跳登录
  4. 结合 P0-IX-2 草稿保存，确保用户数据不丢

### 【P0-BIZ-6】DEV 模式泄露验证码
- **现状**: `MerchantLogin.tsx` 发送验证码成功后 `message.success(debugCode)` 将验证码直接展示
- **位置**: `MerchantLogin.tsx` sendCode 成功回调
- **方案**: 仅在 `import.meta.env.DEV` 且非生产构建时用 `console.debug` 输出，不使用 `message.success`。生产打包时通过 Vite define 移除

### 【P1-BIZ-7】验证码无频率限制防护
- **现状**: 前端仅 60s 倒计时，无图形验证码/滑块验证。恶意用户可绕过前端直接调用 API 轰炸短信
- **位置**: `MerchantLogin.tsx` / `merchantApi.ts` sendCode
- **方案**:
  1. 前端：发送前增加图形验证码或滑块验证（推荐腾讯云天御/阿里云验证）
  2. 后端：IP 级别限流 + 手机号级别限流（同号 60s 内不可重发，单 IP 每小时 ≤20 次）

### 【P1-BIZ-8】Token 存储 XSS 风险
- **现状**: `merchant_token` 明文存在 localStorage，任何 XSS 漏洞可直接窃取
- **位置**: 全局 localStorage 操作
- **方案**:
  1. 短期：确保 CSP header 严格、所有输入做 XSS 过滤
  2. 中期：Token 改为 HttpOnly Cookie 方式，前端不直接访问
  3. 长期：实现 BFF 层管理 session

### 【P1-BIZ-9】handleLogout 无服务端失效
- **现状**: 退出仅清除 localStorage，服务端 token 仍有效（可被重放）
- **位置**: `MerchantLayout.tsx` handleLogout
- **方案**: 调用后端 `/api/merchant/logout` 接口使 token 失效，再清除本地状态

### 【P1-BIZ-10】注册 SMS code 过期风险
- **现状**: Step 0 发送验证码，用户填完 4 步表单后提交（可能已过去 10+ 分钟），验证码早已过期
- **位置**: `MerchantRegister.tsx`
- **方案**:
  1. 提交前检查验证码发送时间，如超过 5 分钟提示重新获取
  2. 或后端 register 接口不依赖 SMS code（改为 token 机制：发送验证码成功后返回一个有效期较长的 phoneVerifyToken）

### 【P1-BIZ-11】API 响应信封双层解包
- **现状**: `unwrapEnvelope` 存在 `payload.data?.code` 的双层解包逻辑，暗示后端响应格式不一致
- **位置**: `merchantApi.ts` unwrapEnvelope
- **方案**: 与后端统一响应格式 `{ code: number, message: string, data: T }`，移除兼容代码

### 【P1-BIZ-12】上传接口超时设置不足
- **现状**: merchantApi 全局 `timeout: 10000`（10 秒），大文件/多图上传极易超时
- **位置**: `merchantApi.ts` axios instance
- **方案**: 上传接口单独设 `timeout: 60000`（60 秒），或上传请求用独立 axios 实例

### 【P2-BIZ-13】路由无 404 兜底
- **现状**: 访问 `/merchant/random-path` 无匹配路由，白屏
- **位置**: `merchant-router.tsx`
- **方案**: 添加 `{ path: '*', element: <Navigate to="/merchant" /> }` 或 404 页面

### 【P2-BIZ-14】城市区域数据硬编码
- **现状**: `regionApi.getChildren('610100')` 硬编码西安市行政区划代码
- **位置**: `MerchantRegister.tsx` loadAreaOptions
- **方案**: 改为动态获取，先选城市再加载区域。或从配置中读取默认城市 code

---

## 四、问题优先级总览

| 优先级 | 数量 | 关键问题 |
|--------|------|----------|
| **P0 (必修)** | 8 | 无认证中心、路由无守卫、认证 crash 风险、401 硬刷新、无 token 刷新、DEV 泄码、角色卡片未关联、注册无草稿 |
| **P1 (重要)** | 18 | 验证码防护、XSS 风险、响应式缺失、表单验证策略、SMS 过期、logout 无服务端失效等 |
| **P2 (改进)** | 12 | 404 兜底、硬编码城市、图片排序、自动刷新等 |

## 五、修复执行策略

### Wave 1: 基础设施（必须先完成）
| 任务 | 类型 | 文件 |
|------|------|------|
| 创建 merchantAuthStore | P0-BIZ-1 | 新建 `stores/merchantAuthStore.ts` |
| 创建 MerchantAuthGuard | P0-BIZ-2 | 新建 `components/MerchantAuthGuard.tsx` |
| 统一品牌主题 | P0-UI-1 | 新建 `styles/merchantTheme.ts` |

### Wave 2: 登录流程修复
| 任务 | 类型 | 文件 |
|------|------|------|
| 登录页接入 authStore + 修复泄码 | P0-BIZ-6, P0-BIZ-4 | `MerchantLogin.tsx` |
| merchantApi 接入 store + 上传超时 | P0-BIZ-4, P1-BIZ-12 | `merchantApi.ts` |
| MerchantLayout 接入 store + 安全退出 | P0-BIZ-3, P1-BIZ-9 | `MerchantLayout.tsx` |
| 路由接入 AuthGuard + 404 | P0-BIZ-2, P2-BIZ-13 | `merchant-router.tsx` |

### Wave 3: 注册流程修复
| 任务 | 类型 | 文件 |
|------|------|------|
| 注册草稿保存 + 提交确认 | P0-IX-2, P0-IX-3 | `MerchantRegister.tsx` |
| 首页角色预选 + 卡片说明 | P0-IX-1, P1-UI-5 | `MerchantEntry.tsx` |
| 条件渲染字段 + 案例区域联动 | P2-UI-9, P1-IX-8 | `MerchantRegister.tsx` |

### Wave 4: 建材商 + 审核状态
| 任务 | 类型 | 文件 |
|------|------|------|
| 商品参数改造 + 删除功能 | P1-UI-6, P2-UI-12 | `MaterialShopRegister.tsx` |
| 审核状态轮询 + 重提交容错 | P2-UI-11, P1-IX-7 | `MerchantApplyStatus.tsx` |

### Wave 5: 响应式 + 体验优化
| 任务 | 类型 | 文件 |
|------|------|------|
| 全局响应式适配 | P1-UI-2,3,4 | 多文件 |
| 验证码频率防护 | P1-BIZ-7 | `MerchantLogin.tsx` + 后端 |
| Token 刷新机制 | P0-BIZ-5 | `merchantApi.ts` + 后端 |

## 六、Definition of Done
- [ ] 所有 P0 问题修复完成
- [ ] 商家端有统一的 merchantAuthStore，不再直接操作 localStorage
- [ ] 路由守卫生效，未登录访问受保护页面立即跳转
- [ ] 注册表单草稿持久化，刷新不丢数据
- [ ] DEV 模式不再通过 UI 展示验证码
- [ ] `npm run build` 无 TypeScript 错误
- [ ] 所有页面在 375px~1440px 宽度下正常显示
