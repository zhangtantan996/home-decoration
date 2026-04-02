package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/monitor"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/timeutil"
	"home-decoration-server/pkg/utils"
	"log"
	"maps"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== Admin 统计 API ====================

var adminRegionService = &service.RegionService{}

func getAdminUserCleanupService() *service.AdminUserCleanupService {
	return service.NewAdminUserCleanupService(repository.DB)
}

const (
	adminAccountStatusUnbound  = "unbound"
	adminAccountStatusActive   = "active"
	adminAccountStatusDisabled = "disabled"

	adminLoginStatusUnbound           = "unbound"
	adminLoginStatusEnabled           = "enabled"
	adminLoginStatusDisabledByAccount = "disabled_by_account"
	adminLoginStatusDisabledByEntity  = "disabled_by_entity"

	adminOperatingStatusUnopened   = "unopened"
	adminOperatingStatusRestricted = "restricted"
	adminOperatingStatusActive     = "active"
	adminOperatingStatusFrozen     = "frozen"

	adminOnboardingStatusNone = "none"
)

type adminLinkedUserBrief struct {
	ID       uint64
	Phone    string
	Nickname string
	Status   int8
}

func resolveAdminAccountStatus(hasBoundUser bool, userStatus int8) string {
	if !hasBoundUser {
		return adminAccountStatusUnbound
	}
	if userStatus == 1 {
		return adminAccountStatusActive
	}
	return adminAccountStatusDisabled
}

func resolveAdminProviderLoginStatus(provider model.Provider, hasBoundUser bool, userStatus int8) string {
	if !hasBoundUser {
		return adminLoginStatusUnbound
	}
	if userStatus != 1 {
		return adminLoginStatusDisabledByAccount
	}
	if provider.Status != merchantProviderStatusActive {
		return adminLoginStatusDisabledByEntity
	}
	return adminLoginStatusEnabled
}

func resolveAdminMaterialShopLoginStatus(shop model.MaterialShop, hasBoundUser bool, userStatus int8) string {
	if !hasBoundUser {
		return adminLoginStatusUnbound
	}
	if userStatus != 1 {
		return adminLoginStatusDisabledByAccount
	}
	if !service.IsMaterialShopLoginEnabled(&shop) {
		return adminLoginStatusDisabledByEntity
	}
	return adminLoginStatusEnabled
}

func resolveAdminProviderOperatingStatus(provider model.Provider, hasBoundUser bool, onboardingStatus string) string {
	if !hasBoundUser {
		return adminOperatingStatusUnopened
	}
	if provider.Status != merchantProviderStatusActive {
		return adminOperatingStatusFrozen
	}
	if onboardingStatus != merchantOnboardingStatusApproved {
		return adminOperatingStatusRestricted
	}
	return adminOperatingStatusActive
}

func resolveAdminMaterialShopOperatingStatus(shop model.MaterialShop, hasBoundUser bool, onboardingStatus string) string {
	if !hasBoundUser {
		return adminOperatingStatusUnopened
	}
	if !service.IsMaterialShopActive(&shop) {
		return adminOperatingStatusFrozen
	}
	if onboardingStatus != merchantOnboardingStatusApproved {
		return adminOperatingStatusRestricted
	}
	return adminOperatingStatusActive
}

func resolveAdminProviderOnboardingStatus(provider model.Provider, hasBoundUser bool, app *model.MerchantApplication) string {
	if !hasBoundUser {
		return adminOnboardingStatusNone
	}
	return resolveProviderOnboardingStatus(provider, app)
}

func resolveAdminMaterialShopOnboardingStatus(shop model.MaterialShop, hasBoundUser bool, app *model.MaterialShopApplication) string {
	if !hasBoundUser {
		return adminOnboardingStatusNone
	}
	return resolveMaterialShopOnboardingStatus(shop, app)
}

func matchesAdminDerivedStatusFilter(actual, expected string) bool {
	expected = strings.TrimSpace(expected)
	return expected == "" || expected == actual
}

const (
	adminProviderBoundUserAlias            = "admin_provider_bound_users"
	adminProviderLatestCompletionAlias     = "admin_provider_latest_completion"
	adminMaterialShopBoundUserAlias        = "admin_material_shop_bound_users"
	adminMaterialShopLatestCompletionAlias = "admin_material_shop_latest_completion"
)

func adminProviderBoundCondition() string {
	return fmt.Sprintf("providers.user_id > 0 AND %s.id IS NOT NULL", adminProviderBoundUserAlias)
}

func adminProviderUnboundCondition() string {
	return fmt.Sprintf("(providers.user_id = 0 OR %s.id IS NULL)", adminProviderBoundUserAlias)
}

func adminProviderOnboardingApprovedCondition() string {
	return fmt.Sprintf("(%s AND (providers.needs_onboarding_completion = false OR COALESCE(%s.status, -1) = 1))", adminProviderBoundCondition(), adminProviderLatestCompletionAlias)
}

func adminProviderOnboardingRequiredCondition() string {
	return fmt.Sprintf("(%s AND providers.needs_onboarding_completion = true AND %s.provider_id IS NULL)", adminProviderBoundCondition(), adminProviderLatestCompletionAlias)
}

func adminProviderOnboardingPendingReviewCondition() string {
	return fmt.Sprintf("(%s AND providers.needs_onboarding_completion = true AND %s.status = 0)", adminProviderBoundCondition(), adminProviderLatestCompletionAlias)
}

func adminProviderOnboardingRejectedCondition() string {
	return fmt.Sprintf("(%s AND providers.needs_onboarding_completion = true AND %s.status = 2)", adminProviderBoundCondition(), adminProviderLatestCompletionAlias)
}

func adminMaterialShopBoundCondition() string {
	return fmt.Sprintf("material_shops.user_id > 0 AND %s.id IS NOT NULL", adminMaterialShopBoundUserAlias)
}

func adminMaterialShopUnboundCondition() string {
	return fmt.Sprintf("(material_shops.user_id = 0 OR %s.id IS NULL)", adminMaterialShopBoundUserAlias)
}

func adminMaterialShopOnboardingApprovedCondition() string {
	return fmt.Sprintf("(%s AND (material_shops.needs_onboarding_completion = false OR COALESCE(%s.status, -1) = 1))", adminMaterialShopBoundCondition(), adminMaterialShopLatestCompletionAlias)
}

func adminMaterialShopOnboardingRequiredCondition() string {
	return fmt.Sprintf("(%s AND material_shops.needs_onboarding_completion = true AND %s.shop_id IS NULL)", adminMaterialShopBoundCondition(), adminMaterialShopLatestCompletionAlias)
}

func adminMaterialShopOnboardingPendingReviewCondition() string {
	return fmt.Sprintf("(%s AND material_shops.needs_onboarding_completion = true AND %s.status = 0)", adminMaterialShopBoundCondition(), adminMaterialShopLatestCompletionAlias)
}

func adminMaterialShopOnboardingRejectedCondition() string {
	return fmt.Sprintf("(%s AND material_shops.needs_onboarding_completion = true AND %s.status = 2)", adminMaterialShopBoundCondition(), adminMaterialShopLatestCompletionAlias)
}

func adminProviderLatestCompletionJoin() string {
	return fmt.Sprintf(`LEFT JOIN (
		SELECT provider_id, status
		FROM (
			SELECT provider_id, status,
				ROW_NUMBER() OVER (PARTITION BY provider_id ORDER BY updated_at DESC, id DESC) AS rn
			FROM merchant_applications
			WHERE application_scene = ?
		) AS admin_provider_completion_ranked
		WHERE admin_provider_completion_ranked.rn = 1
	) AS %s ON %s.provider_id = providers.id`, adminProviderLatestCompletionAlias, adminProviderLatestCompletionAlias)
}

func adminMaterialShopLatestCompletionJoin() string {
	return fmt.Sprintf(`LEFT JOIN (
		SELECT shop_id, status
		FROM (
			SELECT shop_id, status,
				ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY updated_at DESC, id DESC) AS rn
			FROM material_shop_applications
			WHERE application_scene = ?
		) AS admin_material_shop_completion_ranked
		WHERE admin_material_shop_completion_ranked.rn = 1
	) AS %s ON %s.shop_id = material_shops.id`, adminMaterialShopLatestCompletionAlias, adminMaterialShopLatestCompletionAlias)
}

func applyAdminProviderDerivedStatusFilters(db *gorm.DB, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter string) *gorm.DB {
	switch strings.TrimSpace(accountStatusFilter) {
	case "":
	case adminAccountStatusUnbound:
		db = db.Where(adminProviderUnboundCondition())
	case adminAccountStatusActive:
		db = db.Where(fmt.Sprintf("%s AND %s.status = 1", adminProviderBoundCondition(), adminProviderBoundUserAlias))
	case adminAccountStatusDisabled:
		db = db.Where(fmt.Sprintf("%s AND %s.status <> 1", adminProviderBoundCondition(), adminProviderBoundUserAlias))
	default:
		db = db.Where("1 = 0")
	}

	switch strings.TrimSpace(onboardingStatusFilter) {
	case "":
	case adminOnboardingStatusNone:
		db = db.Where(adminProviderUnboundCondition())
	case merchantOnboardingStatusApproved:
		db = db.Where(adminProviderOnboardingApprovedCondition())
	case merchantOnboardingStatusRequired:
		db = db.Where(adminProviderOnboardingRequiredCondition())
	case merchantOnboardingStatusPendingReview:
		db = db.Where(adminProviderOnboardingPendingReviewCondition())
	case merchantOnboardingStatusRejected:
		db = db.Where(adminProviderOnboardingRejectedCondition())
	default:
		db = db.Where("1 = 0")
	}

	switch strings.TrimSpace(operatingStatusFilter) {
	case "":
	case adminOperatingStatusUnopened:
		db = db.Where(adminProviderUnboundCondition())
	case adminOperatingStatusFrozen:
		db = db.Where(fmt.Sprintf("%s AND providers.status <> %d", adminProviderBoundCondition(), merchantProviderStatusActive))
	case adminOperatingStatusActive:
		db = db.Where(fmt.Sprintf("%s AND providers.status = %d", adminProviderOnboardingApprovedCondition(), merchantProviderStatusActive))
	case adminOperatingStatusRestricted:
		db = db.Where(fmt.Sprintf("%s AND providers.status = %d AND providers.needs_onboarding_completion = true AND COALESCE(%s.status, -1) <> 1", adminProviderBoundCondition(), merchantProviderStatusActive, adminProviderLatestCompletionAlias))
	default:
		db = db.Where("1 = 0")
	}

	return db
}

