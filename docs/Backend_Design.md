# 装修设计一体化平台 - 后端设计与API文档

> **文档版本**: v1.1
> **更新日期**: 2024年12月
> **状态**: 已实现

---

## 1. 系统架构

### 1.1 技术栈 (已落地)
- **语言**: Go (Gin框架)
- **数据库**: PostgreSQL 15+ (GORM ORM)
- **缓存**: Redis (规划中)
- **文档**: Markdown / Swagger

### 1.2 服务划分
目前采用单体模块化架构，便于快速迭代，未来可根据 `internal/module` 拆分微服务。
- `user`: 用户认证、个人资料
- `provider`: 服务商库
- `project`: 项目管理、施工日志、验收
- `escrow`: 资金托管、支付

---

## 2. API 接口详情

**Base URL**: `http://localhost:8080/api/v1`
**Content-Type**: `application/json`

### 2.1 认证模块 (Auth)

#### 注册
`POST /auth/register`
- **Request**:
  ```json
  {
    "phone": "13800138001",
    "code": "123456",
    "nickname": "张三",
    "userType": 1  // 1业主 2服务商 3工人
  }
  ```
- **Response**:
  ```json
  {
    "code": 0,
    "message": "注册成功",
    "data": { "userId": 1, "phone": "...", "nickname": "..." }
  }
  ```

#### 登录
`POST /auth/login`
- **Request**:
  ```json
  { "phone": "13800138001", "code": "123456" }
  ```
- **Response**:
  ```json
  {
    "code": 0,
    "data": {
      "token": "eyJ...",
      "refreshToken": "...",
      "expiresIn": 259200,
      "user": { ... }
    }
  }
  ```

#### 发送验证码
`POST /auth/send-code`
- **Request**: `{ "phone": "13800138001" }`
- **Response**: `{ "code": 0, "message": "验证码已发送" }` (测试环境固定123456)

---

### 2.2 用户模块 (User)

**Auth**: Bearer Token

#### 获取个人资料
`GET /user/profile`
- **Response**: `{ "id": 1, "nickname": "...", "avatar": "...", "userType": 1 }`

#### 更新个人资料
`PUT /user/profile`
- **Request**: `{ "nickname": "新昵称", "avatar": "http://..." }`

---

### 2.3 服务商模块 (Provider)

**Auth**: Bearer Token

#### 设计师列表
`GET /designers`
- **Query**: `keyword` (搜索), `rating` (按评分排序), `page`, `pageSize`
- **Response**:
  ```json
  {
    "data": {
      "list": [
        {
          "id": 1,
          "companyName": "顶层设计",
          "nickname": "设计总监",
          "rating": 4.9,
          "completedCnt": 100
        }
      ],
      "total": 1,
      "page": 1
    }
  }
  ```

#### 装修公司列表
`GET /companies`

#### 工长列表
`GET /foremen`

#### 服务商详情
`GET /designers/:id`

---

### 2.4 项目模块 (Project)

**Auth**: Bearer Token

#### 创建项目
`POST /projects`
- **Request**:
  ```json
  {
    "name": "我的新家",
    "address": "北京市...",
    "providerId": 1,
    "area": 120,
    "budget": 500000,
    "startDate": "2025-01-01",
    "expectedEnd": "2025-06-01"
  }
  ```
- **Response**: `{ "id": 1 }`
- **说明**: 创建时自动生成托管账户和默认验收节点。

#### 项目列表
`GET /projects`
- **Response**: 项目摘要列表

#### 项目详情
`GET /projects/:id`
- **Response**: 不仅包含项目基本信息，还包含：
  - `ownerName`, `providerName`
  - `milestones`: 验收节点列表 (含状态、金额)
  - `recentLogs`: 最近施工日志
  - `escrowBalance`: 托管账户余额

#### 施工日志
`GET /projects/:id/logs`
`POST /projects/:id/logs`
- **Request**: `{ "description": "水电施工", "photos": "[url1, url2]" }`

#### 验收节点
`GET /projects/:id/milestones`
`POST /projects/:id/accept` (验收通过)

---

### 2.5 资金托管 (Escrow)

**Auth**: Bearer Token

#### 托管账户详情
`GET /projects/:id/escrow`
- **Response**:
  ```json
  {
    "escrowAccount": { "totalAmount": 50000, "frozenAmount": 50000, "releasedAmount": 0 },
    "transactions": [ ... ]
  }
  ```

#### 存入资金
`POST /projects/:id/deposit`
- **Request**:
  ```json
  {
    "amount": 50000,
    "milestoneId": 1  // 可选，关联特定节点
  }
  ```

#### 释放资金
`POST /projects/:id/release`
- **Request**: `{ "milestoneId": 1 }`
- **说明**: 必须在节点验收通过(Status=3)后才能调用，释放对应节点的金额给服务商。

---

## 3. 错误码说明

| Code | 说明 |
|------|------|
| 0 | 成功 |
| 400 | 参数错误 / 业务校验失败 |
| 401 | 未授权 / Token过期 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 4. 数据库设计索引

详见 [Database_Design.md](./Database_Design.md)
