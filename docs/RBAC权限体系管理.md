# RBAC 权限体系管理指南

本文档整合了 **RBAC 权限设计方案** 与 **后端实现指南**。

---

## 1. 权限模型设计

### 1.1 核心实体关系
```
[管理员 (SysAdmin)] --(M:N)--> [角色 (SysRole)] --(M:N)--> [菜单/权限点 (SysMenu)]
```

### 1.2 权限标识规范
格式：`{module}:{resource}:{action}`
- **示例**: `provider:designer:list` (查看设计师列表)
- **通配符**: `*:*:*` (超级管理员)

### 1.3 预置角色
| 角色 Key | 名称 | 职责 | 权限范围 |
|---|---|---|---|
| `super_admin` | 超级管理员 | 系统维护 | 全权限 |
| `product_manager` | 产品经理 | 业务管理 | 服务商管理(增删改查)、项目查看 |
| `operations` | 运营专员 | 审核/内容 | 资质审核、评价管理、用户查看 |
| `finance` | 财务 | 资金管理 | 托管账户操作、交易审批 |
| `risk` | 风控 | 纠纷处理 | 仲裁、风控预警 |

---

## 2. 后端实现 (Golang)

### 2.1 数据库结构
- `sys_admins`: 管理员账号
- `sys_roles`: 角色定义
- `sys_menus`: 菜单与权限点定义 (树形结构)
- `sys_admin_roles`, `sys_role_menus`: 关联表

### 2.2 权限中间件
位于 `internal/middleware/permission.go`。
```go
// 路由中使用
r.GET("/designers", middleware.RequirePermission("provider:designer:list"), GetList)
```
- **逻辑**: 如果 `isSuperAdmin` 直接放行；否则查询 `sys_admin_roles` -> `sys_role_menus` 是否包含目标权限。

### 2.3 初始化脚本
位于 `server/scripts/seed_rbac_full.go`。
- **作用**: 自动创建所有预置角色、菜单树、权限点，并重置默认账号密码。
- **运行**: `go run scripts/seed_rbac_full.go`

---

## 3. 前端实现 (React Admin)

### 3.1 动态菜单
- **登录接口**: 返回 `menus` (树形JSON) 和 `permissions` (字符串数组)。
- **Store**: `authStore` 存储上述信息。
- **侧边栏**: 根据 `menus` 动态渲染，无权限的菜单直接不可见。

### 3.2 按钮级控制
使用 `usePermission` Hook 或封装组件：
```tsx
<PermissionWrapper permission="provider:designer:create">
  <Button>新增</Button>
</PermissionWrapper>
```
无权限时按钮自动隐藏。

---

## 4. 测试账号清单
(默认密码通常为 `username` + `123`)

- **admin**: 超级管理员
- **product**: 产品经理
- **operations**: 运营
- **finance**: 财务
- **risk**: 风控
