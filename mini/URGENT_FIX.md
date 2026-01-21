# 🚨 紧急修复:小程序 API 地址问题

## 当前问题

小程序正在请求 `http://host.orb.local:8080`,但应该使用 `http://192.168.110.128:8080`

错误:`net::ERR_NAME_NOT_RESOLVED` - 微信开发者工具无法解析 `host.orb.local` 域名

---

## 立即执行以下步骤

### 1. 停止所有编译进程

在终端中执行:
```bash
cd /Volumes/tantan/AI_project/home-decoration/mini
pkill -f "taro build"
```

### 2. 清理所有缓存(已完成 ✅)

```bash
rm -rf dist .taro-cache node_modules/.cache
```

### 3. 检查是否有环境变量覆盖

在终端中执行:
```bash
unset TARO_APP_API_BASE
env | grep TARO
```

如果看到任何 TARO 相关的环境变量,请执行 `unset VARIABLE_NAME` 清除。

### 4. 重新编译

```bash
npm run dev:weapp
```

### 5. 在微信开发者工具中

1. **关闭项目** - 完全关闭微信开发者工具
2. **重新打开** - 重新打开项目
3. **清除缓存** - 工具栏 → 清缓存 → 清除所有缓存
4. **重新编译** - 点击"编译"按钮

---

## 验证步骤

编译完成后,在微信开发者工具的**控制台 → Network 标签**中查看请求:

✅ **正确:** `http://192.168.110.128:8080/api/v1/...`  
❌ **错误:** `http://host.orb.local:8080/...` 或 `http://localhost:8080/...`

---

## 如果问题仍然存在

### 检查微信开发者工具的项目配置

1. 打开 **详情 → 本地设置**
2. 查看是否有"环境变量"或"代理设置"
3. 确保没有设置 `TARO_APP_API_BASE` 环境变量

### 手动验证配置文件

确认以下文件中的 API 地址:

1. **config/dev.ts** - 应该是 `http://192.168.110.128:8080/api/v1`
2. **src/utils/request.ts** - 应该是 `http://192.168.110.128:8080/api/v1`
3. **src/services/uploads.ts** - 应该是 `http://192.168.110.128:8080/api/v1`

---

## 最后的手段:完全重置

如果上述步骤都不起作用:

```bash
# 1. 删除 node_modules
rm -rf node_modules package-lock.json

# 2. 重新安装依赖
npm install

# 3. 清理并重新编译
rm -rf dist .taro-cache
npm run dev:weapp
```

---

## 为什么会出现 host.orb.local?

`host.orb.local` 是 OrbStack 提供的特殊域名,用于从容器内部访问主机。但是:

- ❌ 微信开发者工具**无法解析**这个域名
- ✅ 必须使用**真实的 IP 地址** `192.168.110.128`

**请立即执行上述步骤并告诉我结果!** 🚀
