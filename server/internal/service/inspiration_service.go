package service

import (
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
	"regexp"
	"strings"
	"sync"
	"time"
)

var (
	sensitiveWordsCacheTTL      = 30 * time.Second
	sensitiveWordsCacheMu       sync.RWMutex
	sensitiveWordsCacheLoadedAt time.Time
	sensitiveWordsCache         []model.SensitiveWord
)

type InspirationService struct{}

type InspirationQuery struct {
	Page     int    `form:"page"`
	PageSize int    `form:"pageSize"`
	Style    string `form:"style"`
	Layout   string `form:"layout"`
	PriceMin int    `form:"priceMin"`
	PriceMax int    `form:"priceMax"`
}

func normalizeInspirationStyleFilter(v string) []string {
	v = strings.TrimSpace(v)
	if v == "" || v == "全部" {
		return nil
	}

	// Mobile uses simplified labels (e.g. "北欧"), while DB typically stores dictionary values
	// (e.g. "北欧风格"). Keep this mapping tolerant to avoid empty filter results.
	switch v {
	case "北欧":
		return []string{"北欧", "北欧风格"}
	case "日式":
		return []string{"日式", "日式风格"}
	case "工业风":
		return []string{"工业风", "工业风格"}
	case "轻奢":
		// Some existing data uses "现代轻奢".
		return []string{"轻奢", "轻奢风格", "现代轻奢"}
	default:
		return []string{v}
	}
}

func normalizeInspirationLayoutFilter(v string) []string {
	v = strings.TrimSpace(v)
	if v == "" || v == "全部" {
		return nil
	}

	// Mobile uses coarse buckets (一居/二居/三居/四居及以上/别墅), while DB stores
	// more granular dictionary values (一室一厅/两室两厅/...). Expand to IN filters.
	switch v {
	case "一居":
		return []string{"一居", "一室", "一室一厅"}
	case "二居":
		return []string{"二居", "两室一厅", "两室两厅"}
	case "三居":
		return []string{"三居", "三室一厅", "三室两厅"}
	case "四居及以上":
		return []string{"四居及以上", "四室及以上", "复式"}
	case "别墅":
		return []string{"别墅"}
	default:
		return []string{v}
	}
}

func normalizeInspirationPriceBound(v int) float64 {
	if v <= 0 {
		return 0
	}

	// Mobile筛选以“万”为单位传参（10/20/50），而后台/管理端录入价格是“元”。
	// 为兼容其他潜在调用方：如果传入数值过大（>=1000），认为已是“元”。
	if v >= 1000 {
		return float64(v)
	}
	return float64(v) * 10000
}

type InspirationItem struct {
	ID           uint64  `json:"id"`
	Title        string  `json:"title"`
	CoverImage   string  `json:"coverImage"`
	Style        string  `json:"style"`
	Layout       string  `json:"layout"`
	Area         string  `json:"area"`
	Price        float64 `json:"price"`
	LikeCount    int64   `json:"likeCount"`
	CommentCount int64   `json:"commentCount"`
	IsLiked      bool    `json:"isLiked"`
	IsFavorited  bool    `json:"isFavorited"`
	Author       Author  `json:"author"`
}

