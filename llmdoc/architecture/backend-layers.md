# 后端分层架构 - Home Decoration Platform

## 🏗️ 架构概览

本项目采用**严格的三层架构**，确保代码职责清晰、易于维护和测试。

```
┌─────────────────────────────────────────┐
│         HTTP Request (Gin)              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  Handler Layer (HTTP 处理层)            │
│  - 绑定请求参数                          │
│  - 调用 Service                         │
│  - 返回 HTTP 响应                        │
│  - 无业务逻辑                            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  Service Layer (业务逻辑层)             │
│  - 业务规则验证                          │
│  - 编排多个 Repository                  │
│  - 事务管理                              │
│  - 错误处理                              │
│  - 所有业务逻辑                          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  Repository Layer (数据访问层)          │
│  - GORM 查询                            │
│  - Redis 操作                           │
│  - 无业务逻辑                            │
│  - 返回数据                              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  Model Layer (数据模型)                 │
│  - GORM 结构体定义                       │
│  - 表关系定义                            │
│  - JSON 序列化标签                       │
└─────────────────────────────────────────┘
```

## 📁 目录结构

```
server/internal/
├── handler/              # HTTP 处理层
│   ├── user_handler.go
│   ├── provider_handler.go
│   ├── escrow_handler.go
│   └── booking_handler.go
├── service/              # 业务逻辑层
│   ├── user_service.go
│   ├── provider_service.go
│   ├── escrow_service.go
│   └── booking_service.go
├── repository/           # 数据访问层
│   ├── database.go
│   ├── user_repository.go
│   ├── provider_repository.go
│   └── escrow_repository.go
├── model/                # 数据模型
│   └── model.go
├── router/               # 路由定义
│   └── router.go
└── middleware/           # 中间件
    ├── jwt.go
    ├── cors.go
    └── logger.go
```

## 🎯 Handler Layer（HTTP 处理层）

### 职责
- 绑定 HTTP 请求参数
- 调用 Service 层方法
- 返回 HTTP 响应
- **禁止包含业务逻辑**

### 示例

```go
// server/internal/handler/user_handler.go

type UserHandler struct {
    userService *service.UserService
}

func NewUserHandler(userService *service.UserService) *UserHandler {
    return &UserHandler{userService: userService}
}

// ✅ CORRECT: 薄 Handler，只处理 HTTP
func (h *UserHandler) CreateUser(c *gin.Context) {
    // 1. 绑定请求参数
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.Error(c, http.StatusBadRequest, err.Error())
        return
    }

    // 2. 调用 Service
    user, err := h.userService.Create(req)
    if err != nil {
        response.Error(c, http.StatusInternalServerError, err.Error())
        return
    }

    // 3. 返回响应
    response.Success(c, user)
}

// ❌ WRONG: Handler 包含业务逻辑
func (h *UserHandler) CreateUser(c *gin.Context) {
    var req CreateUserRequest
    c.ShouldBindJSON(&req)

    // ❌ 业务逻辑应该在 Service 层
    if len(req.Password) < 8 {
        c.JSON(400, gin.H{"error": "password too short"})
        return
    }

    // ❌ 直接操作数据库应该在 Repository 层
    hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
    user := &model.User{Email: req.Email, Password: string(hashedPassword)}
    db.Create(user)

    c.JSON(200, user)
}
```

### 请求/响应结构体

```go
// 定义在 handler 文件中
type CreateUserRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required,min=8"`
    Phone    string `json:"phone" binding:"required"`
}

type UserResponse struct {
    ID        uint64    `json:"id"`
    Email     string    `json:"email"`
    Phone     string    `json:"phone"`
    CreatedAt time.Time `json:"createdAt"`
}
```

## 🧠 Service Layer（业务逻辑层）

### 职责
- **所有业务逻辑**
- 业务规则验证
- 编排多个 Repository
- 事务管理
- 错误处理

### 示例

```go
// server/internal/service/user_service.go

type UserService struct {
    userRepo     *repository.UserRepository
    escrowRepo   *repository.EscrowRepository
    db           *gorm.DB
}

func NewUserService(
    userRepo *repository.UserRepository,
    escrowRepo *repository.EscrowRepository,
    db *gorm.DB,
) *UserService {
    return &UserService{
        userRepo:   userRepo,
        escrowRepo: escrowRepo,
        db:         db,
    }
}

