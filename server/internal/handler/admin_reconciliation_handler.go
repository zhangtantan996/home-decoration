package handler

import (
	"strconv"
	"strings"

	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminReconciliationList 对账记录列表
func AdminReconciliationList(c *gin.Context) {
	reconcileType := strings.TrimSpace(c.Query("reconcileType"))
	status := strings.TrimSpace(c.Query("status"))
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("pageSize"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	reconciliationService := service.NewReconciliationService(repository.DB)
	output, err := reconciliationService.ListReconciliationRecords(&service.ListReconciliationRecordsInput{
		ReconcileType: reconcileType,
		Status:        status,
		Page:          page,
		PageSize:      pageSize,
	})
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	list := make([]gin.H, len(output.List))
	for i, record := range output.List {
		list[i] = gin.H{
			"id":               record.ID,
			"reconcileDate":    record.ReconcileDate,
			"reconcileType":    record.ReconcileType,
			"channel":          record.Channel,
			"totalCount":       record.TotalCount,
			"matchedCount":     record.MatchedCount,
			"differenceCount":  record.DifferenceCount,
			"totalAmount":      record.TotalAmount,
			"differenceAmount": record.DifferenceAmount,
			"status":           record.Status,
			"createdAt":        record.CreatedAt,
		}
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    output.Total,
		"page":     output.Page,
		"pageSize": output.PageSize,
	})
}

// AdminReconciliationDetail 对账记录详情
func AdminReconciliationDetail(c *gin.Context) {
	recordID := parseUint64(c.Param("id"))
	if recordID == 0 {
		response.Error(c, 400, "无效的对账记录ID")
		return
	}

	reconciliationService := service.NewReconciliationService(repository.DB)
	record, err := reconciliationService.GetReconciliationDetail(recordID)
	if err != nil {
		response.Error(c, 404, err.Error())
		return
	}

	response.Success(c, gin.H{
		"id":               record.ID,
		"reconcileDate":    record.ReconcileDate,
		"reconcileType":    record.ReconcileType,
		"channel":          record.Channel,
		"totalCount":       record.TotalCount,
		"matchedCount":     record.MatchedCount,
		"differenceCount":  record.DifferenceCount,
		"totalAmount":      record.TotalAmount,
		"differenceAmount": record.DifferenceAmount,
		"status":           record.Status,
		"errorMessage":     record.ErrorMessage,
		"completedAt":      record.CompletedAt,
		"createdAt":        record.CreatedAt,
		"updatedAt":        record.UpdatedAt,
	})
}

// AdminReconciliationDifferences 差异明细列表
func AdminReconciliationDifferences(c *gin.Context) {
	recordID := parseUint64(c.Param("id"))
	if recordID == 0 {
		response.Error(c, 400, "无效的对账记录ID")
		return
	}

	differenceType := strings.TrimSpace(c.Query("differenceType"))
	resolvedStr := strings.TrimSpace(c.Query("resolved"))
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("pageSize"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	var resolved *bool
	if resolvedStr != "" {
		val := resolvedStr == "true" || resolvedStr == "1"
		resolved = &val
	}

	reconciliationService := service.NewReconciliationService(repository.DB)
	output, err := reconciliationService.ListDifferences(&service.ListDifferencesInput{
		ReconciliationID: recordID,
		DifferenceType:   differenceType,
		Resolved:         resolved,
		Page:             page,
		PageSize:         pageSize,
	})
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	list := make([]gin.H, len(output.List))
	for i, diff := range output.List {
		list[i] = gin.H{
			"id":              diff.ID,
			"differenceType":  diff.DifferenceType,
			"outTradeNo":      diff.OutTradeNo,
			"providerTradeNo": diff.ProviderTradeNo,
			"platformAmount":  diff.PlatformAmount,
			"channelAmount":   diff.ChannelAmount,
			"platformStatus":  diff.PlatformStatus,
			"channelStatus":   diff.ChannelStatus,
			"handleStatus":    diff.HandleStatus,
			"resolved":        diff.Resolved,
			"resolvedAt":      diff.ResolvedAt,
			"resolvedBy":      diff.ResolvedBy,
			"resolveNotes":    diff.ResolveNotes,
			"ignoreReason":    diff.IgnoreReason,
			"solution":        diff.Solution,
			"createdAt":       diff.CreatedAt,
		}
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    output.Total,
		"page":     output.Page,
		"pageSize": output.PageSize,
	})
}

// AdminReconciliationResolve 标记差异已处理
func AdminReconciliationResolve(c *gin.Context) {
	diffID := parseUint64(c.Param("id"))
	if diffID == 0 {
		response.Error(c, 400, "无效的差异记录ID")
		return
	}

	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Error(c, 401, "未授权")
		return
	}

	var input struct {
		ResolveNotes string `json:"resolveNotes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	reconciliationService := service.NewReconciliationService(repository.DB)
	err := reconciliationService.ResolveDifference(&service.ResolveDifferenceInput{
		DifferenceID: diffID,
		ResolvedBy:   adminID,
		ResolveNotes: input.ResolveNotes,
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "差异已标记为已处理",
	})
}

// AdminReconciliationDifferenceInvestigate 标记差异为调查中
func AdminReconciliationDifferenceInvestigate(c *gin.Context) {
	diffID := parseUint64(c.Param("id"))
	if diffID == 0 {
		response.Error(c, 400, "无效的差异记录ID")
		return
	}

	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Error(c, 401, "未授权")
		return
	}

	var input struct {
		Notes string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	reconciliationService := service.NewReconciliationService(repository.DB)
	err := reconciliationService.InvestigateDifference(&service.InvestigateDifferenceInput{
		DifferenceID: diffID,
		AdminID:      adminID,
		Notes:        input.Notes,
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "差异已标记为调查中",
	})
}

// AdminReconciliationDifferenceIgnore 忽略差异
func AdminReconciliationDifferenceIgnore(c *gin.Context) {
	diffID := parseUint64(c.Param("id"))
	if diffID == 0 {
		response.Error(c, 400, "无效的差异记录ID")
		return
	}

	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Error(c, 401, "未授权")
		return
	}

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "忽略原因不能为空")
		return
	}

	reconciliationService := service.NewReconciliationService(repository.DB)
	err := reconciliationService.IgnoreDifference(&service.IgnoreDifferenceInput{
		DifferenceID: diffID,
		AdminID:      adminID,
		Reason:       input.Reason,
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "差异已忽略",
	})
}

// AdminReconciliationDifferenceResolve 解决差异
func AdminReconciliationDifferenceResolve(c *gin.Context) {
	diffID := parseUint64(c.Param("id"))
	if diffID == 0 {
		response.Error(c, 400, "无效的差异记录ID")
		return
	}

	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Error(c, 401, "未授权")
		return
	}

	var input struct {
		Solution string `json:"solution" binding:"required"`
		Notes    string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "解决方案不能为空")
		return
	}

	reconciliationService := service.NewReconciliationService(repository.DB)
	err := reconciliationService.ResolveDifferenceEnhanced(&service.ResolveDifferenceEnhancedInput{
		DifferenceID: diffID,
		AdminID:      adminID,
		Solution:     input.Solution,
		Notes:        input.Notes,
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "差异已解决",
	})
}
