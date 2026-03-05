package handler

import (
	"errors"
	"log"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/monitor"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/tinode"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetTinodeUserID returns Tinode user topic id for the given app user identifier.
//
// GET /api/v1/tinode/userid/:userId
// `userId` can be an internal numeric id or a publicId.
// Response: { code:0, data:{ tinodeUserId: "usr..." } }
func GetTinodeUserID(c *gin.Context) {
	userIdentifier := strings.TrimSpace(c.Param("userId"))
	if userIdentifier == "" {
		response.Error(c, 400, "参数错误")
		return
	}

	platformHeader := strings.TrimSpace(c.GetHeader("X-Client-Platform"))
	if platformHeader == "" {
		platformHeader = strings.TrimSpace(c.GetHeader("X-Platform"))
	}
	if platformHeader == "" {
		platformHeader = strings.TrimSpace(c.GetHeader("X-App-Platform"))
	}
	clientPlatform := monitor.DetectClientPlatform(platformHeader, c.GetHeader("User-Agent"))

	rollbackDecision := monitor.EvaluatePublicIDRollback(userIdentifier, "tinode_userid_lookup")
	if rollbackDecision.DrillEnabled {
		c.Header("X-PublicId-Rollback-Drill", "1")
	}
	if rollbackDecision.ForceLegacyLookup {
		c.Header("X-PublicId-Rollback-Mode", "legacy-id-only")
	}

	var (
		user *model.User
		err  error
	)
	if rollbackDecision.ForceLegacyLookup {
		if !rollbackDecision.LegacyCapable {
			response.Error(c, 400, "参数错误")
			return
		}
		user, err = userService.GetUserByID(rollbackDecision.LegacyUserID)
	} else {
		user, err = userService.GetUserByIdentifier(userIdentifier)
	}
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Error(c, 404, "用户不存在")
			return
		}
		log.Printf("[Tinode] Resolve user failed (userid endpoint): identifier=%s, rollbackLegacy=%t, err=%v", userIdentifier, rollbackDecision.ForceLegacyLookup, err)
		response.Error(c, 500, "查询用户失败")
		return
	}

	if strings.TrimSpace(user.PublicID) == "" {
		monitor.RecordPublicIDMissing("tinode_userid_lookup", user.ID, "tinode_userid_endpoint")
	}

	rolloutDecision := monitor.EvaluatePublicIDRollout(user.ID, "tinode_userid_lookup", clientPlatform)
	if rolloutDecision.Matched {
		c.Header("X-PublicId-Rollout", "1")
	}

	if err := tinode.SyncUserToTinode(user); err != nil {
		log.Printf("[Tinode] Sync user failed (userid endpoint): userID=%d, err=%v", user.ID, err)
		response.Error(c, 500, "Tinode 同步失败")
		return
	}

	tinodeUserID, err := tinode.UserIDToTinodeUserID(user.ID)
	if err != nil {
		log.Printf("[Tinode] Compute user id failed: userID=%d, err=%v", user.ID, err)
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
