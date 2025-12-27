package handler

import (
	"net/http"
	"strconv"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
)

// GetConversations 获取用户的会话列表
func GetConversations(c *gin.Context) {
	uid := uint64(c.GetFloat64("userId"))

	var conversations []model.Conversation
	if err := repository.DB.
		Where("user1_id = ? OR user2_id = ?", uid, uid).
		Order("last_message_time DESC").
		Find(&conversations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1001, "message": "获取会话列表失败"})
		return
	}

	// 组装返回数据 (附带对方用户信息)
	type ConversationVO struct {
		model.Conversation
		PartnerID     uint64 `json:"partnerId"`
		PartnerName   string `json:"partnerName"`
		PartnerAvatar string `json:"partnerAvatar"`
		UnreadCount   int    `json:"unreadCount"`
	}

	var result = make([]ConversationVO, 0) // 确保返回空数组而非 null
	for _, conv := range conversations {
		vo := ConversationVO{Conversation: conv}
		var partnerID uint64
		if conv.User1ID == uid {
			partnerID = conv.User2ID
			vo.UnreadCount = conv.User1Unread
		} else {
			partnerID = conv.User1ID
			vo.UnreadCount = conv.User2Unread
		}
		vo.PartnerID = partnerID

		// 获取对方用户信息
		var partner model.User
		if err := repository.DB.First(&partner, partnerID).Error; err == nil {
			vo.PartnerName = partner.Nickname
			vo.PartnerAvatar = partner.Avatar
		}
		result = append(result, vo)
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// GetMessages 获取聊天记录
func GetMessages(c *gin.Context) {
	uid := uint64(c.GetFloat64("userId"))

	conversationID := c.Query("conversationId")
	if conversationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1001, "message": "缺少会话ID"})
		return
	}

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize > 50 {
		pageSize = 50
	}

	// 验证用户是否属于该会话
	var conv model.Conversation
	if err := repository.DB.First(&conv, "id = ?", conversationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 1002, "message": "会话不存在"})
		return
	}
	if conv.User1ID != uid && conv.User2ID != uid {
		c.JSON(http.StatusForbidden, gin.H{"code": 1003, "message": "无权访问该会话"})
		return
	}

	// 获取消息
	var messages []model.ChatMessage
	var total int64
	repository.DB.Model(&model.ChatMessage{}).Where("conversation_id = ?", conversationID).Count(&total)
	repository.DB.
		Where("conversation_id = ?", conversationID).
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&messages)

	// 标记为已读
	repository.DB.Model(&model.ChatMessage{}).
		Where("conversation_id = ? AND receiver_id = ? AND is_read = ?", conversationID, uid, false).
		Update("is_read", true)

	// 清空未读数
	if conv.User1ID == uid {
		repository.DB.Model(&conv).Update("user1_unread", 0)
	} else {
		repository.DB.Model(&conv).Update("user2_unread", 0)
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"messages": messages,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// GetUnreadCount 获取总未读消息数
func GetUnreadCount(c *gin.Context) {
	uid := uint64(c.GetFloat64("userId"))

	var total int64
	repository.DB.Model(&model.ChatMessage{}).
		Where("receiver_id = ? AND is_read = ?", uid, false).
		Count(&total)

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": total})
}