func applyAdminMaterialShopDerivedStatusFilters(db *gorm.DB, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter string) *gorm.DB {
	switch strings.TrimSpace(accountStatusFilter) {
	case "":
	case adminAccountStatusUnbound:
		db = db.Where(adminMaterialShopUnboundCondition())
	case adminAccountStatusActive:
		db = db.Where(fmt.Sprintf("%s AND %s.status = 1", adminMaterialShopBoundCondition(), adminMaterialShopBoundUserAlias))
	case adminAccountStatusDisabled:
		db = db.Where(fmt.Sprintf("%s AND %s.status <> 1", adminMaterialShopBoundCondition(), adminMaterialShopBoundUserAlias))
	default:
		db = db.Where("1 = 0")
	}

	switch strings.TrimSpace(onboardingStatusFilter) {
	case "":
	case adminOnboardingStatusNone:
		db = db.Where(adminMaterialShopUnboundCondition())
	case merchantOnboardingStatusApproved:
		db = db.Where(adminMaterialShopOnboardingApprovedCondition())
	case merchantOnboardingStatusRequired:
		db = db.Where(adminMaterialShopOnboardingRequiredCondition())
	case merchantOnboardingStatusPendingReview:
		db = db.Where(adminMaterialShopOnboardingPendingReviewCondition())
	case merchantOnboardingStatusRejected:
		db = db.Where(adminMaterialShopOnboardingRejectedCondition())
	default:
		db = db.Where("1 = 0")
	}

	switch strings.TrimSpace(operatingStatusFilter) {
	case "":
	case adminOperatingStatusUnopened:
		db = db.Where(adminMaterialShopUnboundCondition())
	case adminOperatingStatusFrozen:
		db = db.Where(fmt.Sprintf("%s AND COALESCE(material_shops.status, 1) <> 1", adminMaterialShopBoundCondition()))
	case adminOperatingStatusActive:
		db = db.Where(fmt.Sprintf("%s AND COALESCE(material_shops.status, 1) = 1", adminMaterialShopOnboardingApprovedCondition()))
	case adminOperatingStatusRestricted:
		db = db.Where(fmt.Sprintf("%s AND COALESCE(material_shops.status, 1) = 1 AND material_shops.needs_onboarding_completion = true AND COALESCE(%s.status, -1) <> 1", adminMaterialShopBoundCondition(), adminMaterialShopLatestCompletionAlias))
	default:
		db = db.Where("1 = 0")
	}

	return db
}

func adminProviderPriorityOrderExpr() string {
	bound := adminProviderBoundCondition()
	return strings.Join([]string{
		"CASE",
		fmt.Sprintf("WHEN %s AND providers.needs_onboarding_completion = true AND COALESCE(%s.status, -1) = 2 THEN 0", bound, adminProviderLatestCompletionAlias),
		fmt.Sprintf("WHEN %s AND providers.needs_onboarding_completion = true AND COALESCE(%s.status, -1) = 0 THEN 1", bound, adminProviderLatestCompletionAlias),
		fmt.Sprintf("WHEN %s AND providers.needs_onboarding_completion = true AND COALESCE(%s.status, -1) NOT IN (0, 1, 2) THEN 2", bound, adminProviderLatestCompletionAlias),
		fmt.Sprintf("WHEN %s AND providers.status <> %d THEN 3", bound, merchantProviderStatusActive),
		fmt.Sprintf("WHEN %s AND %s.status <> 1 THEN 4", bound, adminProviderBoundUserAlias),
		fmt.Sprintf("WHEN (%s OR providers.is_settled = false) THEN 5", adminProviderUnboundCondition()),
		"WHEN providers.verified = false THEN 6",
		"ELSE 7 END",
	}, " ")
}

func adminMaterialShopPriorityOrderExpr() string {
	bound := adminMaterialShopBoundCondition()
	return strings.Join([]string{
		"CASE",
		fmt.Sprintf("WHEN %s AND material_shops.needs_onboarding_completion = true AND COALESCE(%s.status, -1) = 2 THEN 0", bound, adminMaterialShopLatestCompletionAlias),
		fmt.Sprintf("WHEN %s AND material_shops.needs_onboarding_completion = true AND COALESCE(%s.status, -1) = 0 THEN 1", bound, adminMaterialShopLatestCompletionAlias),
		fmt.Sprintf("WHEN %s AND material_shops.needs_onboarding_completion = true AND COALESCE(%s.status, -1) NOT IN (0, 1, 2) THEN 2", bound, adminMaterialShopLatestCompletionAlias),
		fmt.Sprintf("WHEN %s AND (COALESCE(material_shops.status, 1) <> 1 OR (%s.status = 1 AND material_shops.is_verified = false AND material_shops.needs_onboarding_completion = false)) THEN 3", bound, adminMaterialShopBoundUserAlias),
		fmt.Sprintf("WHEN %s AND %s.status <> 1 THEN 4", bound, adminMaterialShopBoundUserAlias),
		fmt.Sprintf("WHEN (%s OR material_shops.is_settled = false) THEN 5", adminMaterialShopUnboundCondition()),
		"WHEN material_shops.is_verified = false THEN 6",
		"ELSE 7 END",
	}, " ")
}

func buildAdminProviderListQuery(providerType, verified, isSettled, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter string, includeDerivedOrdering bool) *gorm.DB {
	db := repository.DB.Model(&model.Provider{})
	if providerType != "" {
		db = db.Where("provider_type = ?", providerType)
	}
	if verified == "true" {
		db = db.Where("verified = true")
	} else if verified == "false" {
		db = db.Where("verified = false")
	}
	if isSettled == "true" {
		db = db.Where("is_settled = true")
	} else if isSettled == "false" {
		db = db.Where("is_settled = false")
	}

	needsUserJoin := includeDerivedOrdering || strings.TrimSpace(accountStatusFilter) != "" || strings.TrimSpace(onboardingStatusFilter) != "" || strings.TrimSpace(operatingStatusFilter) != ""
	needsCompletionJoin := includeDerivedOrdering || strings.TrimSpace(onboardingStatusFilter) != "" || strings.TrimSpace(operatingStatusFilter) != ""
	if needsUserJoin {
		db = db.Joins(fmt.Sprintf("LEFT JOIN users AS %s ON %s.id = providers.user_id", adminProviderBoundUserAlias, adminProviderBoundUserAlias))
	}
	if needsCompletionJoin {
		db = db.Joins(adminProviderLatestCompletionJoin(), model.MerchantApplicationSceneClaimedCompletion)
	}
	if needsUserJoin {
		db = applyAdminProviderDerivedStatusFilters(db, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter)
	}

	return db
}

func buildAdminMaterialShopListQuery(shopType, isSettled, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter string, includeDerivedOrdering bool) *gorm.DB {
	db := repository.DB.Model(&model.MaterialShop{})
	if shopType != "" {
		db = db.Where("type = ?", shopType)
	}
	if isSettled == "true" {
		db = db.Where("is_settled = true")
	} else if isSettled == "false" {
		db = db.Where("is_settled = false")
	}

	needsUserJoin := includeDerivedOrdering || strings.TrimSpace(accountStatusFilter) != "" || strings.TrimSpace(onboardingStatusFilter) != "" || strings.TrimSpace(operatingStatusFilter) != ""
	needsCompletionJoin := includeDerivedOrdering || strings.TrimSpace(onboardingStatusFilter) != "" || strings.TrimSpace(operatingStatusFilter) != ""
	if needsUserJoin {
		db = db.Joins(fmt.Sprintf("LEFT JOIN users AS %s ON %s.id = material_shops.user_id", adminMaterialShopBoundUserAlias, adminMaterialShopBoundUserAlias))
	}
	if needsCompletionJoin {
		db = db.Joins(adminMaterialShopLatestCompletionJoin(), model.MerchantApplicationSceneClaimedCompletion)
	}
	if needsUserJoin {
		db = applyAdminMaterialShopDerivedStatusFilters(db, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter)
	}

	return db
}

func findLatestClaimedCompletionApplicationsByProviderIDs(tx *gorm.DB, providerIDs []uint64) (map[uint64]*model.MerchantApplication, error) {
	result := make(map[uint64]*model.MerchantApplication, len(providerIDs))
	if len(providerIDs) == 0 {
		return result, nil
	}

	ranked := tx.Model(&model.MerchantApplication{}).
		Select("merchant_applications.*, ROW_NUMBER() OVER (PARTITION BY provider_id ORDER BY updated_at DESC, id DESC) AS rn").
		Where("application_scene = ? AND provider_id IN ?", model.MerchantApplicationSceneClaimedCompletion, providerIDs)

	var apps []model.MerchantApplication
	if err := tx.Table("(?) AS admin_provider_completion_ranked", ranked).
		Where("admin_provider_completion_ranked.rn = 1").
		Find(&apps).Error; err != nil {
		return nil, err
	}

	for i := range apps {
		app := apps[i]
		result[app.ProviderID] = &app
	}
	return result, nil
}

func findLatestClaimedMaterialShopCompletionApplicationsByShopIDs(tx *gorm.DB, shopIDs []uint64) (map[uint64]*model.MaterialShopApplication, error) {
	result := make(map[uint64]*model.MaterialShopApplication, len(shopIDs))
	if len(shopIDs) == 0 {
		return result, nil
	}

	ranked := tx.Model(&model.MaterialShopApplication{}).
		Select("material_shop_applications.*, ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY updated_at DESC, id DESC) AS rn").
		Where("application_scene = ? AND shop_id IN ?", model.MerchantApplicationSceneClaimedCompletion, shopIDs)

	var apps []model.MaterialShopApplication
	if err := tx.Table("(?) AS admin_material_shop_completion_ranked", ranked).
		Where("admin_material_shop_completion_ranked.rn = 1").
		Find(&apps).Error; err != nil {
		return nil, err
	}

	for i := range apps {
		app := apps[i]
		result[app.ShopID] = &app
	}
	return result, nil
}

