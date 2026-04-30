package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/internal/utils/tencentim"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== 商家入驻 Handler ====================

var regionService = &service.RegionService{}

func firstNonEmptyMerchantApplicantName(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func merchantLicenseVerificationFields(outcome *service.EnterpriseVerificationOutcome) (status, provider, requestID, reason, licenseHash string, verifiedAt *time.Time) {
	if outcome == nil {
		return "", "", "", "", "", nil
	}
	return outcome.Status, outcome.Provider, outcome.ProviderRequestID, outcome.RejectReason, outcome.LicenseHash, outcome.VerifiedAt
}

func licenseVerificationStatus(outcome *service.EnterpriseVerificationOutcome) string {
	status, _, _, _, _, _ := merchantLicenseVerificationFields(outcome)
	return status
}

func licenseVerificationProvider(outcome *service.EnterpriseVerificationOutcome) string {
	_, provider, _, _, _, _ := merchantLicenseVerificationFields(outcome)
	return provider
}

func licenseVerificationRequestID(outcome *service.EnterpriseVerificationOutcome) string {
	_, _, requestID, _, _, _ := merchantLicenseVerificationFields(outcome)
	return requestID
}

func licenseVerificationReason(outcome *service.EnterpriseVerificationOutcome) string {
	_, _, _, reason, _, _ := merchantLicenseVerificationFields(outcome)
	return reason
}

func licenseVerificationHash(outcome *service.EnterpriseVerificationOutcome) string {
	_, _, _, _, licenseHash, _ := merchantLicenseVerificationFields(outcome)
	return licenseHash
}

func licenseVerificationVerifiedAt(outcome *service.EnterpriseVerificationOutcome) *time.Time {
	_, _, _, _, _, verifiedAt := merchantLicenseVerificationFields(outcome)
	return verifiedAt
}

// MerchantApplyInput 入驻申请输入
type MerchantApplyInput struct {
	Phone                  string `json:"phone" binding:"required"`
	Code                   string `json:"code"`
	ApplicantType          string `json:"applicantType"` // 兼容旧字段
	Role                   string `json:"role"`          // designer, foreman, company
	EntityType             string `json:"entityType"`    // personal, company
	RealName               string `json:"realName"`
	Avatar                 string `json:"avatar" binding:"required"`
	IDCardNo               string `json:"idCardNo"`
	IDCardFront            string `json:"idCardFront"`
	IDCardBack             string `json:"idCardBack"`
	LegalPersonName        string `json:"legalPersonName"`
	LegalPersonIDCardNo    string `json:"legalPersonIdCardNo"`
	LegalPersonIDCardFront string `json:"legalPersonIdCardFront"`
	LegalPersonIDCardBack  string `json:"legalPersonIdCardBack"`
	VerificationToken      string `json:"verificationToken"`
	ResubmitToken          string `json:"resubmitToken"`
	// 工作室/公司专属
	CompanyName   string   `json:"companyName"`
	LicenseNo     string   `json:"licenseNo"`
	LicenseImage  string   `json:"licenseImage"`
	TeamSize      int      `json:"teamSize"`
	OfficeAddress string   `json:"officeAddress"`
	CompanyAlbum  []string `json:"companyAlbum"`
	// 工长专属
	YearsExperience int `json:"yearsExperience"`
	// 通用
	ServiceArea      []string           `json:"serviceArea" binding:"required,min=1"`
	Styles           []string           `json:"styles"`
	HighlightTags    []string           `json:"highlightTags"`
	Pricing          map[string]float64 `json:"pricing"`
	Introduction     string             `json:"introduction"`
	GraduateSchool   string             `json:"graduateSchool"`
	DesignPhilosophy string             `json:"designPhilosophy"`
	// 作品集
	PortfolioCases []PortfolioCaseInput `json:"portfolioCases" binding:"required,min=1"`
	// 条款勾选留痕
	LegalAcceptance LegalAcceptanceInput `json:"legalAcceptance" binding:"required"`
}

// PortfolioCaseInput 作品集输入
type PortfolioCaseInput struct {
	Category    string   `json:"category"`
	Title       string   `json:"title"`
	Description string   `json:"description" binding:"required"`
	Images      []string `json:"images" binding:"required,min=1"`
	Style       string   `json:"style"`
	Area        string   `json:"area"`
}

type LegalAcceptanceInput struct {
	Accepted                     bool   `json:"accepted"`
	OnboardingAgreementVersion   string `json:"onboardingAgreementVersion"`
	PlatformRulesVersion         string `json:"platformRulesVersion"`
	PrivacyDataProcessingVersion string `json:"privacyDataProcessingVersion"`
}

func normalizeApplyRoleAndEntity(input *MerchantApplyInput) error {
	role := strings.ToLower(strings.TrimSpace(input.Role))
	entityType := strings.ToLower(strings.TrimSpace(input.EntityType))
	applicantType := strings.ToLower(strings.TrimSpace(input.ApplicantType))

	if role == "" {
		switch applicantType {
		case "personal":
			role = "designer"
			entityType = "personal"
		case "studio":
			role = "designer"
			entityType = "company"
		case "company":
			role = "company"
			entityType = "company"
		case "foreman":
			role = "foreman"
		}
	}

	if role != "designer" && role != "foreman" && role != "company" {
		return fmt.Errorf("入驻角色无效")
	}

	if entityType == "" {
		if role == "company" {
			entityType = "company"
		} else {
			entityType = "personal"
		}
	}

	if entityType != "personal" && entityType != "company" {
		return fmt.Errorf("主体类型无效")
	}

	if role == "company" {
		entityType = "company"
	}

	compatApplicantType := "personal"
	switch role {
	case "designer":
		if entityType == "company" {
			compatApplicantType = "studio"
		} else {
			compatApplicantType = "personal"
		}
	case "foreman":
		compatApplicantType = "foreman"
	case "company":
		compatApplicantType = "company"
	}

	input.Role = role
	input.EntityType = entityType
	input.ApplicantType = compatApplicantType
	return nil
}

func validatePricingValue(pricing map[string]float64, key string) bool {
	if pricing == nil {
		return false
	}
	value, ok := pricing[key]
	return ok && value >= 1 && value <= 99999
}

func validateOptionalPricingValue(pricing map[string]float64, key string) bool {
	if pricing == nil {
		return true
	}
	value, ok := pricing[key]
	if !ok {
		return true
	}
	return value >= 1 && value <= 99999
}

func validateLegalAcceptance(input *LegalAcceptanceInput) error {
	input.OnboardingAgreementVersion = strings.TrimSpace(input.OnboardingAgreementVersion)
	input.PlatformRulesVersion = strings.TrimSpace(input.PlatformRulesVersion)
	input.PrivacyDataProcessingVersion = strings.TrimSpace(input.PrivacyDataProcessingVersion)

	if !input.Accepted {
		return fmt.Errorf("请先同意平台入驻相关条款")
	}
	if input.OnboardingAgreementVersion == "" {
		return fmt.Errorf("缺少入驻协议版本信息")
	}
	if input.PlatformRulesVersion == "" {
		return fmt.Errorf("缺少平台规则版本信息")
	}
	if input.PrivacyDataProcessingVersion == "" {
		return fmt.Errorf("缺少隐私与数据处理条款版本信息")
	}
	if len(input.OnboardingAgreementVersion) > 64 || len(input.PlatformRulesVersion) > 64 || len(input.PrivacyDataProcessingVersion) > 64 {
		return fmt.Errorf("条款版本长度超出限制")
	}

	return nil
}

func buildLegalAcceptanceJSON(input LegalAcceptanceInput) string {
	snapshot := map[string]interface{}{
		"accepted":                     input.Accepted,
		"onboardingAgreementVersion":   input.OnboardingAgreementVersion,
		"platformRulesVersion":         input.PlatformRulesVersion,
		"privacyDataProcessingVersion": input.PrivacyDataProcessingVersion,
	}
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		return "{}"
	}
	return string(encoded)
}

func isUserPhoneDuplicateError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "duplicate key value") &&
		(strings.Contains(message, "users_phone") || strings.Contains(message, "(phone)"))
}

func createOrLoadMerchantUserWithCompatibility(tx *gorm.DB, phone, nickname string) (model.User, error) {
	var user model.User
	err := tx.Where("phone = ?", phone).First(&user).Error
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return model.User{}, err
	}

	createdUser, createErr := createMerchantUserWithCompatibility(tx, phone, nickname)
	if createErr != nil {
		if isUserPhoneDuplicateError(createErr) {
			if findErr := tx.Where("phone = ?", phone).First(&user).Error; findErr == nil {
				return user, nil
			}
		}
		return model.User{}, createErr
	}

	return createdUser, nil
}

