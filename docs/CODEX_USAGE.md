# Home Decoration 的 Codex 使用规范

这份文档给团队成员看，解释如何在这个仓库里正确使用 Codex。

给 Codex 直接执行的仓库级硬规则在根目录 `AGENTS.md`。两者分工如下：
- `AGENTS.md`：短、硬、可执行，给 agent 直接读
- `docs/CODEX_USAGE.md`：解释为什么这样做，以及团队应该如何提任务、审结果、沉淀流程

## 1. 先分清你在让 Codex 做什么
本仓库默认把任务分成三类：

### Read / Investigate
适用场景：
- 读代码
- 查现状
- 排查报错
- 评估方案

典型例子：
- 查 `merchant/` 入驻流程为什么缺少必填校验
- 分析 `server/` 某个 handler 为什么返回 500
- 判断 `playwright.config.ts` 的 `baseURL` 现在对应哪个前端

要求：
- 先读必要文档和目标文件
- 不修改代码
- 给出现状、风险和建议下一步

### Direct Fix
适用场景：
- 单点 bug
- 中小范围修复
- 目标明确、边界清楚

典型例子：
- 修 `admin/` 一个表单字段校验
- 修 `server/internal/service` 某个业务分支
- 修 `web/` 某个接口参数名错误

要求：
- 快速收敛上下文
- 直接改
- 跑最小必要验证
- 汇报改动和残余风险

### Structured Change
适用场景：
- 跨文件或跨端改动
- 路由、schema、部署、配置变更
- 需求仍有歧义
- 会影响多个模块的协作边界

典型例子：
- 新增一个 `server` 接口并联动 `admin` 页面
- 调整 `merchant` 入驻规则并同步 E2E
- 变更部署配置或新增迁移脚本

要求：
1. 先读 source-of-truth 文档
2. 先 plan，再动代码
3. 明确目标、范围、不改什么
4. 改完后说明验证覆盖到哪里

## 2. 在这个 monorepo 里，prompt 要怎么写
对这个仓库最有效的 prompt 结构还是四段，但要说得足够具体：

- `Goal`：要改什么，落在哪个端或哪个目录
- `Context`：相关文件、报错、接口、页面、脚本、已有实现
- `Constraints`：架构限制、版本限制、不能改的范围
- `Done when`：什么结果算完成，至少要跑什么验证

推荐模板：

```md
Goal
- 修复 `admin/` 用户列表页筛选条件丢失的问题

Context
- 页面在 `admin/src/pages/...`
- 请求走 `admin/src/services/api.ts`
- 复现方式：切换分页后筛选条件被清空
- 参考：同模块另一个列表页的筛选保留逻辑

Constraints
- 不改后端接口
- 不引入新依赖
- 保持 Ant Design 和 Zustand 现有模式

Done when
- 分页切换后筛选条件仍保留
- 相关页面能通过最小必要验证
- 汇报明确写出实际跑过哪些检查
```

### 这个仓库里最常漏掉的上下文
- 没说清楚是 `admin`、`merchant`、`web`、`mobile`、`mini` 还是 `server`
- 没说是否允许改后端 / 改接口 / 改 schema
- 没给复现步骤
- 没说 `Done when`
- 没说明是一次性调查还是直接修复

## 3. 什么时候必须先 plan
以下情况不要直接让 Codex 开写：
- 涉及多个模块或多个端
- 需求本身还有歧义
- 会动路由、schema、部署、权限或公共组件
- 你已经预期会补测试、改脚本或处理回归
- 你不确定应该改哪一层

在这个仓库，下面这些任务默认按 `Structured Change` 处理：
- `handler -> service -> repository` 跨层调整
- Playwright/E2E 失败且根因不明
- `merchant` / `web` / `admin` 联动同一个后端行为
- Docker、Nginx、env、build 脚本改动

## 4. Codex 在这个仓库里不只是写代码
默认期望是：
- 改代码
- 补或改必要测试
- 跑相关验证
- 说明哪些没有验证
- 对 diff 做基本回归检查

### 最小验证原则
先跑最小有意义的，不要一上来全量：

- `server/`：优先跑目标 package 的 `go test`
- `admin/`：优先跑相关 build / lint / targeted check
- `merchant/`：优先跑本端 build
- `mobile/`：优先跑 lint 或目标 test
- `mini/`：优先跑 lint / build:weapp
- 跨端行为改动：按影响面追加更高层验证

### 这个仓库里的验证坑
- 根 `npm run dev` 启的是 `server + admin + merchant`，不是所有前端
- 用户侧 web 走的是 `npm run dev:user-web`
- 默认 `playwright.config.ts` 的 `baseURL` 不是所有场景都对，跑前必须确认当前要测的是哪个应用
- 历史文档和当前 manifest 可能有差异，验证时要以当前可执行配置为准，并在总结里指出不一致