// AdminStatsOverview 概览统计
func AdminStatsOverview(c *gin.Context) {
	var stats struct {
		UserCount         int64                            `json:"userCount"`
		TodayNewUsers     int64                            `json:"todayNewUsers"`
		ProviderCount     int64                            `json:"providerCount"`
		DesignerCount     int64                            `json:"designerCount"`
		CompanyCount      int64                            `json:"companyCount"`
		ForemanCount      int64                            `json:"foremanCount"`
		ProjectCount      int64                            `json:"projectCount"`
		ActiveProjects    int64                            `json:"activeProjects"`
		CompletedProjects int64                            `json:"completedProjects"`
		BookingCount      int64                            `json:"bookingCount"`
		PendingBookings   int64                            `json:"pendingBookings"`
		MaterialShopCount int64                            `json:"materialShopCount"`
		MonthlyGMV        float64                          `json:"monthlyGMV"`
		PublicIDHealth    monitor.PublicIDHealthSnapshot   `json:"publicIdHealth"`
		PublicIDRollout   monitor.PublicIDRolloutSnapshot  `json:"publicIdRollout"`
		PublicIDRollback  monitor.PublicIDRollbackSnapshot `json:"publicIdRollback"`
	}

	today := timeutil.StartOfDay(timeutil.Now())

	// 用户统计
	repository.DB.Model(&model.User{}).Count(&stats.UserCount)
	repository.DB.Model(&model.User{}).Where("created_at >= ?", today).Count(&stats.TodayNewUsers)

	// 服务商统计
	repository.DB.Model(&model.Provider{}).Count(&stats.ProviderCount)
	repository.DB.Model(&model.Provider{}).Where("provider_type = 1").Count(&stats.DesignerCount)
	repository.DB.Model(&model.Provider{}).Where("provider_type = 2").Count(&stats.CompanyCount)
	repository.DB.Model(&model.Provider{}).Where("provider_type = 3").Count(&stats.ForemanCount)

	// 项目统计
	repository.DB.Model(&model.Project{}).Count(&stats.ProjectCount)
	repository.DB.Model(&model.Project{}).Where("status = 0").Count(&stats.ActiveProjects)
	repository.DB.Model(&model.Project{}).Where("status = 1").Count(&stats.CompletedProjects)

	// 预约统计
	repository.DB.Model(&model.Booking{}).Count(&stats.BookingCount)
	repository.DB.Model(&model.Booking{}).Where("status = 1").Count(&stats.PendingBookings)

	// 主材门店
	repository.DB.Model(&model.MaterialShop{}).Count(&stats.MaterialShopCount)

	// 本月成交额 (从 Transaction 表)
	monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, today.Location())
	repository.DB.Model(&model.Transaction{}).
		Where("created_at >= ? AND type = 'deposit' AND status = 1", monthStart).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&stats.MonthlyGMV)

	stats.PublicIDHealth = monitor.SnapshotPublicIDHealth()
	stats.PublicIDRollout = monitor.SnapshotPublicIDRollout()
	stats.PublicIDRollback = monitor.SnapshotPublicIDRollback()

	response.Success(c, stats)
}

// AdminStatsTrends 趋势统计
func AdminStatsTrends(c *gin.Context) {
	days := 7
	if d := c.Query("days"); d == "30" {
		days = 30
	}

	type DailyStats struct {
		Date     string  `json:"date"`
		Users    int64   `json:"users"`
		Bookings int64   `json:"bookings"`
		Projects int64   `json:"projects"`
		GMV      float64 `json:"gmv"`
	}

	var trends []DailyStats
	today := timeutil.StartOfDay(timeutil.Now())

	for i := days - 1; i >= 0; i-- {
		date := today.AddDate(0, 0, -i)
		nextDate := date.AddDate(0, 0, 1)
		dateStr := date.Format("01-02")

		var daily DailyStats
		daily.Date = dateStr

		repository.DB.Model(&model.User{}).
			Where("created_at >= ? AND created_at < ?", date, nextDate).
			Count(&daily.Users)

		repository.DB.Model(&model.Booking{}).
			Where("created_at >= ? AND created_at < ?", date, nextDate).
			Count(&daily.Bookings)

		repository.DB.Model(&model.Project{}).
			Where("created_at >= ? AND created_at < ?", date, nextDate).
			Count(&daily.Projects)

		repository.DB.Model(&model.Transaction{}).
			Where("created_at >= ? AND created_at < ? AND type = 'deposit'", date, nextDate).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&daily.GMV)

		trends = append(trends, daily)
	}

	response.Success(c, trends)
}

// AdminStatsDistribution 分布统计
func AdminStatsDistribution(c *gin.Context) {
	type DistributionItem struct {
		Name  string `json:"name"`
		Value int64  `json:"value"`
	}

	var result struct {
		ProviderTypes []DistributionItem `json:"providerTypes"`
		ProjectStatus []DistributionItem `json:"projectStatus"`
		BookingStatus []DistributionItem `json:"bookingStatus"`
	}

	// 服务商类型分布
	var designerCount, companyCount, foremanCount int64
	repository.DB.Model(&model.Provider{}).Where("provider_type = 1").Count(&designerCount)
	repository.DB.Model(&model.Provider{}).Where("provider_type = 2").Count(&companyCount)
	repository.DB.Model(&model.Provider{}).Where("provider_type = 3").Count(&foremanCount)
	result.ProviderTypes = []DistributionItem{
		{Name: "设计师", Value: designerCount},
		{Name: "装修公司", Value: companyCount},
		{Name: "工长", Value: foremanCount},
	}

	// 项目状态分布
	var activeProjects, completedProjects, pausedProjects int64
	repository.DB.Model(&model.Project{}).Where("status = 0").Count(&activeProjects)
	repository.DB.Model(&model.Project{}).Where("status = 1").Count(&completedProjects)
	repository.DB.Model(&model.Project{}).Where("status = 2").Count(&pausedProjects)
	result.ProjectStatus = []DistributionItem{
		{Name: "进行中", Value: activeProjects},
		{Name: "已完工", Value: completedProjects},
		{Name: "已暂停", Value: pausedProjects},
	}

	// 预约状态分布
	var pendingBookings, confirmedBookings, completedBookings, cancelledBookings int64
	repository.DB.Model(&model.Booking{}).Where("status = 1").Count(&pendingBookings)
	repository.DB.Model(&model.Booking{}).Where("status = 2").Count(&confirmedBookings)
	repository.DB.Model(&model.Booking{}).Where("status = 3").Count(&completedBookings)
	repository.DB.Model(&model.Booking{}).Where("status = 4").Count(&cancelledBookings)
	result.BookingStatus = []DistributionItem{
		{Name: "待处理", Value: pendingBookings},
		{Name: "已确认", Value: confirmedBookings},
		{Name: "已完成", Value: completedBookings},
		{Name: "已取消", Value: cancelledBookings},
	}

	response.Success(c, result)
}

// ==================== Admin 用户管理 ====================

// AdminListUsers 用户列表
func AdminListUsers(c *gin.Context) {
	page := 1
	pageSize := 10
	if p := c.Query("page"); p != "" {
		page = parseInt(p, 1)
	}
	if ps := c.Query("pageSize"); ps != "" {
		pageSize = parseInt(ps, 10)
	}

	keyword := c.Query("keyword")
	userType := c.Query("userType")
	roleType := strings.TrimSpace(c.Query("roleType"))

	type adminUserListRow struct {
		model.User
		RoleType          string `json:"roleType"`
		RoleLabel         string `json:"roleLabel"`
		PrimaryEntityType string `json:"primaryEntityType,omitempty"`
		PrimaryEntityID   uint64 `json:"primaryEntityId,omitempty"`
		PrimaryEntityName string `json:"primaryEntityName,omitempty"`
	}

	db := repository.DB.Model(&model.User{})
	if keyword != "" {
		db = db.Where("phone LIKE ? OR nickname LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if userType != "" {
		db = db.Where("user_type = ?", userType)
	}

	var users []model.User
	if err := db.Order("id DESC").Find(&users).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	userIDs := make([]uint64, 0, len(users))
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	identityMap := make(map[uint64][]model.UserIdentity)
	if len(userIDs) > 0 {
		var identities []model.UserIdentity
		if err := repository.DB.Where("user_id IN ?", userIDs).Order("id DESC").Find(&identities).Error; err == nil {
			for _, identity := range identities {
				identityMap[identity.UserID] = append(identityMap[identity.UserID], identity)
			}
		}
	}

	providerMap := make(map[uint64]model.Provider)
	if len(userIDs) > 0 {
		var providers []model.Provider
		if err := repository.DB.Where("user_id IN ?", userIDs).Order("id DESC").Find(&providers).Error; err == nil {
			for _, provider := range providers {
				if _, exists := providerMap[provider.UserID]; !exists {
					providerMap[provider.UserID] = provider
				}
			}
		}
	}

	materialShopMap := make(map[uint64]model.MaterialShop)
	if len(userIDs) > 0 {
		var shops []model.MaterialShop
		if err := repository.DB.Where("user_id IN ?", userIDs).Order("id DESC").Find(&shops).Error; err == nil {
			for _, shop := range shops {
				if _, exists := materialShopMap[shop.UserID]; !exists {
					materialShopMap[shop.UserID] = shop
				}
			}
		}
	}

	rows := make([]adminUserListRow, 0, len(users))
	for _, user := range users {
		derivedRoleType, derivedRoleLabel := resolveAdminUserRole(user, providerMap[user.ID], materialShopMap[user.ID], identityMap[user.ID])
		if roleType != "" && roleType != derivedRoleType {
			continue
		}
		primaryEntityType := ""
		var primaryEntityID uint64
		primaryEntityName := ""
		if shop, ok := materialShopMap[user.ID]; ok && shop.ID > 0 {
			primaryEntityType = "material_shop"
			primaryEntityID = shop.ID
			primaryEntityName = strings.TrimSpace(shop.Name)
			if primaryEntityName == "" {
				primaryEntityName = strings.TrimSpace(shop.CompanyName)
			}
		} else if provider, ok := providerMap[user.ID]; ok && provider.ID > 0 {
			primaryEntityType = "provider"
			primaryEntityID = provider.ID
			primaryEntityName = strings.TrimSpace(provider.CompanyName)
			if primaryEntityName == "" {
				primaryEntityName = strings.TrimSpace(user.Nickname)
			}
		}
		rows = append(rows, adminUserListRow{
			User:              user,
			RoleType:          derivedRoleType,
			RoleLabel:         derivedRoleLabel,
			PrimaryEntityType: primaryEntityType,
			PrimaryEntityID:   primaryEntityID,
			PrimaryEntityName: primaryEntityName,
		})
	}

	total := int64(len(rows))
	start := (page - 1) * pageSize
	if start > len(rows) {
		start = len(rows)
	}
	end := start + pageSize
	if end > len(rows) {
		end = len(rows)
	}

	response.Success(c, gin.H{
		"list":  rows[start:end],
		"total": total,
	})
}

func resolveAdminUserRole(user model.User, provider model.Provider, materialShop model.MaterialShop, identities []model.UserIdentity) (string, string) {
	if materialShop.ID > 0 {
		return "material_shop", "主材商"
	}

	for _, identity := range identities {
		switch strings.TrimSpace(identity.IdentityType) {
		case "material_shop", "supplier":
			return "material_shop", "主材商"
		}
	}

	if provider.ID > 0 {
		switch provider.ProviderType {
		case 1:
			return "designer", "设计师"
		case 2:
			return "company", "装修公司"
		case 3:
			return "foreman", "工长"
		default:
			return "provider", "服务商"
		}
	}

	for _, identity := range identities {
		switch strings.TrimSpace(identity.IdentityType) {
		case "company":
			return "company", "装修公司"
		case "foreman", "worker":
			return "foreman", "工长"
		case "designer":
			return "designer", "设计师"
		case "provider":
			return "provider", "服务商"
		}
	}

	switch user.UserType {
	case 4:
		return "admin", "管理员"
	case 1:
		return "owner", "业主"
	case 2:
		return "provider", "服务商"
	case 3:
		return "foreman", "工长"
	default:
		return "owner", "业主"
	}
}

// AdminUpdateUserStatus 更新用户状态
func AdminUpdateUserStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status int8 `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Model(&model.User{}).Where("id = ?", id).Update("status", req.Status).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
}

// AdminGetUser 获取用户详情
func AdminGetUser(c *gin.Context) {
	id := c.Param("id")
	var user model.User
	if err := repository.DB.First(&user, "id = ?", id).Error; err != nil {
		response.NotFound(c, "用户不存在")
		return
	}
	response.Success(c, user)
}

// AdminCreateUser 创建用户
func AdminCreateUser(c *gin.Context) {
	var req struct {
		Phone    string `json:"phone" binding:"required"`
		Nickname string `json:"nickname"`
		UserType int8   `json:"userType"`
		Status   int8   `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	user := model.User{
		Phone:    req.Phone,
		Nickname: req.Nickname,
		UserType: req.UserType,
		Status:   req.Status,
	}
	if user.Status == 0 {
		user.Status = 1 // 默认启用
	}
	if err := repository.DB.Create(&user).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}
	response.Success(c, user)
}

