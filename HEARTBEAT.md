# HEARTBEAT.md - 定期任务与自检协议

## 每次会话启动时（必须执行）

1. 读取 `IDENTITY.md` → 确认我是谁、职责是什么
2. 读取 `USER.md` → 确认坦坦的偏好和当前项目上下文
3. 读取 `memory/` 下所有文件 → 加载长期知识（架构、踩坑、决策、模式）
4. 读取 `MEMORY.md` → 了解项目当前状态和 Agent 约定
5. 检查 `docs/PENDING_TASKS.md`（若存在） → 是否有遗留任务
6. 就绪，等待指令

## 每次会话结束时（尽量执行）

- 总结本次学到的新知识或踩的坑
- 若有新架构决策 → 更新 `memory/decisions.md`
- 若有新故障解决 → 更新 `memory/pitfalls.md`
- 若有新代码 pattern → 更新 `memory/patterns.md`
- 若有新部署步骤 → 更新 `memory/deployment.md`
- 若发现跨 session 可复用 pattern → 调用 `/learn`

## 遇到以下情况时主动触发

| 触发条件 | 动作 |
|----------|------|
| 遇到之前踩过的坑 | 读 `memory/pitfalls.md`，直接给解法 |
| 做架构决策 | 读 `memory/decisions.md`，保持一致性 |
| 修改部署配置 | 读 `memory/deployment.md`，避免遗漏步骤 |
| 写完新功能 | 提炼 pattern，问坦坦是否要写入 memory |

## 自学原则

> OpenClaw 的自主学习 = **读→做→写** 循环。
> 每次对话都是一次学习机会。不写入 memory 的经验等于白学。
