package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

func AdminListSensitiveWords(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 50)

	var words []model.SensitiveWord
	var total int64

	query := repository.DB.Model(&model.SensitiveWord{})
	query.Count(&total)

	if err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&words).Error; err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"list":  words,
		"total": total,
	})
}

func AdminCreateSensitiveWord(c *gin.Context) {
	var input struct {
		Word     string `json:"word" binding:"required"`
		Category string `json:"category"`
		Level    string `json:"level"`
		Action   string `json:"action"`
		IsRegex  bool   `json:"isRegex"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	word := model.SensitiveWord{
		Word:     input.Word,
		Category: input.Category,
		Level:    input.Level,
		Action:   input.Action,
		IsRegex:  input.IsRegex,
	}

	if err := repository.DB.Create(&word).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	response.Success(c, word)
}

func AdminUpdateSensitiveWord(c *gin.Context) {
	wordID := parseUint64(c.Param("id"))
	var input struct {
		Word     string `json:"word"`
		Category string `json:"category"`
		Level    string `json:"level"`
		Action   string `json:"action"`
		IsRegex  *bool  `json:"isRegex"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	updates := make(map[string]interface{})
	if input.Word != "" {
		updates["word"] = input.Word
	}
	if input.Category != "" {
		updates["category"] = input.Category
	}
	if input.Level != "" {
		updates["level"] = input.Level
	}
	if input.Action != "" {
		updates["action"] = input.Action
	}
	if input.IsRegex != nil {
		updates["is_regex"] = *input.IsRegex
	}

	if err := repository.DB.Model(&model.SensitiveWord{}).
		Where("id = ?", wordID).
		Updates(updates).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.Success(c, gin.H{"message": "更新成功"})
}

func AdminDeleteSensitiveWord(c *gin.Context) {
	wordID := parseUint64(c.Param("id"))

	if err := repository.DB.Delete(&model.SensitiveWord{}, wordID).Error; err != nil {
		response.ServerError(c, "删除失败")
		return
	}

	response.Success(c, gin.H{"message": "删除成功"})
}