// ✅ CORRECT: 业务逻辑在 Service 层
func (s *UserService) Create(req CreateUserRequest) (*model.User, error) {
    // 1. 业务规则验证
    if err := s.validateEmail(req.Email); err != nil {
        return nil, err
    }

    // 2. 密码哈希（业务逻辑）
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        return nil, fmt.Errorf("failed to hash password: %w", err)
    }

    // 3. 事务管理（多步操作）
    tx := s.db.Begin()
    defer func() {
        if r := recover(); r != nil {
            tx.Rollback()
        }
    }()

    // 4. 创建用户
    user := &model.User{
        Email:    req.Email,
        Password: string(hashedPassword),
        Phone:    req.Phone,
        UserType: 1, // 普通用户
    }
    if err := s.userRepo.CreateWithTx(tx, user); err != nil {
        tx.Rollback()
        return nil, fmt.Errorf("failed to create user: %w", err)
    }

    // 5. 创建托管账户（业务规则：每个用户必须有托管账户）
    escrowAccount := &model.EscrowAccount{
        UserID:  user.ID,
        Balance: 0,
    }
    if err := s.escrowRepo.CreateWithTx(tx, escrowAccount); err != nil {
        tx.Rollback()
        return nil, fmt.Errorf("failed to create escrow account: %w", err)
    }

    // 6. 提交事务
    if err := tx.Commit().Error; err != nil {
        return nil, fmt.Errorf("failed to commit transaction: %w", err)
    }

    return user, nil
}

// 业务规则验证（私有方法）
func (s *UserService) validateEmail(email string) error {
    // 检查邮箱是否已存在
    existingUser, err := s.userRepo.FindByEmail(email)
    if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
        return fmt.Errorf("failed to check email: %w", err)
    }
    if existingUser != nil {
        return errors.New("email already exists")
    }
    return nil
}
```

### 事务管理模式

```go
// ✅ CORRECT: 标准事务模式
func (s *SomeService) ComplexOperation() error {
    tx := s.db.Begin()
    defer func() {
        if r := recover(); r != nil {
            tx.Rollback()
        }
    }()

    // 操作 1
    if err := s.repo1.DoSomethingWithTx(tx); err != nil {
        tx.Rollback()
        return err
    }

    // 操作 2
    if err := s.repo2.DoSomethingWithTx(tx); err != nil {
        tx.Rollback()
        return err
    }

    return tx.Commit().Error
}
```

## 💾 Repository Layer（数据访问层）

### 职责
- GORM 查询
- Redis 操作
- **禁止包含业务逻辑**
- 返回数据或错误

### 示例

```go
// server/internal/repository/user_repository.go

type UserRepository struct {
    db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
    return &UserRepository{db: db}
}

// ✅ CORRECT: 纯数据访问
func (r *UserRepository) Create(user *model.User) error {
    return r.db.Create(user).Error
}

func (r *UserRepository) CreateWithTx(tx *gorm.DB, user *model.User) error {
    return tx.Create(user).Error
}

func (r *UserRepository) FindByID(id uint64) (*model.User, error) {
    var user model.User
    err := r.db.First(&user, id).Error
    return &user, err
}

func (r *UserRepository) FindByEmail(email string) (*model.User, error) {
    var user model.User
    err := r.db.Where("email = ?", email).First(&user).Error
    if errors.Is(err, gorm.ErrRecordNotFound) {
        return nil, nil
    }
    return &user, err
}

func (r *UserRepository) Update(user *model.User) error {
    return r.db.Save(user).Error
}

func (r *UserRepository) Delete(id uint64) error {
    return r.db.Delete(&model.User{}, id).Error
}

// ❌ WRONG: Repository 包含业务逻辑
func (r *UserRepository) CreateUser(email, password string) error {
    // ❌ 密码哈希是业务逻辑，应该在 Service 层
    hash, _ := bcrypt.GenerateFromPassword([]byte(password), 10)
    user := &model.User{Email: email, Password: string(hash)}
    return r.db.Create(user).Error
}
```

### 查询模式

```go
// 简单查询
func (r *UserRepository) FindByPhone(phone string) (*model.User, error) {
    var user model.User
    err := r.db.Where("phone = ?", phone).First(&user).Error
    return &user, err
}

