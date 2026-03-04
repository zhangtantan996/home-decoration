# Task 4: merchantApi.ts 拦截器重构

## 完成内容
- 请求拦截器：改用 `useMerchantAuthStore.getState().getToken()` 获取 token
- 响应拦截器 401 处理：调用 `useMerchantAuthStore.getState().logout()` + 派发 `merchant-auth-expired` 事件
- 移除 `window.location.href` 重定向（由 Task 6 监听事件处理）
- 移除直接 `localStorage.getItem('merchant_token')`
- upload 方法添加 `timeout: 60000`
- `sendCode` 保留 `captchaToken` 可选参数

## 验证
- grep 确认无 `window.location.href` 和直接 localStorage 访问
- lsp_diagnostics 无错误
- 保留了 MerchantApiError、unwrapEnvelope、unwrapData 语义
- 未修改其他文件

## 依赖
- Task 6 将监听 `merchant-auth-expired` 事件并执行路由跳转
