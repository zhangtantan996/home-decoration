# Home Decoration Mini Program (Taro + React)

## Quick start
1. 使用 Node.js 20+，进入 `mini/` 目录执行依赖安装：
   ```bash
   npm install
   ```
2. 确认后端已配置微信小程序 AppID/Secret，并启动 API (`/api/v1` 可访问)。
3. 本地开发：
   ```bash
   npm run dev:weapp
   ```
   将生成的 `dist/` 目录导入微信开发者工具（填入实际小程序 AppID）。

## 环境变量
- `TARO_APP_API_BASE`：API 基地址，dev 默认 `http://localhost:8080/api/v1`。
- 微信后台需开启获取手机号能力，前端登录流程使用：
  - `POST /auth/wechat/mini/login`（wx.login code）
  - `POST /auth/wechat/mini/bind-phone`（bindToken + wx.getPhoneNumber code）

## 目录要点
- `src/pages/*`：5 个 Tab 壳子（首页/灵感/进度/消息/我的）
- `src/services/auth.ts`：微信登录/绑定 API 封装
- `src/utils/request.ts`：Taro.request 包装，内置 refresh token 逻辑
- `src/store/auth.ts`：Zustand 持久化存储 token + 用户信息
- `src/theme/*`：品牌色、圆角、基础样式

后续可按 `docs/WECHAT_MINIPROGRAM_DEV_PLAN.md` 逐步填充业务页面与 IM/支付。
