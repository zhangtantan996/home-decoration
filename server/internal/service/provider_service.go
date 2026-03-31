package service

import (
	"encoding/json"
	"home-decoration-server/internal/dto"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/monitor"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
	"strings"

	"gorm.io/gorm"
)

// ProviderService 服务商服务
type ProviderService struct{}

// ProviderQuery 服务商查询参数
type ProviderQuery struct {
	Type     string  `form:"type"`     // 1设计师 2公司 3工长, 或字符串设计师、施工队等
	Lat      float64 `form:"lat"`      // 纬度
	Lng      float64 `form:"lng"`      // 经度
	Radius   float64 `form:"radius"`   // 半径(km)
	Keyword  string  `form:"keyword"`  // 关键词
	SortBy   string  `form:"sortBy"`   // 排序: rating, distance, price
	Page     int     `form:"page"`     // 页码
	PageSize int     `form:"pageSize"` // 每页数量
	SubType  string  `form:"subType"`  // 子类型筛选
}

// ... (ProviderListItem struct unchanged)

// ProviderListItem 服务商列表项
type ProviderListItem struct {
	ID            uint64  `json:"id"`
	UserID        uint64  `json:"userId"`
	UserPublicID  string  `json:"userPublicId,omitempty"`
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
	SubType         string   `json:"subType"`
	YearsExperience int      `json:"yearsExperience"`
	Specialty       string   `json:"specialty"`
	ReviewCount     int      `json:"reviewCount"`
	PriceMin        float64  `json:"priceMin"`
	PriceMax        float64  `json:"priceMax"`
	PriceUnit       string   `json:"priceUnit"`
	ServiceArea     []string `json:"serviceArea"`
	IsSettled       bool     `json:"isSettled"`
}

// ListDesigners 获取设计师列表
func (s *ProviderService) ListDesigners(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	return s.ListProvidersInternal([]int8{1}, query)
}

// ListCompanies 获取装修公司列表
func (s *ProviderService) ListCompanies(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	return s.ListProvidersInternal([]int8{2}, query)
}

// ListForemen 获取工长列表 (含装修公司)
func (s *ProviderService) ListForemen(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	// 查询 工长(3) 和 公司(2)
	return s.ListProvidersInternal([]int8{2, 3}, query)
}

// ListProviders 公开的分页列表
func (s *ProviderService) ListProviders(query *ProviderQuery) ([]ProviderListItem, int64, error) {
	var providerTypes []int8

	if query.Type != "" && query.Type != "all" {
		switch query.Type {
		case "1", "designer":
			providerTypes = []int8{1}
		case "2", "company":
			providerTypes = []int8{2}
		case "3", "worker", "foreman":
			providerTypes = []int8{3}
		default:
			// 尝试直接转换为数字
			return s.ListProvidersInternal(nil, query)
		}
	}

	return s.ListProvidersInternal(providerTypes, query)
}