type Author struct {
	ID     uint64 `json:"id"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
}

func (s *InspirationService) ListInspiration(query *InspirationQuery, userID *uint64) ([]InspirationItem, int64, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 || query.PageSize > 50 {
		query.PageSize = 20
	}

	db := repository.DB.Model(&model.ProviderCase{}).
		Where("show_in_inspiration = ?", true)

	if styles := normalizeInspirationStyleFilter(query.Style); len(styles) > 0 {
		db = db.Where("style IN ?", styles)
	}
	if layouts := normalizeInspirationLayoutFilter(query.Layout); len(layouts) > 0 {
		db = db.Where("layout IN ?", layouts)
	}
	if min := normalizeInspirationPriceBound(query.PriceMin); min > 0 {
		db = db.Where("price >= ?", min)
	}
	if max := normalizeInspirationPriceBound(query.PriceMax); max > 0 {
		db = db.Where("price <= ?", max)
	}

	var total int64
	db.Count(&total)

	var cases []model.ProviderCase
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("created_at DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&cases).Error; err != nil {
		return nil, 0, err
	}

	if len(cases) == 0 {
		return []InspirationItem{}, total, nil
	}

	caseIDs := make([]uint64, len(cases))
	providerIDs := make([]uint64, 0)
	for i, c := range cases {
		caseIDs[i] = c.ID
		if c.ProviderID > 0 {
			providerIDs = append(providerIDs, c.ProviderID)
		}
	}

	likeCounts := s.batchGetLikeCounts(caseIDs)
	commentCounts := s.batchGetCommentCounts(caseIDs)

	var userLikes map[uint64]bool
	var userFavorites map[uint64]bool
	if userID != nil {
		userLikes = s.batchGetUserLikes(*userID, caseIDs)
		userFavorites = s.batchGetUserFavorites(*userID, caseIDs)
	}

	providers := s.batchGetProviders(providerIDs)

	items := make([]InspirationItem, len(cases))
	for i, c := range cases {
		author := Author{ID: 0, Name: "官方", Avatar: ""}
		if c.ProviderID > 0 {
			if provider, ok := providers[c.ProviderID]; ok {
				author.ID = provider.ID
				author.Name = provider.CompanyName
				if provider.UserID > 0 {
					if user, err := s.getUserByID(provider.UserID); err == nil {
						author.Avatar = imgutil.GetFullImageURL(user.Avatar)
					}
				}
			}
		}

		items[i] = InspirationItem{
			ID:           c.ID,
			Title:        c.Title,
			CoverImage:   imgutil.GetFullImageURL(c.CoverImage),
			Style:        c.Style,
			Layout:       c.Layout,
			Area:         c.Area,
			Price:        c.Price,
			LikeCount:    likeCounts[c.ID],
			CommentCount: commentCounts[c.ID],
			IsLiked:      userLikes[c.ID],
			IsFavorited:  userFavorites[c.ID],
			Author:       author,
		}
	}

	return items, total, nil
}

func (s *InspirationService) batchGetLikeCounts(caseIDs []uint64) map[uint64]int64 {
	type Result struct {
		TargetID uint64
		Count    int64
	}
	var results []Result
	repository.DB.Model(&model.UserLike{}).
		Select("target_id, COUNT(*) as count").
		Where("target_id IN ? AND target_type = ?", caseIDs, "case").
		Group("target_id").
		Scan(&results)

	counts := make(map[uint64]int64)
	for _, r := range results {
		counts[r.TargetID] = r.Count
	}
	return counts
}

func (s *InspirationService) batchGetCommentCounts(caseIDs []uint64) map[uint64]int64 {
	type Result struct {
		CaseID uint64
		Count  int64
	}
	var results []Result
	repository.DB.Model(&model.CaseComment{}).
		Select("case_id, COUNT(*) as count").
		Where("case_id IN ? AND status = ?", caseIDs, "approved").
		Group("case_id").
		Scan(&results)

	counts := make(map[uint64]int64)
	for _, r := range results {
		counts[r.CaseID] = r.Count
	}
	return counts
}

func (s *InspirationService) batchGetUserLikes(userID uint64, caseIDs []uint64) map[uint64]bool {
	var likes []model.UserLike
	repository.DB.Where("user_id = ? AND target_id IN ? AND target_type = ?", userID, caseIDs, "case").
		Find(&likes)

	result := make(map[uint64]bool)
	for _, like := range likes {
		result[like.TargetID] = true
	}
	return result
}

func (s *InspirationService) batchGetUserFavorites(userID uint64, caseIDs []uint64) map[uint64]bool {
	var favorites []model.UserFavorite
	repository.DB.Where("user_id = ? AND target_id IN ? AND target_type = ?", userID, caseIDs, "case").
		Find(&favorites)

	result := make(map[uint64]bool)
	for _, fav := range favorites {
		result[fav.TargetID] = true
	}
	return result
}

func (s *InspirationService) batchGetProviders(providerIDs []uint64) map[uint64]model.Provider {
	if len(providerIDs) == 0 {
		return make(map[uint64]model.Provider)
	}

	var providers []model.Provider
	repository.DB.Where("id IN ?", providerIDs).Find(&providers)

	result := make(map[uint64]model.Provider)
	for _, p := range providers {
		result[p.ID] = p
	}
	return result
}

func (s *InspirationService) getUserByID(userID uint64) (*model.User, error) {
	var user model.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *InspirationService) LikeCase(userID, caseID uint64) (int64, bool, error) {
	like := model.UserLike{
		UserID:     userID,
		TargetID:   caseID,
		TargetType: "case",
	}

	result := repository.DB.FirstOrCreate(&like, like)
	if result.Error != nil {
		return 0, false, result.Error
	}

	var count int64
	repository.DB.Model(&model.UserLike{}).
		Where("target_id = ? AND target_type = ?", caseID, "case").
		Count(&count)

	return count, true, nil
}

func (s *InspirationService) UnlikeCase(userID, caseID uint64) (int64, bool, error) {
	result := repository.DB.Where("user_id = ? AND target_id = ? AND target_type = ?", userID, caseID, "case").
		Delete(&model.UserLike{})
	if result.Error != nil {
		return 0, false, result.Error
	}

	var count int64
	repository.DB.Model(&model.UserLike{}).
		Where("target_id = ? AND target_type = ?", caseID, "case").
		Count(&count)

	return count, false, nil
}

func (s *InspirationService) FavoriteCase(userID, caseID uint64) error {
	favorite := model.UserFavorite{
		UserID:     userID,
		TargetID:   caseID,
		TargetType: "case",
	}
	return repository.DB.FirstOrCreate(&favorite, favorite).Error
}

func (s *InspirationService) UnfavoriteCase(userID, caseID uint64) error {
	return repository.DB.Where("user_id = ? AND target_id = ? AND target_type = ?", userID, caseID, "case").
		Delete(&model.UserFavorite{}).Error
}

func (s *InspirationService) FavoriteMaterialShop(userID, shopID uint64) error {
	favorite := model.UserFavorite{
		UserID:     userID,
		TargetID:   shopID,
		TargetType: "material_shop",
	}
	return repository.DB.FirstOrCreate(&favorite, favorite).Error
}

func (s *InspirationService) UnfavoriteMaterialShop(userID, shopID uint64) error {
	return repository.DB.Where("user_id = ? AND target_id = ? AND target_type = ?", userID, shopID, "material_shop").
		Delete(&model.UserFavorite{}).Error
}

type CommentQuery struct {
	Page     int `form:"page"`
	PageSize int `form:"pageSize"`
}

type CommentItem struct {
	ID        uint64    `json:"id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
	User      Author    `json:"user"`
}

