# 后端：添加 API 端点 - 操作指南

> 本指南演示如何在后端添加一个完整的 API 端点，遵循分层架构。

## 📋 前置条件

- 已阅读 [后端分层架构](../architecture/backend-layers.md)
- 已阅读 [开发约束](../overview/development-constraints.md)
- 熟悉 Go、Gin、GORM

## 🎯 示例场景

**需求**：添加一个 API 端点，允许用户查看自己的预约列表。

**端点**：`GET /api/v1/bookings`

**认证**：需要 JWT 认证

**响应**：返回当前用户的所有预约记录

## 📝 步骤 1：定义数据模型（如果需要）

如果模型已存在，跳过此步骤。

```go
// server/internal/model/model.go

type Booking struct {
    Base
    UserID       uint64    `json:"userId" gorm:"not null"`
    ProviderID   uint64    `json:"providerId" gorm:"not null"`
    BookingTime  time.Time `json:"bookingTime" gorm:"not null"`
    Status       string    `json:"status" gorm:"default:'pending'"` // pending/confirmed/completed/cancelled
    IntentAmount int64     `json:"intentAmount"` // 意向金（单位：分）
    ExpireAt     time.Time `json:"expireAt"` // 超时时间
}

func (Booking) TableName() string {
    return "bookings"
}
```

## 📝 步骤 2：创建 Repository

文件：`server/internal/repository/booking_repository.go`

```go
package repository

import (
    "gorm.io/gorm"
    "home-decoration/server/internal/model"
)

type BookingRepository struct {
    db *gorm.DB
}

func NewBookingRepository(db *gorm.DB) *BookingRepository {
    return &BookingRepository{db: db}
}

// FindByUserID 查询用户的所有预约
func (r *BookingRepository) FindByUserID(userID uint64) ([]model.Booking, error) {
    var bookings []model.Booking
    err := r.db.
        Where("user_id = ?", userID).
        Preload("Provider"). // 预加载服务商信息
        Order("created_at DESC").
        Find(&bookings).Error
    return bookings, err
}

// FindByID 根据 ID 查询预约
func (r *BookingRepository) FindByID(id uint64) (*model.Booking, error) {
    var booking model.Booking
    err := r.db.
        Preload("User").
        Preload("Provider").
        First(&booking, id).Error
    return &booking, err
}

// Create 创建预约
func (r *BookingRepository) Create(booking *model.Booking) error {
    return r.db.Create(booking).Error
}

// CreateWithTx 在事务中创建预约
func (r *BookingRepository) CreateWithTx(tx *gorm.DB, booking *model.Booking) error {
    return tx.Create(booking).Error
}

// Update 更新预约
func (r *BookingRepository) Update(booking *model.Booking) error {
    return r.db.Save(booking).Error
}
```

## 📝 步骤 3：创建 Service

文件：`server/internal/service/booking_service.go`