func createMerchantUserWithCompatibility(tx *gorm.DB, phone, _ string) (model.User, error) {
	nickname := "用户"
	if len(phone) >= 4 {
		nickname += phone[len(phone)-4:]
	}
	now := time.Now()
	createData := map[string]interface{}{
		"phone":      phone,
		"nickname":   nickname,
		"user_type":  1,
		"status":     1,
		"created_at": now,
		"updated_at": now,
	}

	if tx.Migrator().HasColumn(&model.User{}, "public_id") {
		createData["public_id"] = model.GeneratePublicID()
	}
	if tx.Migrator().HasColumn(&model.User{}, "login_failed_count") {
		createData["login_failed_count"] = 0
	}
	if tx.Migrator().HasColumn(&model.User{}, "last_login_ip") {
		createData["last_login_ip"] = ""
	}
	if tx.Migrator().HasColumn(&model.User{}, "password") {
		createData["password"] = ""
	}
	if tx.Migrator().HasColumn(&model.User{}, "avatar") {
		createData["avatar"] = ""
	}

	if err := tx.Table("users").Create(createData).Error; err != nil {
		return model.User{}, err
	}

	var user model.User
	if err := tx.Where("phone = ?", phone).First(&user).Error; err != nil {
		return model.User{}, err
	}
	return user, nil
}

func buildUserCreateFailMessage(err error) string {
	if repository.IsSchemaMismatchError(err) {
		return repository.SchemaServiceUnavailableMessage("商家入驻服务")
	}
	if config.GetAppEnv() == config.AppEnvProduction {
		return "提交失败: 创建账号失败"
	}
	if err == nil {
		return "提交失败: 创建账号失败"
	}
	return "提交失败: 创建账号失败 (" + err.Error() + ")"
}

func respondMerchantSchemaMismatch(c *gin.Context, err error) bool {
	if !repository.IsSchemaMismatchError(err) {
		return false
	}
	response.ServiceUnavailable(c, repository.SchemaServiceUnavailableMessage("商家入驻服务"))
	return true
}

func parseJSONOrDelimitedSlice(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}
	}

	var values []string
	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
		if err := json.Unmarshal([]byte(trimmed), &values); err == nil {
			return normalizeStringSlice(values)
		}
	}

	if strings.Contains(trimmed, " · ") {
		return normalizeStringSlice(strings.Split(trimmed, " · "))
	}
	if strings.Contains(trimmed, ",") {
		return normalizeStringSlice(strings.Split(trimmed, ","))
	}

	return normalizeStringSlice([]string{trimmed})
}

func parsePricingObject(raw string) map[string]float64 {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return map[string]float64{}
	}

	var pricing map[string]float64
	if err := json.Unmarshal([]byte(trimmed), &pricing); err != nil {
		return map[string]float64{}
	}
	return pricing
}

func getPricingRange(pricing map[string]float64) (float64, float64) {
	minVal := 0.0
	maxVal := 0.0

	for _, value := range pricing {
		if value <= 0 {
			continue
		}
		if minVal == 0 || value < minVal {
			minVal = value
		}
		if value > maxVal {
			maxVal = value
		}
	}

	return minVal, maxVal
}

func normalizeApprovedApplicationMeta(app *model.MerchantApplication) (int8, string, string, string, error) {
	role := strings.ToLower(strings.TrimSpace(app.Role))
	entityType := strings.ToLower(strings.TrimSpace(app.EntityType))
	applicantType := strings.ToLower(strings.TrimSpace(app.ApplicantType))

	if role == "" {
		switch applicantType {
		case "studio":
			role = "designer"
			entityType = "company"
		case "company":
			role = "company"
			entityType = "company"
		case "foreman":
			role = "foreman"
		default:
			role = "designer"
			entityType = "personal"
		}
	}

	if entityType == "" {
		if role == "company" {
			entityType = "company"
		} else if applicantType == "studio" {
			entityType = "company"
		} else {
			entityType = "personal"
		}
	}

	if entityType != "personal" && entityType != "company" {
		return 0, "", "", "", fmt.Errorf("主体类型无效")
	}

	var (
		providerType int8
		subType      string
		compatType   string
	)

	switch role {
	case "designer":
		providerType = 1
		if entityType == "company" {
			subType = "studio"
			compatType = "studio"
		} else {
			subType = "personal"
			compatType = "personal"
		}
	case "foreman":
		providerType = 3
		subType = "foreman"
		compatType = "foreman"
	case "company":
		providerType = 2
		entityType = "company"
		subType = "company"
		compatType = "company"
	default:
		return 0, "", "", "", fmt.Errorf("入驻角色无效")
	}

	return providerType, subType, entityType, compatType, nil
}

func encryptSensitiveOrPlain(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}

	if strings.TrimSpace(os.Getenv("ENCRYPTION_KEY")) == "" {
		return value
	}

	encrypted, err := utils.Encrypt(value)
	if err != nil {
		log.Printf("[MerchantApply] encrypt failed, fallback plain value: %v", err)
		return value
	}
	return encrypted
}

func decryptSensitiveOrPlain(raw string) (string, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", true
	}
	if strings.TrimSpace(os.Getenv("ENCRYPTION_KEY")) == "" {
		return value, true
	}
	decrypted, err := utils.Decrypt(value)
	if err != nil {
		return "", false
	}
	return decrypted, true
}

func displayMaskedSensitive(raw string, mask func(string) string) string {
	value, ok := decryptSensitiveOrPlain(raw)
	if !ok || strings.TrimSpace(value) == "" {
		return "***"
	}
	return mask(value)
}

func displayReadableSensitive(raw string) string {
	value, ok := decryptSensitiveOrPlain(raw)
	if !ok {
		return "***"
	}
	return value
}

func maskSensitiveID(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) < 10 {
		return "***"
	}
	return trimmed[:6] + "********" + trimmed[len(trimmed)-4:]
}

func normalizePortfolioCaseDisplays(cases []PortfolioCaseInput) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(cases))
	for _, caseItem := range cases {
		result = append(result, map[string]interface{}{
			"title":       caseItem.Title,
			"description": caseItem.Description,
			"images":      imgutil.GetFullImageURLs(caseItem.Images),
			"style":       caseItem.Style,
			"area":        caseItem.Area,
		})
	}
	return result
}

func normalizeStringSlice(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))

	for _, item := range values {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}

	return result
}

func validatePortfolioCases(role string, cases []PortfolioCaseInput) error {
	if len(cases) == 0 {
		return fmt.Errorf("请至少添加1个案例")
	}

	if role == "foreman" {
		normalized := normalizeForemanPortfolioCases(cases)
		provided := make(map[string]PortfolioCaseInput, len(normalized))
		for _, item := range normalized {
			provided[item.Category] = item
		}
		for _, category := range foremanRequiredCategories {
			item, ok := provided[category]
			if !ok {
				return fmt.Errorf("工长需补充%s", foremanCategoryDisplayNames[category])
			}
			if strings.TrimSpace(item.Description) == "" {
				return fmt.Errorf("%s工艺说明不能为空", foremanCategoryDisplayNames[category])
			}
			if len([]rune(strings.TrimSpace(item.Description))) > 5000 {
				return fmt.Errorf("%s工艺说明不能超过5000个字符", foremanCategoryDisplayNames[category])
			}
			images := normalizeStoredAssetSlice(normalizeStringSlice(item.Images))
			if len(images) < 2 || len(images) > 8 {
				return fmt.Errorf("%s需上传2-8张图片", foremanCategoryDisplayNames[category])
			}
		}
		if item, ok := provided["other"]; ok {
			desc := strings.TrimSpace(item.Description)
			images := normalizeStoredAssetSlice(normalizeStringSlice(item.Images))
			if desc == "" && len(images) == 0 {
				return nil
			}
			if desc == "" {
				return fmt.Errorf("其他施工展示工艺说明不能为空")
			}
			if len(images) < 2 || len(images) > 8 {
				return fmt.Errorf("其他施工展示需上传2-8张图片")
			}
		}
		return nil
	}

	for index := range cases {
		cases[index].Category = normalizeForemanCategory(cases[index].Category)
		cases[index].Title = strings.TrimSpace(cases[index].Title)
		cases[index].Description = strings.TrimSpace(cases[index].Description)
		cases[index].Style = strings.TrimSpace(cases[index].Style)
		cases[index].Area = strings.TrimSpace(cases[index].Area)
		cases[index].Images = normalizeStoredAssetSlice(normalizeStringSlice(cases[index].Images))

		if cases[index].Title == "" {
			return fmt.Errorf("第%d个案例缺少标题", index+1)
		}
		if cases[index].Description == "" {
			return fmt.Errorf("第%d个案例缺少说明", index+1)
		}
		if len([]rune(cases[index].Description)) > 5000 {
			return fmt.Errorf("第%d个案例说明不能超过5000个字符", index+1)
		}
		if len(cases[index].Images) == 0 {
			return fmt.Errorf("第%d个案例至少上传1张图片", index+1)
		}

		switch role {
		case "designer":
			minImages := 4
			if len(cases[index].Images) < minImages || len(cases[index].Images) > 12 {
				return fmt.Errorf("设计师第%d个案例需上传%d-12张图片", index+1, minImages)
			}
			if strings.TrimSpace(cases[index].Style) == "" {
				cases[index].Style = "现代简约"
			}
			if strings.TrimSpace(cases[index].Area) == "" {
				cases[index].Area = "待补充"
			}
		case "company":
			if len(cases[index].Images) < 3 {
				return fmt.Errorf("装修公司第%d个案例至少上传3张图片", index+1)
			}
		}
	}

	return nil
}