// AdminUpdateUser 更新用户信息
func AdminUpdateUser(c *gin.Context) {
	id := c.Param("id")
	var user model.User
	if err := repository.DB.First(&user, "id = ?", id).Error; err != nil {
		response.NotFound(c, "用户不存在")
		return
	}
	var req struct {
		Nickname string `json:"nickname"`
		UserType int8   `json:"userType"`
		Status   int8   `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	updates := map[string]interface{}{}
	if req.Nickname != "" {
		updates["nickname"] = req.Nickname
	}
	if req.UserType > 0 {
		updates["user_type"] = req.UserType
	}
	updates["status"] = req.Status

	if err := repository.DB.Model(&user).Updates(updates).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, user)
}

// AdminDeleteUser 删除单个用户（仅超级管理员）
func AdminDeleteUser(c *gin.Context) {
	id := parseUint(c.Param("id"))
	if id == 0 {
		response.BadRequest(c, "用户ID错误")
		return
	}

	result, err := getAdminUserCleanupService().DeleteUsers([]uint64{id})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", gin.H{
		"deletedUserIds": result.UserIDs,
		"deletedCount":   len(result.UserIDs),
	})
}

// AdminBatchDeleteUsers 批量删除用户（仅超级管理员，需二次验证）
func AdminBatchDeleteUsers(c *gin.Context) {
	var req map[string]any
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	userIDs := parseUserIDsFromPayload(req["userIds"])
	if len(userIDs) == 0 {
		userIDs = parseUserIDsFromPayload(req["user_ids"])
	}
	if len(userIDs) == 0 {
		response.BadRequest(c, "参数错误：userIds 不能为空")
		return
	}

	verificationText := parseStringFromPayload(req["verificationText"])
	if verificationText == "" {
		verificationText = parseStringFromPayload(req["verification_text"])
	}
	expectedVerificationText := buildBatchDeleteVerificationText(len(userIDs))
	if verificationText != expectedVerificationText {
		response.BadRequest(c, fmt.Sprintf("二次验证失败，请输入 %s", expectedVerificationText))
		return
	}

	result, err := getAdminUserCleanupService().DeleteUsers(userIDs)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "批量删除成功", gin.H{
		"deletedUserIds": result.UserIDs,
		"deletedCount":   len(result.UserIDs),
	})
}

func buildBatchDeleteVerificationText(count int) string {
	return fmt.Sprintf("DELETE %d", count)
}

func parseStringFromPayload(value any) string {
	if typed, ok := value.(string); ok {
		return strings.TrimSpace(typed)
	}
	return ""
}

func parseUserIDsFromPayload(value any) []uint64 {
	list, ok := value.([]any)
	if !ok {
		return nil
	}

	result := make([]uint64, 0, len(list))
	for _, item := range list {
		switch typed := item.(type) {
		case float64:
			if typed > 0 {
				result = append(result, uint64(typed))
			}
		case string:
			if typed == "" {
				continue
			}
			if parsed, err := strconv.ParseUint(typed, 10, 64); err == nil && parsed > 0 {
				result = append(result, parsed)
			}
		}
	}

	return result
}

// ==================== Admin 服务商管理 ====================

type adminProviderListRow struct {
	model.Provider
	RealName           string                        `json:"realName"`
	SourceLabel        string                        `json:"sourceLabel"`
	AccountBound       bool                          `json:"accountBound"`
	AccountStatus      string                        `json:"accountStatus"`
	LoginStatus        string                        `json:"loginStatus"`
	LoginEnabled       bool                          `json:"loginEnabled"`
	CompletionRequired bool                          `json:"completionRequired"`
	OnboardingStatus   string                        `json:"onboardingStatus"`
	OperatingStatus    string                        `json:"operatingStatus"`
	OperatingEnabled   bool                          `json:"operatingEnabled"`
	CompletionAppID    uint64                        `json:"completionApplicationId,omitempty"`
	Visibility         service.VisibilityData        `json:"visibility"`
	Actions            service.VisibilityActions     `json:"actions"`
	LegacyInfo         *service.VisibilityLegacyInfo `json:"legacyInfo,omitempty"`
}

type adminMaterialShopListRow struct {
	model.MaterialShop
	UserPhone          string                        `json:"userPhone"`
	UserNickname       string                        `json:"userNickname"`
	AccountBound       bool                          `json:"accountBound"`
	AccountStatus      string                        `json:"accountStatus"`
	LoginStatus        string                        `json:"loginStatus"`
	LoginEnabled       bool                          `json:"loginEnabled"`
	CompletionRequired bool                          `json:"completionRequired"`
	OnboardingStatus   string                        `json:"onboardingStatus"`
	OperatingStatus    string                        `json:"operatingStatus"`
	OperatingEnabled   bool                          `json:"operatingEnabled"`
	CompletionAppID    uint64                        `json:"completionApplicationId"`
	SourceLabel        string                        `json:"sourceLabel"`
	Visibility         service.VisibilityData        `json:"visibility"`
	Actions            service.VisibilityActions     `json:"actions"`
	LegacyInfo         *service.VisibilityLegacyInfo `json:"legacyInfo,omitempty"`
}

func findProviderVisibilitySource(provider model.Provider) (*model.MerchantApplication, bool) {
	var app model.MerchantApplication
	if provider.SourceApplicationID > 0 {
		if err := repository.DB.First(&app, provider.SourceApplicationID).Error; err == nil {
			return &app, true
		}
	}

	if err := repository.DB.Where("provider_id = ?", provider.ID).Order("id DESC").First(&app).Error; err == nil {
		return &app, true
	}

	return nil, false
}

func resolveProviderSourceLabel(p model.Provider) string {
	if !p.IsSettled {
		return "平台收录"
	}
	if p.SourceApplicationID > 0 {
		return "入驻申请"
	}
	if p.UserID > 0 {
		return "后台创建"
	}
	return "历史直建"
}

func resolveMaterialShopSourceLabel(shop model.MaterialShop) string {
	if !shop.IsSettled {
		return "平台收录"
	}
	if shop.SourceApplicationID > 0 {
		return "入驻申请"
	}
	if shop.UserID > 0 {
		return "后台补全"
	}
	return "历史直建"
}

func findLatestClaimedMaterialShopCompletionApplication(tx *gorm.DB, shopID, userID uint64) (*model.MaterialShopApplication, error) {
	query := tx.Model(&model.MaterialShopApplication{}).
		Where("application_scene = ?", model.MerchantApplicationSceneClaimedCompletion)

	switch {
	case shopID > 0:
		query = query.Where("shop_id = ?", shopID)
	case userID > 0:
		query = query.Where("user_id = ?", userID)
	default:
		return nil, nil
	}

	var app model.MaterialShopApplication
	if err := query.Order("updated_at DESC, id DESC").First(&app).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &app, nil
}

func resolveMaterialShopOnboardingStatus(shop model.MaterialShop, app *model.MaterialShopApplication) string {
	if !shop.NeedsOnboardingCompletion {
		return merchantOnboardingStatusApproved
	}
	if app == nil {
		return merchantOnboardingStatusRequired
	}
	switch app.Status {
	case 0:
		return merchantOnboardingStatusPendingReview
	case 2:
		return merchantOnboardingStatusRejected
	case 1:
		return merchantOnboardingStatusApproved
	default:
		return merchantOnboardingStatusRequired
	}
}

func resolveMaterialShopIdentityStatus(shop model.MaterialShop) int8 {
	if service.IsMaterialShopLoginEnabled(&shop) {
		return merchantIdentityStatusActive
	}
	return merchantIdentityStatusFrozen
}

func findMaterialShopVisibilitySource(shop model.MaterialShop) (*model.MaterialShopApplication, bool) {
	var app model.MaterialShopApplication
	if shop.SourceApplicationID > 0 {
		if err := repository.DB.First(&app, shop.SourceApplicationID).Error; err == nil {
			return &app, true
		}
	}

	if err := repository.DB.Where("shop_id = ?", shop.ID).Order("id DESC").First(&app).Error; err == nil {
		return &app, true
	}

	return nil, false
}

// AdminListProviders 服务商列表
func AdminListProviders(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	providerType := c.Query("type")
	verified := c.Query("verified")
	isSettled := c.Query("isSettled")
	accountStatusFilter := c.Query("accountStatus")
	onboardingStatusFilter := c.Query("onboardingStatus")
	operatingStatusFilter := c.Query("operatingStatus")

	query := buildAdminProviderListQuery(providerType, verified, isSettled, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter, false)

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	var providerIDs []uint64
	if total > 0 {
		if err := buildAdminProviderListQuery(providerType, verified, isSettled, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter, true).
			Session(&gorm.Session{}).
			Order(adminProviderPriorityOrderExpr()).
			Order("providers.id DESC").
			Offset((page-1)*pageSize).
			Limit(pageSize).
			Pluck("providers.id", &providerIDs).Error; err != nil {
			response.ServerError(c, "加载失败")
			return
		}
	}

	if len(providerIDs) == 0 {
		response.Success(c, gin.H{
			"list":  make([]adminProviderListRow, 0),
			"total": total,
		})
		return
	}

	var pageProviders []model.Provider
	if err := repository.DB.Where("id IN ?", providerIDs).Find(&pageProviders).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	providerByID := make(map[uint64]model.Provider, len(pageProviders))
	for _, provider := range pageProviders {
		providerByID[provider.ID] = provider
	}

	providers := make([]model.Provider, 0, len(providerIDs))
	for _, id := range providerIDs {
		if provider, ok := providerByID[id]; ok {
			providers = append(providers, provider)
		}
	}

	userIDs := make([]uint64, 0, len(providers))
	for _, provider := range providers {
		if provider.UserID > 0 {
			userIDs = append(userIDs, provider.UserID)
		}
	}

	userMap := make(map[uint64]adminLinkedUserBrief, len(userIDs))
	if len(userIDs) > 0 {
		var users []adminLinkedUserBrief
		repository.DB.Model(&model.User{}).Select("id", "phone", "nickname", "status").Where("id IN ?", userIDs).Find(&users)
		for _, user := range users {
			userMap[user.ID] = user
		}
	}

	completionAppMap, err := findLatestClaimedCompletionApplicationsByProviderIDs(repository.DB, providerIDs)
	if err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	list := make([]adminProviderListRow, 0, len(providers))
	for _, provider := range providers {
		provider.PlatformDisplayEnabled = service.ProviderPlatformDisplayEnabled(&provider)
		provider.MerchantDisplayEnabled = service.ProviderMerchantDisplayEnabled(&provider)
		completionApp := completionAppMap[provider.ID]
		userInfo, hasBoundUser := userMap[provider.UserID]
		accountBound := provider.UserID > 0 && hasBoundUser
		onboardingStatus := resolveAdminProviderOnboardingStatus(provider, accountBound, completionApp)
		accountStatus := resolveAdminAccountStatus(accountBound, userInfo.Status)
		loginStatus := resolveAdminProviderLoginStatus(provider, accountBound, userInfo.Status)
		operatingStatus := resolveAdminProviderOperatingStatus(provider, accountBound, onboardingStatus)
		loginEnabled := loginStatus == adminLoginStatusEnabled
		completionRequired := accountBound && provider.NeedsOnboardingCompletion
		operatingEnabled := operatingStatus == adminOperatingStatusActive
		completionAppID := uint64(0)
		if completionApp != nil {
			completionAppID = completionApp.ID
		}

		visibilityDecision := service.EvaluateProviderPublicVisibility(&provider)
		visibilityDecision.CurrentLabel = "缺少入驻申请"
		visibilityDecision.EntitySnapshot = service.VisibilityEntitySnapshot{
			ProviderID:       &provider.ID,
			ProviderVerified: &provider.Verified,
			ProviderStatus:   &provider.Status,
		}
		visibilityResult := service.VisibilityResult{
			Visibility: visibilityDecision,
			Actions:    service.VisibilityActions{RejectResubmittable: false},
		}

		if app, ok := findProviderVisibilitySource(provider); ok {
			visibilityResult = adminVisibilityResolver.ResolveMerchantApplication(*app, &provider)
		}

		list = append(list, adminProviderListRow{
			Provider:           provider,
			RealName:           userInfo.Nickname,
			SourceLabel:        resolveProviderSourceLabel(provider),
			AccountBound:       accountBound,
			AccountStatus:      accountStatus,
			LoginStatus:        loginStatus,
			LoginEnabled:       loginEnabled,
			CompletionRequired: completionRequired,
			OnboardingStatus:   onboardingStatus,
			OperatingStatus:    operatingStatus,
			OperatingEnabled:   operatingEnabled,
			CompletionAppID:    completionAppID,
			Visibility:         visibilityResult.Visibility,
			Actions:            visibilityResult.Actions,
			LegacyInfo:         visibilityResult.LegacyInfo,
		})
	}

	response.Success(c, gin.H{
		"list":  list,
		"total": total,
	})
}

// AdminVerifyProvider 审核服务商
func AdminVerifyProvider(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Verified bool `json:"verified"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Model(&model.Provider{}).Where("id = ?", id).Update("verified", req.Verified).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
}

// AdminCreateProvider 创建服务商
func AdminCreateProvider(c *gin.Context) {
	var req struct {
		UserId          uint64 `json:"userId"`
		ProviderType    int8   `json:"providerType" binding:"required"`
		CompanyName     string `json:"companyName" binding:"required"`
		RealName        string `json:"realName"`
		SubType         string `json:"subType"`
		Specialty       string `json:"specialty"`
		YearsExperience int    `json:"yearsExperience"`
		Status          int8   `json:"status"`
		IsSettled       *bool  `json:"isSettled"`       // nil 默认 true
		CollectedSource string `json:"collectedSource"` // 收录来源
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	isSettled := true
	if req.IsSettled != nil {
		isSettled = *req.IsSettled
	}

	provider := model.Provider{
		UserID:          req.UserId,
		ProviderType:    req.ProviderType,
		CompanyName:     req.CompanyName,
		DisplayName:     service.ResolveProviderStoredDisplayName(req.ProviderType, req.CompanyName, req.RealName),
		SubType:         req.SubType,
		Specialty:       req.Specialty,
		YearsExperience: req.YearsExperience,
		Status:          req.Status,
		IsSettled:       isSettled,
		CollectedSource: req.CollectedSource,
	}
	if provider.Status == 0 {
		provider.Status = 1 // 默认启用
	}
	if provider.SubType == "" {
		provider.SubType = "personal"
	}
	if err := repository.DB.Create(&provider).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}
	response.Success(c, provider)
}

// AdminUpdateProvider 更新服务商
func AdminUpdateProvider(c *gin.Context) {
	id := c.Param("id")
	var provider model.Provider
	if err := repository.DB.First(&provider, "id = ?", id).Error; err != nil {
		response.NotFound(c, "服务商不存在")
		return
	}
	var req struct {
		CompanyName     string   `json:"companyName"`
		RealName        string   `json:"realName"`
		SubType         string   `json:"subType"`
		Specialty       string   `json:"specialty"`
		YearsExperience int      `json:"yearsExperience"`
		Status          int8     `json:"status"`
		RestoreRate     float32  `json:"restoreRate"`     // 还原度
		BudgetControl   float32  `json:"budgetControl"`   // 预算控制力
		WorkTypes       string   `json:"workTypes"`       // 工种类型（逗号分隔）
		PriceMin        float64  `json:"priceMin"`        // 最低价格
		PriceMax        float64  `json:"priceMax"`        // 最高价格
		PriceUnit       string   `json:"priceUnit"`       // 价格单位
		CoverImage      string   `json:"coverImage"`      // 封面背景图
		ServiceIntro    string   `json:"serviceIntro"`    // 服务介绍
		TeamSize        int      `json:"teamSize"`        // 团队规模
		EstablishedYear int      `json:"establishedYear"` // 成立年份
		Certifications  string   `json:"certifications"`  // 资质认证（JSON数组）
		ServiceArea     []string `json:"serviceArea"`     // 服务区域（区域代码数组）
		IsSettled       *bool    `json:"isSettled"`       // 入驻状态
		CollectedSource string   `json:"collectedSource"` // 收录来源
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// 验证服务城市代码（如果提供）支持名称/代码输入
	var serviceAreaCodes []string
	if len(req.ServiceArea) > 0 {
		codes, err := adminRegionService.NormalizeServiceCityCodes(req.ServiceArea)
		if err != nil {
			response.BadRequest(c, "服务城市验证失败: "+err.Error())
			return
		}
		serviceAreaCodes = codes
	}

	updates := map[string]interface{}{}
	if req.CompanyName != "" {
		updates["company_name"] = req.CompanyName
	}
	if req.RealName != "" || strings.TrimSpace(req.CompanyName) != "" {
		effectiveCompanyName := provider.CompanyName
		if strings.TrimSpace(req.CompanyName) != "" {
			effectiveCompanyName = req.CompanyName
		}
		updates["display_name"] = service.ResolveProviderStoredDisplayName(provider.ProviderType, effectiveCompanyName, req.RealName)
	}
	if req.SubType != "" {
		updates["sub_type"] = req.SubType
	}
	if req.Specialty != "" {
		updates["specialty"] = req.Specialty
	}
	if req.YearsExperience > 0 {
		updates["years_experience"] = req.YearsExperience
	}
	if req.RestoreRate >= 0 {
		updates["restore_rate"] = req.RestoreRate
	}
	if req.BudgetControl >= 0 {
		updates["budget_control"] = req.BudgetControl
	}
	if req.WorkTypes != "" {
		updates["work_types"] = req.WorkTypes
	}
	if req.PriceMin >= 0 {
		updates["price_min"] = req.PriceMin
	}
	if req.PriceMax >= 0 {
		updates["price_max"] = req.PriceMax
	}
	updates["price_unit"] = model.ProviderPriceUnitPerSquareMeter
	if req.CoverImage != "" {
		updates["cover_image"] = normalizeStoredAsset(req.CoverImage)
	}
	if req.ServiceIntro != "" {
		updates["service_intro"] = req.ServiceIntro
	}
	if req.TeamSize > 0 {
		updates["team_size"] = req.TeamSize
	}
	if req.EstablishedYear > 0 {
		updates["established_year"] = req.EstablishedYear
	}
	if req.Certifications != "" {
		updates["certifications"] = req.Certifications
	}
	if len(serviceAreaCodes) > 0 {
		serviceAreaJSON, _ := json.Marshal(serviceAreaCodes)
		updates["service_area"] = string(serviceAreaJSON)
	}
	updates["status"] = req.Status
	if req.IsSettled != nil {
		updates["is_settled"] = *req.IsSettled
	}
	if req.CollectedSource != "" {
		updates["collected_source"] = req.CollectedSource
	}

	if err := repository.DB.Model(&provider).Updates(updates).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, provider)
}

// AdminUpdateProviderStatus 更新服务商状态（封禁/解封）
func AdminUpdateProviderStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status int8 `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Model(&model.Provider{}).Where("id = ?", id).Update("status", req.Status).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
}

func AdminUpdateProviderPlatformDisplay(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if !service.SupportsProviderPlatformDisplayEnabled() {
		response.Error(c, 503, repository.SchemaServiceUnavailableMessage("服务商平台展示开关"))
		return
	}
	if err := repository.DB.Model(&model.Provider{}).Where("id = ?", id).Update("platform_display_enabled", req.Enabled).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
}

// AdminClaimProviderAccount 为未入驻服务商（装修公司）绑定账号并完成入驻
func AdminClaimProviderAccount(c *gin.Context) {
	providerID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var req struct {
		Phone       string `json:"phone" binding:"required"`
		ContactName string `json:"contactName"`
		Nickname    string `json:"nickname"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	if !utils.ValidatePhone(phone) {
		response.BadRequest(c, "手机号格式不正确")
		return
	}

	tx := repository.DB.Begin()

	var provider model.Provider
	if err := tx.First(&provider, providerID).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "服务商不存在")
		return
	}
	beforeProvider := provider
	if provider.UserID > 0 {
		tx.Rollback()
		response.BadRequest(c, "该服务商已绑定账号")
		return
	}

	var existingUser model.User
	userExists := tx.Where("phone = ?", phone).First(&existingUser).Error == nil

	displayName := firstNonEmpty(
		strings.TrimSpace(req.Nickname),
		strings.TrimSpace(req.ContactName),
		strings.TrimSpace(provider.CompanyName),
	)
	user, err := createOrLoadMerchantUserWithCompatibility(tx, phone, displayName)
	if err != nil {
		tx.Rollback()
		response.Error(c, 500, "认领失败: 创建或加载用户失败")
		return
	}

	// 检查该手机号是否已绑定其他服务商
	var duplicateProvider model.Provider
	if err := tx.Where("user_id = ? AND id <> ?", user.ID, provider.ID).Order("id DESC").First(&duplicateProvider).Error; err == nil {
		tx.Rollback()
		response.BadRequest(c, "该手机号已绑定其他服务商账号，请使用未绑定的手机号")
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		response.Error(c, 500, "校验服务商账号失败")
		return
	}

	// 检查该手机号是否已绑定其他主材门店
	var duplicateShop model.MaterialShop
	if err := tx.Where("user_id = ?", user.ID).Order("id DESC").First(&duplicateShop).Error; err == nil {
		tx.Rollback()
		response.BadRequest(c, "该手机号已绑定主材商账号，请使用未绑定的手机号")
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		response.Error(c, 500, "校验主材商账号失败")
		return
	}

	// 更新 provider：绑定 user_id，标记为已入驻，并开启补全门禁
	providerUpdates := map[string]interface{}{
		"user_id":                     user.ID,
		"is_settled":                  true,
		"needs_onboarding_completion": true,
	}
	if err := tx.Model(&provider).Updates(providerUpdates).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "绑定服务商账号失败")
		return
	}

	// 若关联了入驻申请记录，同步 user_id
	if provider.SourceApplicationID > 0 {
		if err := tx.Model(&model.MerchantApplication{}).
			Where("id = ? AND (user_id = 0 OR user_id IS NULL)", provider.SourceApplicationID).
			Update("user_id", user.ID).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "同步申请账号失败")
			return
		}
	}

	provider.UserID = user.ID
	provider.IsSettled = true
	provider.NeedsOnboardingCompletion = true

	// 确保商家身份记录（认领后默认允许登录，但经营仍受补全门禁控制）
	identityStatus := resolveProviderIdentityStatus(provider)
	if err := ensureMerchantIdentity(tx, user.ID, merchantIdentityTypeProvider, provider.ID, adminID, identityStatus); err != nil {
		tx.Rollback()
		response.Error(c, 500, "补全服务商身份失败: "+err.Error())
		return
	}

	if err := (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "claim_provider_account",
		ResourceType:  "provider",
		ResourceID:    provider.ID,
		Reason:        readAdminReason(c, req.Reason, "认领装修公司账号"),
		Result:        "success",
		BeforeState: map[string]interface{}{
			"provider": map[string]interface{}{
				"id":                        beforeProvider.ID,
				"userId":                    beforeProvider.UserID,
				"isSettled":                 beforeProvider.IsSettled,
				"needsOnboardingCompletion": beforeProvider.NeedsOnboardingCompletion,
			},
		},
		AfterState: map[string]interface{}{
			"provider": map[string]interface{}{
				"id":                        provider.ID,
				"userId":                    provider.UserID,
				"isSettled":                 provider.IsSettled,
				"needsOnboardingCompletion": provider.NeedsOnboardingCompletion,
			},
		},
		Metadata: map[string]interface{}{
			"phone":              phone,
			"userId":             user.ID,
			"createdUser":        !userExists,
			"completionRequired": true,
		},
	}); err != nil {
		tx.Rollback()
		response.Error(c, 500, "记录认领审计失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "认领入驻失败")
		return
	}

	response.Success(c, gin.H{
		"providerId":         provider.ID,
		"userId":             user.ID,
		"phone":              phone,
		"createdUser":        !userExists,
		"accountBound":       true,
		"sourceLabel":        resolveProviderSourceLabel(model.Provider{SourceApplicationID: provider.SourceApplicationID, UserID: user.ID, IsSettled: true}),
		"loginEnabled":       identityStatus == merchantIdentityStatusActive,
		"completionRequired": true,
		"onboardingStatus":   merchantOnboardingStatusRequired,
	})
}