type CreateCommentRequest struct {
	CaseID  uint64 `json:"caseId"`
	UserID  uint64 `json:"-"`
	Content string `json:"content" binding:"required,min=1,max=500"`
}

func (s *InspirationService) GetCaseComments(caseID uint64, query *CommentQuery) ([]CommentItem, int64, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 || query.PageSize > 100 {
		query.PageSize = 20
	}

	db := repository.DB.Model(&model.CaseComment{}).
		Where("case_id = ? AND status = ?", caseID, "approved")

	var total int64
	db.Count(&total)

	var comments []model.CaseComment
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("created_at DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&comments).Error; err != nil {
		return nil, 0, err
	}

	if len(comments) == 0 {
		return []CommentItem{}, total, nil
	}

	userIDs := make([]uint64, len(comments))
	for i, c := range comments {
		userIDs[i] = c.UserID
	}
	users := s.batchGetUsers(userIDs)

	items := make([]CommentItem, len(comments))
	for i, c := range comments {
		user := Author{ID: c.UserID, Name: "未知用户", Avatar: ""}
		if u, ok := users[c.UserID]; ok {
			user.Name = u.Nickname
			user.Avatar = imgutil.GetFullImageURL(u.Avatar)
		}
		items[i] = CommentItem{
			ID:        c.ID,
			Content:   c.Content,
			CreatedAt: c.CreatedAt,
			User:      user,
		}
	}

	return items, total, nil
}

