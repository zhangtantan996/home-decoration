package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func AdminListComments(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 20)
	status := c.Query("status")

	var comments []model.CaseComment
	var total int64

	query := repository.DB.Model(&model.CaseComment{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)

	if err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&comments).Error; err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	var resultList []gin.H
	for _, comment := range comments {
		var caseTitle string
		var providerCase model.ProviderCase
		if err := repository.DB.First(&providerCase, comment.CaseID).Error; err == nil {
			caseTitle = providerCase.Title
		}

		userName := "未知用户"
		userAvatar := ""
		var user model.User
		if err := repository.DB.First(&user, comment.UserID).Error; err == nil {
			userName = user.Nickname
			userAvatar = imgutil.GetFullImageURL(user.Avatar)
		}

		resultList = append(resultList, gin.H{
			"id":         comment.ID,
			"caseId":     comment.CaseID,
			"caseTitle":  caseTitle,
			"userId":     comment.UserID,
			"userName":   userName,
			"userAvatar": userAvatar,
			"content":    comment.Content,
			"status":     comment.Status,
			"createdAt":  comment.CreatedAt,
		})
	}

	response.Success(c, gin.H{
		"list":  resultList,
		"total": total,
	})
}

func AdminUpdateCommentStatus(c *gin.Context) {
	commentID := parseUint64(c.Param("id"))
	var input struct {
		Status string `json:"status" binding:"required,oneof=approved pending_review hidden deleted"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Model(&model.CaseComment{}).
		Where("id = ?", commentID).
		Update("status", input.Status).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.Success(c, gin.H{"message": "更新成功"})
}
