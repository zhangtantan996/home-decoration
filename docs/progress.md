# 项目开发进度报告

## 已完成事项 (Completed)
- [x] **修复商家财务中心逻辑**：
    - **后端**：
        - 重构 `MerchantIncomeSummary` 和 `MerchantWithdrawCreate` 接口。
        - 修正“可提现金额”计算逻辑：`可提现 = 已结算收入总和 - (处理中 + 成功)提现总和`。
        - 修复了提现时未正确扣除余额的 Bug。
        - 优化 `randomString` 和 `parseInt` 等辅助函数。
- [x] **腾讯云 IM TUIKit 集成**：
    - **后端**：
        - 实现 `SyncUserToIM` 服务，支持异步将平台用户同步至腾讯云 IM。
        - 在用户注册、商家入驻审核通过时自动触发同步。
    - **商家端**：
        - 激活 `MerchantChat` 页面的 TUIKit 组件。
        - 修复 `UIKitProvider` 初始化逻辑（集成 `tim-js-sdk`）。
        - 定制 `tuikit-theme.css`，应用项目主题色（金色 #D4AF37）。
    - **移动端**：
        - 封装 `useTencentIM` Hook 与 `TencentIMService`。
        - 创建 `tuikitTheme.ts` 主题配置。
        - 在 App 启动（`AppNavigator`）时静默初始化 IM，并将 WebSocket 保留为主要/降级通道。
- [x] 优化本地开发启动流程：集成 `concurrently` 实现一键并行启动。
- [x] 创建 `dev_start.ps1`：为 Windows 用户提供一键启动脚本。
- [x] 配置 VS Code Tasks：支持从编辑器直接启动所有服务。
- [x] 修复 Git 追踪问题：解决 `NUL` 文件报错、换行符警告及 `db_data_local` 误追踪。
- [x] 完善部署指南：新增并优化了 `DEPLOYMENT_GUIDE_ZH.md`。

## 进行中事项 (Pending)
- [ ] 验证跨平台启动脚本稳定性。
- [ ] 进一步优化 Docker 构建缓存。

## 已知问题 (Known Issues)
- **商家端构建**：本地 `npm run build` 遇到 `esbuild` 环境相关错误（非代码逻辑问题），建议在纯净 CI/CD 环境或重新安装依赖后验证。