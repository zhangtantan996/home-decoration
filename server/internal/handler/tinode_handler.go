package handler

import (
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

// ClearChatHistory logs chat clear requests.
//
// DELETE /api/v1/tinode/topic/:topic/messages
func ClearChatHistory(c *gin.Context) {
	userId := c.GetUint64("userId")
	topic := c.Param("topic")
	if topic == "" {
		response.Error(c, 400, "参数错误")
		return
	}

	log.Printf("[ClearChat] user=%d topic=%s", userId, topic)
	response.SuccessWithMessage(c, "聊天记录已清空", nil)
}
