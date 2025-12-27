# 管理后台新增功能说明

## 更新内容

本次更新为管理后台新增了以下功能模块的完整后端支持：

### 1. 管理员管理 ✅
- **数据表**: `admins`
- **功能**:
  - 管理员列表查询（支持关键词搜索）
  - 创建管理员（支持密码加密）
  - 编辑管理员信息
  - 删除管理员
  - 启用/禁用管理员状态
- **API接口**:
  - `GET /api/v1/admin/admins` - 获取管理员列表
  - `POST /api/v1/admin/admins` - 创建管理员
  - `PUT /api/v1/admin/admins/:id` - 更新管理员
  - `DELETE /api/v1/admin/admins/:id` - 删除管理员
  - `PATCH /api/v1/admin/admins/:id/status` - 更新状态

### 2. 资质审核管理 ✅
- **数据表**: `provider_audits`, `material_shop_audits`
- **功能**:
  - 服务商资质审核列表
  - 门店认证审核列表
  - 审核通过/拒绝操作
  - 支持查看营业执照、资质证书等材料
- **API接口**:
  - `GET /api/v1/admin/audits/providers` - 服务商审核列表
  - `GET /api/v1/admin/audits/material-shops` - 门店审核列表
  - `POST /api/v1/admin/audits/:type/:id/approve` - 审核通过
  - `POST /api/v1/admin/audits/:type/:id/reject` - 审核拒绝

### 3. 财务管理 ✅
- **数据表**: `escrow_accounts`(扩展), `transactions`(扩展)
- **功能**:
  - 托管账户列表查询
  - 交易记录查询（支持类型筛选）
  - 账户提现功能
  - 账户统计信息
- **API接口**:
  - `GET /api/v1/admin/finance/escrow-accounts` - 托管账户列表
  - `GET /api/v1/admin/finance/transactions` - 交易记录列表
  - `POST /api/v1/admin/finance/escrow-accounts/:accountId/withdraw` - 申请提现

### 4. 风险管理 ✅
- **数据表**: `risk_warnings`, `arbitrations`
- **功能**:
  - 风险预警列表（支持风险等级筛选）
  - 风险预警处理
  - 仲裁申请列表
  - 仲裁处理（受理/审理/裁决/驳回）
- **API接口**:
  - `GET /api/v1/admin/risk/warnings` - 风险预警列表
  - `POST /api/v1/admin/risk/warnings/:id/handle` - 处理风险预警
  - `GET /api/v1/admin/risk/arbitrations` - 仲裁列表
  - `PUT /api/v1/admin/risk/arbitrations/:id` - 更新仲裁

### 5. 系统设置 ✅
- **数据表**: `system_settings`
- **功能**:
  - 系统配置项管理
  - 支持基本设置、安全设置、支付设置、短信设置等
  - Key-Value 存储结构
- **API接口**:
  - `GET /api/v1/admin/settings` - 获取系统设置
  - `PUT /api/v1/admin/settings` - 更新系统设置

### 6. 操作日志 ✅
- **数据表**: `admin_logs`
- **功能**:
  - 管理员操作日志记录
  - 支持按管理员ID、操作类型筛选
  - 记录详细的请求信息（IP、UserAgent等）
- **API接口**:
  - `GET /api/v1/admin/logs` - 操作日志列表

## 数据库变更

### 新增数据表

1. **admins** - 管理员表
2. **provider_audits** - 服务商资质审核表
3. **material_shop_audits** - 门店认证审核表
4. **risk_warnings** - 风险预警表
5. **arbitrations** - 仲裁表
6. **system_settings** - 系统设置表
7. **admin_logs** - 操作日志表

### 扩展数据表

1. **escrow_accounts** - 新增字段：
   - `user_id` - 账户所有者ID
   - `project_name` - 项目名称
   - `user_name` - 用户名称
   - `available_amount` - 可用金额

2. **transactions** - 新增字段：
   - `order_id` - 订单号（唯一索引）
   - `from_account` - 付款账户
   - `to_account` - 收款账户
   - `remark` - 备注

## 部署步骤

### 1. 更新代码

```bash
cd server
go mod tidy  # 安装依赖（如果有新增）
go build -o bin/server ./cmd/api
```

### 2. 数据库迁移

启动服务器时，GORM会自动创建新表：

```bash
./bin/server
```

### 3. 初始化示例数据（可选）

```bash
psql -h localhost -U your_user -d your_database -f scripts/init_admin_data.sql
```

默认管理员账号：
- 用户名: `admin`
- 密码: `admin123`

### 4. 启动前端

```bash
cd admin
npm install
npm run dev
```

访问: http://localhost:5173/admin

## 技术栈

### 后端
- **语言**: Go 1.21+
- **框架**: Gin
- **ORM**: GORM
- **数据库**: PostgreSQL
- **密码加密**: bcrypt

### 前端
- **框架**: React 19 + TypeScript
- **UI库**: Ant Design 5
- **路由**: React Router 7
- **HTTP客户端**: Axios
- **状态管理**: Zustand

## API 接口完整列表

### 管理员管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/v1/admin/admins | 管理员列表 |
| POST | /api/v1/admin/admins | 创建管理员 |
| PUT | /api/v1/admin/admins/:id | 更新管理员 |
| DELETE | /api/v1/admin/admins/:id | 删除管理员 |
| PATCH | /api/v1/admin/admins/:id/status | 更新状态 |

### 审核管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/v1/admin/audits/providers | 服务商审核列表 |
| GET | /api/v1/admin/audits/material-shops | 门店审核列表 |
| POST | /api/v1/admin/audits/:type/:id/approve | 审核通过 |
| POST | /api/v1/admin/audits/:type/:id/reject | 审核拒绝 |

### 财务管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/v1/admin/finance/escrow-accounts | 托管账户列表 |
| GET | /api/v1/admin/finance/transactions | 交易记录列表 |
| POST | /api/v1/admin/finance/escrow-accounts/:accountId/withdraw | 申请提现 |

### 风险管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/v1/admin/risk/warnings | 风险预警列表 |
| POST | /api/v1/admin/risk/warnings/:id/handle | 处理风险预警 |
| GET | /api/v1/admin/risk/arbitrations | 仲裁列表 |
| PUT | /api/v1/admin/risk/arbitrations/:id | 更新仲裁 |

### 系统设置
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/v1/admin/settings | 获取系统设置 |
| PUT | /api/v1/admin/settings | 更新系统设置 |

### 操作日志
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/v1/admin/logs | 操作日志列表 |

## 注意事项

1. **权限控制**: 所有管理后台接口都需要JWT认证，需要在请求头中携带token
2. **密码安全**: 管理员密码使用bcrypt加密，默认cost为10
3. **数据验证**: 所有接口都有基本的参数验证
4. **错误处理**: 统一使用response包处理响应
5. **日志记录**: 建议在实际使用中完善操作日志的自动记录功能

## 后续优化建议

1. 添加操作日志中间件，自动记录所有管理操作
2. 实现更细粒度的权限控制（基于角色和菜单）
3. 添加数据导出功能
4. 实现实时通知功能（WebSocket）
5. 添加数据统计图表
6. 完善审核流程（支持多级审核）
7. 添加文件上传功能（用于证件审核）

## 联系方式

如有问题，请联系开发团队。
