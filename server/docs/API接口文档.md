# 家装平台 API 接口文档
> ⚠️ 本文档为历史存档，新接口说明及最新格式请参考 `documentation/04-后端开发/API接口/认证模块.md`，以该目录内容为准。

## 目录
- [1. 全局说明](#1-全局说明)
- [2. 认证模块 (Auth)](#2-认证模块-auth)
- [3. 用户/业主端接口 (User)](#3-用户业主端接口-user)
- [4. 商家端接口 (Merchant)](#4-商家端接口-merchant)
- [5. 管理后台接口 (Admin)](#5-管理后台接口-admin)
- [6. 公共模块](#6-公共模块)

---

## 1. 全局说明

### 1.1 基础信息
- **Base URL**: `http://localhost:8080/api/v1` (开发环境)
- **Content-Type**: `application/json`
- **认证方式**: JWT (Header `Authorization: Bearer <token>`)

### 1.2 通用响应结构
```json
{
    "code": 0,
    "message": "success",
    "data": {}
}
```
- `code`: 状态码 (0: 成功, 400: 参数错误, 401: 未认证, 403: 权限不足, 404: 资源不存在, 500: 服务器错误)
- `message`: 提示信息
- `data`: 返回的业务数据

### 1.3 分页响应结构
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [],
        "total": 100,
        "page": 1,
        "pageSize": 20
    }
}
```

### 1.4 错误响应示例
```json
{
    "code": 401,
    "message": "未授权访问",
    "data": null
}
```

---

## 2. 认证模块 (Auth)

### 2.1 发送验证码
**接口**: `POST /api/v1/auth/send-code`
**描述**: 发送手机验证码（注册、登录、入驻申请）
**认证**: 无需认证
**请求参数**:
```json
{
    "phone": "13800138000"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "验证码已发送",
    "data": {
        "message": "测试环境验证码: 123456"
    }
}
```

---

### 2.2 用户注册
**接口**: `POST /api/v1/auth/register`
**描述**: 用户注册（业主端）
**认证**: 无需认证
**请求参数**:
```json
{
    "phone": "13800138000",
    "code": "123456",
    "password": "Password123!",
    "nickname": "张三"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "注册成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
        "user": {
            "id": 1,
            "phone": "13800138000",
            "nickname": "张三",
            "avatar": "",
            "userType": 1
        }
    }
}
```

---

### 2.3 用户登录
**接口**: `POST /api/v1/auth/login`
**描述**: 用户登录（支持验证码登录和密码登录）
**认证**: 无需认证
**请求参数**:
```json
{
    "phone": "13800138000",
    "code": "123456"
}
```
或
```json
{
    "phone": "13800138000",
    "password": "Password123!"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "登录成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
        "user": {
            "id": 1,
            "phone": "13800138000",
            "nickname": "张三",
            "avatar": "https://...",
            "userType": 1
        }
    }
}
```

---

### 2.4 刷新 Token
**接口**: `POST /api/v1/auth/refresh`
**描述**: 使用 refreshToken 刷新访问令牌
**认证**: 无需认证
**请求参数**:
```json
{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "刷新成功",
    "data": {
        "token": "新的访问令牌",
        "refreshToken": "新的刷新令牌"
    }
}
```

---

### 2.5 微信小程序登录
**接口**: `POST /api/v1/auth/wechat/mini/login`
**描述**: 客户端通过 `wx.login` 获取 code，并调用接口让后端通过 `wechatAuthService.Login` 验证，登录成功后返回 JWT；若账号未绑定手机号，则返回绑定凭证。
**认证**: 无需认证
**请求参数**:
```json
{
    "code": "wx.login 返回的 code"
}
```

**响应示例（已绑定手机号）**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
        "expiresIn": 28800,
        "user": {
            "id": 1,
            "phone": "13800138000",
            "nickname": "小程序用户",
            "avatar": "https://...",
            "userType": 1
        }
    }
}
```

**响应示例（需绑定手机号）**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "needBindPhone": true,
        "bindToken": "eyJhbGciOiJIUzI1NiIs...",
        "expiresIn": 300
    }
}
```

**备注**:
- 若 `wechatAuthService.Login` 返回 `NeedBindPhone`，需要引导用户调用 `POST /api/v1/auth/wechat/mini/bind-phone` 完成手机号绑定并获取最终 Token。
- 返回的 `bindToken` 仅限短期使用（`expiresIn` 单位为秒）。

---

### 2.6 微信小程序绑定手机号
**接口**: `POST /api/v1/auth/wechat/mini/bind-phone`
**描述**: 使用微信登录返回的 `bindToken` 和 `wx.getPhoneNumber` 返回的 code 完成手机号绑定，并返回最终 JWT。
**认证**: 无需认证
**请求参数**:
```json
{
    "bindToken": "微信登录阶段返回的 bindToken",
    "phoneCode": "wx.getPhoneNumber 返回的 code"
}
```

**响应示例**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
        "expiresIn": 28800,
        "user": {
            "id": 2,
            "phone": "13800138000",
            "nickname": "用户3800",
            "avatar": "",
            "userType": 1
        }
    }
}
```

**备注**:
- `bindToken` 只可短时使用，建议在 5 分钟内完成绑定。
- `phoneCode` 只能由小程序端通过微信能力获取，不能重放。

---
## 3. 用户/业主端接口 (User)

> **所有用户端接口均需携带 JWT Token**

### 3.1 个人资料管理

#### 3.1.1 获取个人资料
**接口**: `GET /api/v1/user/profile`
**描述**: 获取当前登录用户的详细信息
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "phone": "13800138000",
        "nickname": "张三",
        "avatar": "https://...",
        "userType": 1,
        "createdAt": "2025-01-01T00:00:00Z"
    }
}
```

---

#### 3.1.2 更新个人资料
**接口**: `PUT /api/v1/user/profile`
**描述**: 更新用户昵称、头像等信息
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "nickname": "新昵称",
    "avatar": "https://新头像URL"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "更新成功",
    "data": {
        "id": 1,
        "nickname": "新昵称",
        "avatar": "https://新头像URL"
    }
}
```

---

### 3.2 服务商查询

#### 3.2.1 查询服务商列表（公开接口）
**接口**: `GET /api/v1/providers`
**描述**: 查询所有类型服务商（设计师/装修公司/工长）
**认证**: 无需认证（公开接口）
**Query 参数**:
- `type`: 类型筛选 (designer/company/foreman)
- `keyword`: 关键词搜索
- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20）
- `latitude`: 纬度（用于距离排序）
- `longitude`: 经度（用于距离排序）
- `sortBy`: 排序方式 (rating/distance/price_low/price_high)

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "userId": 10,
                "providerType": 1,
                "companyName": "XX设计工作室",
                "avatar": "https://...",
                "rating": 4.8,
                "reviewCount": 120,
                "yearsExperience": 8,
                "specialty": "现代简约,北欧风格",
                "priceMin": 100,
                "priceMax": 300,
                "verified": true,
                "status": 1,
                "restoreRate": 98.5,
                "budgetControl": 95.2,
                "distance": 2.5
            }
        ],
        "total": 50,
        "page": 1,
        "pageSize": 20
    }
}
```

---

#### 3.2.2 设计师列表
**接口**: `GET /api/v1/designers`
**描述**: 专门查询设计师
**认证**: 无需认证
**Query 参数**: 同 3.2.1

---

#### 3.2.3 装修公司列表
**接口**: `GET /api/v1/companies`
**描述**: 专门查询装修公司
**认证**: 无需认证
**Query 参数**: 同 3.2.1

---

#### 3.2.4 工长列表
**接口**: `GET /api/v1/foremen`
**描述**: 专门查询工长
**认证**: 无需认证
**Query 参数**: 同 3.2.1

---

#### 3.2.5 服务商详情
**接口**: `GET /api/v1/designers/:id`
**描述**: 获取服务商详细信息（适用于所有类型）
**认证**: 无需认证

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "companyName": "XX设计工作室",
        "avatar": "https://...",
        "rating": 4.8,
        "reviewCount": 120,
        "yearsExperience": 8,
        "specialty": "现代简约,北欧风格",
        "description": "专注高品质室内设计...",
        "portfolioCount": 30,
        "verified": true,
        "businessLicense": "https://...",
        "qualificationCert": "https://...",
        "serviceArea": ["浦东新区", "徐汇区"],
        "teamSize": 15,
        "address": "上海市浦东新区..."
    }
}
```

