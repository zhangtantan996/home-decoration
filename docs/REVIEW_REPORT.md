# 代码审查报告（后端为主）

## 范围与方法
- 范围：后端深度审查；前端仅做刷新/重连/网络错误处理的快速检查（admin + mobile）。
- 方法：静态代码审查 + 关键路径梳理（认证、刷新、WebSocket/Tinode、轮询与重试）。

## 执行摘要
当前后端主体结构清晰，但在令牌刷新/鉴权边界、测试验证码暴露、以及客户端重连/轮询策略方面存在若干风险点。若不修复，可能导致：  
1) 刷新令牌可被当作访问令牌使用、  
2) 非预期的持续重连/轮询导致性能与用户体验问题、  
3) 测试验证码在生产环境误用造成安全漏洞。

以下按严重度排序。

---

## 发现清单（按严重度）

| ID | 严重度 | 标题 | 影响 |
|---|---|---|---|
| F-01 | 高 | Refresh Token 与 Access Token 不区分 | 刷新令牌可访问受保护接口，泄露后风险放大 |
| F-02 | 高 | JWT 中间件未显式校验签名算法 | 存在算法降级/不安全解析的风险 |
| F-03 | 中 | 测试验证码固定且直接返回给客户端 | 生产环境误用将导致账号被轻易接管 |
| F-04 | 中 | Tinode 重连无退避与上限 | 网络异常时持续重连，耗电/耗流量/压服务 |
| F-05 | 低 | Admin 通知轮询无错误反馈与退避 | 离线或后端异常时体验差、日志噪声 |

---

## 详细发现与建议

### F-01（高）Refresh Token 与 Access Token 不区分
**证据**
- `server/internal/service/user_service.go`：`generateToken` 对 access/refresh 使用完全相同的 claims（仅过期时间不同）。
- `server/internal/middleware/middleware.go`：`JWT` 中间件不区分 token 类型，任何带 `userId/userType` 的 token 都可访问受保护接口。

**风险**
刷新令牌通常是长期有效凭证，一旦泄露即可直接访问保护接口，风险高于短期 access token。

**建议**
- 在 JWT claims 中加入 `token_type`（如 `access` / `refresh`）。
- `JWT` 中间件强制只接受 `access`。
- 刷新接口强制只接受 `refresh`，并可配合 `jti` 做 refresh token 轮换/黑名单策略。

---

### F-02（高）JWT 中间件未显式校验签名算法
**证据**
- `server/internal/middleware/middleware.go`：`JWT` 中间件使用 `jwt.Parse`，未检查签名方法类型。

**风险**
若依赖库或配置允许非预期算法（例如 `none` 或非对称算法混用），可能导致令牌绕过验证。

**建议**
- 在 keyFunc 中加入签名方法校验（仅允许 `HMAC`）。
- 统一封装 JWT 解析工具，避免不同位置实现不一致。

---

### F-03（中）测试验证码固定且直接返回给客户端
**证据**
- `server/internal/service/user_service.go`：验证码校验固定为 `123456`（注册/登录）。
- `server/internal/handler/handler.go`：`SendCode` 直接返回测试验证码。

**风险**
若生产环境未关闭该逻辑，任意手机号可被直接登录/注册，存在严重账号安全隐患。

**建议**
- 通过配置区分 `dev`/`prod`，仅在开发环境启用固定验证码与返回码。
- 生产环境接入真实短信服务或关闭验证码登录。

---

### F-04（中）Tinode 重连无退避与上限
**证据**
- `mobile/src/services/TinodeService.ts`：断线后每 3/5 秒重试，失败后继续循环，无退避与上限。

**风险**
网络异常或服务不可用时，客户端会持续重连，导致电量消耗、流量浪费，并放大后端压力。

**建议**
- 使用指数退避（如 3s、6s、12s…上限 60s）并设置最大尝试次数。
- 达到上限后发出事件，让 UI 提示“聊天服务不可用，稍后重试”。

---

### F-05（低）Admin 通知轮询无错误反馈与退避
**证据**
- `admin/src/components/NotificationDropdown.tsx`：轮询失败仅 `console.error`，无用户提示或退避。
- `admin/src/components/MerchantNotificationDropdown.tsx`：同类实现。

**风险**
离线或后端异常时缺少友好提示，且固定轮询可能产生不必要请求。

**建议**
- 失败后提示用户“网络异常”并引导手动重试。
- 结合 `document.visibilityState` 在后台暂停轮询。

---

## 快速修复建议（高优先级）
1) Token 类型区分 + 中间件强制校验（F-01）。  
2) JWT 签名算法显式校验（F-02）。  
3) 测试验证码只在开发环境可用（F-03）。  

## 次优先级修复
4) Tinode 重连退避 + 上限 + UI 反馈（F-04）。  
5) Admin 轮询错误反馈与后台暂停（F-05）。  

---

## 需要确认的实现选择（修复阶段）
- 是否引入 refresh token 的 `jti` 机制与黑名单存储（Redis 或 DB）？
- Tinode 重连是否需要与系统“离线模式”提示联动？

