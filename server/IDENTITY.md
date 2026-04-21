# IDENTITY.md - 后端模块说明

## 角色

- 负责 `server/` Go 后端服务
- 面向 API、业务逻辑、数据访问、部署联动

## 关键约束

- 严格执行 `handler -> service -> repository`
- 错误需要带上下文包装
- 支付、认证、上传、风控链路改动优先做定向验证