---

#### 3.2.6 服务商案例列表
**接口**: `GET /api/v1/designers/:id/cases`
**描述**: 获取服务商的作品案例
**认证**: 无需认证
**Query 参数**:
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "title": "现代简约风格案例",
                "coverImage": "https://...",
                "images": ["https://...", "https://..."],
                "style": "现代简约",
                "area": "120㎡",
                "location": "上海市浦东新区",
                "completionYear": "2024",
                "description": "案例描述...",
                "viewCount": 1500
            }
        ],
        "total": 30
    }
}
```

---

#### 3.2.7 服务商评价列表
**接口**: `GET /api/v1/designers/:id/reviews`
**描述**: 获取服务商的用户评价
**认证**: 无需认证
**Query 参数**:
- `filter`: all（全部）/ pic（有图）/ good（好评）
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "userId": 20,
                "userName": "李四",
                "userAvatar": "https://...",
                "rating": 5,
                "content": "设计师很专业，效果超出预期！",
                "images": ["https://...", "https://..."],
                "createdAt": "2025-01-15T10:30:00Z",
                "reply": "感谢您的认可！"
            }
        ],
        "total": 120
    }
}
```

---

#### 3.2.8 服务商评价统计
**接口**: `GET /api/v1/designers/:id/review-stats`
**描述**: 获取评价统计信息
**认证**: 无需认证

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "totalCount": 120,
        "averageRating": 4.8,
        "ratings": {
            "5": 90,
            "4": 20,
            "3": 8,
            "2": 2,
            "1": 0
        },
        "withPicturesCount": 80
    }
}
```

---

#### 3.2.9 关注服务商
**接口**: `POST /api/v1/providers/:id/follow`
**描述**: 关注某个服务商
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "关注成功",
    "data": null
}
```

---

#### 3.2.10 取消关注
**接口**: `DELETE /api/v1/providers/:id/follow`
**描述**: 取消关注服务商
**认证**: 需要 JWT Token

---

#### 3.2.11 收藏服务商
**接口**: `POST /api/v1/providers/:id/favorite`
**描述**: 收藏服务商
**认证**: 需要 JWT Token

---

#### 3.2.12 取消收藏
**接口**: `DELETE /api/v1/providers/:id/favorite`
**描述**: 取消收藏
**认证**: 需要 JWT Token

---

#### 3.2.13 获取用户与服务商的关系状态
**接口**: `GET /api/v1/providers/:id/user-status`
**描述**: 获取当前用户是否已关注、收藏该服务商
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "isFollowed": true,
        "isFavorited": false
    }
}
```

---

### 3.3 预约管理

#### 3.3.1 创建预约
**接口**: `POST /api/v1/bookings`
**描述**: 用户向服务商发起预约
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "providerId": 1,
    "providerType": "designer",
    "address": "上海市浦东新区张江高科技园区",
    "area": 120,
    "renovationType": "全屋装修",
    "budgetRange": "10-20万",
    "preferredDate": "2025-02-10",
    "phone": "13800138000",
    "notes": "希望了解北欧风格的设计方案",
    "houseLayout": "3室2厅2卫"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "预约成功",
    "data": {
        "id": 100,
        "bookingNo": "BK20250115001",
        "status": 1,
        "intentFee": 500,
        "intentFeePaid": false
    }
}
```

---

#### 3.3.2 获取预约列表
**接口**: `GET /api/v1/bookings`
**描述**: 获取当前用户的所有预约
**认证**: 需要 JWT Token
**Query 参数**:
- `paid`: true（已支付意向金）/ false（未支付）
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 100,
                "bookingNo": "BK20250115001",
                "providerId": 1,
                "providerName": "XX设计工作室",
                "providerAvatar": "https://...",
                "status": 1,
                "address": "上海市浦东新区...",
                "area": 120,
                "renovationType": "全屋装修",
                "budgetRange": "10-20万",
                "preferredDate": "2025-02-10",
                "intentFee": 500,
                "intentFeePaid": false,
                "createdAt": "2025-01-15T10:00:00Z"
            }
        ],
        "total": 5
    }
}
```

---

#### 3.3.3 获取预约详情
**接口**: `GET /api/v1/bookings/:id`
**描述**: 获取某个预约的详细信息
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 100,
        "bookingNo": "BK20250115001",
        "userId": 10,
        "providerId": 1,
        "providerName": "XX设计工作室",
        "providerAvatar": "https://...",
        "providerPhone": "13900139000",
        "status": 1,
        "address": "上海市浦东新区...",
        "area": 120,
        "renovationType": "全屋装修",
        "budgetRange": "10-20万",
        "preferredDate": "2025-02-10",
        "phone": "13800138000",
        "notes": "希望了解北欧风格的设计方案",
        "houseLayout": "3室2厅2卫",
        "intentFee": 500,
        "intentFeePaid": false,
        "createdAt": "2025-01-15T10:00:00Z",
        "updatedAt": "2025-01-15T10:00:00Z"
    }
}
```

---

#### 3.3.4 支付意向金
**接口**: `POST /api/v1/bookings/:id/pay-intent`
**描述**: 支付预约的意向金
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "paymentMethod": "wechat"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "支付成功",
    "data": {
        "transactionId": "TXN20250115001",
        "intentFeePaid": true
    }
}
```

---

#### 3.3.5 取消预约
**接口**: `DELETE /api/v1/bookings/:id/cancel`
**描述**: 取消预约（变更状态）
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "预约已取消",
    "data": null
}
```

---

#### 3.3.6 删除预约记录
**接口**: `DELETE /api/v1/bookings/:id`
**描述**: 彻底删除预约记录
**认证**: 需要 JWT Token

---

### 3.4 项目管理

#### 3.4.1 创建项目
**接口**: `POST /api/v1/projects`
**描述**: 创建装修项目（通常由确认预约后生成）
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "name": "浦东新区120平米装修项目",
    "providerId": 1,
    "address": "上海市浦东新区...",
    "area": 120,
    "budget": 150000,
    "startDate": "2025-03-01",
    "expectedEndDate": "2025-06-30",
    "description": "项目描述..."
}
```

---

#### 3.4.2 获取项目列表
**接口**: `GET /api/v1/projects`
**描述**: 获取当前用户的所有项目
**认证**: 需要 JWT Token
**Query 参数**:
- `status`: 项目状态筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "name": "浦东新区120平米装修项目",
                "providerId": 1,
                "providerName": "XX装修公司",
                "address": "上海市浦东新区...",
                "area": 120,
                "budget": 150000,
                "status": "in_progress",
                "currentPhase": "水电改造",
                "progress": 35,
                "startDate": "2025-03-01",
                "expectedEndDate": "2025-06-30",
                "createdAt": "2025-02-20T00:00:00Z"
            }
        ],
        "total": 3
    }
}
```

---

#### 3.4.3 获取项目详情
**接口**: `GET /api/v1/projects/:id`
**描述**: 获取项目详细信息
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "name": "浦东新区120平米装修项目",
        "ownerId": 10,
        "providerId": 1,
        "providerName": "XX装修公司",
        "providerPhone": "13900139000",
        "address": "上海市浦东新区...",
        "area": 120,
        "budget": 150000,
        "status": "in_progress",
        "currentPhase": "水电改造",
        "progress": 35,
        "startDate": "2025-03-01",
        "expectedEndDate": "2025-06-30",
        "description": "项目描述...",
        "phases": [
            {
                "id": 1,
                "name": "拆除与清理",
                "status": "completed",
                "progress": 100
            },
            {
                "id": 2,
                "name": "水电改造",
                "status": "in_progress",
                "progress": 60
            }
        ]
    }
}
```

---

#### 3.4.4 更新项目
**接口**: `PUT /api/v1/projects/:id`
**描述**: 更新项目信息
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "name": "新项目名称",
    "budget": 160000,
    "expectedEndDate": "2025-07-15"
}
```