func resolveProviderIdentityStatus(provider model.Provider) int8 {
	if provider.Status == merchantProviderStatusActive {
		return merchantIdentityStatusActive
	}
	return merchantIdentityStatusFrozen
}

// AdminCompleteProviderSettlement 为已绑定账号但仍处于未入驻状态的服务商补齐入驻
func AdminCompleteProviderSettlement(c *gin.Context) {
	providerID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	tx := repository.DB.Begin()

	var provider model.Provider
	if err := tx.First(&provider, providerID).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "服务商不存在")
		return
	}
	if provider.UserID == 0 {
		tx.Rollback()
		response.BadRequest(c, "该服务商尚未绑定账号，请使用认领入驻")
		return
	}
	if provider.IsSettled {
		tx.Rollback()
		response.BadRequest(c, "该服务商已完成入驻")
		return
	}

	if err := tx.Model(&provider).Update("is_settled", true).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "更新入驻状态失败")
		return
	}

	if provider.SourceApplicationID > 0 {
		if err := tx.Model(&model.MerchantApplication{}).
			Where("id = ? AND (user_id = 0 OR user_id IS NULL)", provider.SourceApplicationID).
			Update("user_id", provider.UserID).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "同步申请账号失败")
			return
		}
	}

	identityStatus := resolveProviderIdentityStatus(provider)
	if err := ensureMerchantIdentity(tx, provider.UserID, merchantIdentityTypeProvider, provider.ID, adminID, identityStatus); err != nil {
		tx.Rollback()
		response.Error(c, 500, "补全服务商身份失败: "+err.Error())
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "完成入驻失败")
		return
	}

	response.Success(c, gin.H{
		"providerId": provider.ID,
		"userId":     provider.UserID,
		"sourceLabel": resolveProviderSourceLabel(model.Provider{
			SourceApplicationID: provider.SourceApplicationID,
			UserID:              provider.UserID,
			IsSettled:           true,
		}),
		"loginEnabled": identityStatus == merchantIdentityStatusActive,
	})
}

