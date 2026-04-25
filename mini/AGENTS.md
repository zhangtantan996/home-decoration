# AGENTS.md - Mini Legacy Notes

本文件仅作 `mini/` 目录的补充说明，**根目录 `AGENTS.md` 才是唯一权威规则**。

## 使用方式

1. 先读根目录 `AGENTS.md`
2. 再读 `docs/CODEX_WORKFLOW.md`
3. 必要时查 `docs/CLAUDE_DEV_GUIDE.md` 与 `docs/TROUBLESHOOTING.md`
4. 最后再看 `mini/` 目录下的实际代码、配置与构建脚本

## mini/ 关注点

- 技术栈固定：Taro 3.x + React 18.3.1
- 仅面向微信小程序交付，遵守平台限制
- API 请求统一走现有封装，不引入绕过层
- 不升级 Taro 主版本，不引入与现有模式冲突的新状态管理

## 说明

- 旧的 repo-local Agent 状态与记忆工作流已移出仓库，不再作为上下文来源
- 需要长期沉淀的共享规则，请写入根目录 `AGENTS.md`、`docs/`、`documentation/`