---

#### 3.4.5 获取施工日志
**接口**: `GET /api/v1/projects/:id/logs`
**描述**: 获取项目的施工日志
**认证**: 需要 JWT Token
**Query 参数**:
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "projectId": 1,
                "title": "水电改造进度更新",
                "content": "今日完成客厅电路布线...",
                "images": ["https://...", "https://..."],
                "createdBy": "工长张师傅",
                "createdAt": "2025-03-15T16:00:00Z"
            }
        ],
        "total": 20
    }
}
```

---

#### 3.4.6 添加施工日志
**接口**: `POST /api/v1/projects/:id/logs`
**描述**: 添加施工日志（通常由工长或项目负责人添加）
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "title": "今日施工进度",
    "content": "完成了厨房水管铺设...",
    "images": ["https://...", "https://..."]
}
```

---

#### 3.4.7 获取验收节点
**接口**: `GET /api/v1/projects/:id/milestones`
**描述**: 获取项目的验收节点列表
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": [
        {
            "id": 1,
            "projectId": 1,
            "name": "水电验收",
            "description": "水电改造完成后的验收",
            "amount": 30000,
            "status": "pending",
            "scheduledDate": "2025-03-20",
            "completedDate": null
        },
        {
            "id": 2,
            "name": "泥瓦验收",
            "amount": 40000,
            "status": "not_started"
        }
    ]
}
```

---

#### 3.4.8 确认验收节点
**接口**: `POST /api/v1/projects/:id/accept`
**描述**: 业主确认验收通过（触发资金释放）
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "milestoneId": 1,
    "rating": 5,
    "comment": "验收通过，施工质量很好"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "验收确认成功，资金已释放",
    "data": {
        "milestoneId": 1,
        "releasedAmount": 30000
    }
}
```

---

#### 3.4.9 获取项目阶段
**接口**: `GET /api/v1/projects/:id/phases`
**描述**: 获取项目的施工阶段详情
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": [
        {
            "id": 1,
            "projectId": 1,
            "name": "拆除与清理",
            "description": "拆除旧装修，清理现场",
            "status": "completed",
            "progress": 100,
            "startDate": "2025-03-01",
            "endDate": "2025-03-05",
            "tasks": [
                {
                    "id": 1,
                    "name": "拆除旧墙纸",
                    "isCompleted": true
                },
                {
                    "id": 2,
                    "name": "清理建筑垃圾",
                    "isCompleted": true
                }
            ]
        }
    ]
}
```

---

#### 3.4.10 更新阶段状态
**接口**: `PUT /api/v1/phases/:phaseId`
**描述**: 更新施工阶段的状态和日期
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "status": "in_progress",
    "startDate": "2025-03-10",
    "endDate": "2025-03-20"
}
```

---

#### 3.4.11 更新任务状态
**接口**: `PUT /api/v1/phases/:phaseId/tasks/:taskId`
**描述**: 更新阶段中某个任务的完成状态
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "isCompleted": true
}
```

---

### 3.5 托管账户与资金管理

#### 3.5.1 查询托管账户
**接口**: `GET /api/v1/projects/:id/escrow`
**描述**: 查询项目的托管账户详情
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "projectId": 1,
        "totalAmount": 150000,
        "frozenAmount": 30000,
        "releasedAmount": 0,
        "availableAmount": 120000,
        "status": "active",
        "transactions": [
            {
                "id": 1,
                "type": "deposit",
                "amount": 150000,
                "description": "首次充值",
                "createdAt": "2025-03-01T00:00:00Z"
            }
        ]
    }
}
```

---

#### 3.5.2 充值到托管账户
**接口**: `POST /api/v1/projects/:id/deposit`
**描述**: 业主向托管账户充值
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "amount": 50000,
    "milestoneId": 1,
    "paymentMethod": "wechat"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "充值成功",
    "data": {
        "transactionId": "TXN20250301001",
        "amount": 50000,
        "newBalance": 200000
    }
}
```

---

#### 3.5.3 释放资金
**接口**: `POST /api/v1/projects/:id/release`
**描述**: 释放托管资金给服务商（通常在验收通过后自动触发）
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "milestoneId": 1
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "资金释放成功",
    "data": {
        "milestoneId": 1,
        "releasedAmount": 30000,
        "recipientProviderId": 1
    }
}
```

---

### 3.6 售后服务

#### 3.6.1 获取售后列表
**接口**: `GET /api/v1/after-sales`
**描述**: 获取当前用户的售后申请列表
**认证**: 需要 JWT Token
**Query 参数**:
- `status`: 0（待处理）/ 1（处理中）/ 2（已完成）/ 3（已拒绝）
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "bookingId": 100,
                "orderNo": "ORD20250115001",
                "type": "refund",
                "reason": "质量问题",
                "description": "墙面开裂需要返工",
                "images": ["https://...", "https://..."],
                "amount": 5000,
                "status": 1,
                "createdAt": "2025-01-20T10:00:00Z",
                "reply": "已安排工程师上门查看"
            }
        ],
        "total": 3
    }
}
```

---

#### 3.6.2 提交售后申请
**接口**: `POST /api/v1/after-sales`
**描述**: 提交售后服务申请
**认证**: 需要 JWT Token
**请求参数**:
```json
{
    "bookingId": 100,
    "orderNo": "ORD20250115001",
    "type": "refund",
    "reason": "质量问题",
    "description": "墙面出现开裂，需要返工处理",
    "images": ["https://image1.jpg", "https://image2.jpg"],
    "amount": 5000
}
```
> **type 类型**: `refund`（退款）/ `complaint`（投诉）/ `repair`（维修）

**响应数据**:
```json
{
    "code": 0,
    "message": "售后申请提交成功",
    "data": {
        "id": 10,
        "status": 0
    }
}
```

---

#### 3.6.3 获取售后详情
**接口**: `GET /api/v1/after-sales/:id`
**描述**: 获取售后申请详情
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "userId": 10,
        "bookingId": 100,
        "orderNo": "ORD20250115001",
        "type": "refund",
        "reason": "质量问题",
        "description": "墙面开裂需要返工",
        "images": ["https://...", "https://..."],
        "amount": 5000,
        "status": 1,
        "reply": "已安排工程师上门查看",
        "createdAt": "2025-01-20T10:00:00Z",
        "updatedAt": "2025-01-21T14:30:00Z"
    }
}
```

---

#### 3.6.4 取消售后申请
**接口**: `DELETE /api/v1/after-sales/:id`
**描述**: 取消售后申请
**认证**: 需要 JWT Token

---

## 4. 商家端接口 (Merchant)

> **所有商家端接口均需携带商家 JWT Token**

### 4.0 最新契约补充（2026-02 阶段1）

> 以下内容为阶段1已落地契约，优先级高于本节旧示例字段。

#### 4.0.1 `GET /api/v1/merchant/dashboard`
- 新增平铺字段：`todayBookings`、`pendingProposals`、`activeProjects`、`totalRevenue`、`monthRevenue`。
- 兼容保留：`bookings/proposals/orders` 分组统计结构。

#### 4.0.2 `POST /api/v1/merchant/login`
- `data.provider` 新增：
  - `applicantType`: `personal|studio|company|foreman`
  - `providerSubType`: `designer|company|foreman`

#### 4.0.3 `GET /api/v1/merchant/info`
- 补充返回：`applicantType`、`providerSubType`、`workTypes`。

#### 4.0.4 `PUT /api/v1/merchant/info`
- 支持入参：`workTypes: string[]`。
- 校验规则：工长至少 1 项；非工长可忽略并自动清空。

#### 4.0.5 `GET /api/v1/merchant/service-settings`
**响应字段**：
- `acceptBooking: boolean`
- `autoConfirmHours: number`
- `responseTimeDesc: string`
- `priceRangeMin: number`
- `priceRangeMax: number`
- `serviceStyles: string[]`
- `servicePackages: array`

#### 4.0.6 `PUT /api/v1/merchant/service-settings`
**请求字段**：同 `GET` 返回结构。

#### 4.0.7 高风险资金操作字段
- `POST /api/v1/merchant/withdraw` 新增必填：`verificationCode`。
- `POST /api/v1/merchant/bank-accounts` 新增必填：`verificationCode`。

