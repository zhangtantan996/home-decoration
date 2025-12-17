# 家装一体化平台 - 阿里云 ECS 部署指南

> **服务器信息**
> - **操作系统**: Alibaba Cloud Linux 3.2104 LTS 64位
> - **IP地址**: 47.99.105.195
> - **配置**: 2核 2GB (内存较小，**强烈建议在本地构建，上传产物到服务器**)

## 1. 环境准备 (服务器端)

登录服务器:
```bash
ssh root@47.99.105.195
```

### 1.1 安装 Nginx & Redis & Git
Alibaba Cloud Linux 3 兼容 CentOS 8/RHEL 8 命令。

```bash
# 更新系统
dnf update -y

# 安装 Nginx
dnf install nginx -y
systemctl enable nginx
systemctl start nginx

# 安装 Redis
dnf install redis -y
systemctl enable redis
systemctl start redis

# 安装 Git (如果需要)
dnf install git -y
```

### 1.2 安装 MySQL 8.0
```bash
dnf install mysql-server -y
systemctl enable mysqld
systemctl start mysqld

# 初始化安全配置 (设置 root 密码等)
mysql_secure_installation
```
*提示：请记住设置的 MySQL 密码，后续在后端配置文件中需要使用。*

### 1.3 创建数据库
```bash
mysql -u root -p
```
在 MySQL 命令行执行：
```sql
CREATE DATABASE home_decoration DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 2. 后端部署 (Server)

### 2.1 修改配置
在本地修改 `server/config.yaml`，确保数据库连接正确。
**注意**：生产环境通常不使用 `debug` 模式。

```yaml
server:
  host: "0.0.0.0"
  port: "8080"
  mode: "release"  # 修改为 release

database:
  host: "127.0.0.1" # 如果在同一台服务器
  port: "3306"
  user: "root"
  password: "YOUR_MYSQL_PASSWORD" # 替换为你设置的 MySQL 密码
  dbname: "home_decoration"
```

### 2.2 本地编译 (推荐)
由于服务器内存只有 2G，编译 Go 可能耗尽内存，建议本地编译 Linux 可执行文件。
(假设本地是 Windows，使用 CMD 或 PowerShell)

```powershell
# 在 server 目录下
$Env:GOOS = "linux"
$Env:GOARCH = "amd64"
go build -o server_linux ./cmd/api
```

### 2.3 上传文件
将编译好的 `server_linux` 和 `config.yaml` 上传到服务器。
```bash
# 创建目录
ssh root@47.99.105.195 "mkdir -p /data/www/home-decoration/server"

# 上传 (使用 scp 或 SFTP 工具)
scp server/server_linux server/config.yaml root@47.99.105.195:/data/www/home-decoration/server/
```

### 2.4 配置 Systemd 服务
在服务器上创建服务文件：
`vim /etc/systemd/system/home-decoration.service`

```ini
[Unit]
Description=Home Decoration API Server
After=network.target mysqld.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/data/www/home-decoration/server
ExecStart=/data/www/home-decoration/server/server_linux
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
chmod +x /data/www/home-decoration/server/server_linux
systemctl daemon-reload
systemctl enable home-decoration
systemctl start home-decoration
systemctl status home-decoration
```

---

## 3. 前端部署

### 3.1 本地构建 Admin
在 `admin` 目录下：
```bash
npm install
npm run build
```
构建产物在 `admin/dist`。

### 3.2 本地构建 Mobile
在 `mobile` 目录下：
 ```bash
npm install
npm run build
```
构建产物在 `mobile/dist`。

### 3.3 上传静态文件
```bash
# 在服务器创建目录
ssh root@47.99.105.195 "mkdir -p /data/www/home-decoration/admin /data/www/home-decoration/mobile"

# 上传 Admin
scp -r admin/dist/* root@47.99.105.195:/data/www/home-decoration/admin/

# 上传 Mobile
scp -r mobile/dist/* root@47.99.105.195:/data/www/home-decoration/mobile/
```

---

## 4. Nginx 配置

编辑 Nginx 配置：
`vim /etc/nginx/nginx.conf` (或者在 `/etc/nginx/conf.d/` 下新建配置文件)

确保包含以下配置：

```nginx
server {
    listen 80;
    server_name 47.99.105.195; # 或者你的域名

    # 1. 管理后台 Admin
    location /admin {
        alias /data/www/home-decoration/admin;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
    }

    # 2. 移动端 Mobile (H5)
    location /mobile {
        alias /data/www/home-decoration/mobile;
        index index.html;
        try_files $uri $uri/ /mobile/index.html;
    }
    
    # 根路径重定向到 Admin 或 Mobile，视需求而定
    location / {
        rewrite ^/$ /mobile permanent; 
    }

    # 3. 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**重要说明**：
- 由于使用了 `alias`，Vite 构建的 `base` 可能需要调整。
- **Admin**: 在 `admin/vite.config.ts` 中设置 `base: '/admin/'`。
- **Mobile**: 在 `mobile/vite.config.ts` 中设置 `base: '/mobile/'`。
- 如果不想修改代码，也可以分别部署在不同的端口或子域名（推荐）。

#### 方案 B：使用不同端口 (更简单，无需修改代码 base)
- **80 端口**: 移动端 (Mobile)
- **8081 端口**: 管理后台 (Admin)

```nginx
# 移动端 (主入口)
server {
    listen 80;
    server_name 47.99.105.195;
    root /data/www/home-decoration/mobile;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8080;
    }
}

# 管理后台
server {
    listen 8081; # 需要在阿里云安全组开放 8081 端口
    server_name 47.99.105.195;
    root /data/www/home-decoration/admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

配置完成后重启 Nginx：
```bash
nginx -t
systemctl restart nginx
```

## 5. 安全组设置 (防火墙)
登录阿里云控制台，进入 ECS 实例的 **安全组**，添加入方向规则：
- 允许 TCP 80 (HTTP)
- 允许 TCP 22 (SSH)
- 允许 TCP 8081 (如果你使用了方案B)
- 允许 TCP 8080 (如果需要直接访问后端用于调试，否则建议不开放，只通过 Nginx 转发)