func (s *InspirationService) CreateCaseComment(req *CreateCommentRequest) (*CommentItem, error) {
	status := "approved"
	if sw, err := s.matchSensitiveWord(req.Content); err != nil {
		return nil, err
	} else if sw != nil {
		switch sw.Action {
		case "review":
			status = "pending_review"
		case "block", "":
			return nil, fmt.Errorf("评论包含敏感词: %s", sw.Word)
		default:
			status = "pending_review"
		}
	}

	comment := model.CaseComment{
		CaseID:  req.CaseID,
		UserID:  req.UserID,
		Content: req.Content,
		Status:  status,
	}

	if err := repository.DB.Create(&comment).Error; err != nil {
		return nil, err
	}

	user, _ := s.getUserByID(req.UserID)
	userName := "未知用户"
	userAvatar := ""
	if user != nil {
		userName = user.Nickname
		userAvatar = imgutil.GetFullImageURL(user.Avatar)
	}

	return &CommentItem{
		ID:        comment.ID,
		Content:   comment.Content,
		CreatedAt: comment.CreatedAt,
		User: Author{
			ID:     req.UserID,
			Name:   userName,
			Avatar: userAvatar,
		},
	}, nil
}

func (s *InspirationService) matchSensitiveWord(content string) (*model.SensitiveWord, error) {
	words, err := s.getSensitiveWords()
	if err != nil {
		return nil, err
	}

	contentLower := strings.ToLower(content)
	for i := range words {
		w := words[i]
		if w.Word == "" {
			continue
		}

		if w.IsRegex {
			re, err := regexp.Compile(w.Word)
			if err != nil {
				continue
			}
			if re.MatchString(content) {
				return &words[i], nil
			}
			continue
		}

		if strings.Contains(contentLower, strings.ToLower(w.Word)) {
			return &words[i], nil
		}
	}

	return nil, nil
}

func (s *InspirationService) getSensitiveWords() ([]model.SensitiveWord, error) {
	sensitiveWordsCacheMu.RLock()
	cached := sensitiveWordsCache
	loadedAt := sensitiveWordsCacheLoadedAt
	sensitiveWordsCacheMu.RUnlock()

	if !loadedAt.IsZero() && time.Since(loadedAt) < sensitiveWordsCacheTTL {
		return cached, nil
	}

	sensitiveWordsCacheMu.Lock()
	defer sensitiveWordsCacheMu.Unlock()

	if !sensitiveWordsCacheLoadedAt.IsZero() && time.Since(sensitiveWordsCacheLoadedAt) < sensitiveWordsCacheTTL {
		return sensitiveWordsCache, nil
	}

	var words []model.SensitiveWord
	if err := repository.DB.Find(&words).Error; err != nil {
		return nil, err
	}

	sensitiveWordsCache = words
	sensitiveWordsCacheLoadedAt = time.Now()
	return words, nil
}

func (s *InspirationService) batchGetUsers(userIDs []uint64) map[uint64]model.User {
	if len(userIDs) == 0 {
		return make(map[uint64]model.User)
	}

	var users []model.User
	repository.DB.Where("id IN ?", userIDs).Find(&users)

	result := make(map[uint64]model.User)
	for _, u := range users {
		result[u.ID] = u
	}
	return result
}

type FavoriteQuery struct {
	Type     string `form:"type" binding:"required,oneof=case material_shop"`
	Page     int    `form:"page"`
	PageSize int    `form:"pageSize"`
}

