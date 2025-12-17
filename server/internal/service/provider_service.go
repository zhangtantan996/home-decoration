package service

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// ProviderService 服务商服务
type ProviderService struct{}

// ProviderQuery 服务商查询参数
type ProviderQuery struct {
	ProviderType int8    `form:"type"`     // 1设计师 2公司 3工长
	Lat          float64 `form:"lat"`      // 纬度
	Lng          float64 `form:"lng"`      // 经度
	Radius       float64 `form:"radius"`   // 半径(km)
	Keyword      string  `form:"keyword"`  // 关键词
	SortBy       string  `form:"sortBy"`   // 排序: rating, distance, price
	Page         int     `form:"page"`     // 页码
	PageSize     int     `form:"pageSize"` // 每页数量
}

// ProviderListItem 服务商列表项
type ProviderListItem struct {
	ID            uint64  `json:"id"`
	UserID        uint64  `json:"userId"`
	ProviderType  int8    `json:"providerType"`
	CompanyName   string  `json:"companyName"`
	Nickname      string  `json:"nickname"`
	Avatar        string  `json:"avatar"`
	Rating        float32 `json:"rating"`
	RestoreRate   float32 `json:"restoreRate"`
	BudgetControl float32 `json:"budgetControl"`
	CompletedCnt  int     `json:"completedCnt"`
	Verified      bool    `json:"verified"`
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	Distance      float64 `json:"distance,omitempty"` // 距离(km)
}

// ListDesigners 获取设计师列表
func (s *ProviderService) ListDesigners(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	return s.listProviders(1, query)
}

// ListCompanies 获取装修公司列表
func (s *ProviderService) ListCompanies(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	return s.listProviders(2, query)
}

// ListForemen 获取工长列表
func (s *ProviderService) ListForemen(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	return s.listProviders(3, query)
}

// listProviders 通用服务商列表查询
func (s *ProviderService) listProviders(providerType int8, query *ProviderQuery) ([]ProviderListItem, int64, error) {
	// 默认分页
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 || query.PageSize > 50 {
		query.PageSize = 10
	}

	var providers []model.Provider
	var total int64

	db := repository.DB.Model(&model.Provider{}).Where("provider_type = ?", providerType)

	// 关键词搜索
	if query.Keyword != "" {
		db = db.Where("company_name LIKE ?", "%"+query.Keyword+"%")
	}

	// 统计总数
	db.Count(&total)

	// 排序
	switch query.SortBy {
	case "rating":
		db = db.Order("rating DESC")
	case "completed":
		db = db.Order("completed_cnt DESC")
	default:
		// 默认综合排序: 还原度*0.4 + 预算控制*0.3 + 评分*0.3
		db = db.Order("(restore_rate * 0.4 + budget_control * 0.3 + rating * 10 * 0.3) DESC")
	}

	// 分页
	offset := (query.Page - 1) * query.PageSize
	if err := db.Offset(offset).Limit(query.PageSize).Find(&providers).Error; err != nil {
		return nil, 0, err
	}

	// 关联用户信息
	result := make([]ProviderListItem, len(providers))
	for i, p := range providers {
		var user model.User
		repository.DB.First(&user, p.UserID)

		result[i] = ProviderListItem{
			ID:            p.ID,
			UserID:        p.UserID,
			ProviderType:  p.ProviderType,
			CompanyName:   p.CompanyName,
			Nickname:      user.Nickname,
			Avatar:        user.Avatar,
			Rating:        p.Rating,
			RestoreRate:   p.RestoreRate,
			BudgetControl: p.BudgetControl,
			CompletedCnt:  p.CompletedCnt,
			Verified:      p.Verified,
			Latitude:      p.Latitude,
			Longitude:     p.Longitude,
		}

		// TODO: 计算距离 (需要用户坐标)
	}

	return result, total, nil
}

// GetProviderByID 获取服务商详情
func (s *ProviderService) GetProviderByID(id uint64) (*model.Provider, *model.User, error) {
	var provider model.Provider
	if err := repository.DB.First(&provider, id).Error; err != nil {
		return nil, nil, err
	}

	var user model.User
	if err := repository.DB.First(&user, provider.UserID).Error; err != nil {
		return nil, nil, err
	}

	return &provider, &user, nil
}
