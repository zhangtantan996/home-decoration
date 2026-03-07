# Home Decoration 项目记忆

这是 `home-decoration` 项目的长期记忆入口。

## 当前技术结构

- `server/`：Go 后端，Gin + GORM，严格分层。
- `admin/`：React + Vite + Ant Design 管理后台。
- `mobile/`：React Native App。
- `mini/`：Taro 小程序。
- `deploy/`：Docker / Nginx / 生产部署。
- `tests/e2e/`：Playwright 测试。

## 当前多 Agent 约定

- `婷婷（总控）`：编排与汇总。
- `洞察（只读分析）`：只读分析。
- `后端工匠（Server）`：后端实现。
- `管理台匠人（Admin）`：管理后台实现。
- `小程序工匠（Mini）`：小程序实现。
- `移动端工匠（Mobile）`：移动端实现。
- `质检员（QA）`：验证与验收。