// ==================== Admin 预约管理 ====================

// AdminListBookings 预约列表
func AdminListBookings(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	status := c.Query("status")

	var bookings []model.Booking
	var total int64

	db := repository.DB.Model(&model.Booking{})
	if status != "" {
		db = db.Where("status = ?", status)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&bookings)

	response.Success(c, gin.H{
		"list":  bookings,
		"total": total,
	})
}

// AdminUpdateBookingStatus 更新预约状态
func AdminUpdateBookingStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status int8 `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Model(&model.Booking{}).Where("id = ?", id).Update("status", req.Status).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
}

// ==================== Admin 评价管理 ====================

// AdminListReviews 评价列表
func AdminListReviews(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	providerId := c.Query("providerId")

	var reviews []model.ProviderReview
	var total int64

	db := repository.DB.Model(&model.ProviderReview{})
	if providerId != "" {
		db = db.Where("provider_id = ?", providerId)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&reviews)

	// 转换为前端需要的格式，关联用户和服务商信息
	type ReviewResponse struct {
		ID           uint64  `json:"id"`
		ProviderID   uint64  `json:"providerId"`
		ProviderName string  `json:"providerName"` // 新增：服务商名称
		UserID       uint64  `json:"userId"`
		UserName     string  `json:"userName"` // 新增：用户名称
		Rating       float32 `json:"rating"`
		Content      string  `json:"content"`
		Images       string  `json:"images"`
		ServiceType  string  `json:"serviceType"`
		CreatedAt    string  `json:"createdAt"`
	}

	var result []ReviewResponse
	for _, review := range reviews {
		resp := ReviewResponse{
			ID:          review.ID,
			ProviderID:  review.ProviderID,
			UserID:      review.UserID,
			Rating:      review.Rating,
			Content:     review.Content,
			Images:      review.Images,
			ServiceType: review.ServiceType,
			CreatedAt:   review.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		// 查询用户名称
		var user model.User
		if err := repository.DB.Select("nickname").First(&user, review.UserID).Error; err == nil {
			resp.UserName = user.Nickname
		} else {
			resp.UserName = fmt.Sprintf("用户%d", review.UserID)
		}

		// 查询服务商名称
		var provider model.Provider
		if err := repository.DB.Select("id", "user_id", "company_name").First(&provider, review.ProviderID).Error; err == nil {
			var providerUser model.User
			if provider.UserID > 0 {
				_ = repository.DB.Select("nickname", "phone").First(&providerUser, provider.UserID).Error
				resp.ProviderName = service.ResolveProviderDisplayName(provider, &providerUser)
			} else {
				resp.ProviderName = service.ResolveProviderDisplayName(provider, nil)
			}
		} else {
			resp.ProviderName = fmt.Sprintf("服务商%d", review.ProviderID)
		}

		result = append(result, resp)
	}

	response.Success(c, gin.H{
		"list":  result,
		"total": total,
	})
}

// AdminDeleteReview 删除评价
func AdminDeleteReview(c *gin.Context) {
	id := c.Param("id")

	var review model.ProviderReview
	if err := repository.DB.First(&review, "id = ?", id).Error; err != nil {
		response.NotFound(c, "评价不存在")
		return
	}

	if err := repository.DB.Delete(&review).Error; err != nil {
		response.ServerError(c, "删除失败")
		return
	}
	if err := providerService.RecalculateAggregatedRating(review.ProviderID); err != nil {
		response.ServerError(c, "删除成功，但重算综合评分失败")
		return
	}
	response.Success(c, nil)
}

// ==================== Admin 主材门店管理 ====================

// AdminListMaterialShops 主材门店列表
func AdminListMaterialShops(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	shopType := c.Query("type")
	isSettled := c.Query("isSettled")
	accountStatusFilter := c.Query("accountStatus")
	onboardingStatusFilter := c.Query("onboardingStatus")
	operatingStatusFilter := c.Query("operatingStatus")

	query := buildAdminMaterialShopListQuery(shopType, isSettled, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter, false)

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	var shopIDs []uint64
	if total > 0 {
		if err := buildAdminMaterialShopListQuery(shopType, isSettled, accountStatusFilter, onboardingStatusFilter, operatingStatusFilter, true).
			Session(&gorm.Session{}).
			Order(adminMaterialShopPriorityOrderExpr()).
			Order("material_shops.id DESC").
			Offset((page-1)*pageSize).
			Limit(pageSize).
			Pluck("material_shops.id", &shopIDs).Error; err != nil {
			response.ServerError(c, "加载失败")
			return
		}
	}

	if len(shopIDs) == 0 {
		response.Success(c, gin.H{
			"list":  make([]adminMaterialShopListRow, 0),
			"total": total,
		})
		return
	}

	var pageShops []model.MaterialShop
	if err := repository.DB.Where("id IN ?", shopIDs).Find(&pageShops).Error; err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	shopByID := make(map[uint64]model.MaterialShop, len(pageShops))
	for _, shop := range pageShops {
		shopByID[shop.ID] = shop
	}

	shops := make([]model.MaterialShop, 0, len(shopIDs))
	for _, id := range shopIDs {
		if shop, ok := shopByID[id]; ok {
			shops = append(shops, shop)
		}
	}

	userIDs := make([]uint64, 0, len(shops))
	for _, shop := range shops {
		if shop.UserID > 0 {
			userIDs = append(userIDs, shop.UserID)
		}
	}

	userMap := make(map[uint64]adminLinkedUserBrief, len(userIDs))
	if len(userIDs) > 0 {
		var users []adminLinkedUserBrief
		repository.DB.Model(&model.User{}).Select("id", "phone", "nickname", "status").Where("id IN ?", userIDs).Find(&users)
		for _, user := range users {
			userMap[user.ID] = user
		}
	}

	completionAppMap, err := findLatestClaimedMaterialShopCompletionApplicationsByShopIDs(repository.DB, shopIDs)
	if err != nil {
		response.ServerError(c, "加载失败")
		return
	}

	list := make([]adminMaterialShopListRow, 0, len(shops))
	for _, shop := range shops {
		shop.PlatformDisplayEnabled = service.MaterialShopPlatformDisplayEnabled(&shop)
		shop.MerchantDisplayEnabled = service.MaterialShopMerchantDisplayEnabled(&shop)
		var productCount int64
		repository.DB.Model(&model.MaterialShopProduct{}).Where("shop_id = ? AND status = ?", shop.ID, 1).Count(&productCount)

		visibilityDecision := service.EvaluateMaterialShopPublicVisibility(&shop, productCount)
		visibilityDecision.CurrentLabel = "缺少入驻申请"
		visibilityDecision.EntitySnapshot = service.VisibilityEntitySnapshot{
			ShopID:       &shop.ID,
			ShopVerified: &shop.IsVerified,
		}
		visibilityResult := service.VisibilityResult{
			Visibility: visibilityDecision,
			Actions:    service.VisibilityActions{RejectResubmittable: false},
		}

		if app, ok := findMaterialShopVisibilitySource(shop); ok {
			visibilityResult = adminVisibilityResolver.ResolveMaterialShopApplication(*app, &shop, productCount)
		}

		userInfo, hasUser := userMap[shop.UserID]
		accountBound := shop.UserID > 0 && hasUser
		sourceLabel := resolveMaterialShopSourceLabel(shop)
		completionApp := completionAppMap[shop.ID]
		onboardingStatus := resolveAdminMaterialShopOnboardingStatus(shop, accountBound, completionApp)
		accountStatus := resolveAdminAccountStatus(accountBound, userInfo.Status)
		loginStatus := resolveAdminMaterialShopLoginStatus(shop, accountBound, userInfo.Status)
		completionRequired := accountBound && shop.NeedsOnboardingCompletion
		operatingStatus := resolveAdminMaterialShopOperatingStatus(shop, accountBound, onboardingStatus)
		operatingEnabled := operatingStatus == adminOperatingStatusActive
		completionAppID := uint64(0)
		if completionApp != nil {
			completionAppID = completionApp.ID
		}

		list = append(list, adminMaterialShopListRow{
			MaterialShop:       shop,
			UserPhone:          userInfo.Phone,
			UserNickname:       userInfo.Nickname,
			AccountBound:       accountBound,
			AccountStatus:      accountStatus,
			LoginStatus:        loginStatus,
			LoginEnabled:       loginStatus == adminLoginStatusEnabled,
			CompletionRequired: completionRequired,
			OnboardingStatus:   onboardingStatus,
			OperatingStatus:    operatingStatus,
			OperatingEnabled:   operatingEnabled,
			CompletionAppID:    completionAppID,
			SourceLabel:        sourceLabel,
			Visibility:         visibilityResult.Visibility,
			Actions:            visibilityResult.Actions,
			LegacyInfo:         visibilityResult.LegacyInfo,
		})
	}

	response.Success(c, gin.H{
		"list":  list,
		"total": total,
	})
}

// AdminCreateMaterialShop 创建主材门店
func AdminCreateMaterialShop(c *gin.Context) {
	var req struct {
		Name            string `json:"name" binding:"required"`
		Type            string `json:"type"` // showroom | brand
		CompanyName     string `json:"companyName"`
		Address         string `json:"address"`
		ContactPhone    string `json:"contactPhone"`
		ContactName     string `json:"contactName"`
		MainProducts    string `json:"mainProducts"`
		IsSettled       *bool  `json:"isSettled"`       // nil 默认 true
		CollectedSource string `json:"collectedSource"` // 收录来源
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	isSettled := true
	if req.IsSettled != nil {
		isSettled = *req.IsSettled
	}

	// 已入驻商家仍须走申请流程
	if isSettled {
		response.BadRequest(c, "已入驻主材门店请通过主材商入驻申请创建")
		return
	}

	shop := model.MaterialShop{
		Name:            req.Name,
		Type:            req.Type,
		CompanyName:     req.CompanyName,
		Address:         req.Address,
		ContactPhone:    req.ContactPhone,
		ContactName:     req.ContactName,
		MainProducts:    req.MainProducts,
		IsSettled:       false,
		CollectedSource: req.CollectedSource,
	}
	if shop.Type == "" {
		shop.Type = "showroom"
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}
	response.Success(c, shop)
}

// AdminCompleteMaterialShopAccount 为历史主材门店补全账号
func AdminCompleteMaterialShopAccount(c *gin.Context) {
	shopID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var req struct {
		Phone       string `json:"phone" binding:"required"`
		ContactName string `json:"contactName"`
		Nickname    string `json:"nickname"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	if !utils.ValidatePhone(phone) {
		response.BadRequest(c, "手机号格式不正确")
		return
	}

	tx := repository.DB.Begin()

	var shop model.MaterialShop
	if err := tx.First(&shop, shopID).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "门店不存在")
		return
	}
	beforeShop := shop
	if shop.UserID > 0 {
		tx.Rollback()
		response.BadRequest(c, "该主材门店已绑定账号")
		return
	}

	var existingUser model.User
	userExists := tx.Where("phone = ?", phone).First(&existingUser).Error == nil

	displayName := firstNonEmpty(
		strings.TrimSpace(req.Nickname),
		strings.TrimSpace(req.ContactName),
		strings.TrimSpace(shop.ContactName),
		strings.TrimSpace(shop.Name),
	)
	user, err := createOrLoadUserForMaterialApply(tx, phone, displayName)
	if err != nil {
		tx.Rollback()
		response.Error(c, 500, "补全账号失败: 创建或加载用户失败")
		return
	}

	var duplicateShop model.MaterialShop
	if err := tx.Where("user_id = ? AND id <> ?", user.ID, shop.ID).Order("id DESC").First(&duplicateShop).Error; err == nil {
		tx.Rollback()
		response.BadRequest(c, "该手机号已绑定其他主材商账号，请使用未绑定的手机号")
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		response.Error(c, 500, "校验主材商账号失败")
		return
	}

	var activeProvider model.Provider
	if err := tx.Where("user_id = ? AND status = ?", user.ID, merchantProviderStatusActive).Order("id DESC").First(&activeProvider).Error; err == nil {
		tx.Rollback()
		response.BadRequest(c, "该手机号已绑定其他生效中的服务商身份，请使用未入驻的手机号")
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		response.Error(c, 500, "校验服务商身份失败")
		return
	}

	shopUpdates := map[string]interface{}{
		"user_id":                     user.ID,
		"is_settled":                  true,
		"needs_onboarding_completion": true,
	}
	if strings.TrimSpace(shop.ContactPhone) == "" {
		shopUpdates["contact_phone"] = phone
	}
	if strings.TrimSpace(shop.ContactName) == "" && strings.TrimSpace(req.ContactName) != "" {
		shopUpdates["contact_name"] = strings.TrimSpace(req.ContactName)
	}
	if err := tx.Model(&shop).Updates(shopUpdates).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "绑定主材商账号失败")
		return
	}

	if shop.SourceApplicationID > 0 {
		if err := tx.Model(&model.MaterialShopApplication{}).
			Where("id = ? AND (user_id = 0 OR user_id IS NULL)", shop.SourceApplicationID).
			Update("user_id", user.ID).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "同步申请账号失败")
			return
		}
	}

	shop.UserID = user.ID
	shop.IsSettled = true
	shop.NeedsOnboardingCompletion = true
	if strings.TrimSpace(shop.ContactPhone) == "" {
		shop.ContactPhone = phone
	}
	if strings.TrimSpace(shop.ContactName) == "" && strings.TrimSpace(req.ContactName) != "" {
		shop.ContactName = strings.TrimSpace(req.ContactName)
	}
	identityStatus := resolveMaterialShopIdentityStatus(shop)
	if err := ensureMerchantIdentity(tx, user.ID, merchantIdentityTypeMaterial, shop.ID, adminID, identityStatus); err != nil {
		tx.Rollback()
		response.Error(c, 500, "补全主材商身份失败: "+err.Error())
		return
	}

	if err := (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "claim_material_shop_account",
		ResourceType:  "material_shop",
		ResourceID:    shop.ID,
		Reason:        readAdminReason(c, req.Reason, "认领主材商账号"),
		Result:        "success",
		BeforeState: map[string]interface{}{
			"materialShop": map[string]interface{}{
				"id":                        beforeShop.ID,
				"userId":                    beforeShop.UserID,
				"isSettled":                 beforeShop.IsSettled,
				"needsOnboardingCompletion": beforeShop.NeedsOnboardingCompletion,
			},
		},
		AfterState: map[string]interface{}{
			"materialShop": map[string]interface{}{
				"id":                        shop.ID,
				"userId":                    shop.UserID,
				"isSettled":                 shop.IsSettled,
				"needsOnboardingCompletion": shop.NeedsOnboardingCompletion,
			},
		},
		Metadata: map[string]interface{}{
			"phone":              phone,
			"userId":             user.ID,
			"createdUser":        !userExists,
			"completionRequired": true,
		},
	}); err != nil {
		tx.Rollback()
		response.Error(c, 500, "记录认领审计失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "补全账号失败")
		return
	}

	response.Success(c, gin.H{
		"shopId":                  shop.ID,
		"userId":                  user.ID,
		"phone":                   phone,
		"createdUser":             !userExists,
		"accountBound":            true,
		"sourceLabel":             resolveMaterialShopSourceLabel(shop),
		"loginEnabled":            identityStatus == merchantIdentityStatusActive,
		"completionRequired":      true,
		"onboardingStatus":        merchantOnboardingStatusRequired,
		"operatingEnabled":        false,
		"completionApplicationId": uint64(0),
	})
}

