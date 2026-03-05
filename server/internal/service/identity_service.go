package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

// IdentityService 身份服务
type IdentityService struct{}

// IdentityDTO 身份 DTO
type IdentityDTO struct {
	ID              uint64     `json:"id"`
	IdentityType    string     `json:"identityType"`              // owner, provider, admin
	ProviderSubType string     `json:"providerSubType,omitempty"` // designer, company, foreman
	Status          int8       `json:"status"`                    // 0=pending, 1=approved, 2=rejected, 3=suspended
	Verified        bool       `json:"verified"`
	VerifiedAt      *time.Time `json:"verifiedAt"`
	RefID           *uint64    `json:"refId"`       // provider.id
	DisplayName     string     `json:"displayName"` // 显示名称
	CreatedAt       time.Time  `json:"createdAt"`
}

// SwitchIdentityRequest 切换身份请求
type SwitchIdentityRequest struct {
	IdentityID  uint64 `json:"identityId"`  // 目标身份ID（移动端）
	TargetRole  string `json:"targetRole"`  // 目标身份类型
	CurrentRole string `json:"currentRole"` // 当前身份（用于审计）
	IP          string `json:"-"`           // IP 地址（从 context 获取）
	UserAgent   string `json:"-"`           // User Agent（从 context 获取）
}

type SwitchIdentityResult struct {
	AccessToken     string
	RefreshToken    string
	ActiveRole      string
	ProviderSubType string
	ProviderID      uint64
}

// ApplyIdentityRequest 申请新身份请求
type ApplyIdentityRequest struct {
	IdentityType    string `json:"identityType" binding:"required"` // 申请的身份类型
	ProviderSubType string `json:"providerSubType"`
	ApplicationData string `json:"applicationData"` // 申请材料（JSON 格式）
}

type IdentityApplicationListItem struct {
	ID              uint64     `json:"id"`
	UserID          uint64     `json:"userId"`
	IdentityType    string     `json:"identityType"`
	ProviderSubType string     `json:"providerSubType,omitempty"`
	Status          int8       `json:"status"`
	RejectReason    string     `json:"rejectReason,omitempty"`
	AppliedAt       time.Time  `json:"appliedAt"`
	ReviewedAt      *time.Time `json:"reviewedAt,omitempty"`
	ReviewedBy      *uint64    `json:"reviewedBy,omitempty"`
}

// IdentityApplicationDetail 身份申请详情（包含商家入驻完整信息）
type IdentityApplicationDetail struct {
	IdentityApplicationListItem

	// 商家入驻扩展字段（仅当 identityType=provider 时返回）
	MerchantDetails *MerchantApplicationDetails `json:"merchantDetails,omitempty"`
}

// MerchantApplicationDetails 商家入驻详细信息
type MerchantApplicationDetails struct {
	// 基础信息
	Phone         string `json:"phone"`
	ApplicantType string `json:"applicantType"` // personal, studio, company, foreman
	Role          string `json:"role"`          // designer, foreman, company
	EntityType    string `json:"entityType"`    // personal, company

	// 个人/负责人信息
	RealName    string `json:"realName"`
	IDCardNo    string `json:"idCardNo"`    // 脱敏显示
	IDCardFront string `json:"idCardFront"` // 身份证正面 URL
	IDCardBack  string `json:"idCardBack"`  // 身份证反面 URL

	// 公司信息
	CompanyName   string `json:"companyName,omitempty"`
	LicenseNo     string `json:"licenseNo,omitempty"`
	LicenseImage  string `json:"licenseImage,omitempty"`
	TeamSize      int    `json:"teamSize,omitempty"`
	OfficeAddress string `json:"officeAddress,omitempty"`

	// 工长扩展信息
	YearsExperience int      `json:"yearsExperience,omitempty"`
	WorkTypes       []string `json:"workTypes,omitempty"` // JSON 数组

	// 服务信息
	ServiceArea      []string               `json:"serviceArea,omitempty"`      // 服务区域名称数组
	ServiceAreaCodes []string               `json:"serviceAreaCodes,omitempty"` // 服务区域代码数组
	Styles           []string               `json:"styles,omitempty"`
	HighlightTags    []string               `json:"highlightTags,omitempty"`
	Pricing          map[string]float64     `json:"pricing,omitempty"`
	Introduction     string                 `json:"introduction,omitempty"`
	GraduateSchool   string                 `json:"graduateSchool,omitempty"`
	DesignPhilosophy string                 `json:"designPhilosophy,omitempty"`
	PortfolioCases   []PortfolioCaseDisplay `json:"portfolioCases,omitempty"`
}