---

### 4.1 商家入驻申请

#### 4.1.1 提交入驻申请
**接口**: `POST /api/v1/merchant/apply`
**描述**: 服务商提交入驻申请
**认证**: 无需认证
**请求参数**:
```json
{
    "phone": "13800138000",
    "code": "123456",
    "applicantType": "studio",
    "realName": "张三",
    "idCardNo": "310101199001011234",
    "idCardFront": "https://id-front.jpg",
    "idCardBack": "https://id-back.jpg",
    "companyName": "XX设计工作室",
    "licenseNo": "91310000MA1234567X",
    "licenseImage": "https://license.jpg",
    "teamSize": 8,
    "yearsExperience": 10,
    "workTypes": ["electrician", "plumber"],
    "officeAddress": "上海市浦东新区张江高科技园区",
    "serviceArea": ["浦东新区", "徐汇区", "黄浦区"],
    "styles": ["现代简约", "北欧", "日式"],
    "introduction": "专注高品质室内设计，拥有8年从业经验...",
    "portfolioCases": [
        {
            "title": "现代简约风格案例",
            "images": ["https://case1-1.jpg", "https://case1-2.jpg"],
            "style": "现代简约",
            "area": "120㎡",
            "year": "2024"
        },
        {
            "title": "北欧风格案例",
            "images": ["https://case2-1.jpg"],
            "style": "北欧",
            "area": "95㎡",
            "year": "2024"
        }
    ]
}
```
> **applicantType**: `personal`（个人）/ `studio`（工作室）/ `company`（公司）/ `foreman`（工长）
>
> **workTypes**: 工长类型必填，其他类型可省略。推荐值：`mason`、`electrician`、`carpenter`、`painter`、`plumber`。

**响应数据**:
```json
{
    "code": 0,
    "message": "申请提交成功，请等待审核",
    "data": {
        "applicationId": 100,
        "status": "pending"
    }
}
```

---

#### 4.1.2 查询申请状态
**接口**: `GET /api/v1/merchant/apply/:phone/status`
**描述**: 通过手机号查询入驻申请状态
**认证**: 无需认证

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "applicationId": 100,
        "phone": "13800138000",
        "status": "pending",
        "applicantType": "studio",
        "companyName": "XX设计工作室",
        "submittedAt": "2025-01-15T10:00:00Z",
        "reviewedAt": null,
        "rejectReason": null
    }
}
```
> **status**: `pending`（待审核）/ `approved`（已通过）/ `rejected`（已拒绝）

---

#### 4.1.3 重新提交申请
**接口**: `POST /api/v1/merchant/apply/:id/resubmit`
**描述**: 被拒绝后重新提交申请
**认证**: 无需认证
**请求参数**: 同 4.1.1

---

### 4.2 商家认证

#### 4.2.1 商家登录
**接口**: `POST /api/v1/merchant/login`
**描述**: 商家登录（仅支持验证码登录）
**认证**: 无需认证
**请求参数**:
```json
{
    "phone": "13800138000",
    "code": "123456"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "登录成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
        "merchant": {
            "id": 1,
            "userId": 50,
            "providerType": 1,
            "companyName": "XX设计工作室",
            "avatar": "https://...",
            "phone": "13800138000",
            "verified": true,
            "status": 1
        }
    }
}
```

---

### 4.3 商家信息

#### 4.3.1 获取商家信息
**接口**: `GET /api/v1/merchant/info`
**描述**: 获取当前登录商家的详细信息
**认证**: 需要商家 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "userId": 50,
        "providerType": 1,
        "companyName": "XX设计工作室",
        "avatar": "https://...",
        "phone": "13800138000",
        "rating": 4.8,
        "reviewCount": 120,
        "yearsExperience": 8,
        "specialty": "现代简约,北欧风格",
        "verified": true,
        "status": 1,
        "serviceArea": ["浦东新区", "徐汇区"],
        "teamSize": 8,
        "officeAddress": "上海市浦东新区张江高科技园区"
    }
}
```

---

### 4.4 预约管理

#### 4.4.1 获取预约列表
**接口**: `GET /api/v1/merchant/bookings`
**描述**: 获取该商家收到的所有预约
**认证**: 需要商家 JWT Token
**Query 参数**:
- `status`: 预约状态筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 100,
                "bookingNo": "BK20250115001",
                "userId": 10,
                "userName": "李四",
                "userPhone": "13900139000",
                "address": "上海市浦东新区...",
                "area": 120,
                "renovationType": "全屋装修",
                "budgetRange": "10-20万",
                "preferredDate": "2025-02-10",
                "notes": "希望了解北欧风格的设计方案",
                "status": 1,
                "intentFeePaid": true,
                "createdAt": "2025-01-15T10:00:00Z"
            }
        ],
        "total": 15
    }
}
```

---

#### 4.4.2 获取预约详情
**接口**: `GET /api/v1/merchant/bookings/:id`
**描述**: 获取某个预约的详细信息
**认证**: 需要商家 JWT Token

---

### 4.5 方案管理

#### 4.5.1 提交设计方案
**接口**: `POST /api/v1/merchant/proposals`
**描述**: 商家向业主提交设计方案
**认证**: 需要商家 JWT Token
**请求参数**:
```json
{
    "bookingId": 100,
    "summary": "北欧风格设计方案概述...",
    "designFee": 8000,
    "constructionFee": 120000,
    "materialFee": 80000,
    "estimatedDays": 90,
    "attachments": ["https://design1.pdf", "https://design2.pdf"]
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "方案提交成功",
    "data": {
        "id": 50,
        "bookingId": 100,
        "totalAmount": 208000,
        "status": "pending"
    }
}
```

---

#### 4.5.2 获取方案列表
**接口**: `GET /api/v1/merchant/proposals`
**描述**: 获取该商家提交的所有方案
**认证**: 需要商家 JWT Token
**Query 参数**:
- `status`: pending（待确认）/ accepted（已接受）/ rejected（已拒绝）
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 50,
                "bookingId": 100,
                "userName": "李四",
                "summary": "北欧风格设计方案概述...",
                "designFee": 8000,
                "constructionFee": 120000,
                "materialFee": 80000,
                "totalAmount": 208000,
                "estimatedDays": 90,
                "status": "pending",
                "createdAt": "2025-01-16T14:00:00Z"
            }
        ],
        "total": 8
    }
}
```

---

### 4.6 订单管理

#### 4.6.1 获取订单列表
**接口**: `GET /api/v1/merchant/orders`
**描述**: 获取该商家的所有订单
**认证**: 需要商家 JWT Token
**Query 参数**:
- `status`: 订单状态筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "orderNo": "ORD20250120001",
                "userId": 10,
                "userName": "李四",
                "projectId": 5,
                "projectName": "浦东新区120平米装修项目",
                "totalAmount": 208000,
                "paidAmount": 50000,
                "status": "in_progress",
                "createdAt": "2025-01-20T00:00:00Z"
            }
        ],
        "total": 12
    }
}
```

---

### 4.7 商家工作台

#### 4.7.1 获取工作台数据
**接口**: `GET /api/v1/merchant/dashboard`
**描述**: 获取商家首页统计数据
**认证**: 需要商家 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "todayBookings": 3,
        "pendingProposals": 5,
        "activeProjects": 8,
        "totalRevenue": 1200000,
        "monthRevenue": 150000,
        "rating": 4.8,
        "reviewCount": 120,
        "recentBookings": [
            {
                "id": 100,
                "userName": "李四",
                "area": 120,
                "budgetRange": "10-20万",
                "createdAt": "2025-01-15T10:00:00Z"
            }
        ]
    }
}
```

---

### 4.8 收益管理