```go
package service

import (
    "errors"
    "fmt"
    "time"

    "gorm.io/gorm"
    "home-decoration/server/internal/model"
    "home-decoration/server/internal/repository"
)

type BookingService struct {
    bookingRepo  *repository.BookingRepository
    providerRepo *repository.ProviderRepository
    escrowRepo   *repository.EscrowRepository
    db           *gorm.DB
}

func NewBookingService(
    bookingRepo *repository.BookingRepository,
    providerRepo *repository.ProviderRepository,
    escrowRepo *repository.EscrowRepository,
    db *gorm.DB,
) *BookingService {
    return &BookingService{
        bookingRepo:  bookingRepo,
        providerRepo: providerRepo,
        escrowRepo:   escrowRepo,
        db:           db,
    }
}

// GetUserBookings 获取用户的所有预约
func (s *BookingService) GetUserBookings(userID uint64) ([]model.Booking, error) {
    bookings, err := s.bookingRepo.FindByUserID(userID)
    if err != nil {
        return nil, fmt.Errorf("failed to get user bookings: %w", err)
    }
    return bookings, nil
}

// GetByID 根据 ID 获取预约详情
func (s *BookingService) GetByID(id uint64, userID uint64) (*model.Booking, error) {
    booking, err := s.bookingRepo.FindByID(id)
    if err != nil {
        return nil, fmt.Errorf("failed to get booking: %w", err)
    }

    // 业务规则：用户只能查看自己的预约
    if booking.UserID != userID {
        return nil, errors.New("unauthorized to view this booking")
    }

    return booking, nil
}

// Create 创建预约
func (s *BookingService) Create(userID uint64, req CreateBookingRequest) (*model.Booking, error) {
    // 1. 验证服务商存在
    provider, err := s.providerRepo.FindByID(req.ProviderID)
    if err != nil {
        return nil, fmt.Errorf("provider not found: %w", err)
    }

    // 2. 业务规则：预约时间必须在未来
    if req.BookingTime.Before(time.Now()) {
        return nil, errors.New("booking time must be in the future")
    }

    // 3. 开始事务
    tx := s.db.Begin()
    defer func() {
        if r := recover(); r != nil {
            tx.Rollback()
        }
    }()

    // 4. 创建预约
    booking := &model.Booking{
        UserID:       userID,
        ProviderID:   req.ProviderID,
        BookingTime:  req.BookingTime,
        Status:       "pending",
        IntentAmount: 10000, // 100 元意向金（单位：分）
        ExpireAt:     time.Now().Add(24 * time.Hour), // 24 小时后过期
    }
    if err := s.bookingRepo.CreateWithTx(tx, booking); err != nil {
        tx.Rollback()
        return nil, fmt.Errorf("failed to create booking: %w", err)
    }

    // 5. 冻结意向金（业务逻辑）
    if err := s.freezeIntentAmount(tx, userID, booking.IntentAmount); err != nil {
        tx.Rollback()
        return nil, err
    }

    // 6. 提交事务
    if err := tx.Commit().Error; err != nil {
        return nil, fmt.Errorf("failed to commit transaction: %w", err)
    }

    return booking, nil
}

// freezeIntentAmount 冻结意向金（私有方法）
func (s *BookingService) freezeIntentAmount(tx *gorm.DB, userID uint64, amount int64) error {
    // 获取托管账户（带锁）
    var account model.EscrowAccount
    if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
        Where("user_id = ?", userID).
        First(&account).Error; err != nil {
        return fmt.Errorf("failed to get escrow account: %w", err)
    }

    // 检查余额
    if account.Balance < amount {
        return errors.New("insufficient balance")
    }

    // 冻结金额
    account.Balance -= amount
    account.FrozenAmount += amount
    if err := tx.Save(&account).Error; err != nil {
        return fmt.Errorf("failed to freeze amount: %w", err)
    }

    return nil
}
```

## 📝 步骤 4：创建 Handler

文件：`server/internal/handler/booking_handler.go`

```go
package handler

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    "home-decoration/server/internal/service"
    "home-decoration/server/pkg/response"
)

type BookingHandler struct {
    bookingService *service.BookingService
}

func NewBookingHandler(bookingService *service.BookingService) *BookingHandler {
    return &BookingHandler{bookingService: bookingService}
}

// GetUserBookings 获取用户的预约列表
// @Summary 获取用户预约列表
// @Tags Booking
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} response.Response{data=[]model.Booking}
// @Router /api/v1/bookings [get]
func (h *BookingHandler) GetUserBookings(c *gin.Context) {
    // 从 JWT 中间件获取用户 ID
    userID, exists := c.Get("userID")
    if !exists {
        response.Error(c, http.StatusUnauthorized, "unauthorized")
        return
    }

    // 调用 Service
    bookings, err := h.bookingService.GetUserBookings(userID.(uint64))
    if err != nil {
        response.Error(c, http.StatusInternalServerError, err.Error())
        return
    }

    // 返回响应
    response.Success(c, bookings)
}

// GetBookingDetail 获取预约详情
func (h *BookingHandler) GetBookingDetail(c *gin.Context) {
    // 获取预约 ID
    idStr := c.Param("id")
    id, err := strconv.ParseUint(idStr, 10, 64)
    if err != nil {
        response.Error(c, http.StatusBadRequest, "invalid booking id")
        return
    }

    // 获取用户 ID
    userID, _ := c.Get("userID")

    // 调用 Service
    booking, err := h.bookingService.GetByID(id, userID.(uint64))
    if err != nil {
        response.Error(c, http.StatusInternalServerError, err.Error())
        return
    }

    response.Success(c, booking)
}

// CreateBooking 创建预约
func (h *BookingHandler) CreateBooking(c *gin.Context) {
    var req CreateBookingRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.Error(c, http.StatusBadRequest, err.Error())
        return
    }

    userID, _ := c.Get("userID")
    booking, err := h.bookingService.Create(userID.(uint64), req)
    if err != nil {
        response.Error(c, http.StatusInternalServerError, err.Error())
        return
    }

    response.Success(c, booking)
}

// 请求结构体
type CreateBookingRequest struct {
    ProviderID  uint64    `json:"providerId" binding:"required"`
    BookingTime time.Time `json:"bookingTime" binding:"required"`
}
```

