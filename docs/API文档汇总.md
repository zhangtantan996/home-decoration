# API 文档汇总

> 家装平台 API 接口文档 - 完整版  
> 最后更新：2026-04-20

## 目录

- [1. 通用说明](#1-通用说明)
- [2. 认证授权模块](#2-认证授权模块)
- [3. 用户端 API](#3-用户端-api)
- [4. 商家端 API](#4-商家端-api)
- [5. Admin 端 API](#5-admin-端-api)
- [6. 公共 API](#6-公共-api)

---

## 1. 通用说明

### 1.1 基础信息

| 项目 | 说明 |
|------|------|
| Base URL (开发) | `http://localhost:8080/api/v1` |
| Base URL (生产) | `https://api.yourdomain.com/api/v1` |
| 协议 | HTTPS (生产环境) |
| 编码 | UTF-8 |
| 数据格式 | JSON |

### 1.2 认证方式

#### JWT Token 认证

**请求头**:
```http
Authorization: Bearer <token>
```

**Token 类型**:
- 用户端 Token: 通过 `/auth/login` 获取
- Admin Token: 通过 `/admin/login` 获取
- Token 有效期: 24 小时
- Refresh Token 有效期: 7 天

### 1.3 响应格式

#### 成功响应
```json
{
  "code": 200,
  "message": "success",
  "data": { }
}
```

#### 错误响应
```json
{
  "code": 400,
  "message": "错误描述",
  "data": null
}
```

### 1.4 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器错误 |

### 1.5 分页参数

**查询参数**:
- `page`: 页码（从 1 开始）
- `pageSize`: 每页数量（默认 10，最大 100）

**响应格式**:
```json
{
  "code": 200,
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

---

## 2. 认证授权模块

### 2.1 用户注册

`POST /auth/register`

**请求体**:
```json
{
  "phone": "13800138000",
  "password": "password123",
  "code": "123456"
}
```

### 2.2 用户登录

`POST /auth/login`

**请求体**:
```json
{
  "phone": "13800138000",
  "password": "password123"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "token": "jwt_token",
    "refreshToken": "refresh_token",
    "user": {
      "id": 1,
      "phone": "13800138000",
      "nickname": "用户昵称"
    }
  }
}
```

### 2.3 发送验证码

`POST /auth/send-code`

**请求体**:
```json
{
  "phone": "13800138000",
  "purpose": "register"
}
```

**purpose 可选值**: `register`, `login`, `reset_password`, `change_phone`

### 2.4 刷新 Token

`POST /auth/refresh`

**请求体**:
```json
{
  "refreshToken": "refresh_token_string"
}
```

### 2.5 微信小程序登录

`POST /auth/wechat/mini/login`

**请求体**:
```json
{
  "code": "wx_login_code"
}
```

### 2.6 微信小程序绑定手机号

`POST /auth/wechat/mini/bind-phone`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "code": "phone_code"
}
```

---

## 3. 用户端 API

### 3.1 用户信息管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/user/profile` | GET | 获取个人信息 |
| `/user/profile` | PUT | 更新个人信息 |
| `/user/change-password` | POST | 修改密码 |
| `/user/change-phone` | POST | 更换手机号 |
| `/user/delete-account` | POST | 注销账号 |
| `/user/settings` | GET | 获取用户设置 |
| `/user/settings` | PUT | 更新用户设置 |
| `/user/verification` | GET | 获取实名认证信息 |
| `/user/verification` | POST | 提交实名认证 |
| `/user/devices` | GET | 获取登录设备列表 |
| `/user/devices/:id` | DELETE | 移除指定设备 |
| `/user/feedback` | POST | 提交意见反馈 |

### 3.2 身份管理（多身份切换）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/identities` | GET | 获取所有身份 |
| `/identities/current` | GET | 获取当前身份 |
| `/identities/switch` | POST | 切换身份 |
| `/identities/apply` | POST | 申请新身份 |

**切换身份示例**:
```json
POST /identities/switch
{
  "identityType": "provider",
  "identityId": 123
}
```

### 3.3 预约管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/bookings` | GET | 获取预约列表 |
| `/bookings` | POST | 创建预约 |
| `/bookings/:id` | GET | 获取预约详情 |
| `/bookings/:id/pay-survey-deposit` | POST | 支付量房定金 |
| `/bookings/:id/survey-deposit/refund` | POST | 退款量房定金 |
| `/bookings/:id/budget-confirm` | GET | 获取预算确认 |
| `/bookings/:id/budget-confirm/accept` | POST | 接受预算 |
| `/bookings/:id/budget-confirm/reject` | POST | 拒绝预算 |
| `/bookings/:id/select-crew` | POST | 选择施工方 |
| `/bookings/:id/cancel` | DELETE | 取消预约 |

**创建预约示例**:
```json
POST /bookings
{
  "providerId": 123,
  "providerType": "designer",
  "address": "北京市朝阳区xxx",
  "area": 120.5,
  "renovationType": "全包",
  "budgetRange": "10-15万",
  "preferredDate": "2026-05-01",
  "phone": "13800138000",
  "notes": "希望现代简约风格"
}
```

### 3.4 设计方案管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/proposals` | GET | 获取方案列表 |
| `/proposals/:id` | GET | 获取方案详情 |
| `/proposals/:id/confirm` | POST | 确认方案 |
| `/proposals/:id/reject` | POST | 拒绝方案 |
| `/proposals/pending-count` | GET | 获取待处理数量 |
| `/proposals/booking/:bookingId/history` | GET | 获取版本历史 |

### 3.5 项目管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/projects` | GET | 获取项目列表 |
| `/projects` | POST | 创建项目 |
| `/projects/:id` | GET | 获取项目详情 |
| `/projects/:id` | PUT | 更新项目 |
| `/projects/:id/construction/confirm` | POST | 确认施工方 |
| `/projects/:id/construction/quote/confirm` | POST | 确认施工报价 |
| `/projects/:id/start` | POST | 开始项目 |
| `/projects/:id/pause` | POST | 暂停项目 |
| `/projects/:id/resume` | POST | 恢复项目 |
| `/projects/:id/complete` | POST | 完工提交 |
| `/projects/:id/completion` | GET | 获取完工信息 |
| `/projects/:id/completion/approve` | POST | 批准完工 |
| `/projects/:id/completion/reject` | POST | 拒绝完工 |
| `/projects/:id/milestones` | GET | 获取里程碑列表 |
| `/projects/:id/phases` | GET | 获取施工阶段 |
| `/projects/:id/logs` | GET | 获取施工日志 |
| `/projects/:id/logs` | POST | 创建施工日志 |
| `/projects/:id/contract` | GET | 获取合同 |
| `/projects/:id/bill` | GET | 获取账单 |

### 3.6 里程碑验收

| 端点 | 方法 | 说明 |
|------|------|------|
| `/milestones/:id/inspect` | POST | 验收节点 |
| `/milestones/:id/request-rectification` | POST | 要求整改 |
| `/milestones/:id/pay` | POST | 支付节点款项 |

**验收节点示例**:
```json
POST /milestones/:id/inspect
{
  "passed": true,
  "notes": "验收通过",
  "photos": ["url1", "url2"]
}
```

### 3.7 托管支付

| 端点 | 方法 | 说明 |
|------|------|------|
| `/projects/:id/escrow` | GET | 获取托管账户 |
| `/projects/:id/deposit` | POST | 充值托管账户 |
| `/projects/:id/release` | POST | 释放资金 |

### 3.8 订单管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/orders` | GET | 获取订单列表 |
| `/orders/:id` | GET | 获取订单详情 |
| `/orders/:id/pay` | POST | 支付订单 |
| `/orders/:id` | DELETE | 取消订单 |
| `/orders/pending-payments` | GET | 获取待支付列表 |

### 3.9 支付管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/payments/:id` | GET | 获取支付详情 |
| `/payments/:id/status` | GET | 获取支付状态 |
| `/payments/:id/launch` | GET | 发起支付 |
| `/payments/:id/qr` | GET | 获取支付二维码 |

### 3.10 服务商相关

| 端点 | 方法 | 说明 |
|------|------|------|
| `/providers/:id/follow` | POST | 关注服务商 |
| `/providers/:id/follow` | DELETE | 取消关注 |
| `/providers/:id/favorite` | POST | 收藏服务商 |
| `/providers/:id/favorite` | DELETE | 取消收藏 |
| `/providers/:id/user-status` | GET | 获取用户状态 |

### 3.11 灵感图库

| 端点 | 方法 | 说明 |
|------|------|------|
| `/inspiration` | GET | 获取灵感列表 |
| `/inspiration/:id/like` | POST | 点赞案例 |
| `/inspiration/:id/like` | DELETE | 取消点赞 |
| `/inspiration/:id/favorite` | POST | 收藏案例 |
| `/inspiration/:id/favorite` | DELETE | 取消收藏 |
| `/inspiration/:id/comments` | GET | 获取评论 |
| `/inspiration/:id/comments` | POST | 发表评论 |

### 3.12 通知系统

| 端点 | 方法 | 说明 |
|------|------|------|
| `/notifications` | GET | 获取通知列表 |
| `/notifications/unread-count` | GET | 获取未读数量 |
| `/notifications/:id/read` | PUT | 标记为已读 |
| `/notifications/read-all` | PUT | 全部标记已读 |
| `/notifications/:id` | DELETE | 删除通知 |

### 3.13 IM 系统

| 端点 | 方法 | 说明 |
|------|------|------|
| `/im/usersig` | GET | 获取腾讯云 IM 签名 |
| `/tinode/userid/:userId` | GET | 获取 Tinode 用户 ID |
| `/tinode/refresh-token` | POST | 刷新 Tinode Token |

---

## 4. 商家端 API

### 4.1 商家入驻

| 端点 | 方法 | 说明 |
|------|------|------|
| `/merchant/apply` | POST | 提交入驻申请 |
| `/merchant/applications` | GET | 获取申请列表 |
| `/merchant/applications/:id` | GET | 获取申请详情 |

**入驻申请示例**:
```json
POST /merchant/apply
{
  "applicantType": "personal",
  "role": "designer",
  "realName": "张三",
  "phone": "13800138000",
  "idCardNo": "encrypted_id_card",
  "serviceArea": ["310100", "610100"],
  "styles": ["现代简约", "北欧"],
  "introduction": "10年设计经验"
}
```

### 4.2 商家信息管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/merchant/profile` | GET | 获取商家信息 |
| `/merchant/profile` | PUT | 更新商家信息 |
| `/merchant/service-settings` | GET | 获取服务设置 |
| `/merchant/service-settings` | PUT | 更新服务设置 |
| `/merchant/bank-accounts` | GET | 获取银行账户 |
| `/merchant/bank-accounts` | POST | 添加银行账户 |

### 4.3 预约管理（商家端）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/merchant/bookings` | GET | 获取预约列表 |
| `/merchant/bookings/:id` | GET | 获取预约详情 |
| `/merchant/bookings/:id/confirm` | POST | 确认预约 |
| `/merchant/bookings/:id/reject` | POST | 拒绝预约 |
| `/merchant/bookings/:id/site-survey` | POST | 提交量房结果 |
| `/merchant/bookings/:id/budget-confirm` | POST | 提交预算确认 |

### 4.4 设计方案管理（商家端）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/merchant/proposals` | GET | 获取方案列表 |
| `/merchant/proposals` | POST | 提交设计方案 |
| `/merchant/proposals/:id` | GET | 获取方案详情 |
| `/merchant/proposals/:id` | PUT | 更新方案 |

### 4.5 施工报价管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/merchant/quote-tasks` | GET | 获取报价任务 |
| `/merchant/quote-tasks/:id` | GET | 获取任务详情 |
| `/merchant/quote-submissions` | POST | 提交报价 |
| `/merchant/quote-submissions/:id` | PUT | 更新报价 |

**提交报价示例**:
```json
POST /merchant/quote-submissions
{
  "quoteTaskId": 123,
  "items": [
    {
      "category": "水电改造",
      "name": "强电改造",
      "unit": "米",
      "quantity": 100,
      "unitPrice": 50,
      "totalPrice": 5000
    }
  ],
  "totalAmount": 50000,
  "notes": "报价说明"
}
```

### 4.6 项目管理（商家端）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/merchant/projects` | GET | 获取项目列表 |
| `/merchant/projects/:id` | GET | 获取项目详情 |
| `/merchant/projects/:id/milestones/:milestoneId/submit` | POST | 提交验收 |
| `/merchant/projects/:id/logs` | POST | 提交施工日志 |
| `/merchant/projects/:id/complete` | POST | 提交完工 |

### 4.7 案例管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/merchant/cases` | GET | 获取案例列表 |
| `/merchant/cases` | POST | 创建案例 |
| `/merchant/cases/:id` | GET | 获取案例详情 |
| `/merchant/cases/:id` | PUT | 更新案例 |
| `/merchant/cases/:id` | DELETE | 删除案例 |

### 4.8 收入管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/merchant/incomes` | GET | 获取收入列表 |
| `/merchant/incomes/summary` | GET | 获取收入汇总 |
| `/merchant/withdraws` | GET | 获取提现记录 |
| `/merchant/withdraws` | POST | 申请提现 |

**申请提现示例**:
```json
POST /merchant/withdraws
{
  "amount": 10000,
  "bankAccountId": 1
}
```

---

## 5. Admin 端 API

### 5.1 Admin 认证

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/login` | POST | 管理员登录 |
| `/admin/logout` | POST | 管理员登出 |
| `/admin/info` | GET | 获取管理员信息 |
| `/admin/token/refresh` | POST | 刷新 Token |

### 5.2 统计数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/stats/overview` | GET | 获取概览统计 |
| `/admin/stats/trends` | GET | 获取趋势数据 |
| `/admin/stats/distribution` | GET | 获取分布数据 |

### 5.3 用户管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/users` | GET | 获取用户列表 |
| `/admin/users/:id` | GET | 获取用户详情 |
| `/admin/users` | POST | 创建用户 |
| `/admin/users/:id` | PUT | 更新用户 |
| `/admin/users/:id/status` | PATCH | 更新用户状态 |
| `/admin/users/:id` | DELETE | 删除用户 |

### 5.4 服务商管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/providers` | GET | 获取服务商列表 |
| `/admin/providers/:id` | GET | 获取服务商详情 |
| `/admin/providers` | POST | 创建服务商 |
| `/admin/providers/:id` | PUT | 更新服务商 |
| `/admin/providers/:id/verify` | PATCH | 认证服务商 |
| `/admin/providers/:id/status` | PATCH | 更新状态 |

### 5.5 入驻审核

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/merchant-applications` | GET | 获取申请列表 |
| `/admin/merchant-applications/:id` | GET | 获取申请详情 |
| `/admin/merchant-applications/:id/approve` | POST | 批准申请 |
| `/admin/merchant-applications/:id/reject` | POST | 拒绝申请 |

### 5.6 预约管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/bookings` | GET | 获取预约列表 |
| `/admin/bookings/:id/status` | PATCH | 更新预约状态 |
| `/admin/bookings/refundable` | GET | 获取可退款预约 |
| `/admin/bookings/:bookingId/refund` | POST | 退款 |

### 5.7 项目管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/projects` | GET | 获取项目列表 |
| `/admin/projects/:id` | GET | 获取项目详情 |
| `/admin/projects/:id` | PUT | 更新项目 |
| `/admin/projects/:id/risks` | GET | 获取风险列表 |

### 5.8 财务管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/escrow-accounts` | GET | 获取托管账户列表 |
| `/admin/escrow-accounts/:id/freeze` | POST | 冻结账户 |
| `/admin/escrow-accounts/:id/unfreeze` | POST | 解冻账户 |
| `/admin/transactions` | GET | 获取交易记录 |
| `/admin/withdraws` | GET | 获取提现申请 |
| `/admin/withdraws/:id/approve` | POST | 批准提现 |
| `/admin/withdraws/:id/reject` | POST | 拒绝提现 |

### 5.9 RBAC 管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/roles` | GET | 获取角色列表 |
| `/admin/roles` | POST | 创建角色 |
| `/admin/roles/:id` | PUT | 更新角色 |
| `/admin/roles/:id` | DELETE | 删除角色 |
| `/admin/menus` | GET | 获取菜单列表 |
| `/admin/menus` | POST | 创建菜单 |
| `/admin/menus/:id` | PUT | 更新菜单 |
| `/admin/menus/:id` | DELETE | 删除菜单 |

### 5.10 审计日志

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/audit-logs` | GET | 获取审计日志 |
| `/admin/audit-logs/:id` | GET | 获取日志详情 |

---

## 6. 公共 API

### 6.1 服务商查询

| 端点 | 方法 | 说明 |
|------|------|------|
| `/providers` | GET | 获取服务商列表 |
| `/designers` | GET | 获取设计师列表 |
| `/designers/:id` | GET | 获取设计师详情 |
| `/designers/:id/cases` | GET | 获取设计师案例 |
| `/designers/:id/reviews` | GET | 获取设计师评价 |
| `/companies` | GET | 获取装修公司列表 |
| `/companies/:id` | GET | 获取公司详情 |
| `/foremen` | GET | 获取工长列表 |
| `/foremen/:id` | GET | 获取工长详情 |

### 6.2 案例查询

| 端点 | 方法 | 说明 |
|------|------|------|
| `/cases/:id` | GET | 获取案例详情 |
| `/provider-cases/:id` | GET | 获取服务商案例详情 |

### 6.3 主材门店

| 端点 | 方法 | 说明 |
|------|------|------|
| `/material-shops` | GET | 获取门店列表 |
| `/material-shops/:id` | GET | 获取门店详情 |

### 6.4 行政区划

| 端点 | 方法 | 说明 |
|------|------|------|
| `/regions/provinces` | GET | 获取省份列表 |
| `/regions/cities` | GET | 获取城市列表 |
| `/regions/provinces/:provinceCode/cities` | GET | 获取省份下的城市 |
| `/regions/cities/:cityCode/districts` | GET | 获取城市下的区县 |

### 6.5 数据字典

| 端点 | 方法 | 说明 |
|------|------|------|
| `/dictionaries/categories` | GET | 获取所有分类 |
| `/dictionaries/:category` | GET | 获取字典选项 |

### 6.6 文件上传

| 端点 | 方法 | 说明 |
|------|------|------|
| `/upload` | POST | 上传文件 |

**上传示例**:
```http
POST /upload
Content-Type: multipart/form-data

file: <binary>
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "url": "https://example.com/uploads/xxx.jpg"
  }
}
```

---

## 附录

### A. 业务状态码

#### 预约状态
- `1`: pending（待确认）
- `2`: confirmed（已确认）
- `3`: completed（已完成）
- `4`: cancelled（已取消）

#### 项目状态
- `0`: active（进行中）
- `1`: completed（已完成）
- `2`: paused（已暂停）
- `3`: closed（已关闭）

#### 项目业务状态
- `draft`: 草稿
- `proposal_confirmed`: 方案已确认
- `construction_confirmed`: 施工方已确认
- `construction_quote_confirmed`: 施工报价已确认
- `in_progress`: 施工中
- `completed`: 已完成
- `cancelled`: 已取消

#### 里程碑状态
- `0`: pending（待提交）
- `1`: in_progress（进行中）
- `2`: submitted（已提交验收）
- `3`: accepted（验收通过）
- `4`: paid（已支付）
- `5`: rejected（验收拒绝）

### B. 错误码说明

| 错误码 | 说明 |
|--------|------|
| 1001 | 参数错误 |
| 1002 | 资源不存在 |
| 1003 | 权限不足 |
| 2001 | Token 无效 |
| 2002 | Token 过期 |
| 3001 | 业务逻辑错误 |
| 4001 | 数据库错误 |
| 5001 | 第三方服务错误 |

### C. 限流规则

| 端点类型 | 限流规则 |
|----------|----------|
| 登录/注册 | 5 次/分钟 |
| 发送验证码 | 1 次/分钟 |
| 普通 API | 100 次/分钟 |
| 上传文件 | 10 次/分钟 |

---

**文档维护**: 本文档由开发团队维护，如有疑问请联系技术支持。