func validateMerchantApplyBusinessFields(input *MerchantApplyInput) error {
	if err := validateLegalAcceptance(&input.LegalAcceptance); err != nil {
		return err
	}

	if err := normalizeApplyRoleAndEntity(input); err != nil {
		return err
	}

	input.Styles = normalizeStringSlice(input.Styles)
	input.HighlightTags = normalizeStringSlice(input.HighlightTags)
	input.CompanyAlbum = normalizeStoredAssetSlice(normalizeStringSlice(input.CompanyAlbum))
	input.Avatar = normalizeStoredAsset(input.Avatar)
	input.RealName = strings.TrimSpace(input.RealName)
	input.IDCardNo = strings.TrimSpace(input.IDCardNo)
	input.IDCardFront = normalizeStoredAsset(input.IDCardFront)
	input.IDCardBack = normalizeStoredAsset(input.IDCardBack)
	input.CompanyName = strings.TrimSpace(input.CompanyName)
	input.LicenseNo = utils.NormalizeLicenseNo(input.LicenseNo)
	input.LicenseImage = normalizeStoredAsset(input.LicenseImage)
	input.LegalPersonName = strings.TrimSpace(input.LegalPersonName)
	input.LegalPersonIDCardNo = strings.TrimSpace(input.LegalPersonIDCardNo)
	input.LegalPersonIDCardFront = normalizeStoredAsset(input.LegalPersonIDCardFront)
	input.LegalPersonIDCardBack = normalizeStoredAsset(input.LegalPersonIDCardBack)
	input.GraduateSchool = strings.TrimSpace(input.GraduateSchool)
	input.DesignPhilosophy = strings.TrimSpace(input.DesignPhilosophy)
	input.Introduction = strings.TrimSpace(input.Introduction)
	input.OfficeAddress = strings.TrimSpace(input.OfficeAddress)

	if input.EntityType == "company" {
		if input.LegalPersonName != "" {
			input.RealName = input.LegalPersonName
		}
		if input.LegalPersonIDCardNo != "" {
			input.IDCardNo = strings.ToUpper(input.LegalPersonIDCardNo)
		}
		if input.LegalPersonIDCardFront != "" {
			input.IDCardFront = input.LegalPersonIDCardFront
		}
		if input.LegalPersonIDCardBack != "" {
			input.IDCardBack = input.LegalPersonIDCardBack
		}
	}

	if input.RealName == "" {
		if input.EntityType == "company" {
			return fmt.Errorf("请填写法人/经营者姓名")
		}
		return fmt.Errorf("请填写姓名")
	}
	if !utils.ValidateRealName(input.RealName) {
		return fmt.Errorf("姓名长度应在2-20个字符之间")
	}
	if input.IDCardNo == "" {
		if input.EntityType == "company" {
			return fmt.Errorf("请填写法人/经营者身份证号")
		}
		return fmt.Errorf("请填写身份证号")
	}
	if !utils.ValidateIDCard(strings.ToUpper(input.IDCardNo)) {
		return fmt.Errorf("身份证号格式不正确")
	}
	input.IDCardNo = strings.ToUpper(input.IDCardNo)
	if strings.TrimSpace(input.IDCardFront) == "" {
		if input.EntityType == "company" {
			return fmt.Errorf("请上传法人/经营者身份证正面")
		}
		return fmt.Errorf("请上传身份证正面")
	}
	if strings.TrimSpace(input.IDCardBack) == "" {
		if input.EntityType == "company" {
			return fmt.Errorf("请上传法人/经营者身份证反面")
		}
		return fmt.Errorf("请上传身份证反面")
	}

	if input.Avatar == "" {
		return fmt.Errorf("请上传头像")
	}
	if len([]rune(input.Avatar)) > 500 {
		return fmt.Errorf("头像地址长度超过限制")
	}
	if err := service.VerifyIDCardForApply(input.IDCardNo, input.RealName); err != nil {
		return err
	}

	if len([]rune(input.Introduction)) > 5000 {
		return fmt.Errorf("个人/公司简介不能超过5000个字符")
	}

	if len([]rune(input.DesignPhilosophy)) > 5000 {
		return fmt.Errorf("设计理念不能超过5000个字符")
	}
	if input.OfficeAddress == "" {
		return fmt.Errorf("请填写办公地址")
	}

	if err := validatePortfolioCases(input.Role, input.PortfolioCases); err != nil {
		return err
	}

	if input.EntityType == "company" {
		if !utils.ValidateCompanyName(input.CompanyName) {
			return fmt.Errorf("名称长度应在2-100个字符之间")
		}
		if input.LicenseNo == "" {
			return fmt.Errorf("公司主体必须提供统一社会信用代码/营业执照号")
		}
		if err := service.ValidateLicenseInputForApply(input.LicenseNo, input.CompanyName); err != nil {
			return err
		}
		if strings.TrimSpace(input.LicenseImage) == "" {
			return fmt.Errorf("公司主体必须上传营业执照图片")
		}
	}

	switch input.Role {
	case "designer":
		if input.YearsExperience <= 0 || input.YearsExperience > 50 {
			return fmt.Errorf("设计师类型需要填写1-50年的从业经验")
		}
		if len(input.Styles) < 1 || len(input.Styles) > 3 {
			return fmt.Errorf("设计师擅长风格需选择1-3个")
		}
		if len(input.PortfolioCases) < 3 {
			return fmt.Errorf("设计师请至少添加3个作品案例")
		}
		if !validatePricingValue(input.Pricing, "flat") {
			return fmt.Errorf("设计师需填写平层报价（元/㎡，1-99999）")
		}
		if !validateOptionalPricingValue(input.Pricing, "duplex") || !validateOptionalPricingValue(input.Pricing, "other") {
			return fmt.Errorf("设计师复式/其他报价需在1-99999之间（元/㎡）")
		}
		if input.EntityType == "company" {
			for index := range input.PortfolioCases {
				if len(normalizeStringSlice(input.PortfolioCases[index].Images)) < 6 || len(normalizeStringSlice(input.PortfolioCases[index].Images)) > 12 {
					return fmt.Errorf("企业主体设计师第%d个案例需上传6-12张图片", index+1)
				}
			}
		}
	case "foreman":
		if input.YearsExperience <= 0 || input.YearsExperience > 50 {
			return fmt.Errorf("工长类型需要填写1-50年的施工经验")
		}
		if len(input.HighlightTags) < 1 || len(input.HighlightTags) > 3 {
			return fmt.Errorf("工长施工亮点需选择1-3个")
		}
		if len(normalizeForemanPortfolioCases(input.PortfolioCases)) < len(foremanRequiredCategories) {
			return fmt.Errorf("工长类型需补齐5个必填施工展示")
		}
		if !validatePricingValue(input.Pricing, "perSqm") {
			return fmt.Errorf("工长需填写施工报价（元/㎡）")
		}
	case "company":
		if len(input.PortfolioCases) < 3 {
			return fmt.Errorf("装修公司请至少添加3个案例")
		}
		if len(input.CompanyAlbum) < 3 || len(input.CompanyAlbum) > 8 {
			return fmt.Errorf("装修公司企业相册需上传3-8张图片")
		}
		if !validatePricingValue(input.Pricing, "fullPackage") || !validatePricingValue(input.Pricing, "halfPackage") {
			return fmt.Errorf("装修公司需填写全包/半包报价（元/㎡）")
		}
	}

	return nil
}

