# 登录功能安全测试点清单

> 基于家装平台现有代码设计的全面安全测试方案
>
> 最后更新: 2026-02-06

---

## 目录

1. [测试范围概述](#1-测试范围概述)
2. [后端认证安全测试](#2-后端认证安全测试)
3. [前端安全测试](#3-前端安全测试)
4. [JWT Token 安全测试](#4-jwt-token-安全测试)
5. [暴力破解防护测试](#5-暴力破解防护测试)
6. [微信小程序登录安全测试](#6-微信小程序登录安全测试)
7. [会话管理安全测试](#7-会话管理安全测试)
8. [输入验证安全测试](#8-输入验证安全测试)
9. [权限控制安全测试](#9-权限控制安全测试)
10. [日志与审计测试](#10-日志与审计测试)
11. [网络安全测试](#11-网络安全测试)
12. [测试工具与环境](#12-测试工具与环境)

---

## 1. 测试范围概述

### 1.1 涉及的登录端点

| 端点 | 方法 | 用途 | 文件位置 |
|------|------|------|----------|
| `/api/v1/auth/register` | POST | 用户注册 | `handler/handler.go` |
| `/api/v1/auth/login` | POST | 用户登录（密码/验证码） | `handler/handler.go` |
| `/api/v1/auth/send-code` | POST | 发送验证码 | `handler/handler.go` |
| `/api/v1/auth/refresh` | POST | 刷新 Token | `handler/handler.go` |
| `/api/v1/auth/wechat/mini/login` | POST | 微信小程序登录 | `handler/handler.go` |
| `/api/v1/auth/wechat/mini/bind-phone` | POST | 微信绑定手机号 | `handler/handler.go` |
| `/api/v1/admin/login` | POST | 管理员登录 | `handler/admin_auth_handler.go` |
| `/api/v1/merchant/login` | POST | 商家登录 | `handler/merchant_handler.go` |

### 1.2 涉及的前端应用

- **Admin 管理后台**: React 18.3.1 + Vite (`admin/`)
- **Mobile 移动端**: React Native 0.83 (`mobile/`)
- **Mini Program 小程序**: Taro 3.x + React 18.3.1 (`mini/`)

---

## 2. 后端认证安全测试

### 2.1 密码安全测试

#### 2.1.1 密码存储安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| PWD-001 | 验证密码使用 bcrypt 加密存储 | 数据库中密码为 bcrypt hash 格式（$2a$...） | P0 |
| PWD-002 | 验证密码不以明文形式出现在日志中 | 搜索日志无密码明文 | P0 |
| PWD-003 | 验证 API 响应不返回密码字段 | User 对象的 password 字段为空或不存在 | P0 |
| PWD-004 | 验证密码 hash 的 cost 因子 ≥ 10 | bcrypt cost 参数检查 | P1 |

**测试方法**:
```bash
# 检查数据库中的密码格式
SELECT id, phone, password FROM users LIMIT 5;
# 预期: password 字段为 $2a$10$... 格式

# 检查日志中是否泄露密码
grep -r "password" /var/log/app/*.log | grep -v "password_hash"
```

#### 2.1.2 密码强度验证

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| PWD-005 | 注册时密码长度 < 6 位 | 返回 400 错误，提示密码太短 | P0 |
| PWD-006 | 注册时密码为空 | 返回 400 错误 | P0 |
| PWD-007 | 注册时密码包含特殊字符 | 正常注册成功 | P1 |
| PWD-008 | 注册时密码为纯数字 | 根据策略决定是否允许 | P2 |

**测试用例**:
```json
// 测试弱密码
POST /api/v1/auth/register
{
  "phone": "13800138000",
  "password": "123",  // 太短
  "code": "123456"
}
// 预期: 400 Bad Request

// 测试空密码
POST /api/v1/auth/register
{
  "phone": "13800138000",
  "password": "",
  "code": "123456"
}
// 预期: 400 Bad Request
```

### 2.2 登录逻辑安全测试

#### 2.2.1 认证绕过测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| AUTH-001 | 使用错误密码登录 | 返回 401，提示密码错误 | P0 |
| AUTH-002 | 使用不存在的手机号登录 | 返回 401，提示用户不存在 | P0 |
| AUTH-003 | 密码字段为 null 登录 | 返回 400，参数验证失败 | P0 |
| AUTH-004 | 密码字段为空字符串登录 | 返回 400（参数校验失败） | P0 |
| AUTH-005 | 使用 SQL 注入尝试绕过 | 返回 400/401，无 SQL 执行 | P0 |
| AUTH-006 | 使用 NoSQL 注入尝试绕过 | 返回 401，无注入执行 | P0 |
| AUTH-007 | 修改请求中的 userId 字段 | 服务端忽略，使用认证后的 userId | P0 |

**SQL 注入测试用例**:
```json
// 测试 SQL 注入
POST /api/v1/auth/login
{
  "phone": "' OR '1'='1",
  "password": "' OR '1'='1"
}
// 预期: 401 Unauthorized（不是 500 或登录成功）

POST /api/v1/auth/login
{
  "phone": "13800138000'; DROP TABLE users;--",
  "password": "test123"
}
// 预期: 401 Unauthorized，数据库无变化
```

#### 2.2.2 验证码登录安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| CODE-001 | 使用错误验证码登录 | 返回 401，提示验证码错误 | P0 |
| CODE-002 | 使用过期验证码登录 | 返回 401，提示验证码过期 | P0 |
| CODE-003 | 使用已使用的验证码登录 | 返回 401，验证码已失效 | P0 |
| CODE-004 | 验证码重放攻击 | 返回 401，验证码只能使用一次 | P0 |
| CODE-005 | 验证码长度不是 6 位 | 返回 400，格式错误 | P1 |
| CODE-006 | 验证码包含非数字字符 | 返回 400，格式错误 | P1 |
| CODE-007 | 发送验证码后立即使用 | 正常登录成功 | P1 |

**测试用例**:
```json
// 测试验证码重放
// 步骤 1: 发送验证码
POST /api/v1/auth/send-code
{ "phone": "13800138000" }

// 步骤 2: 使用验证码登录（成功）
POST /api/v1/auth/login
{ "phone": "13800138000", "code": "123456" }
// 预期: 200 OK

// 步骤 3: 再次使用同一验证码
POST /api/v1/auth/login
{ "phone": "13800138000", "code": "123456" }
// 预期: 401 Unauthorized（验证码已使用）
```

### 2.3 管理员登录安全测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| ADMIN-001 | 使用普通用户凭证登录管理后台 | 返回 401 | P0 |
| ADMIN-002 | 使用禁用的管理员账号登录 | 返回 403，提示账号已禁用 | P0 |
| ADMIN-003 | 管理员 Token 访问普通用户接口 | 返回 401/403（token_type 不匹配） | P0 |
| ADMIN-004 | 普通用户 Token 访问管理接口 | 返回 401/403（token_type 不匹配） | P0 |
| ADMIN-005 | 管理员登录记录审计日志 | admin_logs 表有登录记录 | P1 |

**测试用例**:
```json
// 测试 Token 类型隔离
// 步骤 1: 获取普通用户 Token
POST /api/v1/auth/login
{ "phone": "13800138000", "password": "test123" }
// 返回: { "token": "eyJ..." }

// 步骤 2: 使用普通用户 Token 访问管理接口
GET /api/v1/admin/users
Authorization: Bearer eyJ...（普通用户 token）
// 预期: 401 Unauthorized（token_type 不是 admin）
```

### 2.4 商家登录安全测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| MERCH-001 | 未认证商家尝试登录 | 返回 401 | P0 |
| MERCH-002 | 商家 Token 访问普通用户接口 | 根据接口权限决定 | P1 |
| MERCH-003 | 商家 Token 访问管理接口 | 返回 401 | P0 |
| MERCH-004 | 商家账号被禁用后登录 | 返回 403 | P0 |

---

## 3. 前端安全测试

### 3.1 Admin 管理后台安全测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| FE-ADMIN-001 | 未登录访问 /dashboard | 重定向到 /login | P0 |
| FE-ADMIN-002 | Token 过期后访问页面 | 重定向到 /login | P0 |
| FE-ADMIN-003 | 手动修改 localStorage 中的 token | 请求失败，重定向到登录 | P0 |
| FE-ADMIN-004 | 手动修改 localStorage 中的权限 | 后端验证失败，返回 403 | P0 |
| FE-ADMIN-005 | XSS 攻击：用户名输入框 | 输入被转义，无脚本执行 | P0 |
| FE-ADMIN-006 | XSS 攻击：密码输入框 | 输入被转义，无脚本执行 | P0 |
| FE-ADMIN-007 | 登录表单 CSRF 防护 | 有 CSRF token 或 SameSite cookie | P1 |
| FE-ADMIN-008 | 密码输入框类型为 password | 密码不可见 | P1 |
| FE-ADMIN-009 | 登录失败后清除密码输入框 | 密码框被清空 | P2 |
| FE-ADMIN-010 | 浏览器自动填充密码安全 | autocomplete="current-password" | P2 |

**XSS 测试用例**:
```javascript
// 在用户名输入框输入
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
javascript:alert('XSS')

// 预期: 输入被转义显示，无弹窗
```

### 3.2 Mobile 移动端安全测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| FE-MOB-001 | Token 存储在 Keychain/Keystore | 使用 react-native-keychain 加密存储 | P0 |
| FE-MOB-002 | Token 不存储在 AsyncStorage | AsyncStorage 中无 token | P0 |
| FE-MOB-003 | 退出登录清除所有凭证 | Keychain 中无残留 token | P0 |
| FE-MOB-004 | 应用切到后台时隐藏敏感信息 | 任务切换器中不显示敏感数据 | P1 |
| FE-MOB-005 | 截屏保护（可选） | 敏感页面禁止截屏 | P2 |
| FE-MOB-006 | 手机号格式验证 | 只接受 11 位以 1 开头的号码 | P0 |
| FE-MOB-007 | 验证码倒计时防重复发送 | 60 秒内不能重复发送 | P1 |
| FE-MOB-008 | 网络请求使用 HTTPS | 所有 API 请求走 HTTPS | P0 |
| FE-MOB-009 | 证书固定（Certificate Pinning） | 防止中间人攻击 | P1 |
| FE-MOB-010 | 越狱/Root 检测 | 检测到越狱设备给出警告 | P2 |

**Token 存储验证**:
```javascript
// 检查 SecureStorage.ts 实现
// 文件: mobile/src/utils/SecureStorage.ts

// 验证使用 react-native-keychain
import * as Keychain from 'react-native-keychain';

// 存储 Token
await Keychain.setGenericPassword('token', tokenValue, {
  service: 'home_decoration_auth'
});

// 不应该使用 AsyncStorage 存储 token
// ❌ 错误做法
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('token', tokenValue); // 不安全！
```

### 3.3 Mini Program 小程序安全测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| FE-MINI-001 | Token 存储在 Taro.setStorage | 使用微信存储 API | P0 |
| FE-MINI-002 | 敏感数据不存储在本地 | 无密码、身份证等敏感信息 | P0 |
| FE-MINI-003 | 退出登录清除存储 | Taro.clearStorage 清除凭证 | P0 |
| FE-MINI-004 | 微信登录 code 不重复使用 | 每次登录获取新 code | P0 |
| FE-MINI-005 | bindToken 有效期验证 | 5 分钟后 bindToken 失效 | P0 |
| FE-MINI-006 | 手机号授权弹窗正确显示 | 用户明确知道授权内容 | P1 |
| FE-MINI-007 | 拒绝授权后的处理 | 提示用户需要授权才能使用 | P1 |

---

## 4. JWT Token 安全测试

### 4.1 Token 生成安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| JWT-001 | Token 使用强密钥签名 | JWT_SECRET 长度 ≥ 32 字符 | P0 |
| JWT-002 | Token 包含过期时间 | exp claim 存在且合理 | P0 |
| JWT-003 | Token 使用 HS256 或更强算法 | alg 字段为 HS256/RS256 | P0 |
| JWT-004 | Token 不包含敏感信息 | 无密码、身份证等敏感数据 | P0 |
| JWT-005 | 不同用户类型 Token 有区分 | token_type 字段区分 admin/user/merchant | P0 |

**Token 结构验证**:
```javascript
// 解码 JWT Token（不验证签名）
// 使用 jwt.io 或 base64 解码

// 普通用户 Token 结构
{
  "userId": 123,
  "userType": 1,
  "activeRole": "homeowner",
  "exp": 1707235200,
  "iat": 1707148800
}

// 管理员 Token 结构
{
  "admin_id": 1,
  "username": "admin",
  "is_super": true,
  "token_type": "admin",
  "exp": 1707152400,
  "iat": 1707148800
}

// 商家 Token 结构
{
  "userId": 456,
  "providerId": 789,
  "providerType": "designer",
  "role": "merchant",
  "exp": 1707235200
}
```

### 4.2 Token 验证安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| JWT-006 | 使用过期 Token 访问 | 返回 401，提示 token 过期 | P0 |
| JWT-007 | 使用篡改的 Token 访问 | 返回 401，签名验证失败 | P0 |
| JWT-008 | 使用空 Token 访问 | 返回 401 | P0 |
| JWT-009 | 使用格式错误的 Token 访问 | 返回 401 | P0 |
| JWT-010 | 使用 none 算法的 Token | 返回 401，拒绝 none 算法 | P0 |
| JWT-011 | 修改 Token 中的 userId | 返回 401，签名验证失败 | P0 |
| JWT-012 | 修改 Token 中的 token_type | 返回 401，签名验证失败 | P0 |

**Token 篡改测试**:
```bash
# 原始 Token
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywiZXhwIjoxNzA3MjM1MjAwfQ.signature

# 篡改 payload 中的 userId（改为 456）
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQ1NiwiZXhwIjoxNzA3MjM1MjAwfQ.signature

# 预期: 401 Unauthorized（签名不匹配）
```

### 4.3 Token 刷新安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| JWT-013 | 使用有效 refreshToken 刷新 | 返回新的 accessToken 和 refreshToken（旧 refreshToken 失效） | P0 |
| JWT-014 | 使用过期 refreshToken 刷新 | 返回 401 | P0 |
| JWT-015 | 使用已使用的 refreshToken 刷新 | 返回 401（防重放） | P0 |
| JWT-016 | refreshToken 重放攻击检测 | Redis 记录已使用的 token | P0 |
| JWT-017 | 刷新后旧 accessToken 行为 | 当前实现：旧 token 仍可用直到过期；如需立即失效需引入服务端 token 黑名单 | P1 |
| JWT-018 | 用户登出后 refreshToken 失效 | 返回 401 | P0 |

**Token 刷新测试**:
```json
// 步骤 1: 登录获取 tokens
POST /api/v1/auth/login
{ "phone": "13800138000", "password": "test123" }
// 返回: { "token": "access_token", "refreshToken": "refresh_token" }

// 步骤 2: 使用 refreshToken 刷新
POST /api/v1/auth/refresh
{ "refreshToken": "refresh_token" }
// 返回: { "token": "new_access_token", "refreshToken": "new_refresh_token" }

// 步骤 3: 再次使用旧 refreshToken（重放攻击）
POST /api/v1/auth/refresh
{ "refreshToken": "refresh_token" }  // 旧的 refreshToken
// 预期: 401 Unauthorized（token 已被使用）
```

---

## 5. 暴力破解防护测试

### 5.1 登录限流测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| RATE-001 | 1 分钟内登录 5 次失败 | 第 6 次返回 429 Too Many Requests | P0 |
| RATE-002 | 限流后等待 1 分钟 | 可以继续尝试登录 | P0 |
| RATE-003 | 不同 IP 的限流独立 | IP-A 被限流不影响 IP-B | P0 |
| RATE-004 | 验证码发送限流 | 1 分钟内最多发送 1 次 | P0 |
| RATE-005 | 全局 API 限流 | 100 次/分钟 | P1 |
| RATE-006 | 限流响应包含 Retry-After 头 | 告知客户端等待时间 | P2 |

**限流测试脚本**:
```bash
#!/bin/bash
# 测试登录限流（5 次/分钟）

for i in {1..10}; do
  response=$(curl -s -w "\n%{http_code}" -X POST \
    http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone":"13800138000","password":"wrong"}')

  http_code=$(echo "$response" | tail -n1)
  echo "Request $i: HTTP $http_code"

  if [ "$http_code" == "429" ]; then
    echo "Rate limit triggered at request $i"
    break
  fi
done

# 预期: 第 6 次请求返回 429
```

### 5.2 账号锁定测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| LOCK-001 | 连续 5 次密码错误 | 账号锁定 30 分钟 | P0 |
| LOCK-002 | 锁定期间使用正确密码 | 仍返回 403，提示账号已锁定 | P0 |
| LOCK-003 | 锁定期满后登录 | 可以正常登录 | P0 |
| LOCK-004 | 锁定期间验证码登录 | 仍返回 403（账号级别锁定） | P0 |
| LOCK-005 | 成功登录后重置失败计数 | login_failed_count 归零 | P1 |
| LOCK-006 | 管理员账号锁定（Redis） | 使用 Redis 记录失败次数 | P0 |

**账号锁定验证**:
```sql
-- 检查用户锁定状态
SELECT id, phone, login_failed_count, locked_until
FROM users
WHERE phone = '13800138000';

-- 预期（锁定状态）:
-- login_failed_count: 5
-- locked_until: 2024-02-06 15:30:00（当前时间 + 30 分钟）
```

### 5.3 验证码安全测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| CAPTCHA-001 | 验证码有效期 5 分钟 | 5 分钟后验证码失效 | P0 |
| CAPTCHA-002 | 验证码只能使用一次 | 使用后立即失效 | P0 |
| CAPTCHA-003 | 验证码为 6 位数字 | 格式固定，不可预测 | P0 |
| CAPTCHA-004 | 验证码存储在 Redis | 不存储在数据库 | P1 |
| CAPTCHA-005 | 验证码与手机号绑定 | 不能用于其他手机号 | P0 |
| CAPTCHA-006 | 暴力猜测验证码 | 限流 + 验证码失效 | P0 |

**验证码暴力猜测测试**:
```bash
#!/bin/bash
# 测试验证码暴力猜测防护

# 先发送验证码
curl -X POST http://localhost:8080/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'

# 尝试暴力猜测
for code in {000000..000100}; do
  response=$(curl -s -w "\n%{http_code}" -X POST \
    http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"13800138000\",\"code\":\"$code\"}")

  http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" == "429" ]; then
    echo "Rate limit triggered after $code attempts"
    break
  fi
done

# 预期: 5 次错误后触发限流
```

---

## 6. 微信小程序登录安全测试

### 6.1 微信登录流程安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| WX-001 | 使用无效 code 登录 | 返回 401，微信验证失败 | P0 |
| WX-002 | 使用过期 code 登录 | 返回 401，code 已过期 | P0 |
| WX-003 | 使用已使用的 code 登录 | 返回 401，code 只能使用一次 | P0 |
| WX-004 | 伪造 openid 登录 | 返回 401，必须通过 code 获取 | P0 |
| WX-005 | 服务端验证 code | 不信任客户端传的 openid | P0 |
| WX-006 | session_key 不返回前端 | 响应中无 session_key | P0 |

**微信登录测试**:
```json
// 测试伪造 openid
POST /api/v1/auth/wechat/mini/login
{
  "code": "valid_code",
  "openid": "fake_openid"  // 尝试伪造
}
// 预期: 服务端忽略 openid，使用 code 换取真实 openid

// 测试无效 code
POST /api/v1/auth/wechat/mini/login
{
  "code": "invalid_code"
}
// 预期: 401 Unauthorized
```

### 6.2 手机号绑定安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| WX-007 | 使用无效 bindToken 绑定 | 返回 401 | P0 |
| WX-008 | 使用过期 bindToken 绑定 | 返回 401（5 分钟有效期） | P0 |
| WX-009 | 使用篡改的 bindToken 绑定 | 返回 401，签名验证失败 | P0 |
| WX-010 | 手机号已被其他微信绑定 | 返回 400，提示已绑定 | P0 |
| WX-011 | 伪造 phoneCode 获取手机号 | 返回 401，微信验证失败 | P0 |
| WX-012 | 绑定成功后 bindToken 失效 | 不能重复使用 | P0 |

**bindToken 安全测试**:
```json
// 步骤 1: 微信登录获取 bindToken
POST /api/v1/auth/wechat/mini/login
{ "code": "wx_code" }
// 返回: { "needBind": true, "bindToken": "eyJ..." }

// 步骤 2: 篡改 bindToken 中的 openid
// 原始 bindToken payload: { "openid": "real_openid", "appId": "wx123" }
// 篡改为: { "openid": "other_openid", "appId": "wx123" }

POST /api/v1/auth/wechat/mini/bind-phone
{
  "bindToken": "tampered_token",
  "phoneCode": "valid_phone_code"
}
// 预期: 401 Unauthorized（签名验证失败）
```

### 6.3 微信配置安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| WX-013 | AppID 和 AppSecret 不硬编码 | 使用环境变量配置 | P0 |
| WX-014 | AppSecret 不返回前端 | API 响应中无 secret | P0 |
| WX-015 | AppSecret 不记录在日志 | 日志中无 secret | P0 |
| WX-016 | 微信 API 调用使用 HTTPS | 所有微信 API 走 HTTPS | P0 |

---

## 7. 会话管理安全测试

### 7.1 会话生命周期

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| SESSION-001 | accessToken 有效期 | 普通用户 24 小时，管理员 60 分钟 | P0 |
| SESSION-002 | refreshToken 有效期 | 7 天（当前实现） | P0 |
| SESSION-003 | 登出后 Token 失效 | 服务端标记 Token 无效 | P0 |
| SESSION-004 | 密码修改后 Token 失效 | 所有旧 Token 失效 | P0 |
| SESSION-005 | 账号禁用后 Token 失效 | 返回 403 | P0 |
| SESSION-006 | 并发登录限制（可选） | 新登录踢出旧会话 | P2 |

### 7.2 会话固定攻击防护

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| SESSION-007 | 登录后生成新 Token | 不复用登录前的 Token | P0 |
| SESSION-008 | Token 不可预测 | 使用安全随机数生成 | P0 |
| SESSION-009 | Token 不在 URL 中传递 | 使用 Authorization 头 | P0 |

### 7.3 跨站请求伪造（CSRF）防护

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| CSRF-001 | 登录请求需要 CSRF Token | 或使用 SameSite Cookie | P1 |
| CSRF-002 | 状态修改请求验证来源 | 检查 Origin/Referer 头 | P1 |
| CSRF-003 | Cookie 设置 SameSite 属性 | SameSite=Strict 或 Lax | P1 |

---

## 8. 输入验证安全测试

### 8.1 手机号验证

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| INPUT-001 | 手机号长度不是 11 位 | 返回 400 | P0 |
| INPUT-002 | 手机号包含非数字字符 | 返回 400 | P0 |
| INPUT-003 | 手机号不以 1 开头 | 返回 400 | P0 |
| INPUT-004 | 手机号为空 | 返回 400 | P0 |
| INPUT-005 | 手机号包含 SQL 注入 | 返回 400，无 SQL 执行 | P0 |
| INPUT-006 | 手机号包含 XSS 代码 | 返回 400，无脚本执行 | P0 |

**输入验证测试用例**:
```json
// 测试各种非法手机号
POST /api/v1/auth/login

// 太短
{ "phone": "1380013", "password": "test123" }
// 预期: 400

// 包含字母
{ "phone": "138001380ab", "password": "test123" }
// 预期: 400

// SQL 注入
{ "phone": "13800138000' OR '1'='1", "password": "test123" }
// 预期: 400

// XSS
{ "phone": "<script>alert(1)</script>", "password": "test123" }
// 预期: 400
```

### 8.2 密码验证

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| INPUT-007 | 密码长度 < 6 位 | 返回 400 | P0 |
| INPUT-008 | 密码为空 | 返回 400 | P0 |
| INPUT-009 | 密码超长（> 100 字符） | 返回 400 或截断 | P1 |
| INPUT-010 | 密码包含特殊字符 | 正常处理 | P1 |
| INPUT-011 | 密码包含 Unicode 字符 | 正常处理 | P2 |
| INPUT-012 | 密码包含空格 | 正常处理（不 trim） | P2 |

### 8.3 用户名验证（管理员）

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| INPUT-013 | 用户名为空 | 返回 400 | P0 |
| INPUT-014 | 用户名包含 SQL 注入 | 返回 400/401，无 SQL 执行 | P0 |
| INPUT-015 | 用户名超长 | 返回 400 | P1 |
| INPUT-016 | 用户名包含特殊字符 | 根据策略决定 | P2 |

### 8.4 请求体验证

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| INPUT-017 | 请求体为空 | 返回 400 | P0 |
| INPUT-018 | 请求体不是 JSON | 返回 400 | P0 |
| INPUT-019 | 请求体 JSON 格式错误 | 返回 400 | P0 |
| INPUT-020 | 请求体包含额外字段 | 忽略额外字段 | P1 |
| INPUT-021 | 请求体超大（> 1MB） | 返回 413 或 400 | P1 |
| INPUT-022 | Content-Type 不是 application/json | 返回 415 或 400 | P1 |

---

## 9. 权限控制安全测试

### 9.1 垂直越权测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| AUTHZ-001 | 普通用户访问管理接口 | 返回 401/403 | P0 |
| AUTHZ-002 | 普通管理员访问超级管理员功能 | 返回 403 | P0 |
| AUTHZ-003 | 商家访问其他商家数据 | 返回 403 | P0 |
| AUTHZ-004 | 用户访问其他用户私密数据 | 返回 403 | P0 |
| AUTHZ-005 | 禁用用户访问任何接口 | 返回 403 | P0 |

**垂直越权测试**:
```bash
# 步骤 1: 获取普通用户 Token
USER_TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"test123"}' | jq -r '.token')

# 步骤 2: 尝试访问管理接口
curl -X GET http://localhost:8080/api/v1/admin/users \
  -H "Authorization: Bearer $USER_TOKEN"
# 预期: 401 Unauthorized

# 步骤 3: 尝试访问调试接口
curl -X GET http://localhost:8080/api/v1/debug/fix-data \
  -H "Authorization: Bearer $USER_TOKEN"
# 预期: 401 Unauthorized
```

### 9.2 水平越权测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| AUTHZ-006 | 用户 A 查看用户 B 的订单 | 返回 403 或空数据 | P0 |
| AUTHZ-007 | 用户 A 修改用户 B 的资料 | 返回 403 | P0 |
| AUTHZ-008 | 用户 A 取消用户 B 的预约 | 返回 403 | P0 |
| AUTHZ-009 | 商家 A 查看商家 B 的收入 | 返回 403 | P0 |
| AUTHZ-010 | 修改 URL 中的 ID 参数 | 服务端验证所有权 | P0 |

**水平越权测试**:
```bash
# 用户 A 的 Token
USER_A_TOKEN="eyJ..."

# 尝试访问用户 B 的数据
curl -X GET http://localhost:8080/api/v1/users/456/profile \
  -H "Authorization: Bearer $USER_A_TOKEN"
# 预期: 403 Forbidden（用户 A 的 ID 是 123，不是 456）

# 尝试修改用户 B 的数据
curl -X PUT http://localhost:8080/api/v1/users/456/profile \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"hacked"}'
# 预期: 403 Forbidden
```

### 9.3 RBAC 权限测试

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| RBAC-001 | 超级管理员拥有所有权限 | 可访问所有接口 | P0 |
| RBAC-002 | 普通管理员只有分配的权限 | 无权限返回 403 | P0 |
| RBAC-003 | 权限修改后立即生效 | 不需要重新登录 | P1 |
| RBAC-004 | 角色删除后权限失效 | 返回 403 | P0 |
| RBAC-005 | 菜单权限与 API 权限一致 | 前端隐藏 = 后端拒绝 | P0 |

---

## 10. 日志与审计测试

### 10.1 登录日志

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| LOG-001 | 登录成功记录日志 | 包含用户 ID、IP、时间 | P0 |
| LOG-002 | 登录失败记录日志 | 包含手机号、IP、失败原因 | P0 |
| LOG-003 | 管理员登录记录审计日志 | admin_logs 表有记录 | P0 |
| LOG-004 | 日志不包含密码明文 | 搜索日志无密码 | P0 |
| LOG-005 | 日志不包含 Token 明文 | 或只记录部分 | P1 |
| LOG-006 | 日志包含 User-Agent | 用于异常检测 | P2 |

**日志验证**:
```sql
-- 检查管理员审计日志
SELECT * FROM admin_logs
WHERE action LIKE '%login%'
ORDER BY created_at DESC
LIMIT 10;

-- 预期字段:
-- admin_id, action, ip, status, created_at
```

### 10.2 异常检测

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| LOG-007 | 同一账号多地登录告警 | 记录异常日志 | P2 |
| LOG-008 | 非工作时间管理员登录告警 | 记录异常日志 | P2 |
| LOG-009 | 大量失败登录告警 | 触发安全告警 | P1 |
| LOG-010 | 敏感操作记录详细日志 | 包含操作前后数据 | P1 |

---

## 11. 网络安全测试

### 11.1 HTTPS 安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| NET-001 | 生产环境强制 HTTPS | HTTP 重定向到 HTTPS | P0 |
| NET-002 | HSTS 头设置 | Strict-Transport-Security 存在 | P0 |
| NET-003 | TLS 版本 ≥ 1.2 | 禁用 TLS 1.0/1.1 | P0 |
| NET-004 | 证书有效且未过期 | SSL Labs 评分 A+ | P0 |

### 11.2 CORS 安全

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| NET-005 | CORS 白名单模式 | 不使用 * 通配符 | P0 |
| NET-006 | 非白名单 Origin 请求 | 返回 403 | P0 |
| NET-007 | 预检请求正确处理 | OPTIONS 返回正确头 | P1 |
| NET-008 | Credentials 模式安全 | 不与 * 同时使用 | P0 |

**CORS 测试**:
```bash
# 测试非白名单 Origin
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"test123"}'
# 预期: 403 Forbidden 或无 Access-Control-Allow-Origin 头

# 测试白名单 Origin
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"test123"}'
# 预期: 200 OK，包含 Access-Control-Allow-Origin: http://localhost:5173
```

### 11.3 安全响应头

| 测试编号 | 测试点 | 预期结果 | 优先级 |
|----------|--------|----------|--------|
| NET-009 | X-Content-Type-Options | nosniff | P0 |
| NET-010 | X-Frame-Options | DENY 或 SAMEORIGIN | P0 |
| NET-011 | X-XSS-Protection | 1; mode=block | P1 |
| NET-012 | Content-Security-Policy | 存在且合理 | P1 |
| NET-013 | Referrer-Policy | strict-origin-when-cross-origin | P2 |

**安全头验证**:
```bash
curl -I http://localhost:8080/api/v1/auth/login

# 预期响应头:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: default-src 'self'; ...
```

---

## 12. 测试工具与环境

### 12.0 当前代码实现状态说明（2026-02-06）

- 用户登录/注册签发的 token 已区分 `token_use`：`access` / `refresh`。
- `/api/v1/auth/refresh` 仅接受 `token_use=refresh`，并执行 refresh token 重放检测。
- 验证码登录失败会计入 `login_failed_count`，并参与账号锁定。
- 管理员/商家/普通用户 token 已通过 `token_type` 做路由隔离（返回 401/403 取决于中间件）。
- 现有验证码仍为测试固定码 `123456`，验证码过期/一次性/Redis 存储相关条目需在接入真实短信验证码后再执行。

### 12.1 推荐测试工具

| 工具 | 用途 | 安装方式 |
|------|------|----------|
| **Burp Suite** | Web 安全测试、拦截代理 | https://portswigger.net/burp |
| **OWASP ZAP** | 自动化安全扫描 | https://www.zaproxy.org/ |
| **Postman** | API 测试 | https://www.postman.com/ |
| **curl** | 命令行 HTTP 测试 | 系统自带 |
| **sqlmap** | SQL 注入检测 | `pip install sqlmap` |
| **jwt.io** | JWT Token 解析 | https://jwt.io/ |
| **Wireshark** | 网络抓包分析 | https://www.wireshark.org/ |

### 12.2 测试环境配置

```bash
# 1. 启动本地开发环境
docker-compose -f docker-compose.local.yml up -d

# 2. 确认服务运行
curl http://localhost:8080/api/v1/health

# 3. 创建测试用户
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13800138000",
    "password": "Test123456",
    "code": "123456"
  }'

# 4. 创建测试管理员（通过数据库）
docker-compose -f docker-compose.local.yml exec db psql -U postgres -d home_decoration -c "
INSERT INTO sys_admins (username, password, nickname, status, is_super)
VALUES ('testadmin', '\$2a\$10\$...', 'Test Admin', 1, false);
"
```

### 12.3 自动化测试脚本

```bash
#!/bin/bash
# login_security_test.sh - 登录安全自动化测试脚本

BASE_URL="http://localhost:8080/api/v1"
PASS=0
FAIL=0

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

test_case() {
  local name=$1
  local expected=$2
  local actual=$3

  if [ "$expected" == "$actual" ]; then
    echo -e "${GREEN}[PASS]${NC} $name"
    ((PASS++))
  else
    echo -e "${RED}[FAIL]${NC} $name (expected: $expected, got: $actual)"
    ((FAIL++))
  fi
}

echo "=== 登录安全测试 ==="

# 测试 1: 错误密码
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"wrongpassword"}')
http_code=$(echo "$response" | tail -n1)
test_case "AUTH-001: 错误密码登录" "401" "$http_code"

# 测试 2: SQL 注入
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone":"'\'' OR '\''1'\''='\''1","password":"test"}')
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" == "400" ] || [ "$http_code" == "401" ]; then
  test_case "AUTH-005: SQL 注入防护" "pass" "pass"
else
  test_case "AUTH-005: SQL 注入防护" "400/401" "$http_code"
fi

# 测试 3: 空密码
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":""}')
http_code=$(echo "$response" | tail -n1)
test_case "AUTH-004: 空密码登录" "400" "$http_code"

# 测试 4: 非白名单 CORS
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"test123"}')
http_code=$(echo "$response" | tail -n1)
test_case "NET-006: CORS 白名单" "403" "$http_code"

# 测试 5: 安全响应头
headers=$(curl -s -I "$BASE_URL/auth/login")
if echo "$headers" | grep -q "X-Content-Type-Options: nosniff"; then
  test_case "NET-009: X-Content-Type-Options" "present" "present"
else
  test_case "NET-009: X-Content-Type-Options" "present" "missing"
fi

echo ""
echo "=== 测试结果 ==="
echo -e "通过: ${GREEN}$PASS${NC}"
echo -e "失败: ${RED}$FAIL${NC}"
```

---

## 附录 A: 测试优先级说明

| 优先级 | 说明 | 上线前必须 |
|--------|------|------------|
| **P0** | 关键安全问题，可能导致数据泄露或系统被攻破 | ✅ 必须通过 |
| **P1** | 重要安全问题，可能导致部分功能被滥用 | ✅ 必须通过 |
| **P2** | 一般安全问题，影响用户体验或有潜在风险 | ⚠️ 建议通过 |

---

## 附录 B: 相关代码文件

| 功能 | 文件路径 |
|------|----------|
| 登录路由 | `server/internal/router/router.go` |
| 登录处理 | `server/internal/handler/handler.go` |
| 用户服务 | `server/internal/service/user_service.go` |
| JWT 中间件 | `server/internal/middleware/middleware.go` |
| 限流中间件 | `server/internal/middleware/rate_limit.go` |
| 安全头中间件 | `server/internal/middleware/security.go` |
| 微信登录 | `server/internal/service/wechat_auth_service.go` |
| 管理员登录 | `server/internal/handler/admin_auth_handler.go` |
| 商家登录 | `server/internal/handler/merchant_handler.go` |
| Token 服务 | `server/internal/service/token_service.go` |
| Admin 登录页 | `admin/src/pages/user/Login.tsx` |
| Mobile 登录页 | `mobile/src/screens/LoginScreen.tsx` |
| Mini 登录服务 | `mini/src/services/auth.ts` |
| 安全存储 | `mobile/src/utils/SecureStorage.ts` |

---

## 附录 C: 常见漏洞修复建议

---

## 附录 D: 已自动化单测覆盖映射（2026-02-06）

> 测试文件：`server/internal/middleware/auth_middleware_test.go`、`server/internal/service/user_service_test.go`

| 清单编号 | 优先级 | 覆盖状态 | 对应单测 |
|----------|--------|----------|----------|
| JWT-006 | P0 | ✅ 已覆盖（refresh token 访问受保护接口被拒绝） | `TestJWTMiddleware_RejectsRefreshToken` |
| JWT-010 | P0 | ✅ 已覆盖（拒绝 none 算法） | `TestJWTMiddleware_RejectsNonHMACAlgorithm` |
| ADMIN-003 | P0 | ✅ 已覆盖（admin token 访问普通用户路由被拒绝） | `TestJWTMiddleware_RejectsAdminToken` |
| ADMIN-004 | P0 | ✅ 已覆盖（普通用户 token 访问管理路由被拒绝） | `TestAdminJWT_RejectsUserToken` |
| MERCH-003 | P0 | ✅ 已覆盖（普通用户 token 访问商家路由被拒绝） | `TestMerchantJWT_RejectsUserToken` |
| JWT-005 | P0 | ✅ 已覆盖（token 类型隔离：admin/user/merchant） | `TestAdminJWT_RejectsUserToken` / `TestMerchantJWT_RejectsUserToken` / `TestJWTMiddleware_RejectsAdminToken` |
| SESSION-007 | P0 | ✅ 部分覆盖（仅 access token 可访问业务路由） | `TestJWTMiddleware_RejectsRefreshToken` / `TestAdminJWT_RejectsRefreshToken` / `TestMerchantJWT_RejectsRefreshToken` |
| AUTH-001 | P0 | ✅ 已覆盖（错误密码登录失败） | `TestUserService_Login/password_wrong_increments_count` |
| AUTH-004 | P0 | ✅ 已覆盖（空密码登录失败） | `TestUserService_Login/password_missing` |
| CODE-001 | P0 | ✅ 已覆盖（错误验证码登录失败） | `TestUserService_Login/invalid_code` |
| LOCK-001 | P0 | ✅ 部分覆盖（锁定态拒绝登录） | `TestUserService_Login/locked_account` |
| LOCK-005 | P1 | ✅ 已覆盖（成功登录重置失败计数） | `TestUserService_Login/tinode_token_error_does_not_block` |

> 说明：优先级取自主清单；`CAPTCHA-*`、`WX-*` 中涉及外部短信/微信真实环境交互的条目，当前仍以集成测试/联调测试为主，未纳入本地纯单测。

### C.1 如果发现 SQL 注入

```go
// ❌ 错误：字符串拼接
query := fmt.Sprintf("SELECT * FROM users WHERE phone = '%s'", phone)
db.Raw(query).Scan(&user)

// ✅ 正确：参数化查询
db.Where("phone = ?", phone).First(&user)
```

### C.2 如果发现 Token 泄露

1. 立即轮换 JWT_SECRET
2. 强制所有用户重新登录
3. 检查日志中是否有 Token 明文
4. 审计是否有异常访问

### C.3 如果发现暴力破解

1. 确认限流配置生效
2. 检查账号锁定机制
3. 考虑添加 CAPTCHA
4. 监控异常登录 IP

---

**文档维护者**: 安全团队
**最后审核**: 2026-02-06
**下次审核**: 2026-05-06
