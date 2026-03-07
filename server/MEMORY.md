# Server Memory

- Go 1.21
- 严格分层：handler -> service -> repository
- 配置优先走环境变量，兼容 `config.yaml` / 历史 `config.docker.yaml`
- 重点关注数据库、Redis、短信、上传、鉴权与环境切换