type FavoriteItem struct {
	ID         uint64    `json:"id"`
	TargetID   uint64    `json:"targetId"`
	TargetType string    `json:"targetType"`
	Title      string    `json:"title"`
	CoverImage string    `json:"coverImage"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (s *InspirationService) GetUserFavorites(userID uint64, query *FavoriteQuery) ([]FavoriteItem, int64, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 || query.PageSize > 50 {
		query.PageSize = 20
	}

	db := repository.DB.Model(&model.UserFavorite{}).
		Where("user_id = ? AND target_type = ?", userID, query.Type)

	var total int64
	db.Count(&total)

	var favorites []model.UserFavorite
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("created_at DESC").
		Offset(offset).
		Limit(query.PageSize).
		Find(&favorites).Error; err != nil {
		return nil, 0, err
	}

	if len(favorites) == 0 {
		return []FavoriteItem{}, total, nil
	}

	var items []FavoriteItem
	if query.Type == "case" {
		items = s.buildCaseFavorites(favorites)
	} else if query.Type == "material_shop" {
		items = s.buildMaterialShopFavorites(favorites)
	}

	return items, total, nil
}

func (s *InspirationService) buildCaseFavorites(favorites []model.UserFavorite) []FavoriteItem {
	caseIDs := make([]uint64, len(favorites))
	for i, f := range favorites {
		caseIDs[i] = f.TargetID
	}

	var cases []model.ProviderCase
	repository.DB.Where("id IN ?", caseIDs).Find(&cases)

	caseMap := make(map[uint64]model.ProviderCase)
	for _, c := range cases {
		caseMap[c.ID] = c
	}

	items := make([]FavoriteItem, 0, len(favorites))
	for _, f := range favorites {
		if c, ok := caseMap[f.TargetID]; ok {
			items = append(items, FavoriteItem{
				ID:         f.ID,
				TargetID:   c.ID,
				TargetType: "case",
				Title:      c.Title,
				CoverImage: imgutil.GetFullImageURL(c.CoverImage),
				CreatedAt:  f.CreatedAt,
			})
		}
	}

	return items
}

func (s *InspirationService) buildMaterialShopFavorites(favorites []model.UserFavorite) []FavoriteItem {
	shopIDs := make([]uint64, len(favorites))
	for i, f := range favorites {
		shopIDs[i] = f.TargetID
	}

	var shops []model.MaterialShop
	repository.DB.Where("id IN ?", shopIDs).Find(&shops)

	shopMap := make(map[uint64]model.MaterialShop)
	for _, s := range shops {
		shopMap[s.ID] = s
	}

	items := make([]FavoriteItem, 0, len(favorites))
	for _, f := range favorites {
		if shop, ok := shopMap[f.TargetID]; ok {
			items = append(items, FavoriteItem{
				ID:         f.ID,
				TargetID:   shop.ID,
				TargetType: "material_shop",
				Title:      shop.Name,
				CoverImage: imgutil.GetFullImageURL(shop.Cover),
				CreatedAt:  f.CreatedAt,
			})
		}
	}

	return items
}

type CaseSocialStats struct {
	LikeCount    int64 `json:"likeCount"`
	CommentCount int64 `json:"commentCount"`
	IsLiked      bool  `json:"isLiked"`
	IsFavorited  bool  `json:"isFavorited"`
}

func (s *InspirationService) GetCaseSocialStats(caseID uint64, userID *uint64) *CaseSocialStats {
	stats := &CaseSocialStats{}

	repository.DB.Model(&model.UserLike{}).
		Where("target_id = ? AND target_type = ?", caseID, "case").
		Count(&stats.LikeCount)

	repository.DB.Model(&model.CaseComment{}).
		Where("case_id = ? AND status = ?", caseID, "approved").
		Count(&stats.CommentCount)

	if userID != nil {
		var likeCount int64
		repository.DB.Model(&model.UserLike{}).
			Where("user_id = ? AND target_id = ? AND target_type = ?", *userID, caseID, "case").
			Count(&likeCount)
		stats.IsLiked = likeCount > 0

		var favCount int64
		repository.DB.Model(&model.UserFavorite{}).
			Where("user_id = ? AND target_id = ? AND target_type = ?", *userID, caseID, "case").
			Count(&favCount)
		stats.IsFavorited = favCount > 0
	}

	return stats
}