## 📝 步骤 5：注册路由

文件：`server/internal/router/router.go`

```go
func SetupRouter(
    db *gorm.DB,
    jwtSecret string,
    // ... 其他依赖
) *gin.Engine {
    r := gin.New()

    // 中间件
    r.Use(middleware.CORS())
    r.Use(middleware.Logger())
    r.Use(middleware.Recovery())

    // 初始化 Repository
    bookingRepo := repository.NewBookingRepository(db)
    providerRepo := repository.NewProviderRepository(db)
    escrowRepo := repository.NewEscrowRepository(db)

    // 初始化 Service
    bookingService := service.NewBookingService(bookingRepo, providerRepo, escrowRepo, db)

    // 初始化 Handler
    bookingHandler := handler.NewBookingHandler(bookingService)

    // API 路由组
    api := r.Group("/api/v1")

    // 需要认证的路由
    auth := api.Group("")
    auth.Use(middleware.JWT(jwtSecret)) // JWT 认证中间件
    {
        // 预约相关路由
        auth.GET("/bookings", bookingHandler.GetUserBookings)           // 获取预约列表
        auth.GET("/bookings/:id", bookingHandler.GetBookingDetail)      // 获取预约详情
        auth.POST("/bookings", bookingHandler.CreateBooking)            // 创建预约
    }

    return r
}
```

## 📝 步骤 6：测试

### 6.1 单元测试

文件：`server/internal/service/booking_service_test.go`

```go
package service

import (
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "home-decoration/server/internal/model"
)

func TestBookingService_GetUserBookings(t *testing.T) {
    // 设置测试数据库
    db := setupTestDB()
    defer teardownTestDB(db)

    // 创建测试数据
    user := &model.User{Email: "test@example.com", Password: "hashed"}
    db.Create(user)

    booking := &model.Booking{
        UserID:      user.ID,
        ProviderID:  1,
        BookingTime: time.Now().Add(24 * time.Hour),
        Status:      "pending",
    }
    db.Create(booking)

    // 初始化 Service
    bookingRepo := repository.NewBookingRepository(db)
    bookingService := NewBookingService(bookingRepo, nil, nil, db)

    // 测试
    bookings, err := bookingService.GetUserBookings(user.ID)

    // 断言
    assert.NoError(t, err)
    assert.Len(t, bookings, 1)
    assert.Equal(t, booking.ID, bookings[0].ID)
}
```

### 6.2 手动测试

```bash
# 1. 启动服务器
cd server
go run ./cmd/api

# 2. 登录获取 token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 响应：
# {"success":true,"data":{"token":"eyJhbGc...","user":{...}}}

# 3. 获取预约列表
curl -X GET http://localhost:8080/api/v1/bookings \
  -H "Authorization: Bearer eyJhbGc..."

# 响应：
# {"success":true,"data":[{"id":1,"userId":1,"providerId":2,...}]}
```

## ✅ 检查清单

完成后检查：

- [ ] 文件命名使用 snake_case（`booking_handler.go`）
- [ ] 遵循分层架构（Handler → Service → Repository）
- [ ] Handler 只处理 HTTP，无业务逻辑
- [ ] Service 包含所有业务逻辑
- [ ] Repository 只做数据访问
- [ ] 使用 JWT 中间件保护路由
- [ ] 使用参数化查询（GORM）
- [ ] 错误处理完整
- [ ] 添加了单元测试
- [ ] 手动测试通过

## 🔗 相关文档

- [后端分层架构](../architecture/backend-layers.md)
- [开发约束](../overview/development-constraints.md)
- [认证授权系统](../architecture/auth-system.md)
- [Go 编码规范](../../.claude/rules/go-standards.md)

---

**最后更新**：2026-01-26