// PortfolioCaseDisplay 作品案例展示
type PortfolioCaseDisplay struct {
	Title  string   `json:"title"`
	Images []string `json:"images"`
	Style  string   `json:"style"`
	Area   float64  `json:"area"`
}

// ListIdentities 获取用户所有身份
func (s *IdentityService) ListIdentities(userID uint64) ([]IdentityDTO, error) {
	var identities []model.UserIdentity
	err := repository.DB.Where("user_id = ?", userID).
		Preload("Provider").
		Preload("Worker").
		Order("id ASC").
		Find(&identities).Error

	if err != nil {
		return nil, fmt.Errorf("查询身份失败: %w", err)
	}

	// 转换为 DTO
	dtos := make([]IdentityDTO, 0, len(identities))
	for _, identity := range identities {
		dto := IdentityDTO{
			ID:           identity.ID,
			IdentityType: identity.IdentityType,
			Status:       identity.Status,
			Verified:     identity.Verified,
			VerifiedAt:   identity.VerifiedAt,
			RefID:        identity.IdentityRefID,
			CreatedAt:    identity.CreatedAt,
		}

		normalizedRole, derivedSubType := normalizeRoleValue(identity.IdentityType)
		dto.IdentityType = normalizedRole

		// 设置显示名称
		switch normalizedRole {
		case "owner":
			dto.DisplayName = "业主"
		case "provider":
			dto.ProviderSubType = derivedSubType
			if identity.Provider != nil {
				dto.ProviderSubType = providerSubTypeFromProvider(identity.Provider)
				dto.DisplayName = identity.Provider.CompanyName
				if dto.DisplayName == "" {
					switch dto.ProviderSubType {
					case "designer":
						dto.DisplayName = "设计师"
					case "company":
						dto.DisplayName = "装修公司"
					case "foreman":
						dto.DisplayName = "工长"
					default:
						dto.DisplayName = "服务商"
					}
				}
				dto.RefID = &identity.Provider.ID
			} else {
				if dto.ProviderSubType == "" {
					dto.ProviderSubType = "designer"
				}
				switch dto.ProviderSubType {
				case "designer":
					dto.DisplayName = "设计师"
				case "company":
					dto.DisplayName = "装修公司"
				case "foreman":
					dto.DisplayName = "工长"
				default:
					dto.DisplayName = "服务商"
				}
			}
		case "admin":
			dto.DisplayName = "管理员"
		default:
			dto.DisplayName = identity.IdentityType
		}

		dtos = append(dtos, dto)
	}

	return dtos, nil
}

