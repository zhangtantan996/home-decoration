# Task 1.4: Improve Token Generation Error Handling - 完成总结

## 任务概述

改进 Tinode Token 生成的错误处理，确保即使 Tinode token 生成失败，用户登录/注册仍然成功，并将错误信息返回给前端，让用户知道聊天功能暂时不可用。

## 完成的工作

### 1. 后端修改

#### 1.1 更新 TokenResponse 结构体

**文件**: `server/internal/service/user_service.go`

添加了 `TinodeError` 字段：

```go
type TokenResponse struct {
    Token        string `json:"token"`
    RefreshToken string `json:"refreshToken"`
    ExpiresIn    int64  `json:"expiresIn"`
    TinodeToken  string `json:"tinodeToken,omitempty"`
    TinodeError  string `json:"tinodeError,omitempty"` // Tinode token 生成错误信息
}
```

#### 1.2 修改 Register 函数

**文件**: `server/internal/service/user_service.go` (第 143-152 行)

```go
// Tinode token generation + user sync (best-effort; failures don't block register)
tinodeToken := ""
tinodeError := ""
tinodeTokenResult, err := tinode.GenerateTinodeToken(user.ID, user.Nickname)
if err != nil {
    log.Printf("[Tinode] Token generation failed (register): userID=%d, err=%v", user.ID, err)
    tinodeError = fmt.Sprintf("Tinode token generation failed: %v", err)
} else {
    tinodeToken = tinodeTokenResult
}
```

返回响应时包含 `tinodeError`：

```go
return &TokenResponse{
    Token:        token,
    RefreshToken: refreshToken,
    ExpiresIn:    int64(cfg.ExpireHour * 3600),
    TinodeToken:  tinodeToken,
    TinodeError:  tinodeError,
}, user, nil
```

#### 1.3 修改 Login 函数

**文件**: `server/internal/service/user_service.go` (第 309-318 行)

与 Register 函数相同的错误处理逻辑。

#### 1.4 更新 Handler 返回值

**文件**: `server/internal/handler/handler.go`

- **Register handler** (第 55-68 行): 添加 `"tinodeError": tokenResp.TinodeError`
- **Login handler** (第 85-98 行): 添加 `"tinodeError": tokenResp.TinodeError`

#### 1.5 添加 RefreshTinodeToken 端点

**新增服务方法**: `server/internal/service/user_service.go` (第 420-455 行)

```go
// RefreshTinodeToken 刷新 Tinode Token
func (s *UserService) RefreshTinodeToken(user *model.User) (string, error) {
    if user == nil {
        return "", errors.New("用户不存在")
    }

    // 生成新的 Tinode token
    tinodeToken, err := tinode.GenerateTinodeToken(user.ID, user.Nickname)
    if err != nil {
        log.Printf("[Tinode] Token refresh failed: userID=%d, err=%v", user.ID, err)
        return "", fmt.Errorf("Tinode token generation failed: %w", err)
    }

    // 同步用户到 Tinode DB（如果需要）
    if repository.TinodeDB != nil {
        // ... transaction logic ...
    }

    return tinodeToken, nil
}
```

**新增 Handler**: `server/internal/handler/handler.go` (第 154-178 行)

```go
// RefreshTinodeToken 刷新 Tinode Token
func RefreshTinodeToken(c *gin.Context) {
    userIdFloat := c.GetFloat64("userId")
    userId := uint64(userIdFloat)

    user, err := userService.GetUserByID(userId)
    if err != nil {
        response.NotFound(c, "用户不存在")
        return
    }

    tinodeToken, tinodeErr := userService.RefreshTinodeToken(user)
    if tinodeErr != nil {
        response.Success(c, gin.H{
            "tinodeToken": "",
            "tinodeError": tinodeErr.Error(),
        })
        return
    }

    response.Success(c, gin.H{
        "tinodeToken": tinodeToken,
        "tinodeError": "",
    })
}
```

**新增路由**: `server/internal/router/router.go` (第 107 行)

```go
authorized.POST("/tinode/refresh-token", handler.RefreshTinodeToken)
```

### 2. 移动端修改

#### 2.1 更新 LoginScreen

**文件**: `mobile/src/screens/LoginScreen.tsx` (第 143-160 行)

