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
	var userID uint64
	var userType string

	// 优先检查管理员
	if adminID, exists := c.Get("admin_id"); exists {
		userType = "admin"
		userID = adminID.(uint64)
	} else if c.GetString("providerId") != "" {
		// 如果是商家端调用，设置userType为provider
		userType = "provider"
		providerID := c.GetUint64("providerId")
		if providerID > 0 {
			userID = providerID
		}
	} else {
		userID = c.GetUint64("userId")
		userType = c.GetString("userType")
	}

	// 如果userType仍为空，默认为user
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

// GetNotificationUnreadCount 获取未读数量
func GetNotificationUnreadCount(c *gin.Context) {
	var userID uint64
	var userType string

	// 优先检查管理员
	if adminID, exists := c.Get("admin_id"); exists {
		userType = "admin"
		userID = adminID.(uint64)
	} else if c.GetString("providerId") != "" {
		// 如果是商家端调用
		userType = "provider"
		providerID := c.GetUint64("providerId")
		if providerID > 0 {
			userID = providerID
		}
	} else {
		userID = c.GetUint64("userId")
		userType = c.GetString("userType")
	}

	if userType == "" {
		userType = "user"
	}

	count, err := notificationService.GetUnreadCount(userID, userType)
	if err != nil {
		response.ServerError(c, "获取未读数量失败")
		return
	}

	response.Success(c, gin.H{
		"count": count,
	})
}

// MarkNotificationAsRead 标记单个通知为已读
func MarkNotificationAsRead(c *gin.Context) {
	var userID uint64

	// 优先检查管理员
	if adminID, exists := c.Get("admin_id"); exists {
		userID = adminID.(uint64)
	} else if c.GetString("providerId") != "" {
		// 如果是商家端调用
		providerID := c.GetUint64("providerId")
		if providerID > 0 {
			userID = providerID
		}
	} else {
		userID = c.GetUint64("userId")
	}

	notificationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, 400, "无效的通知ID")
		return
	}

	if err := notificationService.MarkAsRead(notificationID, userID); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "标记成功",
	})
}

// MarkAllNotificationsAsRead 标记全部通知为已读
func MarkAllNotificationsAsRead(c *gin.Context) {
	var userID uint64
	var userType string

	// 优先检查管理员
	if adminID, exists := c.Get("admin_id"); exists {
		userType = "admin"
		userID = adminID.(uint64)
	} else if c.GetString("providerId") != "" {
		// 如果是商家端调用
		userType = "provider"
		providerID := c.GetUint64("providerId")
		if providerID > 0 {
			userID = providerID
		}
	} else {
		userID = c.GetUint64("userId")
		userType = c.GetString("userType")
	}

	if userType == "" {
		userType = "user"
	}

	if err := notificationService.MarkAllAsRead(userID, userType); err != nil {
		response.ServerError(c, "操作失败")
		return
	}

	response.Success(c, gin.H{
		"message": "全部已读",
	})
}

// DeleteNotification 删除通知
func DeleteNotification(c *gin.Context) {
	var userID uint64

	// 优先检查管理员
	if adminID, exists := c.Get("admin_id"); exists {
		userID = adminID.(uint64)
	} else if c.GetString("providerId") != "" {
		// 如果是商家端调用
		providerID := c.GetUint64("providerId")
		if providerID > 0 {
			userID = providerID
		}
	} else {
		userID = c.GetUint64("userId")
	}

	notificationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, 400, "无效的通知ID")
		return
	}

	if err := notificationService.DeleteNotification(notificationID, userID); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "删除成功",
	})
}
