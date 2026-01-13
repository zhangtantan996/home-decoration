# 部署问题记录与解决方案

## 文档信息
- **创建时间**: 2026-01-02
- **适用环境**: 测试环境 (47.99.105.195:8888)

---

## 问题一：服务器内存不足导致前端构建失败

### 问题描述
在服务器上执行 `docker-compose build` 时，前端构建步骤（`npm run build`）因内存不足而失败。

**错误现象**：
```
transforming...
(无响应后构建中断)
```

**根本原因**：
- 服务器内存约 2GB，而 Vite 构建需要大量内存
- Node.js 默认堆内存限制不足以完成大型项目构建

### 解决方案：本地构建 + 上传预构建产物

**步骤**：

1. **本地构建**（Windows PowerShell）
```powershell
cd G:\AI_engineering\home_decoration\admin
npm run build
```

2. **上传到服务器**
```powershell
scp -r G:\AI_engineering\home_decoration\admin\dist root@47.99.105.195:/data/www/home_decoration_staging/admin/
```

3. **修改 Dockerfile.frontend**（跳过构建阶段）
```dockerfile
FROM nginx:alpine

COPY admin/dist /usr/share/nginx/html/admin
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

4. **服务器重建容器**
```bash
docker compose -f docker-compose.staging.yml up -d --build web
```

### 涉及文件
- `deploy/Dockerfile.frontend` - 移除 npm install 和 npm run build 步骤

---

## 问题二：前端 API 请求指向 localhost:8080 导致跨域失败

### 问题描述
前端部署到生产环境后，API 请求仍然指向 `http://localhost:8080/api/v1`，导致：
1. 浏览器 CORS 错误
2. 请求无法到达后端服务

**错误现象**：
```
Access to XMLHttpRequest at 'http://localhost:8080/api/v1/admin/login' 
from origin 'http://47.99.105.195:8888' has been blocked by CORS policy
```

**根本原因**：
多个前端源文件中硬编码了 `localhost:8080` 作为默认 API 地址：
- `src/services/api.ts`
- `src/services/merchantApi.ts`
- `src/pages/merchant/MerchantCases.tsx`
- `src/pages/cases/CaseManagement.tsx`
- `src/pages/audits/CaseAudits.tsx`

### 解决方案：使用动态环境判断

**修改前**：
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
```

**修改后**：
```typescript
// 生产环境使用相对路径，开发环境使用 localhost
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080/api/v1'
    : '/api/v1';
```

**原理**：
- 本地开发时，hostname 是 `localhost`，使用完整的后端地址
- 生产环境中，hostname 不是 `localhost`，使用相对路径 `/api/v1`
- nginx 会将 `/api/` 请求代理到后端容器

### 涉及文件
- `admin/src/services/api.ts`
- `admin/src/services/merchantApi.ts`
- `admin/src/pages/merchant/MerchantCases.tsx`
- `admin/src/pages/cases/CaseManagement.tsx`
- `admin/src/pages/audits/CaseAudits.tsx`

---

## 附加问题：服务器 CORS 白名单

### 问题描述
即使前端 API 路径正确，请求仍返回 403 Forbidden。

**根本原因**：
后端 CORS 中间件的白名单没有包含测试环境域名。

### 解决方案

修改 `server/internal/router/router.go`，添加测试环境域名：

```go
allowedOrigins := []string{
    "http://localhost:5173",
    "http://localhost:5174",
    "http://47.99.105.195:8888",  // 添加测试环境
}
```

**重要**：修改后需重新构建 API 容器：
```bash
docker compose -f docker-compose.staging.yml build --no-cache api
docker compose -f docker-compose.staging.yml up -d api
```

---

## 最佳实践建议

1. **环境变量配置**：使用 `.env.production` 配置生产环境变量，但注意 Vite 需要 `VITE_` 前缀

2. **动态环境检测**：使用 `window.location.hostname` 判断运行环境更可靠

3. **本地构建流程**：对于内存受限的服务器，建议本地构建后上传

4. **CORS 配置**：维护一个完整的允许域名列表，包括所有环境

5. **配置文件**：确保 `config.yaml` 被正确打包到容器中（检查 Dockerfile 的 COPY 指令）