#### 4.8.1 收益概览
**接口**: `GET /api/v1/merchant/income/summary`
**描述**: 获取收益统计概览
**认证**: 需要商家 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "totalIncome": 1200000,
        "availableBalance": 50000,
        "frozenAmount": 30000,
        "withdrawnAmount": 1120000,
        "monthIncome": 150000,
        "todayIncome": 5000
    }
}
```

---

#### 4.8.2 收入流水
**接口**: `GET /api/v1/merchant/income/list`
**描述**: 获取收入明细流水
**认证**: 需要商家 JWT Token
**Query 参数**:
- `type`: deposit（充值）/ payment（收款）/ refund（退款）
- `status`: pending（待结算）/ completed（已结算）
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "type": "payment",
                "amount": 30000,
                "description": "项目验收付款",
                "projectId": 5,
                "projectName": "浦东新区120平米装修项目",
                "status": "completed",
                "createdAt": "2025-01-20T10:00:00Z"
            }
        ],
        "total": 50
    }
}
```

---

### 4.9 提现管理

#### 4.9.1 获取提现记录
**接口**: `GET /api/v1/merchant/withdraw/list`
**描述**: 获取提现申请记录
**认证**: 需要商家 JWT Token
**Query 参数**:
- `status`: pending（处理中）/ completed（已完成）/ rejected（已拒绝）
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "amount": 50000,
                "fee": 500,
                "actualAmount": 49500,
                "bankAccountNo": "6222021234567890",
                "bankName": "中国工商银行",
                "status": "completed",
                "createdAt": "2025-01-10T10:00:00Z",
                "completedAt": "2025-01-11T15:00:00Z"
            }
        ],
        "total": 10
    }
}
```

---

#### 4.9.2 申请提现
**接口**: `POST /api/v1/merchant/withdraw`
**描述**: 提交提现申请
**认证**: 需要商家 JWT Token
**请求参数**:
```json
{
    "amount": 10000,
    "bankAccountId": 1,
    "verificationCode": "123456"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "提现申请提交成功",
    "data": {
        "id": 10,
        "amount": 10000,
        "fee": 100,
        "actualAmount": 9900,
        "status": "pending"
    }
}
```

---

### 4.10 银行账户管理

#### 4.10.1 获取银行账户列表
**接口**: `GET /api/v1/merchant/bank-accounts`
**描述**: 获取商家绑定的银行账户
**认证**: 需要商家 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": [
        {
            "id": 1,
            "accountName": "张三",
            "accountNo": "6222021234567890",
            "bankName": "中国工商银行",
            "branchName": "上海浦东支行",
            "isDefault": true,
            "createdAt": "2025-01-01T00:00:00Z"
        }
    ]
}
```

---

#### 4.10.2 添加银行账户
**接口**: `POST /api/v1/merchant/bank-accounts`
**描述**: 绑定新的银行账户
**认证**: 需要商家 JWT Token
**请求参数**:
```json
{
    "accountName": "张三",
    "accountNo": "6222021234567890",
    "bankName": "中国工商银行",
    "branchName": "上海浦东支行",
    "isDefault": true,
    "verificationCode": "123456"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "银行账户添加成功",
    "data": {
        "id": 2
    }
}
```

---

#### 4.10.3 删除银行账户
**接口**: `DELETE /api/v1/merchant/bank-accounts/:id`
**描述**: 删除银行账户
**认证**: 需要商家 JWT Token

---

#### 4.10.4 设置默认账户
**接口**: `PUT /api/v1/merchant/bank-accounts/:id/default`
**描述**: 设置为默认提现账户
**认证**: 需要商家 JWT Token

---

### 4.11 作品集管理

#### 4.11.1 获取作品集列表
**接口**: `GET /api/v1/merchant/cases`
**描述**: 获取商家的所有作品案例
**认证**: 需要商家 JWT Token
**Query 参数**:
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "title": "现代简约风格案例",
                "coverImage": "https://cover.jpg",
                "style": "现代简约",
                "area": "120㎡",
                "year": "2024",
                "description": "案例描述...",
                "images": ["https://1.jpg", "https://2.jpg"],
                "viewCount": 1500,
                "sortOrder": 0,
                "createdAt": "2024-12-01T00:00:00Z"
            }
        ],
        "total": 30
    }
}
```

---

#### 4.11.2 获取作品详情
**接口**: `GET /api/v1/merchant/cases/:id`
**描述**: 获取作品案例详情
**认证**: 需要商家 JWT Token

---

#### 4.11.3 创建作品案例
**接口**: `POST /api/v1/merchant/cases`
**描述**: 添加新的作品案例
**认证**: 需要商家 JWT Token
**请求参数**:
```json
{
    "title": "现代简约风格案例",
    "coverImage": "https://cover.jpg",
    "style": "现代简约",
    "area": "120㎡",
    "year": "2024",
    "description": "本案例采用现代简约风格...",
    "images": ["https://1.jpg", "https://2.jpg", "https://3.jpg"]
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "作品添加成功",
    "data": {
        "id": 50
    }
}
```

---

#### 4.11.4 更新作品案例
**接口**: `PUT /api/v1/merchant/cases/:id`
**描述**: 更新作品案例信息
**认证**: 需要商家 JWT Token
**请求参数**: 同 4.11.3

---

#### 4.11.5 删除作品案例
**接口**: `DELETE /api/v1/merchant/cases/:id`
**描述**: 删除作品案例
**认证**: 需要商家 JWT Token

---

#### 4.11.6 作品排序
**接口**: `PUT /api/v1/merchant/cases/reorder`
**描述**: 调整作品案例的展示顺序
**认证**: 需要商家 JWT Token
**请求参数**:
```json
{
    "orders": [
        {"id": 1, "sortOrder": 0},
        {"id": 2, "sortOrder": 1},
        {"id": 3, "sortOrder": 2}
    ]
}
```

---

## 5. 管理后台接口 (Admin)

> **所有管理后台接口均需携带管理员 JWT Token**

### 5.1 管理员认证

#### 5.1.1 管理员登录
**接口**: `POST /api/v1/admin/login`
**描述**: 管理员登录
**认证**: 无需认证
**请求参数**:
```json
{
    "username": "admin",
    "password": "password123"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "登录成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "admin": {
            "id": 1,
            "username": "admin",
            "phone": "13900139000",
            "roles": [
                {
                    "id": 1,
                    "name": "超级管理员",
                    "code": "super_admin"
                }
            ]
        }
    }
}
```

---

#### 5.1.2 获取管理员信息
**接口**: `GET /api/v1/admin/info`
**描述**: 获取当前登录管理员的信息和权限
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "username": "admin",
        "phone": "13900139000",
        "avatar": "https://...",
        "roles": [
            {
                "id": 1,
                "name": "超级管理员",
                "code": "super_admin"
            }
        ],
        "permissions": [
            "user:read",
            "user:write",
            "provider:read",
            "provider:write",
            "booking:read",
            "finance:read",
            "system:manage"
        ],
        "menus": [
            {
                "id": 1,
                "name": "仪表盘",
                "path": "/dashboard",
                "icon": "dashboard"
            },
            {
                "id": 2,
                "name": "用户管理",
                "path": "/users",
                "icon": "user"
            }
        ]
    }
}
```

---

### 5.2 数据统计

#### 5.2.1 概览统计
**接口**: `GET /api/v1/admin/stats/overview`
**描述**: 获取平台核心数据概览
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "totalUsers": 5000,
        "totalProviders": 300,
        "totalProjects": 1200,
        "totalBookings": 3000,
        "totalRevenue": 50000000,
        "monthRevenue": 5000000,
        "todayBookings": 15,
        "pendingAudits": 8,
        "activeProjects": 120
    }
}
```

---

#### 5.2.2 趋势分析
**接口**: `GET /api/v1/admin/stats/trends`
**描述**: 获取趋势数据（用户增长、订单趋势等）
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `days`: 7 或 30（默认 7 天）

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "userTrend": [
            {"date": "2025-01-09", "count": 50},
            {"date": "2025-01-10", "count": 65},
            {"date": "2025-01-11", "count": 70}
        ],
        "bookingTrend": [
            {"date": "2025-01-09", "count": 10},
            {"date": "2025-01-10", "count": 15},
            {"date": "2025-01-11", "count": 12}
        ],
        "revenueTrend": [
            {"date": "2025-01-09", "amount": 50000},
            {"date": "2025-01-10", "amount": 80000}
        ]
    }
}
```

---

