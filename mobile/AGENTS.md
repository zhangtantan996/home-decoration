# AGENTS.md - Mobile Legacy Notes

本文件仅作 `mobile/` 目录的补充说明，**根目录 `AGENTS.md` 才是唯一权威规则**。

## 使用方式

1. 先读根目录 `AGENTS.md`
2. 再读 `docs/Claude开发参考手册.md`
3. 必要时查 `docs/问题解决手册.md`
4. 最后再看 `mobile/` 目录下的实际代码、原生工程和运行脚本

## mobile/ 关注点

- 技术栈固定：React Native 0.83 + React 19.2.0
- 不把 `mobile/` 当成 Web 主交付面
- 优先沿用现有导航、状态管理、原生桥接和接口封装模式
- 改动登录、IM、支付、上传、原生能力时，要先确认平台差异和回归范围

## 说明

- 旧的 repo-local Agent 状态与记忆工作流已移出仓库，不再作为上下文来源
- 需要长期沉淀的共享规则，请写入根目录 `AGENTS.md`、`docs/`、`documentation/` 或 `ops/`