// 复杂查询（带关联）
func (r *ProjectRepository) FindWithDetails(id uint64) (*model.Project, error) {
    var project model.Project
    err := r.db.
        Preload("User").
        Preload("Provider").
        Preload("Phases").
        First(&project, id).Error
    return &project, err
}

// 分页查询
func (r *UserRepository) FindAll(page, pageSize int) ([]model.User, int64, error) {
    var users []model.User
    var total int64

    offset := (page - 1) * pageSize

    if err := r.db.Model(&model.User{}).Count(&total).Error; err != nil {
        return nil, 0, err
    }

    err := r.db.Offset(offset).Limit(pageSize).Find(&users).Error
    return users, total, err
}
```

## 📊 Model Layer（数据模型）

### 职责
- GORM 结构体定义
- 表关系定义
- JSON 序列化标签

### 示例

```go
// server/internal/model/model.go

// Base 结构体（所有模型必须嵌入）
type Base struct {
    ID        uint64    `json:"id" gorm:"primaryKey"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}

// User 模型
type User struct {
    Base
    Email    string `json:"email" gorm:"uniqueIndex;not null"`
    Password string `json:"-" gorm:"not null"` // 不返回前端
    Phone    string `json:"phone" gorm:"uniqueIndex"`
    UserType int    `json:"userType" gorm:"default:1"` // 1=普通用户, 2=服务商
}

func (User) TableName() string {
    return "users"
}

// EscrowAccount 模型
type EscrowAccount struct {
    Base
    UserID       uint64 `json:"userId" gorm:"uniqueIndex;not null"`
    Balance      int64  `json:"balance" gorm:"default:0"` // 单位：分
    FrozenAmount int64  `json:"frozenAmount" gorm:"default:0"`
}

func (EscrowAccount) TableName() string {
    return "escrow_accounts"
}
```

## 🔄 完整示例：创建预约

### 1. Handler

```go
func (h *BookingHandler) CreateBooking(c *gin.Context) {
    var req CreateBookingRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.Error(c, http.StatusBadRequest, err.Error())
        return
    }

    userID := c.GetUint64("userID") // 从 JWT 中间件获取
    booking, err := h.bookingService.Create(userID, req)
    if err != nil {
        response.Error(c, http.StatusInternalServerError, err.Error())
        return
    }

    response.Success(c, booking)
}
```

### 2. Service

```go
func (s *BookingService) Create(userID uint64, req CreateBookingRequest) (*model.Booking, error) {
    // 1. 验证服务商存在
    provider, err := s.providerRepo.FindByID(req.ProviderID)
    if err != nil {
        return nil, fmt.Errorf("provider not found: %w", err)
    }

    // 2. 验证时间可用性
    if err := s.validateTimeSlot(req.ProviderID, req.BookingTime); err != nil {
        return nil, err
    }

    // 3. 开始事务
    tx := s.db.Begin()
    defer tx.Rollback()

    // 4. 创建预约
    booking := &model.Booking{
        UserID:      userID,
        ProviderID:  req.ProviderID,
        BookingTime: req.BookingTime,
        Status:      "pending",
        IntentAmount: 10000, // 100 元意向金（单位：分）
    }
    if err := s.bookingRepo.CreateWithTx(tx, booking); err != nil {
        return nil, err
    }

    // 5. 冻结意向金
    if err := s.escrowService.FreezeAmountWithTx(tx, userID, booking.IntentAmount); err != nil {
        return nil, err
    }

    // 6. 提交事务
    if err := tx.Commit().Error; err != nil {
        return nil, err
    }

    return booking, nil
}
```

### 3. Repository

```go
func (r *BookingRepository) CreateWithTx(tx *gorm.DB, booking *model.Booking) error {
    return tx.Create(booking).Error
}

func (r *BookingRepository) FindByID(id uint64) (*model.Booking, error) {
    var booking model.Booking
    err := r.db.Preload("User").Preload("Provider").First(&booking, id).Error
    return &booking, err
}
```

## 🔗 相关文档

- [开发约束](../overview/development-constraints.md)
- [托管支付系统](escrow-system.md)
- [认证授权系统](auth-system.md)
- [Go 编码规范](../../.claude/rules/go-standards.md)

---

**最后更新**：2026-01-26
