# AGENTS.md - Admin Legacy Notes

本文件仅作 `admin/` 目录的补充说明，**根目录 `AGENTS.md` 才是唯一权威规则**。

## 使用方式

1. 先读根目录 `AGENTS.md`
2. 再读 `docs/Claude开发参考手册.md`
3. 必要时查 `docs/问题解决手册.md`
4. 最后再看 `admin/` 目录下的实际代码、路由、API 封装和构建配置

## admin/ 关注点

- 技术栈固定：React 18.3.1 + Vite + Ant Design 5 + Zustand
- 优先复用现有页面模式、表单模式、表格模式和 API 封装
- 不要引入新的全局状态方案或 UI 框架
- 涉及权限、登录、风控、部署联动时，先回到根目录规则判断影响面

## 说明

- 旧的 repo-local Agent 状态与记忆工作流已移出仓库，不再作为上下文来源
- 需要长期沉淀的共享规则，请写入根目录 `AGENTS.md`、`docs/`、`documentation/` 或 `ops/`
