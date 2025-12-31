# 开发快速启动指南

> **文档版本**: v1.0
> **创建时间**: 2025-12-30
> **相关文档**: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)

---

## 🚀 快速开始

本指南帮助开发人员快速开始实施开发计划中的功能。

---

## 📋 前置准备

### 环境要求

- **Go**: >= 1.23
- **Node.js**: >= 20.x
- **PostgreSQL**: >= 15
- **Redis**: >= 6.2
- **Docker**: >= 20.x（可选）

### 工具准备

```bash
# 安装Go依赖管理工具
go install github.com/cosmtrek/air@latest

# 安装前端工具
npm install -g pnpm
```

---

## 🏗️ 本地开发环境搭建

### 方式一：使用Docker Compose（推荐）

```bash
# 启动所有服务（数据库+Redis+后端+管理后台）
docker-compose -f docker-compose.local.yml up -d

# 查看日志
docker-compose -f docker-compose.local.yml logs -f

# 停止服务
docker-compose -f docker-compose.local.yml down
```

### 方式二：手动启动

#### 1. 启动数据库和Redis

```bash
# 仅启动数据库和Redis
docker-compose -f docker-compose.local.yml up -d db redis
```

#### 2. 启动后端

```bash
cd server

# 安装依赖
go mod download

# 开发模式（热重载）
make dev

# 或直接运行
go run ./cmd/api
```

#### 3. 启动管理后台

```bash
cd admin

# 安装依赖
npm install

# 开发模式
npm run dev
```

#### 4. 启动移动端（React Native）

```bash
cd mobile

# 安装依赖
npm install

# 启动Metro bundler
npm start

# Android
npm run android

# iOS
npm run ios
```

---

## 📝 开发计划实施顺序

### Week 1: P0-1 站内信通知系统（第1-3天）

#### Day 1: 数据库+后端服务层

**步骤1**: 创建数据库迁移脚本

```bash
# 创建迁移文件
touch server/migrations/001_create_notifications_table.sql
```