#### 5.2.3 数据分布
**接口**: `GET /api/v1/admin/stats/distribution`
**描述**: 获取数据分布统计（地域、类型等）
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "providerTypeDistribution": {
            "designer": 120,
            "company": 100,
            "foreman": 80
        },
        "cityDistribution": {
            "上海": 1500,
            "北京": 1200,
            "深圳": 1000
        },
        "budgetDistribution": {
            "5万以下": 500,
            "5-10万": 800,
            "10-20万": 1200,
            "20万以上": 500
        }
    }
}
```

---

### 5.3 用户管理

#### 5.3.1 用户列表
**接口**: `GET /api/v1/admin/users`
**描述**: 获取平台用户列表
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `keyword`: 搜索关键词（手机号、昵称）
- `userType`: 用户类型筛选
- `status`: 状态筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "phone": "13800138000",
                "nickname": "张三",
                "avatar": "https://...",
                "userType": 1,
                "status": 1,
                "createdAt": "2025-01-01T00:00:00Z",
                "lastLoginAt": "2025-01-15T10:00:00Z"
            }
        ],
        "total": 5000
    }
}
```

---

#### 5.3.2 用户详情
**接口**: `GET /api/v1/admin/users/:id`
**描述**: 获取用户详细信息
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "phone": "13800138000",
        "nickname": "张三",
        "avatar": "https://...",
        "userType": 1,
        "status": 1,
        "createdAt": "2025-01-01T00:00:00Z",
        "lastLoginAt": "2025-01-15T10:00:00Z",
        "bookingCount": 5,
        "projectCount": 2,
        "totalSpent": 300000
    }
}
```

---

#### 5.3.3 创建用户
**接口**: `POST /api/v1/admin/users`
**描述**: 管理员创建用户
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "phone": "13800138000",
    "nickname": "新用户",
    "password": "password123",
    "userType": 1
}
```

---

#### 5.3.4 更新用户
**接口**: `PUT /api/v1/admin/users/:id`
**描述**: 更新用户信息
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "nickname": "新昵称",
    "avatar": "https://新头像"
}
```

---

#### 5.3.5 更新用户状态
**接口**: `PATCH /api/v1/admin/users/:id/status`
**描述**: 启用/禁用用户
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "status": 0
}
```
> **status**: 1（正常）/ 0（禁用）

---

### 5.4 管理员管理

#### 5.4.1 管理员列表
**接口**: `GET /api/v1/admin/admins`
**描述**: 获取管理员列表
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `keyword`: 搜索关键词
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "username": "admin",
                "phone": "13900139000",
                "avatar": "https://...",
                "status": 1,
                "roles": [
                    {
                        "id": 1,
                        "name": "超级管理员"
                    }
                ],
                "createdAt": "2024-01-01T00:00:00Z"
            }
        ],
        "total": 10
    }
}
```

---

#### 5.4.2 创建管理员
**接口**: `POST /api/v1/admin/admins`
**描述**: 创建新管理员
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "username": "newadmin",
    "password": "password123",
    "phone": "13900139000",
    "roleIds": [1, 2]
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "管理员创建成功",
    "data": {
        "id": 10
    }
}
```

---

#### 5.4.3 更新管理员
**接口**: `PUT /api/v1/admin/admins/:id`
**描述**: 更新管理员信息
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "phone": "13900139001",
    "roleIds": [2, 3]
}
```

---

#### 5.4.4 删除管理员
**接口**: `DELETE /api/v1/admin/admins/:id`
**描述**: 删除管理员
**认证**: 需要管理员 JWT Token

---

#### 5.4.5 更新管理员状态
**接口**: `PATCH /api/v1/admin/admins/:id/status`
**描述**: 启用/禁用管理员
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "status": 0
}
```

---

### 5.5 服务商管理

#### 5.5.1 服务商列表
**接口**: `GET /api/v1/admin/providers`
**描述**: 获取服务商列表
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `type`: designer/company/foreman
- `keyword`: 搜索关键词
- `verified`: 认证状态筛选
- `status`: 状态筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "userId": 50,
                "providerType": 1,
                "companyName": "XX设计工作室",
                "phone": "13800138000",
                "avatar": "https://...",
                "rating": 4.8,
                "reviewCount": 120,
                "verified": true,
                "status": 1,
                "createdAt": "2024-06-01T00:00:00Z"
            }
        ],
        "total": 300
    }
}
```

---

#### 5.5.2 创建服务商
**接口**: `POST /api/v1/admin/providers`
**描述**: 管理员创建服务商
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "userId": 50,
    "providerType": 1,
    "companyName": "XX设计工作室",
    "specialty": "现代简约,北欧风格",
    "yearsExperience": 8
}
```

---

#### 5.5.3 更新服务商
**接口**: `PUT /api/v1/admin/providers/:id`
**描述**: 更新服务商信息
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "companyName": "新公司名",
    "specialty": "现代简约,日式",
    "verified": true
}
```

---

#### 5.5.4 审核服务商认证
**接口**: `PATCH /api/v1/admin/providers/:id/verify`
**描述**: 审核服务商的认证申请
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "verified": true
}
```

---

#### 5.5.5 更新服务商状态
**接口**: `PATCH /api/v1/admin/providers/:id/status`
**描述**: 启用/禁用服务商
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "status": 0
}
```

---

### 5.6 商家入驻审核

#### 5.6.1 入驻申请列表
**接口**: `GET /api/v1/admin/merchant-applications`
**描述**: 获取商家入驻申请列表
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `status`: pending/approved/rejected
- `applicantType`: personal/studio/company/foreman
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 100,
                "phone": "13800138000",
                "applicantType": "studio",
                "realName": "张三",
                "companyName": "XX设计工作室",
                "status": "pending",
                "submittedAt": "2025-01-15T10:00:00Z",
                "reviewedAt": null,
                "rejectReason": null
            }
        ],
        "total": 50
    }
}
```

---

#### 5.6.2 申请详情
**接口**: `GET /api/v1/admin/merchant-applications/:id`
**描述**: 获取入驻申请详细信息
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 100,
        "phone": "13800138000",
        "applicantType": "studio",
        "realName": "张三",
        "idCardNo": "310101199001011234",
        "idCardFront": "https://id-front.jpg",
        "idCardBack": "https://id-back.jpg",
        "companyName": "XX设计工作室",
        "licenseNo": "91310000MA1234567X",
        "licenseImage": "https://license.jpg",
        "teamSize": 8,
        "officeAddress": "上海市浦东新区张江高科技园区",
        "serviceArea": ["浦东新区", "徐汇区"],
        "styles": ["现代简约", "北欧"],
        "introduction": "专注高品质室内设计...",
        "portfolioCases": [
            {
                "title": "现代简约风格案例",
                "images": ["https://..."],
                "style": "现代简约",
                "area": "120㎡"
            }
        ],
        "status": "pending",
        "submittedAt": "2025-01-15T10:00:00Z"
    }
}
```

---

#### 5.6.3 审核通过
**接口**: `POST /api/v1/admin/merchant-applications/:id/approve`
**描述**: 审核通过商家入驻申请（自动创建用户和服务商）
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "审核通过，已创建商家账号",
    "data": {
        "userId": 100,
        "providerId": 50
    }
}
```

---

#### 5.6.4 审核拒绝
**接口**: `POST /api/v1/admin/merchant-applications/:id/reject`
**描述**: 拒绝商家入驻申请
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "reason": "资料不全，请补充营业执照"
}
```

**响应数据**:
```json
{
    "code": 0,
    "message": "已拒绝该申请",
    "data": null
}
```

---

### 5.7 预约管理

#### 5.7.1 预约列表
**接口**: `GET /api/v1/admin/bookings`
**描述**: 获取所有预约记录
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `status`: 预约状态筛选
- `providerId`: 按服务商筛选
- `page`: 页码
- `pageSize`: 每页数量

---

#### 5.7.2 更新预约状态
**接口**: `PATCH /api/v1/admin/bookings/:id/status`
**描述**: 管理员更新预约状态
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "status": 3
}
```

---

### 5.8 评价管理