// MerchantApply 提交商家入驻申请
func MerchantApply(c *gin.Context) {
	var input MerchantApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	input.Phone = strings.TrimSpace(input.Phone)
	input.Code = strings.TrimSpace(input.Code)
	input.RealName = strings.TrimSpace(input.RealName)
	input.IDCardNo = strings.TrimSpace(input.IDCardNo)
	input.IDCardFront = strings.TrimSpace(input.IDCardFront)
	input.IDCardBack = strings.TrimSpace(input.IDCardBack)

	// 1. 前置校验手机号验证码（兼容 code 兜底）
	if err := authorizeOnboarding(input.Phone, input.VerificationToken, 0, merchantIdentityTypeProvider, merchantVerificationModeApply, input.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	// 2. 严格校验输入格式
	if !utils.ValidatePhone(input.Phone) {
		response.Error(c, 400, "手机号格式不正确")
		return
	}

	if err := validateMerchantApplyBusinessFields(&input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	// 3. 检查是否已有申请
	var existingApp model.MerchantApplication
	if err := repository.DB.Where("phone = ? AND status IN (0, 1)", input.Phone).First(&existingApp).Error; err == nil {
		if existingApp.Status == 0 {
			response.Error(c, 400, "您已提交申请，请等待审核")
		} else {
			response.Error(c, 400, "您已是入驻商家，请直接登录")
		}
		return
	}

	// 4. 验证服务城市代码是否有效（支持名称/代码输入，最终统一收口为城市代码）
	serviceAreaCodes, err := regionService.NormalizeServiceCityCodes(input.ServiceArea)
	if err != nil {
		response.Error(c, 400, "服务城市验证失败: "+err.Error())
		return
	}

	var licenseVerification *service.EnterpriseVerificationOutcome
	if input.EntityType == "company" {
		licenseVerification, err = service.VerifyLicenseForApplyWithContextResult(service.EnterpriseVerificationContext{
			ApplicationType: "merchant",
			ActorKey:        input.Phone,
			CompanyName:     input.CompanyName,
			LicenseNo:       input.LicenseNo,
			ClientIP:        c.ClientIP(),
		})
		if err != nil {
			response.Error(c, 400, err.Error())
			return
		}
	}

	// 5. 序列化 JSON 字段
	serviceAreaJSON, _ := json.Marshal(serviceAreaCodes)
	stylesJSON, _ := json.Marshal(input.Styles)
	highlightTagsJSON, _ := json.Marshal(input.HighlightTags)
	pricingJSON, _ := json.Marshal(input.Pricing)
	portfolioCases := input.PortfolioCases
	if input.Role == "foreman" {
		portfolioCases = normalizeForemanPortfolioCases(input.PortfolioCases)
	}
	portfolioJSON, _ := json.Marshal(portfolioCases)
	companyAlbumJSON, _ := json.Marshal(input.CompanyAlbum)

	tx := repository.DB.Begin()

	// 6. 入驻内隐式建号（或复用已有用户）
	var user model.User
	if err := tx.Where("phone = ?", input.Phone).First(&user).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			tx.Rollback()
			response.Error(c, 500, "提交失败: 查询用户异常")
			return
		}

		createdUser, err := createMerchantUserWithCompatibility(tx, input.Phone, input.RealName)
		if err != nil {
			if isUserPhoneDuplicateError(err) {
				if findErr := tx.Where("phone = ?", input.Phone).First(&user).Error; findErr != nil {
					tx.Rollback()
					if respondMerchantSchemaMismatch(c, findErr) {
						return
					}
					log.Printf("[MerchantApply] duplicate user phone but query existing failed, phone=%s, err=%v", input.Phone, findErr)
					response.Error(c, 500, buildUserCreateFailMessage(findErr))
					return
				}
			} else {
				tx.Rollback()
				if respondMerchantSchemaMismatch(c, err) {
					return
				}
				log.Printf("[MerchantApply] create user failed, phone=%s, err=%v", input.Phone, err)
				response.Error(c, 500, buildUserCreateFailMessage(err))
				return
			}
		} else {
			user = createdUser
		}
	}
	// 7. 商家互斥：同一时刻仅允许一个已生效商家身份；用户账号可与商家共存
	if ok, nextAction, checkErr := canSubmitProviderApplication(tx, user.ID); checkErr != nil {
		tx.Rollback()
		if respondMerchantSchemaMismatch(c, checkErr) {
			return
		}
		response.Error(c, 500, "提交失败: 校验商家身份异常")
		return
	} else if !ok {
		if nextAction == merchantNextActionReapply && verificationTokenAllowsReapply(merchantVerificationModeApply, merchantIdentityTypeProvider, 0, input.Phone, input.VerificationToken) {
			goto createProviderApplication
		}
		tx.Rollback()
		c.JSON(200, response.Response{
			Code:    409,
			Message: "您已有生效中的商家身份，请登录商家中心或重新发起新类型申请",
			Data: gin.H{
				"nextAction": nextAction,
				"userId":     user.ID,
			},
		})
		return
	}

	// 8. 创建申请记录
createProviderApplication:
	acceptedAt := time.Now()
	application := model.MerchantApplication{
		UserID:                 user.ID,
		Phone:                  input.Phone,
		ApplicantType:          input.ApplicantType,
		Role:                   input.Role,
		EntityType:             input.EntityType,
		RealName:               input.RealName,
		Avatar:                 input.Avatar,
		IDCardNo:               encryptSensitiveOrPlain(input.IDCardNo),
		IDCardFront:            input.IDCardFront,
		IDCardBack:             input.IDCardBack,
		CompanyName:            input.CompanyName,
		LicenseNo:              encryptSensitiveOrPlain(input.LicenseNo),
		LicenseImage:           input.LicenseImage,
		LicenseVerifyStatus:    licenseVerificationStatus(licenseVerification),
		LicenseVerifyProvider:  licenseVerificationProvider(licenseVerification),
		LicenseVerifyRequestID: licenseVerificationRequestID(licenseVerification),
		LicenseVerifyReason:    licenseVerificationReason(licenseVerification),
		LicenseHash:            licenseVerificationHash(licenseVerification),
		LicenseVerifiedAt:      licenseVerificationVerifiedAt(licenseVerification),
		TeamSize:               input.TeamSize,
		OfficeAddress:          input.OfficeAddress,
		CompanyAlbumJSON:       string(companyAlbumJSON),
		YearsExperience:        input.YearsExperience,
		ServiceArea:            string(serviceAreaJSON),
		Styles:                 string(stylesJSON),
		HighlightTags:          string(highlightTagsJSON),
		PricingJSON:            string(pricingJSON),
		Introduction:           input.Introduction,
		GraduateSchool:         input.GraduateSchool,
		DesignPhilosophy:       input.DesignPhilosophy,
		PortfolioCases:         string(portfolioJSON),
		LegalAcceptanceJSON:    buildLegalAcceptanceJSON(input.LegalAcceptance),
		LegalAcceptedAt:        &acceptedAt,
		LegalAcceptSource:      "merchant_web",
		ApplicationScene:       model.MerchantApplicationSceneNewOnboarding,
		Status:                 0, // 待审核
	}

	if err := tx.Create(&application).Error; err != nil {
		tx.Rollback()
		if respondMerchantSchemaMismatch(c, err) {
			return
		}
		response.Error(c, 500, "提交失败: "+err.Error())
		return
	}

	tx.Commit()

	service.NewNotificationDispatcher().NotifyMerchantApplicationSubmittedToAdmins(
		application.ID,
		input.Role,
		firstNonEmptyMerchantApplicantName(input.CompanyName, input.RealName),
	)

	// 9. TODO: 发送短信通知
	// sendSMS(input.Phone, "您的商家入驻申请已提交，预计1-3个工作日内完成审核")

	response.Success(c, gin.H{
		"applicationId": application.ID,
		"userCreated":   true,
		"message":       "申请已提交，账号已创建，审核通过后可登录商家中心",
	})
}

// MerchantApplyStatus 查询入驻申请状态
func MerchantApplyStatus(c *gin.Context) {
	phone := c.Param("phone")
	if phone == "" {
		response.Error(c, 400, "手机号不能为空")
		return
	}

	var app model.MerchantApplication
	if err := repository.DB.Where("phone = ?", phone).Order("created_at DESC").First(&app).Error; err != nil {
		response.Error(c, 404, "未找到申请记录")
		return
	}

	statusText := map[int8]string{
		0: "待审核",
		1: "审核通过",
		2: "审核拒绝",
	}

	response.Success(c, gin.H{
		"applicationId": app.ID,
		"applicantType": app.ApplicantType,
		"role":          app.Role,
		"entityType":    app.EntityType,
		"avatar":        app.Avatar,
		"status":        app.Status,
		"statusText":    statusText[app.Status],
		"rejectReason":  app.RejectReason,
		"createdAt":     app.CreatedAt,
		"auditedAt":     app.AuditedAt,
	})
}