// SwitchIdentity 切换身份
func (s *IdentityService) SwitchIdentity(userID uint64, req *SwitchIdentityRequest) (*SwitchIdentityResult, error) {
	req.TargetRole = normalizeRoleInput(req.TargetRole)
	if req.TargetRole == "" && req.IdentityID == 0 {
		return nil, errors.New("目标身份不能为空")
	}

	// 1. 查询可切换身份（仅已激活）
	var identities []model.UserIdentity
	err := repository.DB.Where("user_id = ? AND status = ?", userID, 1).
		Order("id ASC").
		Find(&identities).Error
	if err != nil {
		return nil, errors.New("身份不存在或未激活")
	}
	if len(identities) == 0 {
		return nil, errors.New("身份不存在或未激活")
	}

	var target *model.UserIdentity
	if req.IdentityID != 0 {
		for i := range identities {
			if identities[i].ID == req.IdentityID {
				target = &identities[i]
				break
			}
		}
		if target == nil {
			return nil, errors.New("身份不存在或未激活")
		}

		normalizedRole, _ := normalizeRoleValue(target.IdentityType)
		if req.TargetRole != "" && req.TargetRole != normalizedRole {
			return nil, errors.New("identityId 与目标身份不匹配")
		}
		req.TargetRole = normalizedRole
	} else {
		for i := range identities {
			normalizedRole, _ := normalizeRoleValue(identities[i].IdentityType)
			if normalizedRole == req.TargetRole {
				target = &identities[i]
				break
			}
		}
	}

	if target == nil {
		return nil, errors.New("身份不存在或未激活")
	}

	// 2. Redis 限流检查（5 次/分钟）
	redisClient := repository.GetRedis()
	if redisClient != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()

		key := fmt.Sprintf("identity_switch:%d", userID)
		count, err := redisClient.Incr(ctx, key).Result()
		if err != nil {
			// Redis 错误不应阻止切换，但应记录日志
			fmt.Printf("[IdentityService] Redis error: %v\n", err)
		} else {
			if count == 1 {
				// 第一次访问，设置过期时间
				redisClient.Expire(ctx, key, time.Minute)
			}
			if count > 5 {
				return nil, errors.New("切换过于频繁，请稍后再试")
			}
		}
	}

	// 3. 记录审计日志
	auditLog := &model.IdentityAuditLog{
		UserID:       userID,
		Action:       "switch",
		FromIdentity: normalizeAuditRole(req.CurrentRole),
		ToIdentity:   req.TargetRole,
		IPAddress:    req.IP,
		UserAgent:    req.UserAgent,
	}
	if err := repository.DB.Create(auditLog).Error; err != nil {
		// 审计日志失败不应阻止切换，但应记录
		fmt.Printf("[IdentityService] Audit log failed: %v\n", err)
	}

	// 4. 生成新 token
	ctx, err := resolveRoleContextFromIdentity(userID, target)
	if err != nil {
		return nil, fmt.Errorf("解析目标身份失败: %w", err)
	}

	tokenPair, err := issueTokenPairV2(userID, "", ctx.ActiveRole, ctx.ProviderID, ctx.ProviderSubType, "")
	if err != nil {
		return nil, fmt.Errorf("生成 token 失败: %w", err)
	}

	providerID := uint64(0)
	if ctx.ProviderID != nil {
		providerID = *ctx.ProviderID
	}

	return &SwitchIdentityResult{
		AccessToken:     tokenPair.AccessToken,
		RefreshToken:    tokenPair.RefreshToken,
		ActiveRole:      ctx.ActiveRole,
		ProviderSubType: ctx.ProviderSubType,
		ProviderID:      providerID,
	}, nil
}

// ApplyIdentity 申请新身份
func (s *IdentityService) ApplyIdentity(userID uint64, req *ApplyIdentityRequest) error {
	normalizedRole := normalizeRoleInput(req.IdentityType)
	if normalizedRole != "provider" {
		return errors.New("当前仅支持申请服务商身份")
	}

	rawProviderSubType := strings.ToLower(strings.TrimSpace(req.ProviderSubType))
	if rawProviderSubType == "worker" {
		return errors.New("providerSubType 无效，worker 已弃用，请使用 foreman")
	}

	providerSubType := normalizeProviderSubType(req.ProviderSubType)
	if providerSubType == "" {
		return errors.New("providerSubType 无效，支持 designer/company/foreman")
	}

	req.IdentityType = "provider"
	req.ProviderSubType = providerSubType

	// 检查是否已有该身份
	var existingIdentity model.UserIdentity
	err := repository.DB.Where("user_id = ? AND identity_type IN ? AND status IN ?", userID, []string{"provider", "worker"}, []int8{0, 1, 3}).
		First(&existingIdentity).Error
	if err == nil {
		return errors.New("您已拥有该身份")
	}

	// 检查是否有待审核的申请
	var existingApp model.IdentityApplication
	err = repository.DB.Where("user_id = ? AND identity_type IN ? AND status = ?",
		userID, []string{"provider", "worker"}, 0).First(&existingApp).Error
	if err == nil {
		return errors.New("您已有待审核的申请")
	}

	applicationData := req.ApplicationData
	if applicationData == "" {
		applicationData = fmt.Sprintf(`{"providerSubType":"%s"}`, providerSubType)
	} else {
		var payload map[string]any
		if err := json.Unmarshal([]byte(applicationData), &payload); err == nil {
			payload["providerSubType"] = providerSubType
			raw, marshalErr := json.Marshal(payload)
			if marshalErr != nil {
				return fmt.Errorf("申请材料格式错误: %w", marshalErr)
			}
			applicationData = string(raw)
		} else {
			raw, marshalErr := json.Marshal(map[string]any{
				"providerSubType": providerSubType,
				"raw":             strings.TrimSpace(applicationData),
			})
			if marshalErr != nil {
				return fmt.Errorf("申请材料格式错误: %w", marshalErr)
			}
			applicationData = string(raw)
		}
	}

	// 创建申请记录
	application := &model.IdentityApplication{
		UserID:          userID,
		IdentityType:    "provider",
		ApplicationData: applicationData,
		Status:          0, // pending
		AppliedAt:       time.Now(),
	}

	if err := repository.DB.Create(application).Error; err != nil {
		return fmt.Errorf("创建申请失败: %w", err)
	}

	auditLog := &model.IdentityAuditLog{
		UserID:       userID,
		Action:       "apply",
		FromIdentity: "owner",
		ToIdentity:   "provider",
		Metadata:     buildIdentityAuditMetadata(map[string]any{"providerSubType": providerSubType}),
	}
	_ = repository.DB.Create(auditLog).Error

	return nil
}

