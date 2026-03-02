# 阿里云部署指南 (Aliyun Deployment Guide)

本指南针对 **阿里云 (Aliyun)** 环境进行了定制。

> 更完整的生产上线落地（托管 RDS/Redis + Tinode + 阿里云短信）请查看：`deploy/ALIYUN_PRODUCTION_LAUNCH.md`。

## 1. 云资源准备 (Cloud Resources)

请前往 [阿里云官网 (aliyun.com)](https://www.aliyun.com) 购买以下资源：

| 资源组件 | 推荐配置 (MVP) | 购买建议 |
| :--- | :--- | :--- |
| **云服务器 ECS** | **4核 8G（推荐）** / 2核 4G（最低） | **操作系统选 Ubuntu 22.04**。<br>带宽建议按量付费，峰值 20M+（图片多建议 50-100M）。 |
| **云数据库 RDS** | **PostgreSQL 15** 基础版（2核4G/50G） | **必选**。与 ECS 同地域同 VPC，使用内网地址。<br>请创建两个库：`home_decoration` + `tinode`。 |
| **云数据库 Redis** | ApsaraDB for Redis 1GB 起 | **必选（生产推荐托管）**。与 ECS 同地域同 VPC，开启密码，仅内网访问。 |
| **对象存储 OSS** | 标准存储 | 用于备份 DB 与 uploads（推荐 Bucket 私有）。后续可用于图片上云 + CDN。 |
| **域名** | 万网域名 | 购买后需立即进行 ICP 备案 (阿里云提供免费备案服务)。 |
| **短信服务** | 阿里云短信 | 上线必须接入真实短信验证码（不要使用测试验证码）。签名/模板审核需要时间，尽早提交。 |

## 2. 环境搭建 (Setup)

### 2.1 ECS 初始化 (Ubuntu)
SSH 登录服务器后，使用阿里云镜像源安装 Docker：

```bash
# 1. 卸载旧版本
sudo apt-get remove docker docker-engine docker.io containerd runc

# 2. 安装必要工具
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# 3. 添加阿里云 Docker GPG 密钥
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 4. 设置阿里云镜像仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. 安装 Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 6. 配置 Docker 镜像加速 (使用阿里云加速器)
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://registry.cn-hangzhou.aliyuncs.com"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 2.2 数据库连接 (RDS)
1.  进入 RDS 控制台 -> **白名单与安全组** -> 添加 ECS 的内网 IP。
2.  确保 RDS 和 ECS 在同一个 **专有网络 (VPC)** 下。
3.  获取 RDS 的 **内网地址** (不要用外网地址，内网更快且免费)。

### 2.3 启动服务

```bash
# 获取代码
git clone <your-repo-url> /opt/home_decoration
cd /opt/home_decoration

# 1) 在 deploy/ 目录创建生产环境变量文件（不要提交到 Git）
cd deploy
cp ../.env.example .env
# 编辑 deploy/.env，填入 RDS/Redis 内网地址、JWT_SECRET、ENCRYPTION_KEY、Tinode 与短信配置等

# 2) 启动（托管 RDS + 托管 Redis + Tinode + Admin）
docker compose -f docker-compose.prod.managed.yml up -d --build
```

> HTTPS 推荐使用 **宿主机 Nginx + Let's Encrypt**，参考模板：`deploy/nginx/host_nginx_prod.conf`。

## 3. 安全设置 (Security Group)
进入 ECS 控制台 -> **实例** -> **安全组配置**，添加入方向规则：

| 端口范围 | 协议 | 授权对象 | 说明 |
| :--- | :--- | :--- | :--- |
| **80/80** | TCP | 0.0.0.0/0 | HTTP 访问 (必须) |
| **443/443** | TCP | 0.0.0.0/0 | HTTPS 访问 (必须) |
| **22/22** | TCP | 你的本地IP | SSH 远程连接 (建议不要全开) |

## 4. 小程序域名配置
微信后台只认已备案的域名。阿里云备案通常需要 7-20 天，请尽早提交。
备案期间可以使用 IP访问 (仅用于测试 Web/Admin)，小程序必须等备案完成。