func MerchantVerifyOnboardingPhone(c *gin.Context) {
	var input onboardingVerifyPhoneInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	input.Phone = strings.TrimSpace(input.Phone)
	input.Code = strings.TrimSpace(input.Code)
	input.MerchantKind = strings.TrimSpace(input.MerchantKind)
	input.Mode = strings.TrimSpace(input.Mode)

	if !utils.ValidatePhone(input.Phone) {
		response.Error(c, 400, "手机号格式不正确")
		return
	}
	if input.MerchantKind != merchantIdentityTypeProvider && input.MerchantKind != merchantIdentityTypeMaterial {
		response.Error(c, 400, "商家类型不正确")
		return
	}
	if input.Mode != merchantVerificationModeApply && input.Mode != merchantVerificationModeResubmit {
		response.Error(c, 400, "校验模式不正确")
		return
	}
	if input.Mode == merchantVerificationModeResubmit && input.ApplicationID == 0 {
		response.Error(c, 400, "重提模式缺少申请编号")
		return
	}
	if err := service.VerifySMSCode(input.Phone, service.SMSPurposeIdentityApply, input.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	if input.Mode == merchantVerificationModeApply {
		switch input.MerchantKind {
		case merchantIdentityTypeProvider:
			var existingApp model.MerchantApplication
			if err := repository.DB.Where("phone = ? AND status IN (0, 1)", input.Phone).Order("created_at DESC").First(&existingApp).Error; err == nil {
				if existingApp.Status == 0 {
					response.Error(c, 400, "您已提交申请，请等待审核")
				} else {
					response.Error(c, 400, "您已是入驻商家，请直接登录")
				}
				return
			} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				response.Error(c, 500, "校验入驻申请失败")
				return
			}

			var user model.User
			if err := repository.DB.Where("phone = ?", input.Phone).First(&user).Error; err == nil {
				ok, nextAction, checkErr := canSubmitProviderApplication(repository.DB, user.ID)
				if checkErr != nil {
					response.Error(c, 500, "校验商家身份异常")
					return
				}
				if !ok {
					if nextAction == merchantNextActionReapply && input.AllowReapply {
						break
					}
					c.JSON(200, response.Response{
						Code:    409,
						Message: "您已有生效中的商家身份，请登录商家中心或重新发起新类型申请",
						Data: gin.H{
							"nextAction": nextAction,
							"userId":     user.ID,
						},
					})
					return
				}
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				response.Error(c, 500, "校验手机号账号失败")
				return
			}
		case merchantIdentityTypeMaterial:
			var existingApp model.MaterialShopApplication
			if err := repository.DB.Where("phone = ? AND status IN (0, 1)", input.Phone).Order("created_at DESC").First(&existingApp).Error; err == nil {
				if existingApp.Status == 0 {
					response.Error(c, 400, "您已提交主材商入驻申请，请等待审核")
				} else {
					response.Error(c, 400, "您已是入驻主材商，请直接登录")
				}
				return
			} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				response.Error(c, 500, "校验主材商申请失败")
				return
			}

			var user model.User
			if err := repository.DB.Where("phone = ?", input.Phone).First(&user).Error; err == nil {
				ok, nextAction, checkErr := canSubmitMaterialShopApplication(repository.DB, user.ID)
				if checkErr != nil {
					response.Error(c, 500, "校验商家身份异常")
					return
				}
				if !ok {
					if nextAction == merchantNextActionReapply && input.AllowReapply {
						break
					}
					c.JSON(200, response.Response{
						Code:    409,
						Message: "您已有生效中的商家身份，请登录商家中心或重新发起新类型申请",
						Data: gin.H{
							"nextAction": nextAction,
							"userId":     user.ID,
						},
					})
					return
				}
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				response.Error(c, 500, "校验手机号账号失败")
				return
			}
		}
	}

	verificationToken, err := issueVerificationToken(input.Mode, input.MerchantKind, input.ApplicationID, input.Phone, 30*time.Minute, input.AllowReapply)
	if err != nil {
		response.Error(c, 500, "生成手机号验证凭证失败")
		return
	}

	result := gin.H{
		"ok":                true,
		"verificationToken": verificationToken,
		"verifiedPhone":     input.Phone,
		"expiresAt":         time.Now().Add(30 * time.Minute),
	}

	if input.Mode == merchantVerificationModeResubmit {
		if input.MerchantKind == merchantIdentityTypeProvider {
			var app model.MerchantApplication
			if err := repository.DB.First(&app, input.ApplicationID).Error; err != nil {
				response.Error(c, 404, "申请不存在")
				return
			}
			if app.Status != 2 {
				response.Error(c, 400, "当前申请状态不支持重新提交详情回填")
				return
			}
			if app.Phone != input.Phone {
				response.Error(c, 403, "手机号与原申请不一致")
				return
			}

			var serviceAreaCodes, styles, highlightTags, companyAlbum []string
			var pricing map[string]float64
			var portfolioCases []PortfolioCaseInput
			_ = json.Unmarshal([]byte(app.ServiceArea), &serviceAreaCodes)
			_ = json.Unmarshal([]byte(app.Styles), &styles)
			_ = json.Unmarshal([]byte(app.HighlightTags), &highlightTags)
			_ = json.Unmarshal([]byte(app.CompanyAlbumJSON), &companyAlbum)
			_ = json.Unmarshal([]byte(app.PricingJSON), &pricing)
			_ = json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)
			if app.Role == "foreman" {
				portfolioCases = normalizeForemanPortfolioCases(portfolioCases)
			}
			serviceAreaCodes, serviceAreaNames, _ := regionService.ResolveServiceAreaInputsToCityDisplay(serviceAreaCodes)

			result["merchantKind"] = "provider"
			result["rejectReason"] = app.RejectReason
			result["resubmitEditable"] = gin.H{"phone": false, "role": false}
			result["form"] = gin.H{
				"phone":                  app.Phone,
				"applicantType":          app.ApplicantType,
				"role":                   app.Role,
				"entityType":             app.EntityType,
				"realName":               app.RealName,
				"avatar":                 imgutil.GetFullImageURL(app.Avatar),
				"idCardNo":               displayReadableSensitive(app.IDCardNo),
				"idCardFront":            imgutil.GetFullImageURL(app.IDCardFront),
				"idCardBack":             imgutil.GetFullImageURL(app.IDCardBack),
				"companyName":            app.CompanyName,
				"licenseNo":              displayReadableSensitive(app.LicenseNo),
				"licenseImage":           imgutil.GetFullImageURL(app.LicenseImage),
				"legalPersonName":        app.LegalPersonName,
				"legalPersonIdCardNo":    displayReadableSensitive(app.LegalPersonIDCardNo),
				"legalPersonIdCardFront": imgutil.GetFullImageURL(app.LegalPersonIDCardFront),
				"legalPersonIdCardBack":  imgutil.GetFullImageURL(app.LegalPersonIDCardBack),
				"teamSize":               app.TeamSize,
				"officeAddress":          app.OfficeAddress,
				"companyAlbum":           imgutil.GetFullImageURLs(companyAlbum),
				"yearsExperience":        app.YearsExperience,
				"serviceArea":            serviceAreaNames,
				"serviceAreaCodes":       serviceAreaCodes,
				"styles":                 styles,
				"highlightTags":          highlightTags,
				"pricing":                pricing,
				"introduction":           app.Introduction,
				"graduateSchool":         app.GraduateSchool,
				"designPhilosophy":       app.DesignPhilosophy,
				"portfolioCases":         portfolioCases,
				"legalAcceptance":        parseLegalAcceptanceJSON(app.LegalAcceptanceJSON),
				"legalAcceptanceReset":   true,
			}
		} else {
			var app model.MaterialShopApplication
			if err := repository.DB.First(&app, input.ApplicationID).Error; err != nil {
				response.Error(c, 404, "申请不存在")
				return
			}
			if app.Status != 2 {
				response.Error(c, 400, "当前申请状态不支持重新提交详情回填")
				return
			}
			if app.Phone != input.Phone {
				response.Error(c, 403, "手机号与原申请不一致")
				return
			}
			var products []model.MaterialShopApplicationProduct
			_ = repository.DB.Where("application_id = ?", app.ID).Order("sort_order ASC, id ASC").Find(&products).Error
			productList := make([]gin.H, 0, len(products))
			for _, product := range products {
				var images []string
				_ = json.Unmarshal([]byte(product.ImagesJSON), &images)
				productList = append(productList, gin.H{"name": product.Name, "unit": product.Unit, "price": product.Price, "images": imgutil.GetFullImageURLs(images)})
			}
			businessHoursRanges := parseBusinessHoursRanges(app.BusinessHoursJSON)
			result["merchantKind"] = "material_shop"
			result["rejectReason"] = app.RejectReason
			result["resubmitEditable"] = gin.H{"phone": false, "merchantKind": false}
			result["form"] = gin.H{
				"phone":                  app.Phone,
				"entityType":             app.EntityType,
				"avatar":                 imgutil.GetFullImageURL(app.BrandLogo),
				"shopName":               app.ShopName,
				"shopDescription":        app.ShopDescription,
				"companyName":            app.CompanyName,
				"businessLicenseNo":      displayReadableSensitive(app.BusinessLicenseNo),
				"businessLicense":        imgutil.GetFullImageURL(app.BusinessLicense),
				"legalPersonName":        app.LegalPersonName,
				"legalPersonIdCardNo":    displayReadableSensitive(app.LegalPersonIDCardNo),
				"legalPersonIdCardFront": imgutil.GetFullImageURL(app.LegalPersonIDCardFront),
				"legalPersonIdCardBack":  imgutil.GetFullImageURL(app.LegalPersonIDCardBack),
				"businessHours":          app.BusinessHours,
				"businessHoursRanges":    businessHoursRanges,
				"contactPhone":           app.ContactPhone,
				"contactName":            app.ContactName,
				"address":                app.Address,
				"products":               productList,
				"legalAcceptance":        parseLegalAcceptanceJSON(app.LegalAcceptanceJSON),
				"legalAcceptanceReset":   true,
			}
		}
	}

	response.Success(c, result)
}