// AdminUpdateMaterialShop 更新主材门店
func AdminUpdateMaterialShop(c *gin.Context) {
	id := c.Param("id")
	var shop model.MaterialShop
	if err := repository.DB.First(&shop, "id = ?", id).Error; err != nil {
		response.NotFound(c, "门店不存在")
		return
	}
	if err := c.ShouldBindJSON(&shop); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := repository.DB.Save(&shop).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, shop)
}

// AdminDeleteMaterialShop 删除主材门店
func AdminDeleteMaterialShop(c *gin.Context) {
	id := c.Param("id")
	if err := repository.DB.Delete(&model.MaterialShop{}, "id = ?", id).Error; err != nil {
		response.ServerError(c, "删除失败")
		return
	}
	response.Success(c, nil)
}

// AdminVerifyMaterialShop 认证主材门店
func AdminVerifyMaterialShop(c *gin.Context) {
	id := c.Param("id")
	adminID := c.GetUint64("adminId")
	var req struct {
		Verified bool `json:"verified"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	tx := repository.DB.Begin()

	var shop model.MaterialShop
	if err := tx.First(&shop, "id = ?", id).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "门店不存在")
		return
	}

	if err := tx.Model(&shop).Update("is_verified", req.Verified).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "更新失败")
		return
	}

	shop.IsVerified = req.Verified
	if shop.UserID > 0 {
		if err := ensureMerchantIdentity(tx, shop.UserID, merchantIdentityTypeMaterial, shop.ID, adminID, resolveMaterialShopIdentityStatus(shop)); err != nil {
			tx.Rollback()
			response.Error(c, 500, "同步主材商身份失败: "+err.Error())
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
}

// AdminUpdateMaterialShopStatus 更新主材门店状态（封禁/解封）
func AdminUpdateMaterialShopStatus(c *gin.Context) {
	id := c.Param("id")
	adminID := c.GetUint64("adminId")

	var req struct {
		Status int8 `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if req.Status != 0 && req.Status != 1 {
		response.BadRequest(c, "状态值无效")
		return
	}

	tx := repository.DB.Begin()

	var shop model.MaterialShop
	if err := tx.First(&shop, "id = ?", id).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "门店不存在")
		return
	}

	if err := tx.Table(model.MaterialShop{}.TableName()).Where("id = ?", id).Update("status", req.Status).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "更新失败")
		return
	}

	shop.Status = &req.Status
	if shop.UserID > 0 {
		if err := ensureMerchantIdentity(tx, shop.UserID, merchantIdentityTypeMaterial, shop.ID, adminID, resolveMaterialShopIdentityStatus(shop)); err != nil {
			tx.Rollback()
			response.Error(c, 500, "同步主材商身份失败: "+err.Error())
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.Success(c, nil)
}

func AdminUpdateMaterialShopPlatformDisplay(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if !service.SupportsMaterialShopPlatformDisplayEnabled() {
		response.Error(c, 503, repository.SchemaServiceUnavailableMessage("主材商平台展示开关"))
		return
	}
	if err := repository.DB.Model(&model.MaterialShop{}).Where("id = ?", id).Update("platform_display_enabled", req.Enabled).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
}

// ==================== Admin 退款管理 ====================

// AdminRefundIntentFee 管理员手动退款意向金
func AdminRefundIntentFee(c *gin.Context) {
	bookingID := parseUint64(c.Param("bookingId"))

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 调用退款服务
	refundSvc := &service.RefundService{}
	if err := refundSvc.RefundIntentFee(bookingID, service.RefundScenarioAdminManual, input.Reason); err != nil {
		if strings.Contains(err.Error(), "退款处理中") {
			response.Success(c, gin.H{
				"message": err.Error(),
			})
			return
		}
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "退款成功",
	})
}

