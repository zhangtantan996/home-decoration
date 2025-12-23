package service

import (
	"encoding/json"
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
	WorkType     string  `form:"workType"` // 工种筛选
	SubType      string  `form:"subType"`  // 子类型筛选
}

// ... (ProviderListItem struct unchanged)

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
	// 新增字段
	SubType         string  `json:"subType"`
	YearsExperience int     `json:"yearsExperience"`
	Specialty       string  `json:"specialty"`
	WorkTypes       string  `json:"workTypes"`
	ReviewCount     int     `json:"reviewCount"`
	PriceMin        float64 `json:"priceMin"`
	PriceMax        float64 `json:"priceMax"`
	PriceUnit       string  `json:"priceUnit"`
}

// ListDesigners 获取设计师列表
func (s *ProviderService) ListDesigners(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	return s.listProviders([]int8{1}, query)
}

// ListCompanies 获取装修公司列表
func (s *ProviderService) ListCompanies(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	return s.listProviders([]int8{2}, query)
}

// ListForemen 获取工长列表 (含装修公司)
func (s *ProviderService) ListForemen(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	// 查询 工长(3) 和 公司(2)
	return s.listProviders([]int8{2, 3}, query)
}

// listProviders 通用服务商列表查询
func (s *ProviderService) listProviders(providerTypes []int8, query *ProviderQuery) ([]ProviderListItem, int64, error) {
	// 默认分页
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 || query.PageSize > 50 {
		query.PageSize = 10
	}

	var providers []model.Provider
	var total int64

	db := repository.DB.Model(&model.Provider{})

	if len(providerTypes) > 0 {
		db = db.Where("provider_type IN ?", providerTypes)
	}

	// 关键词搜索
	if query.Keyword != "" {
		db = db.Where("company_name LIKE ? OR specialty LIKE ?", "%"+query.Keyword+"%", "%"+query.Keyword+"%")
	}

	// 工种筛选
	if query.WorkType != "" && query.WorkType != "all" {
		db = db.Where("work_types LIKE ?", "%"+query.WorkType+"%")
	}

	// 子类型筛选
	if query.SubType != "" && query.SubType != "all" {
		db = db.Where("sub_type = ?", query.SubType)
	}

	// 统计总数
	db.Count(&total)

	// 排序
	switch query.SortBy {
	case "rating":
		db = db.Order("rating DESC")
	case "completed", "orders":
		db = db.Order("completed_cnt DESC")
	case "price_low":
		db = db.Order("price_min ASC")
	case "price_high":
		db = db.Order("price_min DESC")
	default:
		// 默认综合排序
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
			ID:              p.ID,
			UserID:          p.UserID,
			ProviderType:    p.ProviderType,
			CompanyName:     p.CompanyName,
			Nickname:        user.Nickname,
			Avatar:          user.Avatar,
			Rating:          p.Rating,
			RestoreRate:     p.RestoreRate,
			BudgetControl:   p.BudgetControl,
			CompletedCnt:    p.CompletedCnt,
			Verified:        p.Verified,
			Latitude:        p.Latitude,
			Longitude:       p.Longitude,
			YearsExperience: p.YearsExperience,
			Specialty:       p.Specialty,
			WorkTypes:       p.WorkTypes,
			ReviewCount:     p.ReviewCount,
			PriceMin:        p.PriceMin,
			PriceMax:        p.PriceMax,
			PriceUnit:       p.PriceUnit,
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

// ProviderDetail 服务商详情（含案例、评价）
type ProviderDetail struct {
	Provider    *model.Provider      `json:"provider"`
	User        *model.User          `json:"user"`
	Cases       []model.ProviderCase `json:"cases"`
	Reviews     []ProviderReviewItem `json:"reviews"`
	ReviewCount int64                `json:"reviewCount"`
	CaseCount   int64                `json:"caseCount"`
}

// ProviderReviewItem 评价列表项
type ProviderReviewItem struct {
	ID           uint64  `json:"id"`
	UserName     string  `json:"userName"`
	UserAvatar   string  `json:"userAvatar"`
	Rating       float32 `json:"rating"`
	Content      string  `json:"content"`
	Images       string  `json:"images"`       // 评价图片 JSON
	ServiceType  string  `json:"serviceType"`  // 服务类型
	Area         string  `json:"area"`         // 面积
	Style        string  `json:"style"`        // 风格
	HelpfulCount int     `json:"helpfulCount"` // 有用数
	CreatedAt    string  `json:"createdAt"`
}

// GetProviderDetail 获取服务商完整详情
func (s *ProviderService) GetProviderDetail(id uint64) (*ProviderDetail, error) {
	var provider model.Provider
	if err := repository.DB.First(&provider, id).Error; err != nil {
		return nil, err
	}

	var user model.User
	if err := repository.DB.First(&user, provider.UserID).Error; err != nil {
		return nil, err
	}

	// 获取案例（前5条）
	var cases []model.ProviderCase
	repository.DB.Where("provider_id = ?", id).Order("sort_order ASC, created_at DESC").Limit(5).Find(&cases)

	// 统计案例总数
	var caseCount int64
	repository.DB.Model(&model.ProviderCase{}).Where("provider_id = ?", id).Count(&caseCount)

	// 获取评价（前5条）
	var reviews []model.ProviderReview
	repository.DB.Where("provider_id = ?", id).Order("created_at DESC").Limit(5).Find(&reviews)

	// 统计评价总数
	var reviewCount int64
	repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ?", id).Count(&reviewCount)

	// 转换评价为带用户信息的格式
	reviewItems := make([]ProviderReviewItem, len(reviews))
	for i, r := range reviews {
		var reviewUser model.User
		repository.DB.First(&reviewUser, r.UserID)
		reviewItems[i] = ProviderReviewItem{
			ID:           r.ID,
			UserName:     reviewUser.Nickname,
			UserAvatar:   reviewUser.Avatar,
			Rating:       r.Rating,
			Content:      r.Content,
			Images:       r.Images,
			ServiceType:  r.ServiceType,
			Area:         r.Area,
			Style:        r.Style,
			HelpfulCount: r.HelpfulCount,
			CreatedAt:    r.CreatedAt.Format("2006-01-02"),
		}
	}

	return &ProviderDetail{
		Provider:    &provider,
		User:        &user,
		Cases:       cases,
		Reviews:     reviewItems,
		ReviewCount: reviewCount,
		CaseCount:   caseCount,
	}, nil
}

// GetProviderCases 获取服务商案例列表（分页）
func (s *ProviderService) GetProviderCases(providerID uint64, page, pageSize int) ([]model.ProviderCase, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 20 {
		pageSize = 10
	}

	var cases []model.ProviderCase
	var total int64

	db := repository.DB.Model(&model.ProviderCase{}).Where("provider_id = ?", providerID)
	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("sort_order ASC, created_at DESC").Offset(offset).Limit(pageSize).Find(&cases).Error; err != nil {
		return nil, 0, err
	}

	return cases, total, nil
}

// GetProviderReviews 获取服务商评价列表（分页+筛选）
// filter: all=全部, pic=有图, good=好评, 其他=按标签筛选
func (s *ProviderService) GetProviderReviews(providerID uint64, page, pageSize int, filter string) ([]ProviderReviewItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 20 {
		pageSize = 10
	}

	var reviews []model.ProviderReview
	var total int64

	db := repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ?", providerID)

	// 根据 filter 添加查询条件
	switch filter {
	case "pic":
		db = db.Where("images != '' AND images IS NOT NULL")
	case "good":
		db = db.Where("rating >= 4.5")
	case "all", "":
		// 不添加额外条件
	default:
		// 按标签筛选 (tags 是 JSON 数组，使用 LIKE 模糊匹配)
		db = db.Where("tags LIKE ?", "%\""+filter+"\"%")
	}

	db.Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&reviews).Error; err != nil {
		return nil, 0, err
	}

	// 转换为带用户信息的格式
	items := make([]ProviderReviewItem, len(reviews))
	for i, r := range reviews {
		var reviewUser model.User
		repository.DB.First(&reviewUser, r.UserID)
		items[i] = ProviderReviewItem{
			ID:           r.ID,
			UserName:     reviewUser.Nickname,
			UserAvatar:   reviewUser.Avatar,
			Rating:       r.Rating,
			Content:      r.Content,
			Images:       r.Images,
			ServiceType:  r.ServiceType,
			Area:         r.Area,
			Style:        r.Style,
			HelpfulCount: r.HelpfulCount,
			CreatedAt:    r.CreatedAt.Format("2006-01-02"),
		}
	}

	return items, total, nil
}

// ReviewStats 评价统计
type ReviewStats struct {
	Total            int64            `json:"total"`            // 总数
	WithImage        int64            `json:"withImage"`        // 有图数
	GoodCount        int64            `json:"goodCount"`        // 好评数(rating >= 4.5)
	AvgRating        float32          `json:"avgRating"`        // 平均评分
	StarDistribution map[int]int64    `json:"starDistribution"` // 星级分布 {5: 10, 4: 5, ...}
	Tags             map[string]int64 `json:"tags"`             // 标签统计
}

// GetReviewStats 获取评价统计数据
func (s *ProviderService) GetReviewStats(providerID uint64) (*ReviewStats, error) {
	stats := &ReviewStats{
		Tags:             make(map[string]int64),
		StarDistribution: make(map[int]int64),
	}

	// 总数
	repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ?", providerID).Count(&stats.Total)

	// 有图数 (images 不为空)
	repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ? AND images != '' AND images IS NOT NULL", providerID).Count(&stats.WithImage)

	// 好评数 (rating >= 4.5)
	repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ? AND rating >= 4.5", providerID).Count(&stats.GoodCount)

	// 平均评分
	var avgResult struct{ Avg float32 }
	repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ?", providerID).Select("COALESCE(AVG(rating), 0) as avg").Scan(&avgResult)
	stats.AvgRating = avgResult.Avg

	// 星级分布 (向下取整统计)
	for star := 1; star <= 5; star++ {
		var count int64
		if star == 5 {
			repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ? AND rating = 5", providerID).Count(&count)
		} else {
			repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ? AND rating >= ? AND rating < ?", providerID, star, star+1).Count(&count)
		}
		stats.StarDistribution[star] = count
	}

	// 标签统计
	var reviews []model.ProviderReview
	repository.DB.Where("provider_id = ? AND tags != '' AND tags IS NOT NULL", providerID).Select("tags").Find(&reviews)

	for _, r := range reviews {
		// 解析 JSON 标签数组
		var tagList []string
		if err := json.Unmarshal([]byte(r.Tags), &tagList); err == nil {
			for _, tag := range tagList {
				stats.Tags[tag]++
			}
		}
	}

	return stats, nil
}

// UserProviderStatus 用户对服务商的状态
type UserProviderStatus struct {
	IsFollowed  bool `json:"isFollowed"`
	IsFavorited bool `json:"isFavorited"`
}

// FollowProvider 关注服务商
func (s *ProviderService) FollowProvider(userID, providerID uint64, targetType string) error {
	follow := model.UserFollow{
		UserID:     userID,
		TargetID:   providerID,
		TargetType: targetType,
	}

	// 使用 FirstOrCreate 避免重复
	result := repository.DB.Where(&follow).FirstOrCreate(&follow)
	if result.Error != nil {
		return result.Error
	}

	// 如果是新建的，增加 followersCount
	if result.RowsAffected > 0 {
		repository.DB.Model(&model.Provider{}).Where("id = ?", providerID).
			UpdateColumn("followers_count", repository.DB.Raw("followers_count + 1"))
	}

	return nil
}

// UnfollowProvider 取消关注服务商
func (s *ProviderService) UnfollowProvider(userID, providerID uint64, targetType string) error {
	result := repository.DB.Where("user_id = ? AND target_id = ? AND target_type = ?",
		userID, providerID, targetType).Delete(&model.UserFollow{})

	if result.Error != nil {
		return result.Error
	}

	// 如果确实删除了记录，减少 followersCount
	if result.RowsAffected > 0 {
		repository.DB.Model(&model.Provider{}).Where("id = ?", providerID).
			UpdateColumn("followers_count", repository.DB.Raw("GREATEST(followers_count - 1, 0)"))
	}

	return nil
}

// FavoriteProvider 收藏服务商
func (s *ProviderService) FavoriteProvider(userID, providerID uint64, targetType string) error {
	fav := model.UserFavorite{
		UserID:     userID,
		TargetID:   providerID,
		TargetType: targetType,
	}

	result := repository.DB.Where(&fav).FirstOrCreate(&fav)
	return result.Error
}

// UnfavoriteProvider 取消收藏服务商
func (s *ProviderService) UnfavoriteProvider(userID, providerID uint64, targetType string) error {
	return repository.DB.Where("user_id = ? AND target_id = ? AND target_type = ?",
		userID, providerID, targetType).Delete(&model.UserFavorite{}).Error
}

// GetUserProviderStatus 获取用户对服务商的关注/收藏状态
func (s *ProviderService) GetUserProviderStatus(userID, providerID uint64) (*UserProviderStatus, error) {
	status := &UserProviderStatus{}

	// 检查是否已关注
	var followCount int64
	repository.DB.Model(&model.UserFollow{}).
		Where("user_id = ? AND target_id = ?", userID, providerID).
		Count(&followCount)
	status.IsFollowed = followCount > 0

	// 检查是否已收藏
	var favCount int64
	repository.DB.Model(&model.UserFavorite{}).
		Where("user_id = ? AND target_id = ?", userID, providerID).
		Count(&favCount)
	status.IsFavorited = favCount > 0

	return status, nil
}
