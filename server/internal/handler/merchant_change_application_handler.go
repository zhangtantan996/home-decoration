package handler

import (
	"encoding/json"
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type merchantIdentityChangeApplyInput struct {
	Phone        string                 `json:"phone" binding:"required"`
	Code         string                 `json:"code" binding:"required"`
	TargetRole   string                 `json:"targetRole" binding:"required"`
	TargetEntity string                 `json:"targetEntity"`
	Notes        string                 `json:"notes"`
	Data         map[string]interface{} `json:"data"`
}

func normalizeTargetRole(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "designer", "foreman", "company", "material_shop":
		return strings.ToLower(strings.TrimSpace(raw))
	default:
		return ""
	}
}

func currentMerchantRole(userID uint64) (string, string, error) {
	var provider model.Provider
	if err := repository.DB.Where("user_id = ?", userID).First(&provider).Error; err == nil {
		applicantType := normalizeMerchantApplicantType(provider.SubType, provider.ProviderType)
		role := normalizeMerchantProviderSubType(applicantType, provider.ProviderType)
		entityType := normalizeProviderEntityType(provider.EntityType, applicantType)
		return role, entityType, nil
	}

	var shop model.MaterialShop
	if err := repository.DB.Where("user_id = ?", userID).First(&shop).Error; err == nil {
		return "material_shop", "company", nil
	}

	return "", "", gorm.ErrRecordNotFound
}

func MerchantApplyIdentityChange(c *gin.Context) {
	var input merchantIdentityChangeApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	if !utils.ValidatePhone(input.Phone) {
		response.Error(c, 400, "手机号格式不正确")
		return
	}
	if err := service.VerifySMSCode(input.Phone, service.SMSPurposeIdentityApply, input.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	targetRole := normalizeTargetRole(input.TargetRole)
	if targetRole == "" {
		response.Error(c, 400, "目标角色无效")
		return
	}

	targetEntity := strings.ToLower(strings.TrimSpace(input.TargetEntity))
	if targetEntity == "" {
		targetEntity = "personal"
	}
	if targetRole == "company" || targetRole == "material_shop" {
		targetEntity = "company"
	}
	if targetEntity != "personal" && targetEntity != "company" {
		response.Error(c, 400, "主体类型无效")
		return
	}

	var user model.User
	if err := repository.DB.Where("phone = ?", input.Phone).First(&user).Error; err != nil {
		response.Error(c, 404, "用户不存在，请先入驻")
		return
	}

	currentRole, currentEntity, roleErr := currentMerchantRole(user.ID)
	if roleErr != nil {
		if errors.Is(roleErr, gorm.ErrRecordNotFound) {
			response.Error(c, 400, "当前账号尚未入驻，无需提交角色变更申请")
			return
		}
		response.Error(c, 500, "读取当前角色失败")
		return
	}
	if currentRole == targetRole && currentEntity == targetEntity {
		response.Error(c, 400, "目标角色与当前角色一致")
		return
	}

	var pending model.MerchantIdentityChangeApplication
	if err := repository.DB.Where("user_id = ? AND status = 0", user.ID).First(&pending).Error; err == nil {
		response.Error(c, 400, "您已有待处理的角色变更申请")
		return
	}

	payload := map[string]interface{}{
		"notes": strings.TrimSpace(input.Notes),
	}
	if input.Data != nil {
		payload["data"] = input.Data
	}
	applicationData, _ := json.Marshal(payload)

	changeApp := model.MerchantIdentityChangeApplication{
		UserID:          user.ID,
		Phone:           input.Phone,
		CurrentRole:     currentRole,
		TargetRole:      targetRole,
		TargetEntity:    targetEntity,
		ApplicationData: string(applicationData),
		Status:          0,
	}

	if err := repository.DB.Create(&changeApp).Error; err != nil {
		response.Error(c, 500, "提交角色变更申请失败")
		return
	}

	response.Success(c, gin.H{
		"changeApplicationId": changeApp.ID,
		"message":             "角色变更申请已提交，请等待审核",
	})
}
