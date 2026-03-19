# home-decoration 当前生产 Nginx / 域名标准（2026-03-09）

这份文档记录 **当前线上已经收敛完成的标准入口口径**。

目标不是讲一套“理想中的未来方案”，而是把**现在生产真实生效**、且已经验证通过的标准配置说清楚，避免后续改动把职责边界又弄混。

---

## 1. 标准职责分工

### 1.1 三域职责

当前生产环境固定为三域分工：

- `hezeyunchuang.com`
- `www.hezeyunchuang.com`
  - 仅承接：**官网 / 商家端静态页面**
- `admin.hezeyunchuang.com`
  - 仅承接：**管理后台静态页面**
- `api.hezeyunchuang.com`
  - 仅承接：**API / uploads / Tinode / v0**

一句话版本：

- **站点域**：只做站点
- **后台域**：只做后台
- **API 域**：只做接口与 IM 相关入口

---

## 2. 当前线上标准结果

### 2.1 站点域

`hezeyunchuang.com` / `www.hezeyunchuang.com`：

- `/` → 官网首页
- `/merchant` → 商家端入口页
- `/merchant/*` → 商家端 SPA 路由
- **不再承担**：`/api/`、`/uploads/`、`/tinode/`、`/v0/`

标准结果：

- `http://hezeyunchuang.com/` → `200`
- `http://hezeyunchuang.com/merchant` → `200`
- `http://hezeyunchuang.com/api/v1/health` → `404`

### 2.2 后台域

`admin.hezeyunchuang.com`：

- `/admin/` → 后台 SPA
- `/admin/*` → 后台前端路由
- `/` → 跳转 `/admin/`
- **不再承担**：`/api/`、`/uploads/`、`/static/`、`/tinode/`、`/v0/`

标准结果：

- `http://admin.hezeyunchuang.com/admin/login` → `200`
- `http://admin.hezeyunchuang.com/api/v1/health` → `404`
- `http://admin.hezeyunchuang.com/tinode/v0/version` → `404`

### 2.3 API 域

`api.hezeyunchuang.com`：

- `/api/` → 后端 API
- `/uploads/` → 上传文件
- `/static/` → 后端静态资源
- `/tinode/` → Tinode 相关入口
- `/v0/`、`/v0/channels` → Tinode / WebSocket 相关入口
- 其它路径统一 `404`

标准结果：

- `http://api.hezeyunchuang.com/api/v1/health` → `200`

---

## 3. 宿主机 Nginx 标准

线上宿主机 Nginx 文件路径：

- `/etc/nginx/sites-available/home-decoration`

当前标准要求：

### 3.1 根域 server

`server_name hezeyunchuang.com www.hezeyunchuang.com;`

只保留：

- `location / { proxy_pass http://home_decoration_web; ... }`

明确移除：

- `/api/`
- `/uploads/`
- `/tinode/`
- `/v0/`

也就是说：

**宿主机层已经不再允许根域通过 Host 改写兜底去访问 API 域能力。**

### 3.2 admin 域 server

`server_name admin.hezeyunchuang.com;`

- 只把请求转发给 `prod_web`
- 具体 `/admin/*` 的页面处理交给容器内 Nginx

### 3.3 api 域 server

`server_name api.hezeyunchuang.com;`

只承接：

- `/api/`
- `/uploads/`
- `/tinode/`
- `/v0/`

`location / { return 404; }`

---

## 4. 容器内 Nginx 标准

线上容器内配置来源：

- 仓库文件：`deploy/nginx/nginx.conf`
- 容器路径：`/etc/nginx/nginx.conf`

### 4.1 默认站点 server

默认站点 / 根域 server 负责：

- `root /usr/share/nginx/html/web`
- `/` → 官网
- `/merchant`
- `/merchant/*`

当前仍保留：

- `/api/`
- `/uploads/`
- `/static/`
- `/tinode/`
- `/v0/`

但这些能力**只能通过 API 域从外层进入**；根域宿主机层已经不再为它们做兜底。

### 4.2 admin 域 server

`server_name ~^admin([.-].+)$;`

只保留：