// MerchantApplyDetailForResubmit 获取驳回后重新提交所需详情
func MerchantApplyDetailForResubmit(c *gin.Context) {
	appID := parseUint64(c.Param("id"))
	var authInput resubmitDetailRequestInput
	if err := c.ShouldBindJSON(&authInput); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	authInput.Phone = strings.TrimSpace(authInput.Phone)
	authInput.Code = strings.TrimSpace(authInput.Code)

	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}
	if app.Status != 2 {
		response.Error(c, 400, "当前申请状态不支持重新提交详情回填")
		return
	}
	if app.Phone != authInput.Phone {
		response.Error(c, 403, "手机号与原申请不一致")
		return
	}
	if err := service.VerifySMSCode(authInput.Phone, service.SMSPurposeIdentityApply, authInput.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	resubmitToken, err := issueResubmitToken(merchantIdentityTypeProvider, app.ID, app.Phone)
	if err != nil {
		response.Error(c, 500, "生成重提授权凭证失败")
		return
	}

	var serviceAreaCodes, styles, highlightTags, companyAlbum []string
	var pricing map[string]float64
	var portfolioCases []PortfolioCaseInput
	_ = json.Unmarshal([]byte(app.ServiceArea), &serviceAreaCodes)
	_ = json.Unmarshal([]byte(app.Styles), &styles)
	_ = json.Unmarshal([]byte(app.HighlightTags), &highlightTags)
	_ = json.Unmarshal([]byte(app.CompanyAlbumJSON), &companyAlbum)
	_ = json.Unmarshal([]byte(app.PricingJSON), &pricing)
	_ = json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)
	if app.Role == "foreman" {
		portfolioCases = normalizeForemanPortfolioCases(portfolioCases)
	}
	serviceAreaCodes, serviceAreaNames, _ := regionService.ResolveServiceAreaInputsToCityDisplay(serviceAreaCodes)

	response.Success(c, gin.H{
		"applicationId": app.ID,
		"merchantKind":  "provider",
		"resubmitToken": resubmitToken,
		"resubmitEditable": gin.H{
			"phone": false,
			"role":  false,
		},
		"form": gin.H{
			"phone":                app.Phone,
			"applicantType":        app.ApplicantType,
			"role":                 app.Role,
			"entityType":           app.EntityType,
			"realName":             app.RealName,
			"avatar":               imgutil.GetFullImageURL(app.Avatar),
			"idCardNo":             displayReadableSensitive(app.IDCardNo),
			"idCardFront":          imgutil.GetFullImageURL(app.IDCardFront),
			"idCardBack":           imgutil.GetFullImageURL(app.IDCardBack),
			"companyName":          app.CompanyName,
			"licenseNo":            displayReadableSensitive(app.LicenseNo),
			"licenseImage":         imgutil.GetFullImageURL(app.LicenseImage),
			"teamSize":             app.TeamSize,
			"officeAddress":        app.OfficeAddress,
			"companyAlbum":         imgutil.GetFullImageURLs(companyAlbum),
			"yearsExperience":      app.YearsExperience,
			"serviceArea":          serviceAreaNames,
			"serviceAreaCodes":     serviceAreaCodes,
			"styles":               styles,
			"highlightTags":        highlightTags,
			"pricing":              pricing,
			"introduction":         app.Introduction,
			"graduateSchool":       app.GraduateSchool,
			"designPhilosophy":     app.DesignPhilosophy,
			"portfolioCases":       portfolioCases,
			"legalAcceptance":      parseLegalAcceptanceJSON(app.LegalAcceptanceJSON),
			"legalAcceptanceReset": true,
		},
		"rejectReason": app.RejectReason,
	})
}