## 5. MCP 在这个仓库里怎么用
当前根目录 `.mcp.json` 只配置了两个 MCP server：
- `playwright`
- `memory`

### 适合用 `playwright` 的情况
- 需要真实浏览器复现问题
- 需要看 DOM、表单、路由跳转、截图
- 需要确认页面是否真的按预期渲染
- 需要验证前端行为而不是只看源码

### 适合用 `memory` 的情况
- 需要保存跨轮次、跨任务的长期上下文
- 需要记录稳定结论、重复问题、约定俗成流程

### 不要滥用 MCP
- repo 里已经有答案时，不要先上 MCP
- 不要为了“看起来高级”把所有外部系统都接进来
- 当前没有反复出现的信息搬运痛点时，不要新增 MCP server

## 6. 什么时候把流程沉淀成 skill
这个仓库已经有 repo-local skills：
- `skills/agent-memory/SKILL.md`
- `skills/playwright-mcp/SKILL.md`
- `skills/self-improving/SKILL.md`
- `skills/x-twitter/SKILL.md`

适合新增 skill 的条件：
- 同一类流程已经重复 2 到 3 次以上
- 步骤稳定
- 输入输出边界清楚
- 不是一次性排障

适合在本仓库沉淀为 skill 的例子：
- Playwright UI 排障固定流程
- merchant 入驻类问题的标准排查
- identity acceptance 报告整理
- 某类 release / smoke 检查总结

不适合做成 skill 的情况：
- 一次性故障
- 需求仍频繁变化
- 每次都需要大量人工判断

## 7. 什么时候再上 automation
automation 解决的是“调度”，不是“方法”。

先问自己两件事：
1. 手动跑这个流程已经稳定了吗？
2. 结果输出格式已经固定了吗？

如果答案不是“是”，先不要自动化。

在这个仓库，未来适合自动化的候选项包括：
- 周期性整理 `test:identity:acceptance:report`
- 固定频率检查某组 Playwright smoke
- 汇总最近 commit 生成变更摘要
- 巡检 CI / 构建失败并给出初步归因

不适合立刻自动化的情况：
- 还在频繁改 prompt 才能跑通
- 结果经常需要人工重写
- 涉及大范围代码修改但回归边界还不稳定

## 8. 线程、session 和 worktree
在这个仓库里，推荐按下面做：

### 一个线程只做一个明确任务
适合：
- 一个 bug
- 一个 feature
- 一次调查

不要把完全不同的问题堆进同一个超长线程。

### 真分叉再 fork
适合 fork 的情况：
- 两个独立方案要并行比较
- 一个线程主做实现，另一个只做排查或验证
- 有边界清楚的独立子问题

### 多个 live 线程不要同时改同一批文件
如果必须并行：
- 用 worktree 隔离
- 或者明确串行处理

否则非常容易互相覆盖修改。

## 9. 当前仓库里最常见的错误用法
- 不说清楚要改哪个应用端
- 复杂任务不先 plan
- 让旧的子目录 `AGENTS.md` 覆盖根级工程规则
- 直接套默认 Playwright `baseURL`
- 只让 Codex 生成代码，不要求验证和回归检查
- 流程还没稳定就急着做 automation
- 把历史 troubleshooting 记录当成当前 manifest 的替代品

## 10. 三个可直接复用的任务写法
### 例 1：小型前端修复
```md
修复 `admin/` 某列表页筛选条件翻页后丢失的问题。

相关文件先从 `admin/src/pages` 和 `admin/src/services/api.ts` 查起。
不要改后端接口，不要加依赖。
完成标准：行为修复，最小必要验证已执行，并说明验证范围。
```

### 例 2：后端 service 层修复
```md
排查并修复 `server/internal/service` 中订单状态流转错误。

先确认问题是在 handler、service 还是 repository。
必须保持 `handler -> service -> repository` 分层，不要在 handler 里直接做数据库逻辑。
完成标准：修复根因，补充或更新相关 Go 测试，并说明实际跑过的测试。
```

### 例 3：跨端结构化改动
```md
需要新增一个 merchant 侧资料补全字段，并同步后端保存逻辑与回归验证。

请先做计划，明确会改哪些层、哪些文件、哪些不改。
约束：不改无关页面，不引入新依赖，保持 React 18 + Ant Design 5 + Zustand 模式。
完成标准：前后端联动完成，最小必要验证已跑，并说明剩余风险。
```

## 11. 最后原则
这套规范的目标不是把 Codex 变成“回答问题的聊天助手”，而是把它稳定接进真实工程流程。

判断一条规范是否有价值，只看三件事：
- 能不能减少 agent 乱猜
- 能不能减少返工
- 能不能让结果更容易验证