// AdminGetRefundableBookings 获取可退款的预约列表
func AdminGetRefundableBookings(c *gin.Context) {
	refundSvc := &service.RefundService{}
	bookings, err := refundSvc.GetRefundableBookings()
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	response.Success(c, gin.H{
		"bookings": bookings,
		"count":    len(bookings),
	})
}

// ==================== Admin 系统配置管理 ====================

// AdminGetSystemConfigs 获取所有系统配置
func AdminGetSystemConfigs(c *gin.Context) {
	configSvc := &service.ConfigService{}
	_ = configSvc.InitDefaultConfigs()

	var configs []model.SystemConfig
	if err := repository.DB.Order("key ASC").Find(&configs).Error; err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	configs = append(configs,
		model.SystemConfig{
			Key:         "payment.channel.wechat.runtime_ready",
			Value:       strconv.FormatBool(configSvc.ValidatePaymentChannelRuntimeConfig(model.PaymentChannelWechat) == nil),
			Description: "微信支付运行时环境变量是否完整",
			Type:        "boolean",
		},
		model.SystemConfig{
			Key:         "payment.channel.alipay.runtime_ready",
			Value:       strconv.FormatBool(configSvc.ValidatePaymentChannelRuntimeConfig(model.PaymentChannelAlipay) == nil),
			Description: "支付宝运行时环境变量是否完整",
			Type:        "boolean",
		},
	)

	response.Success(c, gin.H{
		"configs": configs,
		"count":   len(configs),
	})
}

// AdminUpdateSystemConfig 更新单个系统配置
func AdminUpdateSystemConfig(c *gin.Context) {
	key := c.Param("key")
	adminID := c.GetUint64("admin_id")

	var input struct {
		Value       string `json:"value" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	configSvc := &service.ConfigService{}
	var beforeConfig model.SystemConfig
	_ = repository.DB.Where("key = ?", key).First(&beforeConfig).Error
	if err := configSvc.SetConfig(key, input.Value, input.Description); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	// 清除配置缓存
	configSvc.ClearCache()
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "update_system_config",
		ResourceType:  "system_config",
		ResourceID:    0,
		Reason:        readAdminReason(c, "更新系统配置"),
		Result:        "success",
		BeforeState: map[string]interface{}{
			"key":         beforeConfig.Key,
			"value":       beforeConfig.Value,
			"description": beforeConfig.Description,
		},
		AfterState: map[string]interface{}{
			"key":         key,
			"value":       input.Value,
			"description": input.Description,
		},
		Metadata: map[string]interface{}{
			"key": key,
		},
	})

	response.Success(c, gin.H{
		"message": "配置更新成功",
	})
}

// AdminBatchUpdateSystemConfigs 批量更新系统配置
func AdminBatchUpdateSystemConfigs(c *gin.Context) {
	var input map[string]string
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	delete(input, "reason")
	delete(input, "remark")
	delete(input, "note")
	delete(input, "adminNotes")
	delete(input, "recentReauthProof")

	configSvc := &service.ConfigService{}
	_ = configSvc.InitDefaultConfigs()

	for key, value := range input {
		if err := configSvc.ValidatePaymentChannelToggle(key, value); err != nil {
			response.Error(c, 400, err.Error())
			return
		}
	}

	// 批量更新，SetConfig需要3个参数，这里简化处理
	for key, value := range input {
		if err := configSvc.SetConfig(key, value, ""); err != nil {
			log.Printf("[AdminBatchUpdateSystemConfigs] Failed to update %s: %v", key, err)
		}
	}

	// 清除配置缓存
	configSvc.ClearCache()

	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    c.GetUint64("admin_id"),
		OperationType: "batch_update_system_configs",
		ResourceType:  "system_config",
		ResourceID:    0,
		Reason:        readAdminReason(c, "批量更新系统配置"),
		Result:        "success",
		Metadata: map[string]interface{}{
			"keys":    maps.Keys(input),
			"updated": len(input),
		},
	})

	response.Success(c, gin.H{
		"message": "配置批量更新成功",
		"updated": len(input),
	})
}

// ==================== Helper ====================

func parseInt(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	var v int
	_, _ = fmt.Sscanf(s, "%d", &v)
	if v <= 0 {
		return defaultVal
	}
	// ✅ 限制最大值防止DoS
	if v > 100 {
		return 100
	}
	return v
}