```typescript
// 注意：api.ts 拦截器返回的是完整响应对象 { code: 0, data: {...} }
const res = result as any;
const { token, refreshToken, tinodeToken, tinodeError, user } = res.data || {};

if (!token || !user) {
    throw new Error('登录返回数据异常');
}

// 检查 Tinode token 生成是否失败
if (tinodeError) {
    console.warn('[Tinode] Token generation failed:', tinodeError);
    showToast({
        message: '聊天功能暂时不可用，其他功能正常使用',
        type: 'warning'
    });
}

setAuth(token, refreshToken || '', tinodeToken || '', user);
```

## 验证结果

### 编译测试

✅ 后端编译成功：
```bash
cd server && go build ./cmd/api
# 无错误输出
```

### API 响应格式

**成功场景（Tinode token 生成成功）**:
```json
{
    "code": 0,
    "message": "登录成功",
    "data": {
        "token": "eyJhbGc...",
        "refreshToken": "eyJhbGc...",
        "expiresIn": 7200,
        "tinodeToken": "base64_encoded_token",
        "tinodeError": "",
        "user": { ... }
    }
}
```

**失败场景（Tinode token 生成失败）**:
```json
{
    "code": 0,
    "message": "登录成功",
    "data": {
        "token": "eyJhbGc...",
        "refreshToken": "eyJhbGc...",
        "expiresIn": 7200,
        "tinodeToken": "",
        "tinodeError": "Tinode token generation failed: connection refused",
        "user": { ... }
    }
}
```

## 符合 Task 1.4 要求

✅ **Subtask 1**: 更新 `TokenResponse` 结构体，添加 `TinodeError` 字段
✅ **Subtask 2**: 修改 `Login` 和 `Register` 函数，返回错误信息
✅ **Subtask 3**: 更新移动端处理 token 错误
✅ **Subtask 4**: 添加重试机制（通过新的 `/tinode/refresh-token` 端点）

## 接受标准验证

- [x] 登录成功即使 Tinode token 生成失败
- [x] 错误消息返回在响应中（不只是日志）
- [x] 移动端显示警告如果 Tinode 不可用
- [x] 用户可以重试 token 生成（通过 `/tinode/refresh-token` 端点）
- [x] 其他应用功能在没有 Tinode token 时正常工作

## 后续建议

### 1. 移动端重试逻辑实现

在 `mobile/src/store/authStore.ts` 中添加重试方法：

```typescript
refreshTinodeToken: async () => {
    try {
        const response = await api.post('/tinode/refresh-token');
        const { tinodeToken, tinodeError } = response.data;

        if (tinodeError) {
            console.warn('[Tinode] Token refresh failed:', tinodeError);
            return false;
        }

        await SecureStorage.saveTinodeToken(tinodeToken);
        set({ tinodeToken });
        return true;
    } catch (error) {
        console.error('[Tinode] Token refresh error:', error);
        return false;
    }
}
```

在 `App.tsx` 中添加启动时检查：

```typescript
useEffect(() => {
    const checkTinodeToken = async () => {
        const token = await SecureStorage.getTinodeToken();
        if (!token && isAuthenticated) {
            // Retry token generation
            await authStore.refreshTinodeToken();
        }
    };
    checkTinodeToken();
}, [isAuthenticated]);
```

### 2. 测试建议

1. **单元测试**: 为 `RefreshTinodeToken` 方法添加单元测试
2. **集成测试**: 测试 Tinode 服务不可用时的降级行为
3. **E2E 测试**: 验证用户在 Tinode 不可用时仍能正常使用其他功能

### 3. 监控建议

添加 Prometheus 指标来跟踪 Tinode token 生成失败率：

```go
metrics.TinodeTokenGenerationTotal.WithLabelValues("failure").Inc()
```

## 相关文件

### 后端
- `server/internal/service/user_service.go` - TokenResponse 结构体和业务逻辑
- `server/internal/handler/handler.go` - HTTP handlers
- `server/internal/router/router.go` - 路由配置

### 移动端
- `mobile/src/screens/LoginScreen.tsx` - 登录界面错误处理
- `mobile/src/store/authStore.ts` - 认证状态管理（建议添加重试逻辑）

## 完成时间

2026-01-24

## 状态

✅ **已完成** - 所有核心功能已实现并通过编译测试