#### 5.8.1 评价列表
**接口**: `GET /api/v1/admin/reviews`
**描述**: 获取所有评价列表
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `providerId`: 按服务商筛选
- `rating`: 按评分筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "userId": 10,
                "userName": "李四",
                "providerId": 1,
                "providerName": "XX设计工作室",
                "rating": 5,
                "content": "设计师很专业",
                "images": ["https://..."],
                "createdAt": "2025-01-15T10:00:00Z"
            }
        ],
        "total": 500
    }
}
```

---

#### 5.8.2 删除评价
**接口**: `DELETE /api/v1/admin/reviews/:id`
**描述**: 删除不当评价
**认证**: 需要管理员 JWT Token

---

### 5.9 主材门店管理

#### 5.9.1 门店列表
**接口**: `GET /api/v1/admin/material-shops`
**描述**: 获取主材门店列表
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `type`: showroom/brand
- `isVerified`: 认证状态筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "type": "showroom",
                "name": "居然之家浦东店",
                "cover": "https://...",
                "rating": 4.5,
                "mainProducts": "瓷砖、地板、卫浴",
                "address": "上海市浦东新区...",
                "phone": "021-12345678",
                "isVerified": true,
                "createdAt": "2024-01-01T00:00:00Z"
            }
        ],
        "total": 100
    }
}
```

---

#### 5.9.2 创建门店
**接口**: `POST /api/v1/admin/material-shops`
**描述**: 添加新的主材门店
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "type": "showroom",
    "name": "居然之家浦东店",
    "cover": "https://cover.jpg",
    "mainProducts": "瓷砖、地板、卫浴",
    "address": "上海市浦东新区...",
    "phone": "021-12345678",
    "businessHours": "9:00-18:00",
    "description": "门店介绍..."
}
```

---

#### 5.9.3 更新门店
**接口**: `PUT /api/v1/admin/material-shops/:id`
**描述**: 更新门店信息
**认证**: 需要管理员 JWT Token

---

#### 5.9.4 删除门店
**接口**: `DELETE /api/v1/admin/material-shops/:id`
**描述**: 删除门店
**认证**: 需要管理员 JWT Token

---

#### 5.9.5 审核门店认证
**接口**: `PATCH /api/v1/admin/material-shops/:id/verify`
**描述**: 审核门店认证
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "isVerified": true
}
```

---

### 5.10 审核中心

#### 5.10.1 服务商资料审核
**接口**: `GET /api/v1/admin/audits/providers`
**描述**: 获取服务商资料修改审核列表
**认证**: 需要管理员 JWT Token

---

#### 5.10.2 门店审核
**接口**: `GET /api/v1/admin/audits/material-shops`
**描述**: 获取门店审核列表
**认证**: 需要管理员 JWT Token

---

#### 5.10.3 审核通过
**接口**: `POST /api/v1/admin/audits/:type/:id/approve`
**描述**: 通过审核（type: providers/material-shops）
**认证**: 需要管理员 JWT Token

---

#### 5.10.4 审核拒绝
**接口**: `POST /api/v1/admin/audits/:type/:id/reject`
**描述**: 拒绝审核
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "reason": "拒绝原因"
}
```

---

### 5.11 财务管理

#### 5.11.1 托管账户列表
**接口**: `GET /api/v1/admin/finance/escrow-accounts`
**描述**: 获取所有托管账户
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `status`: 状态筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "projectId": 1,
                "projectName": "浦东新区120平米装修项目",
                "totalAmount": 150000,
                "frozenAmount": 30000,
                "releasedAmount": 0,
                "availableAmount": 120000,
                "status": "active",
                "createdAt": "2025-03-01T00:00:00Z"
            }
        ],
        "total": 100
    }
}
```

---

#### 5.11.2 交易记录
**接口**: `GET /api/v1/admin/finance/transactions`
**描述**: 获取所有交易记录
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `type`: deposit/release/refund
- `startDate`: 开始日期
- `endDate`: 结束日期
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "escrowAccountId": 1,
                "type": "deposit",
                "amount": 150000,
                "description": "项目首次充值",
                "userId": 10,
                "userName": "李四",
                "createdAt": "2025-03-01T10:00:00Z"
            }
        ],
        "total": 500
    }
}
```

---

#### 5.11.3 处理提现申请
**接口**: `POST /api/v1/admin/finance/escrow-accounts/:accountId/withdraw`
**描述**: 处理商家的提现申请
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "withdrawId": 10,
    "action": "approve",
    "rejectReason": ""
}
```
> **action**: approve（批准）/ reject（拒绝）

---

### 5.12 风控管理

#### 5.12.1 风险预警列表
**接口**: `GET /api/v1/admin/risk/warnings`
**描述**: 获取风险预警列表
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `type`: 预警类型筛选
- `status`: 处理状态筛选
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "type": "overdue_payment",
                "level": "high",
                "projectId": 5,
                "projectName": "浦东新区120平米装修项目",
                "description": "项目逾期超过7天未支付",
                "status": "pending",
                "createdAt": "2025-01-20T00:00:00Z"
            }
        ],
        "total": 20
    }
}
```

---

#### 5.12.2 处理预警
**接口**: `POST /api/v1/admin/risk/warnings/:id/handle`
**描述**: 处理风险预警
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "action": "resolved",
    "note": "已联系双方协商解决"
}
```

---

#### 5.12.3 仲裁案件列表
**接口**: `GET /api/v1/admin/risk/arbitrations`
**描述**: 获取仲裁案件列表
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "projectId": 5,
                "applicantId": 10,
                "applicantName": "李四",
                "respondentId": 50,
                "respondentName": "XX装修公司",
                "reason": "施工质量不达标",
                "status": "pending",
                "createdAt": "2025-01-18T00:00:00Z"
            }
        ],
        "total": 5
    }
}
```

---

#### 5.12.4 更新仲裁
**接口**: `PUT /api/v1/admin/risk/arbitrations/:id`
**描述**: 更新仲裁案件处理结果
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "status": "resolved",
    "result": "判定业主退款50%",
    "note": "双方协商一致"
}
```

---

### 5.13 系统设置

#### 5.13.1 获取系统设置
**接口**: `GET /api/v1/admin/settings`
**描述**: 获取系统配置
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "intentFeeRate": 0.01,
        "platformCommissionRate": 0.05,
        "withdrawFeeRate": 0.001,
        "minWithdrawAmount": 100,
        "maintenanceMode": false,
        "contactPhone": "400-123-4567",
        "contactEmail": "support@example.com"
    }
}
```

---

#### 5.13.2 更新系统设置
**接口**: `PUT /api/v1/admin/settings`
**描述**: 更新系统配置
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "intentFeeRate": 0.015,
    "platformCommissionRate": 0.06,
    "minWithdrawAmount": 200
}
```

---

### 5.14 操作日志

#### 5.14.1 操作日志列表
**接口**: `GET /api/v1/admin/logs`
**描述**: 获取管理员操作日志
**认证**: 需要管理员 JWT Token
**Query 参数**:
- `adminId`: 按管理员筛选
- `action`: 操作类型筛选
- `startDate`: 开始日期
- `endDate`: 结束日期
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "adminId": 1,
                "adminName": "admin",
                "action": "approve_merchant",
                "resource": "merchant_application",
                "resourceId": 100,
                "description": "审核通过商家入驻申请",
                "ipAddress": "192.168.1.100",
                "createdAt": "2025-01-15T14:30:00Z"
            }
        ],
        "total": 1000
    }
}
```

---

### 5.15 RBAC权限管理

#### 5.15.1 角色列表
**接口**: `GET /api/v1/admin/roles`
**描述**: 获取所有角色
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": [
        {
            "id": 1,
            "name": "超级管理员",
            "code": "super_admin",
            "description": "拥有所有权限",
            "status": 1,
            "createdAt": "2024-01-01T00:00:00Z"
        },
        {
            "id": 2,
            "name": "运营人员",
            "code": "operator",
            "description": "负责日常运营",
            "status": 1
        }
    ]
}
```

---