// ListProvidersInternal 通用服务商列表查询
func (s *ProviderService) ListProvidersInternal(providerTypes []int8, query *ProviderQuery) ([]ProviderListItem, int64, error) {
	// 默认分页
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 || query.PageSize > 50 {
		query.PageSize = 10
	}

	var providers []model.Provider
	var total int64

	db := applyVisibleProviderFilter(repository.DB.Model(&model.Provider{}))

	if len(providerTypes) > 0 {
		db = db.Where("provider_type IN ?", providerTypes)
	}

	// 关键词搜索
	if query.Keyword != "" {
		keyword := strings.TrimSpace(query.Keyword)
		patterns := []string{"%" + keyword + "%"}
		if strings.HasSuffix(keyword, "风格") {
			trimmed := strings.TrimSuffix(keyword, "风格")
			if trimmed != "" {
				patterns = append(patterns, "%"+trimmed+"%")
			}
		} else if strings.HasSuffix(keyword, "风") {
			trimmed := strings.TrimSuffix(keyword, "风")
			if trimmed != "" {
				patterns = append(patterns, "%"+trimmed+"%")
			}
		}

		conditions := make([]string, 0, len(patterns)*7)
		args := make([]interface{}, 0, len(patterns)*7)
		for _, pattern := range patterns {
			conditions = append(conditions,
				"providers.company_name LIKE ?",
				"users.nickname LIKE ?",
				"providers.specialty LIKE ?",
				"providers.highlight_tags LIKE ?",
				"providers.service_area LIKE ?",
				"providers.sub_type LIKE ?",
				"providers.design_philosophy LIKE ?",
			)
			args = append(args, pattern, pattern, pattern, pattern, pattern, pattern, pattern)
		}

		var matchedProviderTypes []int8
		switch {
		case strings.Contains(keyword, "设计"):
			matchedProviderTypes = append(matchedProviderTypes, 1)
		case strings.Contains(keyword, "装修公司"), strings.Contains(keyword, "公司"):
			matchedProviderTypes = append(matchedProviderTypes, 2)
		case strings.Contains(keyword, "工长"), strings.Contains(keyword, "施工"):
			matchedProviderTypes = append(matchedProviderTypes, 3)
		}
		if len(matchedProviderTypes) > 0 {
			conditions = append(conditions, "providers.provider_type IN ?")
			args = append(args, matchedProviderTypes)
		}

		db = db.Joins("LEFT JOIN users ON users.id = providers.user_id").
			Where(strings.Join(conditions, " OR "), args...)
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
	regionService := RegionService{}
	for i, p := range providers {
		var user model.User
		if p.UserID > 0 {
			repository.DB.First(&user, p.UserID)
		}

		// Some seeded providers may not have a corresponding user row yet.
		// Fallback to provider's cover image so the client can render something.
		avatarPath := user.Avatar
		if avatarPath == "" {
			avatarPath = p.CoverImage
		}

		var identity dto.UserIdentity
		if p.UserID > 0 {
			identity = dto.NewUserIdentity(&user)
			if identity.UserPublicID == "" {
				monitor.RecordPublicIDMissing("provider_list", identity.UserID, "provider_service_list")
			}
		}

		specialty := p.Specialty
		if p.ProviderType == 3 && strings.TrimSpace(specialty) == "" {
			specialty = "全工种施工"
		}
		serviceArea := resolveProviderServiceAreaDisplayNames(&regionService, p.ServiceArea)

		result[i] = ProviderListItem{
			ID:              p.ID,
			UserID:          identity.UserID,
			UserPublicID:    identity.UserPublicID,
			ProviderType:    p.ProviderType,
			CompanyName:     p.CompanyName,
			Nickname:        user.Nickname,
			Avatar:          imgutil.GetFullImageURL(avatarPath),
			Rating:          p.Rating,
			RestoreRate:     p.RestoreRate,
			BudgetControl:   p.BudgetControl,
			CompletedCnt:    p.CompletedCnt,
			Verified:        p.Verified,
			Latitude:        p.Latitude,
			Longitude:       p.Longitude,
			SubType:         p.SubType,
			YearsExperience: p.YearsExperience,
			Specialty:       specialty,
			ReviewCount:     p.ReviewCount,
			PriceMin:        p.PriceMin,
			PriceMax:        p.PriceMax,
			PriceUnit:       p.PriceUnit,
			ServiceArea:     serviceArea,
			IsSettled:       providerSettlementValue(&p),
		}

		// TODO: 计算距离 (需要用户坐标)
	}

	return result, total, nil
}

func resolveProviderServiceAreaDisplayNames(regionService *RegionService, raw string) []string {
	values := parseProviderServiceAreaValues(raw)
	if len(values) == 0 {
		return []string{}
	}

	regionsByCode, err := regionService.GetRegionsByCodesBatch(values)
	if err != nil || len(regionsByCode) == 0 {
		return uniqueProviderTextValues(values)
	}

	parentCodes := make([]string, 0, len(values))
	parentSeen := make(map[string]struct{}, len(values))
	for _, value := range values {
		region, ok := regionsByCode[value]
		if !ok || region.ParentCode == "" {
			continue
		}
		if _, exists := parentSeen[region.ParentCode]; exists {
			continue
		}
		parentSeen[region.ParentCode] = struct{}{}
		parentCodes = append(parentCodes, region.ParentCode)
	}

	parentRegions := make(map[string]model.Region)
	if len(parentCodes) > 0 {
		if items, parentErr := regionService.GetRegionsByCodesBatch(parentCodes); parentErr == nil {
			parentRegions = items
		}
	}

	display := make([]string, 0, len(values)*2)
	seen := make(map[string]struct{}, len(values)*2)
	appendIfMissing := func(text string) {
		text = strings.TrimSpace(text)
		if text == "" {
			return
		}
		if _, exists := seen[text]; exists {
			return
		}
		seen[text] = struct{}{}
		display = append(display, text)
	}

	for _, value := range values {
		region, ok := regionsByCode[value]
		if !ok {
			appendIfMissing(value)
			continue
		}
		if parent, exists := parentRegions[region.ParentCode]; exists && parent.Level >= 2 {
			appendIfMissing(parent.Name)
		}
		appendIfMissing(region.Name)
	}

	if len(display) == 0 {
		return uniqueProviderTextValues(values)
	}
	return display
}

func parseProviderServiceAreaValues(raw string) []string {
	text := strings.TrimSpace(raw)
	if text == "" {
		return []string{}
	}

	var values []string
	if err := json.Unmarshal([]byte(text), &values); err == nil {
		return uniqueProviderTextValues(values)
	}

	return uniqueProviderTextValues(strings.FieldsFunc(text, func(r rune) bool {
		switch r {
		case '、', ',', '，', '|', '/':
			return true
		default:
			return false
		}
	}))
}

func uniqueProviderTextValues(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
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

// GetProviderByID 获取服务商详情
func (s *ProviderService) GetProviderByID(id uint64) (*model.Provider, *model.User, error) {
	var provider model.Provider
	if err := applyVisibleProviderFilter(repository.DB.Model(&model.Provider{})).First(&provider, id).Error; err != nil {
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
	SceneCases  []ProviderSceneItem  `json:"sceneCases"`
	Reviews     []ProviderReviewItem `json:"reviews"`
	ReviewCount int64                `json:"reviewCount"`
	CaseCount   int64                `json:"caseCount"`
	SceneCount  int64                `json:"sceneCount"`
	// 服务区域（名称数组 + 代码数组，方便前端展示/编辑）
	ServiceArea      []string `json:"serviceArea"`
	ServiceAreaCodes []string `json:"serviceAreaCodes"`
	UserPublicID     string   `json:"userPublicId,omitempty"`
}

type ProviderSceneItem struct {
	ID          uint64 `json:"id"`
	CaseID      uint64 `json:"caseId"`
	ProjectID   uint64 `json:"projectId"`
	Title       string `json:"title"`
	CoverImage  string `json:"coverImage"`
	Description string `json:"description"`
	Images      string `json:"images"`
	Year        string `json:"year"`
	CreatedAt   string `json:"createdAt"`
}

type ProviderSceneDetail struct {
	ID          uint64 `json:"id"`
	CaseID      uint64 `json:"caseId"`
	ProjectID   uint64 `json:"projectId"`
	ProviderID  uint64 `json:"providerId"`
	Title       string `json:"title"`
	CoverImage  string `json:"coverImage"`
	Description string `json:"description"`
	Images      string `json:"images"`
	Year        string `json:"year"`
	CreatedAt   string `json:"createdAt"`
}

type ProviderShowcaseDetail struct {
	ID          uint64 `json:"id"`
	ProviderID  uint64 `json:"providerId"`
	Title       string `json:"title"`
	CoverImage  string `json:"coverImage"`
	Style       string `json:"style"`
	Layout      string `json:"layout"`
	Area        string `json:"area"`
	Description string `json:"description"`
	Images      string `json:"images"`
	Year        string `json:"year"`
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

func ensureVisibleProvider(providerID uint64) error {
	if providerID == 0 {
		return gorm.ErrRecordNotFound
	}

	var provider model.Provider
	return applyVisibleProviderFilter(repository.DB.Model(&model.Provider{})).
		Select("id").
		First(&provider, providerID).Error
}

func approvedProjectSceneCreateAuditScope(providerID uint64) *gorm.DB {
	return repository.DB.Model(&model.CaseAudit{}).
		Where(
			"provider_id = ? AND action_type = ? AND source_type = ? AND status = ? AND case_id IS NOT NULL",
			providerID,
			"create",
			"project_completion",
			1,
		)
}

func craftProviderCaseScope(providerID uint64) *gorm.DB {
	return repository.DB.Model(&model.ProviderCase{}).
		Where("provider_id = ?", providerID).
		Where("id NOT IN (?)", approvedProjectSceneCreateAuditScope(providerID).Select("case_id"))
}

func normalizeProviderCasesForPublic(items []model.ProviderCase) {
	for i := range items {
		items[i].CoverImage = imgutil.GetFullImageURL(items[i].CoverImage)
		items[i].Images = imgutil.NormalizeImageURLsJSON(items[i].Images)
	}
}

func pickFirstNonEmptyProviderString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func loadLatestApprovedCaseAuditSnapshots(caseIDs []uint64) (map[uint64]model.CaseAudit, error) {
	result := make(map[uint64]model.CaseAudit, len(caseIDs))
	if len(caseIDs) == 0 {
		return result, nil
	}

	var audits []model.CaseAudit
	if err := repository.DB.
		Where("case_id IN ? AND status = ?", caseIDs, 1).
		Order("case_id ASC, created_at DESC").
		Find(&audits).Error; err != nil {
		return nil, err
	}

	for _, audit := range audits {
		if audit.CaseID == nil {
			continue
		}
		caseID := *audit.CaseID
		if _, exists := result[caseID]; exists {
			continue
		}
		result[caseID] = audit
	}

	return result, nil
}

func buildProviderSceneItem(createAudit model.CaseAudit, latestAudit model.CaseAudit) ProviderSceneItem {
	snapshot := latestAudit
	if snapshot.ID == 0 {
		snapshot = createAudit
	}

	caseID := uint64(0)
	if createAudit.CaseID != nil {
		caseID = *createAudit.CaseID
	}

	coverImage := imgutil.GetFullImageURL(snapshot.CoverImage)
	images := imgutil.NormalizeImageURLsJSON(snapshot.Images)
	if coverImage == "" {
		coverImage = imgutil.GetFullImageURL(createAudit.CoverImage)
	}

	return ProviderSceneItem{
		ID:          createAudit.ID,
		CaseID:      caseID,
		ProjectID:   createAudit.SourceProjectID,
		Title:       pickFirstNonEmptyProviderString(snapshot.Title, createAudit.Title, "真实项目案例"),
		CoverImage:  coverImage,
		Description: pickFirstNonEmptyProviderString(snapshot.Description, createAudit.Description, "项目案例说明待补充"),
		Images:      images,
		Year:        pickFirstNonEmptyProviderString(snapshot.Year, createAudit.Year),
		CreatedAt:   snapshot.CreatedAt.Format("2006-01-02"),
	}
}

func buildProviderSceneDetail(createAudit model.CaseAudit, latestAudit model.CaseAudit) ProviderSceneDetail {
	item := buildProviderSceneItem(createAudit, latestAudit)
	return ProviderSceneDetail{
		ID:          item.ID,
		CaseID:      item.CaseID,
		ProjectID:   item.ProjectID,
		ProviderID:  createAudit.ProviderID,
		Title:       item.Title,
		CoverImage:  item.CoverImage,
		Description: item.Description,
		Images:      item.Images,
		Year:        item.Year,
		CreatedAt:   item.CreatedAt,
	}
}

// GetProviderDetail 获取服务商完整详情
func (s *ProviderService) GetProviderDetail(id uint64) (*ProviderDetail, error) {
	var provider model.Provider
	if err := applyVisibleProviderFilter(repository.DB.Model(&model.Provider{})).First(&provider, id).Error; err != nil {
		return nil, err
	}

	var user model.User
	if provider.UserID > 0 {
		if err := repository.DB.First(&user, provider.UserID).Error; err != nil {
			return nil, err
		}
		if user.PublicID == "" {
			monitor.RecordPublicIDMissing("provider_detail", user.ID, "provider_service_detail")
		}
	}
	if provider.ProviderType == 3 {
		provider.WorkTypes = ""
		if strings.TrimSpace(provider.Specialty) == "" {
			provider.Specialty = "全工种施工"
		}
	}

	// Normalize relative upload paths (e.g. /uploads/...) into absolute URLs.
	// Also fallback to provider cover image for legacy/seeded data.
	provider.Avatar = imgutil.GetFullImageURL(provider.Avatar)
	provider.CoverImage = imgutil.GetFullImageURL(provider.CoverImage)
	if user.Avatar == "" {
		user.Avatar = provider.CoverImage
	}
	user.Avatar = imgutil.GetFullImageURL(user.Avatar)

	// 服务区域：数据库存储的是代码数组，这里转换为名称数组用于前端展示
	regionService := RegionService{}
	serviceAreaCodes, err := regionService.ParseServiceAreaJSON(provider.ServiceArea)
	if err != nil {
		serviceAreaCodes = []string{}
	}
	serviceAreaNames, err := regionService.ConvertCodesToNames(serviceAreaCodes)
	if err != nil {
		serviceAreaNames = []string{}
	}
	if namesJSON, err := json.Marshal(serviceAreaNames); err == nil {
		// 继续复用 provider.serviceArea 字段，但内容换成名称数组，兼容现有前端解析逻辑
		provider.ServiceArea = string(namesJSON)
	}

	cases, caseCount, err := s.GetProviderCases(id, 1, 5)
	if err != nil {
		return nil, err
	}

	sceneCases, sceneCount, err := s.GetProviderSceneCases(id, 1, 5)
	if err != nil {
		return nil, err
	}

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
			UserAvatar:   imgutil.GetFullImageURL(reviewUser.Avatar),
			Rating:       r.Rating,
			Content:      r.Content,
			Images:       imgutil.NormalizeImageURLsJSON(r.Images),
			ServiceType:  r.ServiceType,
			Area:         r.Area,
			Style:        r.Style,
			HelpfulCount: r.HelpfulCount,
			CreatedAt:    r.CreatedAt.Format("2006-01-02"),
		}
	}

	return &ProviderDetail{
		Provider:         &provider,
		User:             &user,
		Cases:            cases,
		SceneCases:       sceneCases,
		Reviews:          reviewItems,
		ReviewCount:      reviewCount,
		CaseCount:        caseCount,
		SceneCount:       sceneCount,
		ServiceArea:      serviceAreaNames,
		ServiceAreaCodes: serviceAreaCodes,
		UserPublicID:     user.PublicID,
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

	if err := ensureVisibleProvider(providerID); err != nil {
		return nil, 0, err
	}

	db := applyVisibleCaseFilter(craftProviderCaseScope(providerID))
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := db.Order("sort_order ASC, created_at DESC").Offset(offset).Limit(pageSize).Find(&cases).Error; err != nil {
		return nil, 0, err
	}
	normalizeProviderCasesForPublic(cases)

	return cases, total, nil
}

func (s *ProviderService) GetProviderSceneCases(providerID uint64, page, pageSize int) ([]ProviderSceneItem, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 20 {
		pageSize = 10
	}
	if err := ensureVisibleProvider(providerID); err != nil {
		return nil, 0, err
	}

	var createAudits []model.CaseAudit
	if err := approvedProjectSceneCreateAuditScope(providerID).
		Order("created_at DESC").
		Find(&createAudits).Error; err != nil {
		return nil, 0, err
	}

	caseIDs := make([]uint64, 0, len(createAudits))
	for _, audit := range createAudits {
		if audit.CaseID == nil {
			continue
		}
		caseIDs = append(caseIDs, *audit.CaseID)
	}

	latestByCase, err := loadLatestApprovedCaseAuditSnapshots(caseIDs)
	if err != nil {
		return nil, 0, err
	}

	items := make([]ProviderSceneItem, 0, len(createAudits))
	for _, createAudit := range createAudits {
		if createAudit.CaseID == nil {
			continue
		}
		latestAudit := latestByCase[*createAudit.CaseID]
		if latestAudit.ActionType == "delete" {
			continue
		}
		items = append(items, buildProviderSceneItem(createAudit, latestAudit))
	}

	total := int64(len(items))
	offset := (page - 1) * pageSize
	if offset >= len(items) {
		return []ProviderSceneItem{}, total, nil
	}
	end := offset + pageSize
	if end > len(items) {
		end = len(items)
	}

	return items[offset:end], total, nil
}

func (s *ProviderService) GetProviderSceneDetail(sceneID uint64) (*ProviderSceneDetail, error) {
	var createAudit model.CaseAudit
	if err := repository.DB.
		Where("id = ? AND action_type = ? AND source_type = ? AND status = ?", sceneID, "create", "project_completion", 1).
		First(&createAudit).Error; err != nil {
		return nil, err
	}

	if err := ensureVisibleProvider(createAudit.ProviderID); err != nil {
		return nil, err
	}

	latestAudit := createAudit
	if createAudit.CaseID != nil {
		latestByCase, err := loadLatestApprovedCaseAuditSnapshots([]uint64{*createAudit.CaseID})
		if err != nil {
			return nil, err
		}
		if snapshot, ok := latestByCase[*createAudit.CaseID]; ok {
			latestAudit = snapshot
		}
	}

	if latestAudit.ActionType == "delete" {
		return nil, gorm.ErrRecordNotFound
	}

	detail := buildProviderSceneDetail(createAudit, latestAudit)
	return &detail, nil
}

func (s *ProviderService) GetProviderShowcaseDetail(caseID uint64) (*ProviderShowcaseDetail, error) {
	var providerCase model.ProviderCase
	if err := repository.DB.First(&providerCase, caseID).Error; err != nil {
		return nil, err
	}

	if err := ensureVisibleProvider(providerCase.ProviderID); err != nil {
		return nil, err
	}
	if !IsCasePublicVisible(&providerCase) {
		return nil, gorm.ErrRecordNotFound
	}

	var linkedSceneCount int64
	if err := approvedProjectSceneCreateAuditScope(providerCase.ProviderID).
		Where("case_id = ?", providerCase.ID).
		Count(&linkedSceneCount).Error; err != nil {
		return nil, err
	}
	if linkedSceneCount > 0 {
		return nil, gorm.ErrRecordNotFound
	}

	providerCase.CoverImage = imgutil.GetFullImageURL(providerCase.CoverImage)
	providerCase.Images = imgutil.NormalizeImageURLsJSON(providerCase.Images)

	return &ProviderShowcaseDetail{
		ID:          providerCase.ID,
		ProviderID:  providerCase.ProviderID,
		Title:       pickFirstNonEmptyProviderString(providerCase.Title, "工艺展示"),
		CoverImage:  providerCase.CoverImage,
		Style:       providerCase.Style,
		Layout:      providerCase.Layout,
		Area:        providerCase.Area,
		Description: pickFirstNonEmptyProviderString(providerCase.Description, "工艺展示说明待补充"),
		Images:      providerCase.Images,
		Year:        providerCase.Year,
	}, nil
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
			UserAvatar:   imgutil.GetFullImageURL(reviewUser.Avatar),
			Rating:       r.Rating,
			Content:      r.Content,
			Images:       imgutil.NormalizeImageURLsJSON(r.Images),
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
		Where("user_id = ? AND target_id = ? AND target_type = ?", userID, providerID, "provider").
		Count(&favCount)
	status.IsFavorited = favCount > 0

	return status, nil
}