将以下内容粘贴到文件中（见 [DATABASE_MIGRATIONS.md](./DATABASE_MIGRATIONS.md#m001-新增通知表-notifications)）

**步骤2**: 执行数据库迁移

```bash
# 连接到数据库
docker-compose -f docker-compose.local.yml exec db psql -U postgres -d home_decoration

# 执行SQL文件
\i /path/to/server/migrations/001_create_notifications_table.sql

# 或直接执行
psql -U postgres -d home_decoration -f server/migrations/001_create_notifications_table.sql
```

**步骤3**: 新增Notification模型

编辑 `server/internal/model/model.go`，在文件末尾添加：

```go
// Notification 站内通知
type Notification struct {
    Base
    UserID      uint64     `json:"userId" gorm:"index"`
    UserType    string     `json:"userType" gorm:"size:20;index"`
    Title       string     `json:"title" gorm:"size:100;not null"`
    Content     string     `json:"content" gorm:"type:text;not null"`
    Type        string     `json:"type" gorm:"size:30;index"`
    RelatedID   uint64     `json:"relatedId" gorm:"default:0;index"`
    RelatedType string     `json:"relatedType" gorm:"size:30"`
    IsRead      bool       `json:"isRead" gorm:"default:false;index"`
    ReadAt      *time.Time `json:"readAt"`
    ActionURL   string     `json:"actionUrl" gorm:"size:200"`
    Extra       string     `json:"extra" gorm:"type:text"`
}

// 通知类型常量
const (
    NotificationTypeBookingIntentPaid  = "booking.intent_paid"
    NotificationTypeBookingConfirmed   = "booking.confirmed"
    NotificationTypeProposalSubmitted  = "proposal.submitted"
    NotificationTypeProposalConfirmed  = "proposal.confirmed"
    NotificationTypeProposalRejected   = "proposal.rejected"
    NotificationTypeOrderCreated       = "order.created"
    NotificationTypeOrderPaid          = "order.paid"
    NotificationTypeWithdrawApproved   = "withdraw.approved"
    NotificationTypeWithdrawRejected   = "withdraw.rejected"
)
```

**步骤4**: 创建通知服务

创建文件 `server/internal/service/notification_service.go`

<details>
<summary>查看完整代码示例（点击展开）</summary>

```go
package service

import (
    "encoding/json"
    "errors"
    "fmt"
    "home-decoration-server/internal/model"
    "home-decoration-server/internal/repository"
    "time"
)

type NotificationService struct{}

type CreateNotificationInput struct {
    UserID      uint64
    UserType    string
    Title       string
    Content     string
    Type        string
    RelatedID   uint64
    RelatedType string
    ActionURL   string
    Extra       map[string]interface{}
}

// Create 创建通知
func (s *NotificationService) Create(input *CreateNotificationInput) error {
    if input.UserID == 0 {
        return errors.New("用户ID不能为空")
    }
    if input.Title == "" || input.Content == "" {
        return errors.New("标题和内容不能为空")
    }

    extraJSON := ""
    if input.Extra != nil {
        bytes, _ := json.Marshal(input.Extra)
        extraJSON = string(bytes)
    }

    notification := &model.Notification{
        UserID:      input.UserID,
        UserType:    input.UserType,
        Title:       input.Title,
        Content:     input.Content,
        Type:        input.Type,
        RelatedID:   input.RelatedID,
        RelatedType: input.RelatedType,
        ActionURL:   input.ActionURL,
        Extra:       extraJSON,
        IsRead:      false,
    }

    return repository.DB.Create(notification).Error
}

// NotifyBookingIntentPaid 通知商家收到新预约
func (s *NotificationService) NotifyBookingIntentPaid(booking *model.Booking, providerUserID uint64) error {
    return s.Create(&CreateNotificationInput{
        UserID:      providerUserID,
        UserType:    "provider",
        Title:       "新预约通知",
        Content:     "您有一个新的预约请求，请尽快处理",
        Type:        model.NotificationTypeBookingIntentPaid,
        RelatedID:   booking.ID,
        RelatedType: "booking",
        ActionURL:   fmt.Sprintf("/merchant/bookings/%d", booking.ID),
        Extra: map[string]interface{}{
            "bookingId": booking.ID,
            "address":   booking.Address,
            "intentFee": booking.IntentFee,
        },
    })
}

// ... 其他快捷方法
```
</details>

**步骤5**: 创建通知Handler

创建文件 `server/internal/handler/notification_handler.go`

<details>
<summary>查看完整代码示例（点击展开）</summary>

```go
package handler

import (
    "home-decoration-server/internal/service"
    "home-decoration-server/pkg/response"
    "strconv"

    "github.com/gin-gonic/gin"
)

var notificationService = &service.NotificationService{}

// GetNotifications 获取通知列表
func GetNotifications(c *gin.Context) {
    userID := c.GetUint64("userId")
    userType := c.GetString("userType")

    if userType == "" {
        userType = "user"
    }

    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

    notifications, total, err := notificationService.GetUserNotifications(userID, userType, page, pageSize)
    if err != nil {
        response.ServerError(c, "获取通知列表失败")
        return
    }

    response.Success(c, gin.H{
        "list":     notifications,
        "total":    total,
        "page":     page,
        "pageSize": pageSize,
    })
}

// ... 其他Handler方法
```
</details>

**步骤6**: 注册路由

编辑 `server/internal/router/router.go`，在 `authorized` 组内添加：

```go
// 通知路由
notifications := authorized.Group("/notifications")
{
    notifications.GET("", handler.GetNotifications)
    notifications.GET("/unread-count", handler.GetUnreadCount)
    notifications.PUT("/:id/read", handler.MarkNotificationAsRead)
    notifications.PUT("/read-all", handler.MarkAllNotificationsAsRead)
    notifications.DELETE("/:id", handler.DeleteNotification)
}
```

**步骤7**: 集成到现有业务

编辑 `server/internal/service/proposal_service.go`，在第61行替换TODO：

```go
// 原代码（第61行）
// TODO: 发送通知给用户

// 修改为：
var booking model.Booking
if err := repository.DB.First(&booking, input.BookingID).Error; err == nil {
    notifService := &NotificationService{}
    notifService.NotifyProposalSubmitted(proposal, booking.UserID)
}
```

---

#### Day 2-3: 移动端+管理后台

**移动端开发** (Day 2)

1. 创建通知API服务
2. 创建通知列表页面
3. 添加路由和导航
4. 添加Tab红点提示

**管理后台开发** (Day 3上午)

1. 创建通知下拉组件
2. 集成到顶部导航栏
3. 测试通知功能

**联调测试** (Day 3下午)

---

### Week 1: P0-2 方案版本管理（第4-5天）

#### Day 4: 数据库+Service层

**步骤1**: 执行数据库变更

```bash
psql -U postgres -d home_decoration -f server/migrations/002_add_proposal_versioning.sql
```

**步骤2**: 修改Proposal模型

编辑 `server/internal/model/business_flow.go`

**步骤3**: 改造ProposalService

编辑 `server/internal/service/proposal_service.go`

---

#### Day 5: API+前端

**步骤1**: 新增API接口

编辑 `server/internal/handler/business_flow_handler.go`

**步骤2**: 移动端集成

编辑 `mobile/src/screens/ProposalDetailScreen.tsx`

**步骤3**: 商家后台集成

编辑 `admin/src/pages/merchant/MerchantProposals.tsx`

---

## 🧪 测试验证

### 单元测试

```bash
cd server
go test ./internal/service/... -v
```

### API测试

使用Postman或curl测试：

```bash
# 获取通知列表
curl -X GET http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"

# 标记已读
curl -X PUT http://localhost:8080/api/v1/notifications/123/read \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 集成测试

1. 创建预约
2. 支付意向金
3. 检查商家是否收到通知
4. 商家提交方案
5. 检查用户是否收到通知

---

## 🐛 常见问题

### 问题1: 数据库连接失败

**解决方案**:
```bash
# 检查数据库是否启动
docker-compose -f docker-compose.local.yml ps

# 查看数据库日志
docker-compose -f docker-compose.local.yml logs db
```

### 问题2: 前端无法连接后端

**解决方案**:
- 检查后端是否启动（端口8080）
- 检查CORS配置
- 检查API_URL环境变量

### 问题3: 移动端无法访问后端API

**解决方案**:
```bash
# Android设备需要配置adb端口转发
adb reverse tcp:8080 tcp:8080
adb reverse tcp:8081 tcp:8081
```

---

## 📚 参考文档

- [完整开发计划](./DEVELOPMENT_PLAN.md)
- [数据库变更清单](./DATABASE_MIGRATIONS.md)
- [API接口变更](./API_CHANGES.md)
- [业务流程规范](./BUSINESS_FLOW.md)
- [待开发功能列表](./PENDING_TASKS.md)

---

## 💡 开发建议

1. **按优先级开发** - 严格按照P0 → P1 → P2的顺序
2. **小步快跑** - 每完成一个小功能就提交代码
3. **及时测试** - 开发完立即测试，不要堆积
4. **编写文档** - 更新API文档和注释
5. **代码审查** - 重要功能提交前找同事review

---

## 🔗 有用的命令

### Docker相关

```bash
# 重启服务
docker-compose -f docker-compose.local.yml restart api

# 查看容器状态
docker-compose -f docker-compose.local.yml ps

# 进入数据库容器
docker-compose -f docker-compose.local.yml exec db psql -U postgres

# 清理所有容器和数据（危险操作）
docker-compose -f docker-compose.local.yml down -v
```

### Go相关

```bash
# 格式化代码
make fmt

# 运行测试
make test

# 构建二进制
make build

# 热重载开发
make dev
```

### 数据库相关

```bash
# 备份数据库
pg_dump -U postgres -d home_decoration > backup.sql

# 恢复数据库
psql -U postgres -d home_decoration < backup.sql

# 查看表结构
\d+ notifications

# 查看索引
\di+ idx_notifications_*
```

---

祝开发顺利！🎉