// GetIdentityByType 根据类型获取用户身份
func (s *IdentityService) GetIdentityByType(userID uint64, identityType string) (*model.UserIdentity, error) {
	normalizedRole, _ := normalizeRoleValue(identityType)
	if normalizedRole == "" {
		normalizedRole = "owner"
	}

	var identities []model.UserIdentity
	err := repository.DB.Where("user_id = ? AND status = ?", userID, 1).
		Preload("Provider").
		Preload("Worker").
		Order("id ASC").
		Find(&identities).Error

	if err != nil {
		return nil, err
	}

	if len(identities) == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	for i := range identities {
		role, _ := normalizeRoleValue(identities[i].IdentityType)
		if role == normalizedRole {
			return &identities[i], nil
		}
	}

	return nil, gorm.ErrRecordNotFound
}

func normalizeAuditRole(raw string) string {
	normalizedRole := normalizeRoleInput(raw)
	if normalizedRole == "" {
		return "owner"
	}
	return normalizedRole
}

func (s *IdentityService) ListIdentityApplications(status *int8, page, pageSize int) ([]IdentityApplicationListItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	query := repository.DB.Model(&model.IdentityApplication{})
	if status != nil {
		query = query.Where("status = ?", *status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []model.IdentityApplication
	if err := query.Order("applied_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]IdentityApplicationListItem, 0, len(rows))
	for _, row := range rows {
		item := IdentityApplicationListItem{
			ID:           row.ID,
			UserID:       row.UserID,
			IdentityType: row.IdentityType,
			Status:       row.Status,
			RejectReason: row.RejectReason,
			AppliedAt:    row.AppliedAt,
			ReviewedAt:   row.ReviewedAt,
			ReviewedBy:   row.ReviewedBy,
		}
		item.ProviderSubType = extractProviderSubType(row.ApplicationData)
		result = append(result, item)
	}

	return result, total, nil
}

func (s *IdentityService) GetIdentityApplication(applicationID uint64) (*IdentityApplicationDetail, error) {
	var row model.IdentityApplication
	if err := repository.DB.First(&row, applicationID).Error; err != nil {
		return nil, err
	}

	detail := &IdentityApplicationDetail{
		IdentityApplicationListItem: IdentityApplicationListItem{
			ID:              row.ID,
			UserID:          row.UserID,
			IdentityType:    row.IdentityType,
			ProviderSubType: extractProviderSubType(row.ApplicationData),
			Status:          row.Status,
			RejectReason:    row.RejectReason,
			AppliedAt:       row.AppliedAt,
			ReviewedAt:      row.ReviewedAt,
			ReviewedBy:      row.ReviewedBy,
		},
	}

	// 如果是服务商申请，关联查询 MerchantApplication
	if row.IdentityType == "provider" {
		merchantDetails, err := s.getMerchantApplicationDetails(row.UserID, row.AppliedAt)
		if err == nil {
			detail.MerchantDetails = merchantDetails
		}
		// 如果查询失败，不影响基础信息返回（降级处理）
	}

	return detail, nil
}

func (s *IdentityService) ApproveIdentityApplication(applicationID, adminID uint64) error {
	var app model.IdentityApplication
	if err := repository.DB.First(&app, applicationID).Error; err != nil {
		return err
	}
	if app.Status != 0 {
		return errors.New("申请已处理")
	}

	providerSubType := extractProviderSubType(app.ApplicationData)
	if providerSubType == "" {
		providerSubType = "designer"
	}

	now := time.Now()
	providerType := int8(1)
	switch providerSubType {
	case "company":
		providerType = 2
	case "foreman":
		providerType = 3
	}

	return repository.DB.Transaction(func(tx *gorm.DB) error {
		if app.IdentityType != "provider" {
			return errors.New("仅支持审核服务商身份申请")
		}

		if err := tx.Model(&app).Updates(map[string]interface{}{
			"status":      1,
			"reviewed_at": now,
			"reviewed_by": adminID,
		}).Error; err != nil {
			return err
		}

		var provider model.Provider
		err := tx.Where("user_id = ?", app.UserID).First(&provider).Error
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			provider = model.Provider{
				UserID:       app.UserID,
				ProviderType: providerType,
				SubType:      providerSubType,
				Status:       1,
				Verified:     true,
			}
			if err := tx.Create(&provider).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&provider).Updates(map[string]interface{}{
				"provider_type": providerType,
				"sub_type":      providerSubType,
				"status":        1,
				"verified":      true,
			}).Error; err != nil {
				return err
			}
		}

		var identity model.UserIdentity
		if err := tx.Where("user_id = ? AND identity_type = ?", app.UserID, "provider").First(&identity).Error; err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			providerID := provider.ID
			newIdentity := model.UserIdentity{
				UserID:        app.UserID,
				IdentityType:  "provider",
				IdentityRefID: &providerID,
				Status:        1,
				Verified:      true,
				VerifiedAt:    &now,
				VerifiedBy:    &adminID,
			}
			if err := tx.Create(&newIdentity).Error; err != nil {
				return err
			}
		} else {
			providerID := provider.ID
			if err := tx.Model(&identity).Updates(map[string]interface{}{
				"identity_ref_id": providerID,
				"status":          1,
				"verified":        true,
				"verified_at":     now,
				"verified_by":     adminID,
			}).Error; err != nil {
				return err
			}
		}

		auditLog := &model.IdentityAuditLog{
			UserID:       app.UserID,
			Action:       "approve",
			FromIdentity: "owner",
			ToIdentity:   "provider",
			Metadata:     buildIdentityAuditMetadata(map[string]any{"applicationId": app.ID, "providerSubType": providerSubType}),
		}
		if err := tx.Create(auditLog).Error; err != nil {
			return err
		}

		return nil
	})
}

