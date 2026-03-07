# HEARTBEAT.md - 定期任务与自检协议

## 已安装 Skills（ClawHub）

| Skill | 版本 | 用途 |
|-------|------|------|
| `skills/playwright-mcp` | 1.0.0 | 浏览器自动化：读 X 帖子、网页抓取 |
| `skills/self-improving` | 1.2.9 | 自我反思 + 永久学习，每次完成工作后运行 |
| `skills/x-twitter` | 2.3.1 | 读/搜/发 X 帖子 |
| `skills/agent-memory` | 1.0.0 | 跨 session 持久记忆，记录事实和经验 |

## 每次会话启动时（必须执行）

1. 读取 `IDENTITY.md` → 确认我是谁、职责是什么
2. 读取 `USER.md` → 确认坦坦的偏好和当前项目上下文
3. 读取 `memory/` 下所有文件 → 加载长期知识（架构、踩坑、决策、模式）
4. 读取 `MEMORY.md` → 了解项目当前状态和 Agent 约定
5. 执行 `skills/self-improving`（启动前自我校准）
6. 检查 `docs/PENDING_TASKS.md`（若存在） → 是否有遗留任务
7. 就绪，等待指令

## 每次会话结束时（尽量执行）

- 执行 `skills/self-improving`（自我反思，提取本次学习）
- 若有新架构决策 → 更新 `memory/decisions.md`
- 若有新故障解决 → 更新 `memory/pitfalls.md`
- 若有新代码 pattern → 更新 `memory/patterns.md`
- 若有新部署步骤 → 更新 `memory/deployment.md`
- 用 `skills/agent-memory` 记录关键经验

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
