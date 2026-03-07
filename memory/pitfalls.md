# 踩过的坑（Pitfalls）

> 遇到问题先查这里。每次解决新问题后追加。
> 最后更新：2026-03-07

---

## Go 后端

### admin/package.json React 版本用了 `^`
- **坑**：`admin/package.json` 中 React 版本写了 `^18.3.1`，存在被自动升级风险
- **解法**：改为精确版本 `18.3.1`（不带 `^` 或 `~`）
- **参考**：`docs/TROUBLESHOOTING.md`

### Handler 直接操作数据库
- **坑**：违反分层架构，导致业务逻辑散落
- **解法**：Handler 只绑定参数和调 Service，绝对不导入 repository 或 db

### Escrow 余额竞态条件
- **坑**：高并发下多个请求同时通过余额检查再扣款，导致超扣
- **解法**：必须用 `clause.Locking{Strength: "UPDATE"}` 悲观锁 + 事务

### config.yaml vs config.docker.yaml
- **坑**：本地跑和 Docker 跑读不同配置文件，导致环境变量不一致
- **解法**：优先读环境变量，其次 config.docker.yaml，最后 config.yaml

---

## 前端 / 移动端

### mobile web build 已禁用
- **坑**：执行 `npm run web` 会提示 "Web build disabled"
- **解法**：mobile 是 native-only，不要尝试 web 构建

### 微信小程序 openid 不可信任客户端
- **坑**：不能信任前端传来的 openid
- **解法**：后端必须用 code 换 openid（code2session），不接受客户端直传

### mini/ 使用 wx 原生 API 替代 Taro
- **坑**：直接用 `wx.request` 等原生 API 会导致跨平台编译失败
- **解法**：全部使用 Taro 封装的 API（`Taro.request` 等）

---

## 部署

### Docker Compose 文件区分
- `docker-compose.local.yml` → 本地全栈（含 API 热重载 + admin dev）
- `docker-compose.dev-env.yml` → 只起 db + redis
- `deploy/docker-compose.prod.yml` → 生产

混用会导致端口冲突或配置错误。

---

_每次踩新坑，追加到这里。格式：坑 → 解法 → 参考。_
