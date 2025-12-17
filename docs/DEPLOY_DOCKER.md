# Docker 一键部署指南

本指南将指导您使用 Docker Compose 在阿里云 ECS 上一键部署“家装一体化平台”。

> **服务器信息**
> - **操作系统**: Alibaba Cloud Linux 3.2104 LTS 64位
> - **IP地址**: 47.99.105.195

## 1. 安装 Docker

连接到服务器后，执行以下命令安装 Docker 和 Docker Compose：

```bash
# 1. 安装 Docker 依赖
dnf config-manager --add-repo=https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io

# 2. 启动 Docker
systemctl enable docker
systemctl start docker

# 3. 安装 Docker Compose (V2)
dnf install -y docker-compose-plugin

# 4. 验证安装
docker compose version
```

## 2. 配置 Swap (虚拟内存)

⚠️ **极为重要**：您的服务器只有 2G 内存，而构建前端应用 (npm install/build) 非常消耗内存。**必须**配置 Swap，否则构建过程一定会因内存不足崩溃 (OOM)。

```bash
# 创建 4G 的 Swap 文件
dd if=/dev/zero of=/swapfile bs=1M count=4096

# 设置权限
chmod 600 /swapfile

# 格式化为 Swap
mkswap /swapfile

# 启用 Swap
swapon /swapfile

# 永久生效 (重启不失效)
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 验证
free -h
# 应该能看到 Swap 行有 4.0G
```

## 3. 部署代码

### 3.1 上传代码
在本地开发机上，将项目代码上传到服务器。
*(假设您已在项目根目录下)*

```bash
# 在服务器创建目录
ssh root@47.99.105.195 "mkdir -p /data/www/home-decoration"

# 排除 node_modules 和 dist 等大文件，建议使用 git clone 或者 rsync
# 这里演示打包上传方式 (Windows PowerShell)
tar --exclude='node_modules' --exclude='.git' --exclude='dist' -cvf project.tar .
scp project.tar root@47.99.105.195:/data/www/home-decoration/

# 在服务器解压
ssh root@47.99.105.195
cd /data/www/home-decoration
tar -xvf project.tar
```

### 3.2 启动服务
在服务器的项目根目录下：

```bash
docker compose up -d --build
```
*提示：第一次构建需要下载基础镜像并编译，大约需要 5-10 分钟。请耐心等待。*

### 3.3 查看状态
```bash
docker compose ps
```
如果所有服务均显示 `Up`，则部署成功。

## 4. 访问验证

打开浏览器访问：
- **移动端**: `http://47.99.105.195` (默认)
- **管理端**: `http://47.99.105.195/admin`
- **API**: `http://47.99.105.195/api/health` (如果后端实现了此接口)

## 5. 常用维护命令

- **查看日志**: `docker compose logs -f`
- **停止服务**: `docker compose down`
- **重启服务**: `docker compose restart`
- **更新代码后重新部署**:
  ```bash
  docker compose up -d --build
  ```

## 6. 进阶：使用 Git 自动同步 (推荐)

使用 `scp` 上传文件比较繁琐，推荐使用 Git 来管理和同步代码。

### 6.1 本地推送到仓库
1.  在 GitHub/Gitee/GitLab 上创建一个私有仓库。
2.  在本地项目根目录初始化并推送：
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin <你的仓库地址>
    git push -u origin main
    ```

### 6.2 服务器拉取代码
1.  登录服务器。
2.  安装 Git：`dnf install git -y`。
3.  配置 SSH Key (以便拉取私有仓库，可选) 或直接使用 HTTPS (需要输入密码)。
4.  克隆代码：
    ```bash
    cd /data/www
    git clone <你的仓库地址> home-decoration
    cd home-decoration
    ```

### 6.3 以后如何更新？
当您在本地修改了代码并 `git push` 后，在服务器上只需执行：

```bash
# 1. 更新代码
git pull

# 2. 重新构建并启动 (Docker 会自动检测变动并重新编译)
docker compose up -d --build

# 3. 清理旧镜像 (可选，释放空间)
docker image prune -f
```
这样就完成了全自动化的更新流程！

