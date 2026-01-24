package handler

import (
	"errors"
	"log"
	"strconv"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/tinode"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// GetTinodeUserID returns Tinode user topic id for the given app user id.
//
// GET /api/v1/tinode/userid/:userId
// Response: { code:0, data:{ tinodeUserId: "usr..." } }
func GetTinodeUserID(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil || userID == 0 {
		response.Error(c, 400, "参数错误")
		return
	}

	// Ensure the target user exists and has a public profile in Tinode DB.
	var user model.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		response.Error(c, 404, "用户不存在")
		return
	}
	if err := tinode.SyncUserToTinode(&user); err != nil {
		log.Printf("[Tinode] Sync user failed (userid endpoint): userID=%d, err=%v", userID, err)
		response.Error(c, 500, "Tinode 同步失败")
		return
	}

	tinodeUserID, err := tinode.UserIDToTinodeUserID(userID)
	if err != nil {
		log.Printf("[Tinode] Compute user id failed: userID=%d, err=%v", userID, err)
		response.Error(c, 500, "Tinode 用户ID生成失败")
		return
	}

	response.Success(c, gin.H{
		"tinodeUserId": tinodeUserID,
	})
}

// ClearChatHistory deletes all messages in a chat topic.
//
// DELETE /api/v1/tinode/topic/:topic/messages
func ClearChatHistory(c *gin.Context) {
	userId := c.GetUint64("userId")
	topic := c.Param("topic")
	if topic == "" {
		response.Error(c, 400, "参数错误")
		return
	}

	// Validate topic format (should be like "usr123_usr456" or "grpXXXX")
	if len(topic) < 3 {
		response.Error(c, 400, "无效的话题格式")
		return
	}

	// Create message deleter with Tinode DB connection
	if repository.TinodeDB == nil {
		log.Printf("[ClearChat] Tinode DB not initialized")
		response.Error(c, 503, "Tinode 服务不可用")
		return
	}

	deleter := tinode.NewMessageDeleter(repository.TinodeDB)

	// Delete messages with timeout
	ctx := c.Request.Context()
	err := deleter.DeleteMessages(ctx, topic, userId)
	if err != nil {
		log.Printf("[ClearChat] Failed: user=%d topic=%s err=%v", userId, topic, err)

		// Check for specific error types using errors.Is
		if errors.Is(err, tinode.ErrNotAuthorized) {
			response.Error(c, 404, "话题不存在或您不是成员")
			return
		}
		if errors.Is(err, tinode.ErrInsufficientPermission) {
			response.Error(c, 403, "无权删除此话题的消息（需要管理员权限）")
			return
		}

		response.Error(c, 500, "清空聊天记录失败")
		return
	}

	log.Printf("[ClearChat] Success: user=%d topic=%s", userId, topic)
	response.SuccessWithMessage(c, "聊天记录已清空", nil)
}

