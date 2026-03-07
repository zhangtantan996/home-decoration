# 常用代码 Pattern

> 项目内经过验证的代码模式。写新代码前先查这里。
> 最后更新：2026-03-07

---

## Go 后端

### 标准 Handler 模板
```go
func (h *UserHandler) Create(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, err.Error())
        return
    }

    userID := c.GetUint("userID") // 来自 JWT middleware

    result, err := h.userService.Create(userID, &req)
    if err != nil {
        response.ServerError(c, err.Error())
        return
    }

    response.Success(c, result)
}
```

### Escrow 原子事务（必须用悲观锁）
```go
tx := db.Begin()
defer func() {
    if r := recover(); r != nil {
        tx.Rollback()
    }
}()

var account model.EscrowAccount
if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
    Where("user_id = ?", userID).First(&account).Error; err != nil {
    tx.Rollback()
    return err
}

account.Balance -= amount
tx.Save(&account)
tx.Create(&transaction) // 双边记录

return tx.Commit().Error
```

### 错误包装
```go
// 始终包装，提供上下文
return fmt.Errorf("userService.Create: %w", err)
```

---

## React / TypeScript

### Zustand Store 模板（admin）
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  login: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      login: (token) => set({ token }),
      logout: () => set({ token: null }),
    }),
    { name: 'auth-storage' }
  )
)
```

### API 调用模板（admin）
```typescript
// services/api.ts 中定义
export const userAPI = {
  list: (params?: ListParams) =>
    api.get<PageResult<User>>('/users', { params }),
  create: (data: CreateUserDTO) =>
    api.post<User>('/users', data),
  update: (id: number, data: UpdateUserDTO) =>
    api.put<User>(`/users/${id}`, data),
  delete: (id: number) =>
    api.delete(`/users/${id}`),
}
```

### mini/ 路由跳转
```typescript
// 跳转到页面
Taro.navigateTo({ url: '/pages/detail/index?id=123' })

// Tab 切换
Taro.switchTab({ url: '/pages/home/index' })

// 返回
Taro.navigateBack()
```

---

## 通用

### 响应格式（后端统一）
```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

### 文件命名约定
| 平台 | 规则 | 示例 |
|------|------|------|
| Go | snake_case | `user_service.go` |
| React 组件 | PascalCase | `UserTable.tsx` |
| React hooks | useX | `useAuth.ts` |
| React store/utils | camelCase | `authStore.ts` |

---

_发现新的可复用 pattern，追加到对应区块。_
