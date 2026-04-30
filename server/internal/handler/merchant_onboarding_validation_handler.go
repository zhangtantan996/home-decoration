package handler

import (
	"strings"

	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"

	"github.com/gin-gonic/gin"
)

type onboardingValidateLicenseInput struct {
	LicenseNo   string `json:"licenseNo"`
	CompanyName string `json:"companyName"`
}

type onboardingValidateIDCardInput struct {
	IDNo     string `json:"idNo"`
	RealName string `json:"realName"`
}

func MerchantValidateOnboardingLicense(c *gin.Context) {
	var input onboardingValidateLicenseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Success(c, gin.H{"ok": false, "message": "参数格式不正确"})
		return
	}

	normalized := utils.NormalizeLicenseNo(input.LicenseNo)
	companyName := strings.TrimSpace(input.CompanyName)
	if normalized == "" {
		response.Success(c, gin.H{"ok": false, "message": "请输入统一社会信用代码/营业执照号", "normalizedValue": normalized})
		return
	}
	if !utils.ValidateBusinessLicenseNo(normalized) {
		response.Success(c, gin.H{"ok": false, "message": "统一社会信用代码/营业执照号格式不正确", "normalizedValue": normalized})
		return
	}
	if companyName != "" && !utils.ValidateCompanyName(companyName) {
		response.Success(c, gin.H{"ok": false, "message": "名称长度应在2-100个字符之间", "normalizedValue": normalized})
		return
	}
	response.Success(c, gin.H{"ok": true, "normalizedValue": normalized})
}

func MerchantValidateOnboardingIDCard(c *gin.Context) {
	var input onboardingValidateIDCardInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Success(c, gin.H{"ok": false, "message": "参数格式不正确"})
		return
	}

	normalizedID := strings.ToUpper(strings.TrimSpace(input.IDNo))
	realName := strings.TrimSpace(input.RealName)
	if normalizedID == "" {
		response.Success(c, gin.H{"ok": false, "message": "请输入身份证号", "normalizedValue": normalizedID})
		return
	}
	if !utils.ValidateIDCard(normalizedID) {
		response.Success(c, gin.H{"ok": false, "message": "身份证号格式不正确", "normalizedValue": normalizedID})
		return
	}
	if realName == "" {
		response.Success(c, gin.H{"ok": true, "normalizedValue": normalizedID})
		return
	}
	response.Success(c, gin.H{"ok": true, "normalizedValue": normalizedID})
}
