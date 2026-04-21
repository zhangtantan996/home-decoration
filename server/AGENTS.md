# AGENTS.md - Server Legacy Notes

本文件仅作 `server/` 目录的补充说明，**根目录 `AGENTS.md` 才是唯一权威规则**。

## 使用方式

1. 先读根目录 `AGENTS.md`
2. 再读 `docs/Claude开发参考手册.md`
3. 必要时查 `docs/问题解决手册.md`
4. 最后再看 `server/` 目录下的实际代码、迁移、配置与测试

## server/ 关注点

- 严格遵守 `handler -> service -> repository` 分层
- 数据库 schema 以 `server/migrations/` 和可执行脚本为准
- 不在请求路径中 `panic`
- 支付、风控、认证、上传、部署相关改动要优先做最小验证

## 说明

- 旧的 repo-local Agent 状态与记忆工作流已移出仓库，不再作为上下文来源
- 需要长期沉淀的共享规则，请写入根目录 `AGENTS.md`、`docs/`、`documentation/` 或 `ops/`