#### 5.15.2 创建角色
**接口**: `POST /api/v1/admin/roles`
**描述**: 创建新角色
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "name": "客服人员",
    "code": "customer_service",
    "description": "负责客户咨询与服务"
}
```

---

#### 5.15.3 更新角色
**接口**: `PUT /api/v1/admin/roles/:id`
**描述**: 更新角色信息
**认证**: 需要管理员 JWT Token

---

#### 5.15.4 删除角色
**接口**: `DELETE /api/v1/admin/roles/:id`
**描述**: 删除角色
**认证**: 需要管理员 JWT Token

---

#### 5.15.5 分配菜单权限
**接口**: `POST /api/v1/admin/roles/:id/menus`
**描述**: 为角色分配菜单权限
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "menuIds": [1, 2, 3, 5, 8]
}
```

---

#### 5.15.6 菜单列表
**接口**: `GET /api/v1/admin/menus`
**描述**: 获取所有菜单
**认证**: 需要管理员 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": [
        {
            "id": 1,
            "name": "仪表盘",
            "path": "/dashboard",
            "icon": "dashboard",
            "parentId": 0,
            "sortOrder": 0,
            "permission": "dashboard:view"
        },
        {
            "id": 2,
            "name": "用户管理",
            "path": "/users",
            "icon": "user",
            "parentId": 0,
            "sortOrder": 1,
            "permission": "user:manage"
        }
    ]
}
```

---

#### 5.15.7 创建菜单
**接口**: `POST /api/v1/admin/menus`
**描述**: 创建新菜单
**认证**: 需要管理员 JWT Token
**请求参数**:
```json
{
    "name": "财务报表",
    "path": "/finance/reports",
    "icon": "chart",
    "parentId": 10,
    "sortOrder": 5,
    "permission": "finance:reports"
}
```

---

#### 5.15.8 更新菜单
**接口**: `PUT /api/v1/admin/menus/:id`
**描述**: 更新菜单信息
**认证**: 需要管理员 JWT Token

---

#### 5.15.9 删除菜单
**接口**: `DELETE /api/v1/admin/menus/:id`
**描述**: 删除菜单
**认证**: 需要管理员 JWT Token

---

## 6. 公共模块

### 6.1 主材门店（公开接口）

#### 6.1.1 门店列表
**接口**: `GET /api/v1/material-shops`
**描述**: 获取主材门店列表（公开）
**认证**: 无需认证
**Query 参数**:
- `type`: showroom/brand
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "type": "showroom",
                "name": "居然之家浦东店",
                "cover": "https://...",
                "rating": 4.5,
                "mainProducts": "瓷砖、地板、卫浴",
                "address": "上海市浦东新区...",
                "phone": "021-12345678",
                "businessHours": "9:00-18:00"
            }
        ],
        "total": 100
    }
}
```

---

#### 6.1.2 门店详情
**接口**: `GET /api/v1/material-shops/:id`
**描述**: 获取门店详细信息（公开）
**认证**: 无需认证

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "id": 1,
        "type": "showroom",
        "name": "居然之家浦东店",
        "cover": "https://...",
        "images": ["https://...", "https://..."],
        "rating": 4.5,
        "reviewCount": 200,
        "mainProducts": "瓷砖、地板、卫浴",
        "address": "上海市浦东新区...",
        "phone": "021-12345678",
        "businessHours": "9:00-18:00",
        "description": "门店介绍详情...",
        "latitude": 31.2304,
        "longitude": 121.4737
    }
}
```

---

### 6.2 聊天与消息

#### 6.2.1 WebSocket 连接
**接口**: `GET /api/v1/ws`
**描述**: 建立 WebSocket 连接（实时聊天）
**认证**: 需要 JWT Token（通过 query 参数传递）
**连接地址**: `ws://localhost:8080/api/v1/ws?token=<jwt_token>`

**发送消息格式**:
```json
{
    "type": "message",
    "recipientId": 123,
    "content": "你好，请问有空吗？",
    "messageType": "text"
}
```
> **messageType**: text（文本）/ image（图片）/ file（文件）

**接收消息格式**:
```json
{
    "id": 1,
    "senderId": 10,
    "senderName": "李四",
    "senderAvatar": "https://...",
    "recipientId": 50,
    "content": "你好，请问有空吗？",
    "messageType": "text",
    "createdAt": "2025-01-15T10:30:00Z"
}
```

---

#### 6.2.2 获取会话列表
**接口**: `GET /api/v1/chat/conversations`
**描述**: 获取当前用户的所有会话
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": [
        {
            "id": 1,
            "userId": 10,
            "otherUserId": 50,
            "otherUserName": "XX设计工作室",
            "otherUserAvatar": "https://...",
            "lastMessage": "好的，明天见",
            "lastMessageTime": "2025-01-15T16:00:00Z",
            "unreadCount": 3
        }
    ]
}
```

---

#### 6.2.3 获取历史消息
**接口**: `GET /api/v1/chat/messages`
**描述**: 获取某个会话的历史消息
**认证**: 需要 JWT Token
**Query 参数**:
- `conversationId`: 会话 ID
- `page`: 页码
- `pageSize`: 每页数量

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "items": [
            {
                "id": 1,
                "senderId": 10,
                "senderName": "李四",
                "senderAvatar": "https://...",
                "recipientId": 50,
                "content": "你好，请问有空吗？",
                "messageType": "text",
                "createdAt": "2025-01-15T10:30:00Z"
            },
            {
                "id": 2,
                "senderId": 50,
                "senderName": "XX设计工作室",
                "content": "您好，我有空的",
                "messageType": "text",
                "createdAt": "2025-01-15T10:32:00Z"
            }
        ],
        "total": 50
    }
}
```

---

#### 6.2.4 获取未读消息数
**接口**: `GET /api/v1/chat/unread-count`
**描述**: 获取当前用户的未读消息总数
**认证**: 需要 JWT Token

**响应数据**:
```json
{
    "code": 0,
    "message": "success",
    "data": {
        "totalUnreadCount": 5
    }
}
```

---

### 6.3 健康检查

#### 6.3.1 健康检查
**接口**: `GET /api/v1/health`
**描述**: 系统健康状态检查
**认证**: 无需认证

**响应数据**:
```json
{
    "status": "ok",
    "service": "home-decoration-server",
    "timestamp": "2025-01-15T10:00:00Z"
}
```

---

## 附录

### A. 状态码说明

| 状态码 | 说明 |
|--------|------|
| 0 | 成功 |
| 400 | 参数错误 |
| 401 | 未认证（Token 无效或过期） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

### B. 用户类型 (userType)

| 值 | 说明 |
|----|------|
| 1 | 业主/普通用户 |
| 2 | 服务商 |
| 3 | 工人 |

---

### C. 服务商类型 (providerType)

| 值 | 说明 |
|----|------|
| 1 | 设计师 |
| 2 | 装修公司 |
| 3 | 工长 |

---

### D. 预约状态 (Booking Status)

| 值 | 说明 |
|----|------|
| 1 | 待确认 |
| 2 | 已确认 |
| 3 | 已完成 |
| 4 | 已取消 |

---

### E. 项目状态 (Project Status)

| 状态 | 说明 |
|------|------|
| pending | 待开始 |
| in_progress | 进行中 |
| completed | 已完成 |
| suspended | 已暂停 |
| cancelled | 已取消 |

---

### F. 售后类型 (After-Sales Type)

| 类型 | 说明 |
|------|------|
| refund | 退款 |
| complaint | 投诉 |
| repair | 维修 |

---

### G. 售后状态 (After-Sales Status)

| 值 | 说明 |
|----|------|
| 0 | 待处理 |
| 1 | 处理中 |
| 2 | 已完成 |
| 3 | 已拒绝 |

---

### H. 入驻申请类型 (Applicant Type)

| 类型 | 说明 |
|------|------|
| personal | 个人 |
| studio | 工作室 |
| company | 公司 |

---

### I. 入驻申请状态 (Application Status)

| 状态 | 说明 |
|------|------|
| pending | 待审核 |
| approved | 已通过 |
| rejected | 已拒绝 |

---

## 更新日志

- **2025-01-29**: 初始版本，完整整理所有 API 接口文档
- 包含用户端、商家端、管理后台共 **150+ 接口**
- 涵盖认证、用户、服务商、预约、项目、售后、财务、RBAC 等所有模块

---

**文档维护**: 本文档应随代码更新保持同步
**问题反馈**: 如发现接口文档有误或缺失，请及时更新此文档