func (s *IdentityService) RejectIdentityApplication(applicationID, adminID uint64, reason string) error {
	var app model.IdentityApplication
	if err := repository.DB.First(&app, applicationID).Error; err != nil {
		return err
	}
	if app.Status != 0 {
		return errors.New("申请已处理")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":        2,
		"reject_reason": reason,
		"reviewed_at":   now,
		"reviewed_by":   adminID,
	}
	if err := repository.DB.Model(&app).Updates(updates).Error; err != nil {
		return err
	}

	auditLog := &model.IdentityAuditLog{
		UserID:       app.UserID,
		Action:       "reject",
		FromIdentity: "owner",
		ToIdentity:   app.IdentityType,
		Metadata:     buildIdentityAuditMetadata(map[string]any{"applicationId": app.ID, "reason": reason}),
	}
	_ = repository.DB.Create(auditLog).Error

	return nil
}

func extractProviderSubType(applicationData string) string {
	if applicationData == "" {
		return ""
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(applicationData), &payload); err == nil {
		if raw, ok := payload["providerSubType"].(string); ok {
			if normalized := normalizeProviderSubType(raw); normalized != "" {
				return normalized
			}
		}
	}

	for _, candidate := range []string{"designer", "company", "foreman", "worker"} {
		if containsIgnoreCase(applicationData, candidate) {
			return normalizeProviderSubType(candidate)
		}
	}

	return ""
}

