package service

import (
	"errors"
	"fmt"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// IdentityService 身份服务
type IdentityService struct{}

// IdentityDTO 身份 DTO
type IdentityDTO struct {
	ID           uint64    `json:"id"`
	IdentityType string    `json:"identityType"` // owner, provider, worker, admin
	Status       int8      `json:"status"`       // 0=pending, 1=approved, 2=rejected, 3=suspended
	Verified     bool      `json:"verified"`
	VerifiedAt   *time.Time `json:"verifiedAt"`
	RefID        *uint64   `json:"refId"`        // provider.id 或 worker.id
	DisplayName  string    `json:"displayName"`  // 显示名称
	CreatedAt    time.Time `json:"createdAt"`
}

// SwitchIdentityRequest 切换身份请求
type SwitchIdentityRequest struct {
	TargetRole  string `json:"targetRole" binding:"required"`  // 目标身份类型
	CurrentRole string `json:"currentRole"`                    // 当前身份（用于审计）
	IP          string `json:"-"`                              // IP 地址（从 context 获取）
	UserAgent   string `json:"-"`                              // User Agent（从 context 获取）
}

// ApplyIdentityRequest 申请新身份请求
type ApplyIdentityRequest struct {
	IdentityType    string `json:"identityType" binding:"required"` // 申请的身份类型
	ApplicationData string `json:"applicationData"`                 // 申请材料（JSON 格式）
}

// ListIdentities 获取用户所有身份
func (s *IdentityService) ListIdentities(userID uint64) ([]IdentityDTO, error) {
	var identities []model.UserIdentity
	err := repository.DB.Where("user_id = ? AND status = ?", userID, 1).
		Preload("Provider").
		Preload("Worker").
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

		// 设置显示名称
		switch identity.IdentityType {
		case "owner":
			dto.DisplayName = "业主"
		case "provider":
			if identity.Provider != nil {
				dto.DisplayName = identity.Provider.CompanyName
				if dto.DisplayName == "" {
					dto.DisplayName = "服务商"
				}
			} else {
				dto.DisplayName = "服务商"
			}
		case "worker":
			if identity.Worker != nil {
				// Worker 没有 Name 字段，使用 SkillType 作为显示名称
				dto.DisplayName = "工人"
				if identity.Worker.SkillType != "" {
					dto.DisplayName = identity.Worker.SkillType + "工人"
				}
			} else {
				dto.DisplayName = "工人"
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
func (s *IdentityService) SwitchIdentity(userID uint64, req *SwitchIdentityRequest) (string, error) {
	// 1. 验证目标身份存在且已激活
	var identity model.UserIdentity
	err := repository.DB.Where("user_id = ? AND identity_type = ? AND status = ?",
		userID, req.TargetRole, 1).First(&identity).Error
	if err != nil {
		return "", errors.New("身份不存在或未激活")
	}

	// 2. Redis 限流检查（5 次/分钟）
	redisClient := repository.GetRedis()
	if redisClient != nil {
		key := fmt.Sprintf("identity_switch:%d", userID)
		count, err := redisClient.Incr(repository.Ctx, key).Result()
		if err != nil {
			// Redis 错误不应阻止切换，但应记录日志
			fmt.Printf("[IdentityService] Redis error: %v\n", err)
		} else {
			if count == 1 {
				// 第一次访问，设置过期时间
				redisClient.Expire(repository.Ctx, key, time.Minute)
			}
			if count > 5 {
				return "", errors.New("切换过于频繁，请稍后再试")
			}
		}
	}

	// 3. 记录审计日志
	auditLog := &model.IdentityAuditLog{
		UserID:       userID,
		Action:       "switch",
		FromIdentity: req.CurrentRole,
		ToIdentity:   req.TargetRole,
		IPAddress:    req.IP,
		UserAgent:    req.UserAgent,
	}
	if err := repository.DB.Create(auditLog).Error; err != nil {
		// 审计日志失败不应阻止切换，但应记录
		fmt.Printf("[IdentityService] Audit log failed: %v\n", err)
	}

	// 4. 生成新 token
	newToken, err := generateTokenV2(userID, req.TargetRole, identity.IdentityRefID)
	if err != nil {
		return "", fmt.Errorf("生成 token 失败: %w", err)
	}

	return newToken, nil
}

// ApplyIdentity 申请新身份
func (s *IdentityService) ApplyIdentity(userID uint64, req *ApplyIdentityRequest) error {
	// 检查是否已有该身份
	var existingIdentity model.UserIdentity
	err := repository.DB.Where("user_id = ? AND identity_type = ?", userID, req.IdentityType).
		First(&existingIdentity).Error
	if err == nil {
		return errors.New("您已拥有该身份")
	}

	// 检查是否有待审核的申请
	var existingApp model.IdentityApplication
	err = repository.DB.Where("user_id = ? AND identity_type = ? AND status = ?",
		userID, req.IdentityType, 0).First(&existingApp).Error
	if err == nil {
		return errors.New("您已有待审核的申请")
	}

	// 创建申请记录
	application := &model.IdentityApplication{
		UserID:          userID,
		IdentityType:    req.IdentityType,
		ApplicationData: req.ApplicationData,
		Status:          0, // pending
		AppliedAt:       time.Now(),
	}

	if err := repository.DB.Create(application).Error; err != nil {
		return fmt.Errorf("创建申请失败: %w", err)
	}

	return nil
}

// GetIdentityByType 根据类型获取用户身份
func (s *IdentityService) GetIdentityByType(userID uint64, identityType string) (*model.UserIdentity, error) {
	var identity model.UserIdentity
	err := repository.DB.Where("user_id = ? AND identity_type = ? AND status = ?",
		userID, identityType, 1).
		Preload("Provider").
		Preload("Worker").
		First(&identity).Error

	if err != nil {
		return nil, err
	}

	return &identity, nil
}
