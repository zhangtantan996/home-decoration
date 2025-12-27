package handler

import (
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== Admin 统计 API ====================

// AdminStatsOverview 概览统计
func AdminStatsOverview(c *gin.Context) {
	var stats struct {
		UserCount         int64   `json:"userCount"`
		TodayNewUsers     int64   `json:"todayNewUsers"`
		ProviderCount     int64   `json:"providerCount"`
		DesignerCount     int64   `json:"designerCount"`
		CompanyCount      int64   `json:"companyCount"`
		ForemanCount      int64   `json:"foremanCount"`
		ProjectCount      int64   `json:"projectCount"`
		ActiveProjects    int64   `json:"activeProjects"`
		CompletedProjects int64   `json:"completedProjects"`
		BookingCount      int64   `json:"bookingCount"`
		PendingBookings   int64   `json:"pendingBookings"`
		MaterialShopCount int64   `json:"materialShopCount"`
		MonthlyGMV        float64 `json:"monthlyGMV"`
	}

	today := time.Now().Truncate(24 * time.Hour)

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
	today := time.Now().Truncate(24 * time.Hour)

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

	var users []model.User
	var total int64

	db := repository.DB.Model(&model.User{})
	if keyword != "" {
		db = db.Where("phone LIKE ? OR nickname LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if userType != "" {
		db = db.Where("user_type = ?", userType)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&users)

	response.Success(c, gin.H{
		"list":  users,
		"total": total,
	})
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

// ==================== Admin 服务商管理 ====================

// AdminListProviders 服务商列表
func AdminListProviders(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	providerType := c.Query("type")
	verified := c.Query("verified")

	var providers []model.Provider
	var total int64

	db := repository.DB.Model(&model.Provider{})
	if providerType != "" {
		db = db.Where("provider_type = ?", providerType)
	}
	if verified == "true" {
		db = db.Where("verified = true")
	} else if verified == "false" {
		db = db.Where("verified = false")
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&providers)

	response.Success(c, gin.H{
		"list":  providers,
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
		SubType         string `json:"subType"`
		Specialty       string `json:"specialty"`
		YearsExperience int    `json:"yearsExperience"`
		Status          int8   `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	provider := model.Provider{
		UserID:          req.UserId,
		ProviderType:    req.ProviderType,
		CompanyName:     req.CompanyName,
		SubType:         req.SubType,
		Specialty:       req.Specialty,
		YearsExperience: req.YearsExperience,
		Status:          req.Status,
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
		CompanyName     string `json:"companyName"`
		SubType         string `json:"subType"`
		Specialty       string `json:"specialty"`
		YearsExperience int    `json:"yearsExperience"`
		Status          int8   `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	updates := map[string]interface{}{}
	if req.CompanyName != "" {
		updates["company_name"] = req.CompanyName
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
	updates["status"] = req.Status

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

	response.Success(c, gin.H{
		"list":  reviews,
		"total": total,
	})
}

// AdminDeleteReview 删除评价
func AdminDeleteReview(c *gin.Context) {
	id := c.Param("id")
	if err := repository.DB.Delete(&model.ProviderReview{}, "id = ?", id).Error; err != nil {
		response.ServerError(c, "删除失败")
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

	var shops []model.MaterialShop
	var total int64

	db := repository.DB.Model(&model.MaterialShop{})
	if shopType != "" {
		db = db.Where("type = ?", shopType)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).Order("id DESC").Find(&shops)

	response.Success(c, gin.H{
		"list":  shops,
		"total": total,
	})
}

// AdminCreateMaterialShop 创建主材门店
func AdminCreateMaterialShop(c *gin.Context) {
	var shop model.MaterialShop
	if err := c.ShouldBindJSON(&shop); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := repository.DB.Create(&shop).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}
	response.Success(c, shop)
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
	var req struct {
		Verified bool `json:"verified"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := repository.DB.Model(&model.MaterialShop{}).Where("id = ?", id).Update("is_verified", req.Verified).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}
	response.Success(c, nil)
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