// MerchantResubmit 重新提交入驻申请
func MerchantResubmit(c *gin.Context) {
	appID := parseUint64(c.Param("id"))

	var input MerchantApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 查找原申请
	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	// 只有被拒绝的申请可以重新提交
	if app.Status != 2 {
		response.Error(c, 400, "该申请状态不允许重新提交")
		return
	}

	// 验证手机号一致
	if app.Phone != input.Phone {
		response.Error(c, 400, "手机号与原申请不一致")
		return
	}
	if err := authorizeOnboarding(input.Phone, firstNonEmpty(input.VerificationToken, input.ResubmitToken), app.ID, merchantIdentityTypeProvider, merchantVerificationModeResubmit, input.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	if err := normalizeApplyRoleAndEntity(&input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	if err := validateMerchantApplyBusinessFields(&input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	serviceAreaCodes, err := regionService.NormalizeServiceCityCodes(input.ServiceArea)
	if err != nil {
		response.Error(c, 400, "服务城市验证失败: "+err.Error())
		return
	}

	// 更新申请信息
	var licenseVerification *service.EnterpriseVerificationOutcome
	if input.EntityType == "company" {
		if !service.CanReuseEnterpriseLicenseVerification(app.LicenseVerifyStatus, app.LicenseHash, app.CompanyName, input.CompanyName, input.LicenseNo) {
			licenseVerification, err = service.VerifyLicenseForApplyWithContextResult(service.EnterpriseVerificationContext{
				ApplicationType: "merchant",
				ApplicationID:   app.ID,
				ActorKey:        input.Phone,
				CompanyName:     input.CompanyName,
				LicenseNo:       input.LicenseNo,
				ClientIP:        c.ClientIP(),
			})
			if err != nil {
				response.Error(c, 400, err.Error())
				return
			}
		}
	}
	serviceAreaJSON, _ := json.Marshal(serviceAreaCodes)
	stylesJSON, _ := json.Marshal(input.Styles)
	highlightTagsJSON, _ := json.Marshal(input.HighlightTags)
	pricingJSON, _ := json.Marshal(input.Pricing)
	portfolioCases := input.PortfolioCases
	if input.Role == "foreman" {
		portfolioCases = normalizeForemanPortfolioCases(input.PortfolioCases)
	}
	portfolioJSON, _ := json.Marshal(portfolioCases)
	companyAlbumJSON, _ := json.Marshal(input.CompanyAlbum)

	app.Role = input.Role
	app.EntityType = input.EntityType
	app.ApplicantType = input.ApplicantType
	app.RealName = input.RealName
	app.Avatar = input.Avatar
	app.IDCardNo = encryptSensitiveOrPlain(input.IDCardNo)
	app.IDCardFront = input.IDCardFront
	app.IDCardBack = input.IDCardBack
	app.CompanyName = input.CompanyName
	app.LicenseNo = encryptSensitiveOrPlain(input.LicenseNo)
	app.LicenseImage = input.LicenseImage
	if licenseVerification != nil || input.EntityType != "company" {
		app.LicenseVerifyStatus = licenseVerificationStatus(licenseVerification)
		app.LicenseVerifyProvider = licenseVerificationProvider(licenseVerification)
		app.LicenseVerifyRequestID = licenseVerificationRequestID(licenseVerification)
		app.LicenseVerifyReason = licenseVerificationReason(licenseVerification)
		app.LicenseHash = licenseVerificationHash(licenseVerification)
		app.LicenseVerifiedAt = licenseVerificationVerifiedAt(licenseVerification)
	}
	app.TeamSize = input.TeamSize
	app.OfficeAddress = input.OfficeAddress
	app.YearsExperience = input.YearsExperience
	app.CompanyAlbumJSON = string(companyAlbumJSON)
	app.ServiceArea = string(serviceAreaJSON)
	app.Styles = string(stylesJSON)
	app.HighlightTags = string(highlightTagsJSON)
	app.PricingJSON = string(pricingJSON)
	app.Introduction = input.Introduction
	app.GraduateSchool = input.GraduateSchool
	app.DesignPhilosophy = input.DesignPhilosophy
	app.PortfolioCases = string(portfolioJSON)
	app.LegalAcceptanceJSON = buildLegalAcceptanceJSON(input.LegalAcceptance)
	app.LegalAcceptSource = "merchant_web"
	submittedAt := time.Now()
	app.LegalAcceptedAt = &submittedAt
	app.CreatedAt = submittedAt
	app.UpdatedAt = submittedAt
	app.Status = 0 // 重置为待审核
	app.RejectReason = ""
	app.AuditedBy = 0
	app.AuditedAt = nil
	app.ApplicationScene = normalizeMerchantApplicationScene(app.ApplicationScene)

	if err := repository.DB.Save(&app).Error; err != nil {
		response.Error(c, 500, "重新提交失败")
		return
	}

	response.Success(c, gin.H{
		"applicationId": app.ID,
		"message":       "已重新提交，请等待审核",
	})
}

// ==================== Admin 审核入驻申请 ====================

// AdminListApplications 获取入驻申请列表
func AdminListApplications(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	var apps []model.MerchantApplication
	query := repository.DB.Model(&model.MerchantApplication{}).Order("created_at DESC")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if appType := c.Query("type"); appType != "" {
		appType = strings.ToLower(strings.TrimSpace(appType))
		switch appType {
		case "designer", "foreman", "company":
			query = query.Where("role = ?", appType)
		default:
			query = query.Where("applicant_type = ?", appType)
		}
	}
	if role := c.Query("role"); role != "" {
		query = query.Where("role = ?", strings.ToLower(strings.TrimSpace(role)))
	}
	if entityType := c.Query("entityType"); entityType != "" {
		query = query.Where("entity_type = ?", strings.ToLower(strings.TrimSpace(entityType)))
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		pattern := "%" + keyword + "%"
		query = query.Where("phone LIKE ? OR real_name LIKE ? OR company_name LIKE ?", pattern, pattern, pattern)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}
	if err := query.Offset((page - 1) * pageSize).Limit(pageSize).Find(&apps).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	list := make([]gin.H, 0, len(apps))
	for _, app := range apps {
		var provider *model.Provider
		if app.ProviderID > 0 {
			var providerRecord model.Provider
			if err := repository.DB.First(&providerRecord, app.ProviderID).Error; err == nil {
				provider = &providerRecord
			}
		}
		visibilityResult := adminVisibilityResolver.ResolveMerchantApplication(app, provider)

		item := gin.H{
			"id":               app.ID,
			"phone":            app.Phone,
			"role":             app.Role,
			"entityType":       app.EntityType,
			"applicationScene": normalizeMerchantApplicationScene(app.ApplicationScene),
			"realName":         app.RealName,
			"companyName":      app.CompanyName,
			"status":           app.Status,
			"rejectReason":     app.RejectReason,
			"createdAt":        formatServerDateTime(app.CreatedAt),
			"auditedAt":        formatServerDateTimePtr(app.AuditedAt),
			"visibility":       visibilityResult.Visibility,
			"actions":          visibilityResult.Actions,
		}
		if visibilityResult.LegacyInfo != nil {
			item["legacyInfo"] = visibilityResult.LegacyInfo
		}
		list = append(list, item)
	}

	response.Success(c, gin.H{
		"list":  list,
		"total": total,
	})
}

// AdminGetApplication 获取入驻申请详情
func AdminGetApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))

	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	var serviceAreaCodes, styles, highlightTags, companyAlbum []string
	var pricing map[string]float64
	var portfolioCases []PortfolioCaseInput
	json.Unmarshal([]byte(app.ServiceArea), &serviceAreaCodes)
	json.Unmarshal([]byte(app.Styles), &styles)
	json.Unmarshal([]byte(app.HighlightTags), &highlightTags)
	json.Unmarshal([]byte(app.CompanyAlbumJSON), &companyAlbum)
	json.Unmarshal([]byte(app.PricingJSON), &pricing)
	json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)
	if app.Role == "foreman" {
		portfolioCases = normalizeForemanPortfolioCases(portfolioCases)
	}

	serviceAreaCodes, serviceAreaNames, _ := regionService.ResolveServiceAreaInputsToCityDisplay(serviceAreaCodes)

	var provider *model.Provider
	if app.ProviderID > 0 {
		var providerRecord model.Provider
		if err := repository.DB.First(&providerRecord, app.ProviderID).Error; err == nil {
			provider = &providerRecord
		}
	}
	visibilityResult := adminVisibilityResolver.ResolveMerchantApplication(app, provider)

	detail := gin.H{
		"id":                     app.ID,
		"merchantKind":           "provider",
		"phone":                  app.Phone,
		"applicantType":          app.ApplicantType,
		"role":                   app.Role,
		"entityType":             app.EntityType,
		"applicationScene":       normalizeMerchantApplicationScene(app.ApplicationScene),
		"sourceApplicationId":    app.ID,
		"realName":               app.RealName,
		"avatar":                 imgutil.GetFullImageURL(app.Avatar),
		"idCardNo":               displayReadableSensitive(app.IDCardNo),
		"idCardFront":            imgutil.GetFullImageURL(app.IDCardFront),
		"idCardBack":             imgutil.GetFullImageURL(app.IDCardBack),
		"companyName":            app.CompanyName,
		"licenseNo":              displayReadableSensitive(app.LicenseNo),
		"licenseImage":           imgutil.GetFullImageURL(app.LicenseImage),
		"legalPersonName":        app.LegalPersonName,
		"legalPersonIdCardNo":    displayReadableSensitive(app.LegalPersonIDCardNo),
		"legalPersonIdCardFront": imgutil.GetFullImageURL(app.LegalPersonIDCardFront),
		"legalPersonIdCardBack":  imgutil.GetFullImageURL(app.LegalPersonIDCardBack),
		"teamSize":               app.TeamSize,
		"yearsExperience":        app.YearsExperience,
		"companyAlbum":           imgutil.GetFullImageURLs(companyAlbum),
		"officeAddress":          app.OfficeAddress,
		"serviceArea":            serviceAreaNames,
		"serviceAreaCodes":       serviceAreaCodes,
		"styles":                 styles,
		"highlightTags":          highlightTags,
		"pricing":                pricing,
		"introduction":           app.Introduction,
		"graduateSchool":         app.GraduateSchool,
		"designPhilosophy":       app.DesignPhilosophy,
		"portfolioCases":         normalizePortfolioCaseDisplays(portfolioCases),
		"status":                 app.Status,
		"rejectReason":           app.RejectReason,
		"createdAt":              formatServerDateTime(app.CreatedAt),
		"auditedAt":              formatServerDateTimePtr(app.AuditedAt),
		"auditedBy":              app.AuditedBy,
		"visibility":             visibilityResult.Visibility,
		"actions":                visibilityResult.Actions,
	}
	if visibilityResult.LegacyInfo != nil {
		detail["legacyInfo"] = visibilityResult.LegacyInfo
	}

	response.Success(c, detail)
}

