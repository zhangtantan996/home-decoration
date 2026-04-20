# OpenClaw 本地运行约定

## 目标

`home-decoration` 的 OpenClaw 采用“项目优先”模式：
- 仓库根 `AGENTS.md` 为主规则
- `ops/` 为唯一项目状态源
- `main` 负责协调
- `codex` 负责执行

## 运行前环境变量

至少提供：

```bash
export RIGHTCODE_API_KEY=... 
export TELEGRAM_BOT_TOKEN=...    # 仅在启用 Telegram 时需要
```

## 推荐启动顺序

```bash
openclaw health
node ops/system.mjs
```

如果需要 OpenClaw Telegram 通道：

```bash
export TELEGRAM_BOT_TOKEN=...
openclaw health
```

## 项目工作流

1. 所有任务先进入 `ops/state.yaml`
2. 状态变化同步写入 `ops/events.ndjson`
3. 需要验证时运行 `ops/project.yaml` 中的命名 verify profile
4. 高风险任务先审批再执行

## 禁止事项

- 不要把项目状态写回全局 `~/.openclaw/workspace/MEMORY.md`
- 不要绕过 `ops/` 直接让 Telegram 把任务发给执行器
- 不要在 `openclaw.json` 明文保存模型 key 或 Telegram token