- `/` → `302 /admin/`
- `/admin`
- `/admin/`
- `/admin/*`
- `/assets/`
- favicon / apple-touch-icon

已移除：

- `/api/`
- `/uploads/`
- `/static/`
- `/tinode/`
- `/v0/`

其它路径统一：

- `return 404`

### 4.3 api 域 server

`server_name api.hezeyunchuang.com;`

承接：

- `/api/`
- `/uploads/`
- `/static/`
- `/tinode/v0/`
- `/tinode/ws`
- `/tinode/file/`
- `/v0/`
- `/v0/channels`

其它路径：

- `return 404`

---

## 5. 前端生产 API 基址标准

线上后台前端当前标准配置：

- 文件：`/root/home-decoration/admin/.env.production`
- 当前值：

```env
VITE_APP_ENV=production
VITE_API_URL=http://api.hezeyunchuang.com/api/v1
```

这意味着：

- 后台前端生产环境直接请求 `api.hezeyunchuang.com`
- 不再依赖站点域下 `/api/v1` 的历史兜底

> 备注：当前线上仍是 HTTP-only 入口，因此这里保持 `http://`；后续若宿主机切到 HTTPS，可再同步收敛为 `https://api.hezeyunchuang.com/api/v1`。

---

## 6. Tinode 标准口径

当前对外统一从：

- `api.hezeyunchuang.com`

进入 Tinode 相关能力。

对外保留路径：

- `/tinode/v0/`
- `/tinode/ws`
- `/tinode/file/`
- `/v0/`
- `/v0/channels`

要求：

- 不要再让 `hezeyunchuang.com` 或 `admin.hezeyunchuang.com` 对外承担 Tinode 入口
- 以后即便 Tinode 单独拆 upstream，也应只改 API 域，不要改站点域 / 后台域职责

---

## 7. 回归清单

以后只要改到宿主机 Nginx、`deploy/nginx/nginx.conf`、`admin/.env.production`、`deploy/Dockerfile.frontend`，都至少回归以下项目：

### 7.1 站点域

- `http://hezeyunchuang.com/`
- `http://hezeyunchuang.com/merchant`
- `http://hezeyunchuang.com/api/v1/health` → 应为 `404`

### 7.2 后台域

- `http://admin.hezeyunchuang.com/admin/login`
- `http://admin.hezeyunchuang.com/api/v1/health` → 应为 `404`
- `http://admin.hezeyunchuang.com/tinode/v0/version` → 应为 `404`

### 7.3 API 域

- `http://api.hezeyunchuang.com/api/v1/health`
- 如 Tinode 已启用，再验证：
  - `http://api.hezeyunchuang.com/tinode/v0/version`

---

## 8. 禁止回退的错误做法

后续改配置时，尽量不要再回到下面这些做法：

### 8.1 不要让根域兜底 API

不要在宿主机根域 server 重新加回：

- `/api/`
- `/uploads/`
- `/tinode/`
- `/v0/`

更不要再通过：

- `proxy_set_header Host api.hezeyunchuang.com;`

把根域流量“假装成” API 域去转发。

### 8.2 不要让 admin 域兼做 API 域

`admin.hezeyunchuang.com` 只做后台页面。

不要为了“图省事”再让它直接代理：

- `/api/`
- `/uploads/`
- `/tinode/`
- `/v0/`

### 8.3 不要把前端生产 API 基址退回 `/api/v1`

如果生产前端重新退回：

```env
VITE_API_URL=/api/v1
```

那就又会重新依赖外层入口兜底，职责会再次变模糊。

---

## 9. 备份信息

本轮 2026-03-09 标准化收敛已保留线上备份：

- `/etc/nginx/sites-available/home-decoration.bak-*`
- `/root/home-decoration/deploy/nginx/nginx.conf.bak-*`
- `/root/home-decoration/deploy/nginx/nginx.conf.phase2.bak-*`
- `/root/home-decoration/admin/.env.production.bak-*`

如果后续出现问题，优先用这些备份做快速对比或回滚。

---

## 10. 一句话结论

**当前生产标准不是“站点域顺带兼容一切”，而是“三域职责明确，各做各的”。**

以后谁再改入口配置，先看这份文档，再动手。