// AdminApproveApplication 审核通过入驻申请
func AdminApproveApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	if app.Status != 0 {
		response.Error(c, 400, "该申请已处理")
		return
	}

	tx := repository.DB.Begin()

	// 1. 查询现有 User（优先按 user_id，兼容按手机号兜底）
	var user model.User
	userQueryErr := gorm.ErrRecordNotFound
	if app.UserID > 0 {
		userQueryErr = tx.First(&user, app.UserID).Error
	}
	if errors.Is(userQueryErr, gorm.ErrRecordNotFound) {
		userQueryErr = tx.Where("phone = ?", app.Phone).First(&user).Error
	}
	if userQueryErr != nil {
		tx.Rollback()
		response.Error(c, 400, "用户不存在，请先使用该手机号注册账号")
		return
	}

	// 检查用户状态
	if user.Status != 1 {
		tx.Rollback()
		response.Error(c, 400, "该账号已被禁用")
		return
	}
	snapshot, snapshotErr := buildProviderApprovalSnapshot(&app)
	if snapshotErr != nil {
		tx.Rollback()
		response.Error(c, 400, snapshotErr.Error())
		return
	}

	now := time.Now()
	provider := model.Provider{}
	isClaimedCompletion := normalizeMerchantApplicationScene(app.ApplicationScene) == model.MerchantApplicationSceneClaimedCompletion || app.ProviderID > 0
	if isClaimedCompletion {
		if app.ProviderID == 0 {
			tx.Rollback()
			response.Error(c, 400, "补全申请缺少服务商关联")
			return
		}
		if err := tx.First(&provider, app.ProviderID).Error; err != nil {
			tx.Rollback()
			response.Error(c, 404, "待补全服务商不存在")
			return
		}

		updates := map[string]interface{}{
			"user_id":                     user.ID,
			"provider_type":               snapshot.ProviderType,
			"sub_type":                    snapshot.SubType,
			"entity_type":                 snapshot.EntityType,
			"display_name":                service.ResolveProviderStoredDisplayName(snapshot.ProviderType, app.CompanyName, app.RealName),
			"company_name":                app.CompanyName,
			"avatar":                      app.Avatar,
			"license_no":                  app.LicenseNo,
			"service_area":                app.ServiceArea,
			"specialty":                   snapshot.Specialty,
			"highlight_tags":              snapshot.HighlightTagsJSON,
			"pricing_json":                snapshot.PricingJSON,
			"graduate_school":             app.GraduateSchool,
			"design_philosophy":           app.DesignPhilosophy,
			"years_experience":            app.YearsExperience,
			"service_intro":               app.Introduction,
			"team_size":                   app.TeamSize,
			"office_address":              app.OfficeAddress,
			"company_album_json":          snapshot.CompanyAlbumJSON,
			"price_min":                   snapshot.PriceMin,
			"price_max":                   snapshot.PriceMax,
			"price_unit":                  model.ProviderPriceUnitPerSquareMeter,
			"status":                      merchantProviderStatusActive,
			"verified":                    true,
			"is_settled":                  true,
			"needs_onboarding_completion": false,
		}
		if err := tx.Model(&provider).Updates(updates).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "更新服务商失败: "+err.Error())
			return
		}
		provider.UserID = user.ID
		provider.ProviderType = snapshot.ProviderType
		provider.SubType = snapshot.SubType
		provider.EntityType = snapshot.EntityType
		provider.DisplayName = service.ResolveProviderStoredDisplayName(snapshot.ProviderType, app.CompanyName, app.RealName)
		provider.CompanyName = app.CompanyName
		provider.Avatar = app.Avatar
		provider.LicenseNo = app.LicenseNo
		provider.ServiceArea = app.ServiceArea
		provider.Specialty = snapshot.Specialty
		provider.HighlightTags = snapshot.HighlightTagsJSON
		provider.PricingJSON = snapshot.PricingJSON
		provider.GraduateSchool = app.GraduateSchool
		provider.DesignPhilosophy = app.DesignPhilosophy
		provider.YearsExperience = app.YearsExperience
		provider.ServiceIntro = app.Introduction
		provider.TeamSize = app.TeamSize
		provider.OfficeAddress = app.OfficeAddress
		provider.CompanyAlbumJSON = snapshot.CompanyAlbumJSON
		provider.PriceMin = snapshot.PriceMin
		provider.PriceMax = snapshot.PriceMax
		provider.PriceUnit = model.ProviderPriceUnitPerSquareMeter
		provider.Status = merchantProviderStatusActive
		provider.Verified = true
		provider.IsSettled = true
		provider.NeedsOnboardingCompletion = false
	} else {
		previousIdentity, err := findLatestActiveMerchantIdentity(tx, user.ID, "", 0)
		if err != nil {
			tx.Rollback()
			response.Error(c, 500, "校验旧商家身份失败: "+err.Error())
			return
		}

		provider = model.Provider{
			UserID:              user.ID,
			ProviderType:        snapshot.ProviderType,
			SubType:             snapshot.SubType,
			EntityType:          snapshot.EntityType,
			DisplayName:         service.ResolveProviderStoredDisplayName(snapshot.ProviderType, app.CompanyName, app.RealName),
			CompanyName:         app.CompanyName,
			SourceApplicationID: app.ID,
			Avatar:              app.Avatar,
			LicenseNo:           app.LicenseNo,
			ServiceArea:         app.ServiceArea,
			Specialty:           snapshot.Specialty,
			HighlightTags:       snapshot.HighlightTagsJSON,
			PricingJSON:         snapshot.PricingJSON,
			GraduateSchool:      app.GraduateSchool,
			DesignPhilosophy:    app.DesignPhilosophy,
			YearsExperience:     app.YearsExperience,
			ServiceIntro:        app.Introduction,
			TeamSize:            app.TeamSize,
			OfficeAddress:       app.OfficeAddress,
			CompanyAlbumJSON:    snapshot.CompanyAlbumJSON,
			PriceMin:            snapshot.PriceMin,
			PriceMax:            snapshot.PriceMax,
			PriceUnit:           model.ProviderPriceUnitPerSquareMeter,
			Status:              merchantProviderStatusActive,
			Verified:            true,
		}
		if err := tx.Create(&provider).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "创建服务商失败: "+err.Error())
			return
		}

		if err := freezeMerchantIdentity(tx, user.ID, previousIdentity); err != nil {
			tx.Rollback()
			response.Error(c, 500, "冻结旧商家身份失败: "+err.Error())
			return
		}
	}

	if err := ensureMerchantIdentity(tx, user.ID, merchantIdentityTypeProvider, provider.ID, adminID, merchantIdentityStatusActive); err != nil {
		tx.Rollback()
		response.Error(c, 500, "激活服务商身份失败: "+err.Error())
		return
	}

	if err := replaceProviderCasesFromApplication(tx, provider.ID, &app, snapshot); err != nil {
		tx.Rollback()
		response.Error(c, 500, "迁移案例失败: "+err.Error())
		return
	}

	if err := ensureMerchantServiceSettingExists(tx, provider.ID); err != nil {
		tx.Rollback()
		response.Error(c, 500, "创建服务设置失败: "+err.Error())
		return
	}

	normalizedRole := "designer"
	if snapshot.ProviderType == 3 {
		normalizedRole = "foreman"
	} else if snapshot.ProviderType == 2 {
		normalizedRole = "company"
	}
	app.Role = normalizedRole
	app.EntityType = snapshot.EntityType
	app.ApplicantType = snapshot.CompatApplicantType
	app.Status = 1
	app.AuditedBy = adminID
	app.AuditedAt = &now
	app.UserID = user.ID
	app.ProviderID = provider.ID
	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "更新申请状态失败: "+err.Error())
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "审核提交失败: "+err.Error())
		return
	}

	// 同步商家到腾讯云 IM（异步）
	go func() {
		displayName := service.ResolveProviderDisplayName(provider, &user)
		if err := tencentim.SyncUserToIM(user.ID, displayName, ""); err != nil {
			// 仅记录日志，不影响主流程
			// log.Printf("[TencentIM] 商家同步失败: userID=%d, err=%v", user.ID, err)
		}
	}()

	// TODO: 发送短信通知
	// sendSMS(app.Phone, "恭喜！您的商家入驻申请已通过审核，请使用手机号登录商家中心")
	service.NewNotificationDispatcher().NotifyMerchantApplicationApproved(user.ID, app.ID, service.ResolveProviderDisplayName(provider, &user))
	_ = service.SendMerchantApplicationReviewSMS(app.Phone, true, "")

	response.Success(c, gin.H{
		"message":    "审核通过",
		"userId":     user.ID,
		"providerId": provider.ID,
	})
}

// AdminRejectApplication 拒绝入驻申请
func AdminRejectApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "请填写拒绝原因")
		return
	}

	var app model.MerchantApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	if app.Status != 0 {
		response.Error(c, 400, "该申请已处理")
		return
	}

	now := time.Now()
	app.ApplicationScene = normalizeMerchantApplicationScene(app.ApplicationScene)
	app.Status = 2
	app.RejectReason = input.Reason
	app.AuditedBy = adminID
	app.AuditedAt = &now

	tx := repository.DB.Begin()
	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "操作失败")
		return
	}
	if app.ProviderID > 0 && app.ApplicationScene == model.MerchantApplicationSceneClaimedCompletion {
		if err := tx.Model(&model.Provider{}).
			Where("id = ?", app.ProviderID).
			Update("needs_onboarding_completion", true).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "更新服务商补全状态失败")
			return
		}
	}
	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "操作失败")
		return
	}

	// TODO: 发送短信通知
	// sendSMS(app.Phone, "您的商家入驻申请未通过审核，原因："+input.Reason)
	service.NewNotificationDispatcher().NotifyMerchantApplicationRejected(app.UserID, app.ID, input.Reason)
	_ = service.SendMerchantApplicationReviewSMS(app.Phone, false, input.Reason)

	response.Success(c, gin.H{"message": "已拒绝"})
}