func containsIgnoreCase(text string, needle string) bool {
	if needle == "" {
		return true
	}

	return strings.Contains(strings.ToLower(text), strings.ToLower(needle))
}

func normalizeRoleInput(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "owner", "homeowner", "user":
		return "owner"
	case "provider", "designer", "company", "foreman", "worker":
		return "provider"
	case "admin":
		return "admin"
	default:
		return ""
	}
}

func buildIdentityAuditMetadata(payload map[string]any) string {
	if len(payload) == 0 {
		return "{}"
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return "{}"
	}

	return string(raw)
}

// getMerchantApplicationDetails 获取商家入驻详细信息
func (s *IdentityService) getMerchantApplicationDetails(userID uint64, appliedAt time.Time) (*MerchantApplicationDetails, error) {
	var app model.MerchantApplication

	// 根据 userID 和申请时间查找最近的商家申请（±5分钟时间窗口）
	err := repository.DB.Where("user_id = ? AND created_at BETWEEN ? AND ?",
		userID,
		appliedAt.Add(-5*time.Minute),
		appliedAt.Add(5*time.Minute)).
		Order("created_at DESC").
		First(&app).Error

	if err != nil {
		return nil, err
	}

	// 解析 JSON 字段
	var serviceAreaCodes, styles, workTypes, highlightTags []string
	var pricing map[string]float64
	var portfolioCases []PortfolioCaseDisplay

	json.Unmarshal([]byte(app.ServiceArea), &serviceAreaCodes)
	json.Unmarshal([]byte(app.Styles), &styles)
	json.Unmarshal([]byte(app.WorkTypes), &workTypes)
	json.Unmarshal([]byte(app.HighlightTags), &highlightTags)
	json.Unmarshal([]byte(app.PricingJSON), &pricing)
	json.Unmarshal([]byte(app.PortfolioCases), &portfolioCases)

	// 转换服务区域代码为名称
	var serviceAreaNames []string
	if len(serviceAreaCodes) > 0 {
		regionSvc := &RegionService{}
		serviceAreaNames, _ = regionSvc.ConvertCodesToNames(serviceAreaCodes)
	}

	// 脱敏身份证号（仅显示前6位和后4位）
	maskedIDCardNo := maskIDCardNo(app.IDCardNo)

	return &MerchantApplicationDetails{
		Phone:            app.Phone,
		ApplicantType:    app.ApplicantType,
		Role:             app.Role,
		EntityType:       app.EntityType,
		RealName:         app.RealName,
		IDCardNo:         maskedIDCardNo,
		IDCardFront:      app.IDCardFront,
		IDCardBack:       app.IDCardBack,
		CompanyName:      app.CompanyName,
		LicenseNo:        app.LicenseNo,
		LicenseImage:     app.LicenseImage,
		TeamSize:         app.TeamSize,
		OfficeAddress:    app.OfficeAddress,
		YearsExperience:  app.YearsExperience,
		WorkTypes:        workTypes,
		ServiceArea:      serviceAreaNames,
		ServiceAreaCodes: serviceAreaCodes,
		Styles:           styles,
		HighlightTags:    highlightTags,
		Pricing:          pricing,
		Introduction:     app.Introduction,
		GraduateSchool:   app.GraduateSchool,
		DesignPhilosophy: app.DesignPhilosophy,
		PortfolioCases:   portfolioCases,
	}, nil
}

// maskIDCardNo 脱敏身份证号
func maskIDCardNo(idCardNo string) string {
	if len(idCardNo) < 10 {
		return "***"
	}
	return idCardNo[:6] + "********" + idCardNo[len(idCardNo)-4:]
}
