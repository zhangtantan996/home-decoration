package handler

import (
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/timeutil"

	"github.com/gin-gonic/gin"
)

var (
	adminFinanceService               = service.NewAdminFinanceService()
	adminFinanceReconciliationService = &service.FinanceReconciliationService{}
	adminAuditService                 = &service.AuditLogService{}
)

func AdminGetFinanceOverview(c *gin.Context) {
	result, err := adminFinanceService.GetOverview()
	if err != nil {
		response.ServerError(c, "获取资金概览失败")
		return
	}
	response.Success(c, result)
}

func AdminExportTransactions(c *gin.Context) {
	payload, err := adminFinanceService.ExportTransactions(service.AdminFinanceTransactionFilter{
		Type:      c.Query("type"),
		ProjectID: parseUint64(c.Query("projectId")),
		StartDate: c.Query("startDate"),
		EndDate:   c.Query("endDate"),
	})
	if err != nil {
		response.ServerError(c, "导出交易流水失败")
		return
	}

	filename := fmt.Sprintf("finance-transactions-%s.csv", time.Now().Format("20060102-150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.QueryEscape(filename)))
	c.Data(200, "text/csv; charset=utf-8", payload)
}

func AdminListPaymentOrders(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 20)
	items, total, err := adminFinanceService.ListPaymentOrders(service.AdminPaymentOrderFilter{
		Channel:      c.Query("channel"),
		Status:       c.Query("status"),
		BizType:      c.Query("bizType"),
		FundScene:    c.Query("fundScene"),
		RefundStatus: c.Query("refundStatus"),
		OutTradeNo:   c.Query("outTradeNo"),
		StartDate:    c.Query("startDate"),
		EndDate:      c.Query("endDate"),
		Page:         page,
		PageSize:     pageSize,
	})
	if err != nil {
		response.ServerError(c, "获取支付单列表失败")
		return
	}
	response.Success(c, gin.H{
		"list":     items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func AdminGetPaymentOrderDetail(c *gin.Context) {
	paymentOrderID := parseUint64(c.Param("id"))
	if paymentOrderID == 0 {
		response.BadRequest(c, "无效支付单ID")
		return
	}
	detail, err := adminFinanceService.GetPaymentOrderDetail(paymentOrderID)
	if err != nil {
		response.Error(c, 404, err.Error())
		return
	}
	response.Success(c, detail)
}

func AdminFreezeFunds(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	var input service.FreezeFundsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	result, err := adminFinanceService.FreezeFunds(adminID, &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "资金已冻结", "escrow": result})
}

func AdminUnfreezeFunds(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	var input service.UnfreezeFundsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	result, err := adminFinanceService.UnfreezeFunds(adminID, &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "资金已解冻", "escrow": result})
}

func AdminManualReleaseFunds(c *gin.Context) {
	adminID := c.GetUint64("adminId")
	var input service.ManualReleaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	result, err := adminFinanceService.ManualRelease(adminID, &input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "手动放款成功", "transaction": result})
}

func AdminListFinanceReconciliations(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 20)

	list, total, err := adminFinanceReconciliationService.ListFinanceReconciliations(service.FinanceReconciliationFilter{
		Status:    c.Query("status"),
		StartDate: c.Query("startDate"),
		EndDate:   c.Query("endDate"),
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		response.ServerError(c, "获取资金对账列表失败")
		return
	}

	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func AdminRunFinanceReconciliation(c *gin.Context) {
	targetDate := timeutil.Now().AddDate(0, 0, -1)
	if rawDate := strings.TrimSpace(c.Query("date")); rawDate != "" {
		parsed, err := timeutil.ParseDate(rawDate)
		if err != nil {
			response.BadRequest(c, "日期格式错误，应为 YYYY-MM-DD")
			return
		}
		targetDate = parsed
	}

	result, err := adminFinanceReconciliationService.RunDailyReconciliation(targetDate)
	if err != nil {
		response.ServerError(c, "执行资金对账失败")
		return
	}
	response.Success(c, gin.H{"message": "资金对账执行完成", "item": result})
}

func AdminClaimFinanceReconciliation(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	reconciliationID := parseUint64(c.Param("id"))

	var input struct {
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&input); err != nil && !errors.Is(err, io.EOF) {
		response.BadRequest(c, "参数错误")
		return
	}

	result, err := adminFinanceReconciliationService.ClaimFinanceReconciliation(reconciliationID, adminID, input.Note)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "资金对账已认领", "item": result})
}

func AdminResolveFinanceReconciliation(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	reconciliationID := parseUint64(c.Param("id"))

	var input struct {
		Note string `json:"note" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "请填写处理结果")
		return
	}

	result, err := adminFinanceReconciliationService.ResolveFinanceReconciliation(reconciliationID, adminID, input.Note)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "资金对账已处理", "item": result})
}

func AdminListAuditLogs(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 20)
	recordKind := strings.TrimSpace(c.DefaultQuery("recordKind", "business"))
	list, total, err := adminAuditService.ListAdminAuditLogs(service.AdminAuditLogFilter{
		RecordKind:    recordKind,
		OperationType: c.Query("operationType"),
		ResourceType:  c.Query("resourceType"),
		StartDate:     c.Query("startDate"),
		EndDate:       c.Query("endDate"),
		Page:          page,
		PageSize:      pageSize,
	})
	if err != nil {
		response.ServerError(c, "获取审计日志失败")
		return
	}
	fullAccess := adminCanViewFullAuditPayload(c)
	if !fullAccess {
		list = redactAdminAuditLogDetails(list)
	}
	response.Success(c, gin.H{
		"list":       list,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"fullAccess": fullAccess,
	})
}

func AdminExportAuditLogs(c *gin.Context) {
	if !adminCanViewFullAuditPayload(c) {
		response.Forbidden(c, "仅高权限管理员可导出完整审计日志")
		return
	}
	recordKind := strings.TrimSpace(c.DefaultQuery("recordKind", "business"))
	payload, err := adminAuditService.ExportAdminAuditLogs(service.AdminAuditLogFilter{
		RecordKind:    recordKind,
		OperationType: c.Query("operationType"),
		ResourceType:  c.Query("resourceType"),
		StartDate:     c.Query("startDate"),
		EndDate:       c.Query("endDate"),
	})
	if err != nil {
		response.ServerError(c, "导出审计日志失败")
		return
	}

	filename := fmt.Sprintf("audit-logs-%s.csv", time.Now().Format("20060102-150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.QueryEscape(filename)))
	c.Data(200, "text/csv; charset=utf-8", payload)
}

func adminCanViewFullAuditPayload(c *gin.Context) bool {
	if c == nil {
		return false
	}
	if isSuperAdmin, _ := c.Get("is_super"); isSuperAdmin == true {
		return true
	}
	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		return false
	}

	var count int64
	err := repository.DB.Table("sys_admin_roles").
		Joins("JOIN sys_roles ON sys_roles.id = sys_admin_roles.role_id AND sys_roles.status = 1").
		Where("sys_admin_roles.admin_id = ?", adminID).
		Where("sys_roles.key IN ?", []string{
			"super_admin",
			service.ReservedRoleSystemAdmin,
			service.ReservedRoleSecurityAdmin,
			service.ReservedRoleSecurityAudit,
		}).
		Limit(1).
		Count(&count).Error
	return err == nil && count > 0
}

func redactAdminAuditLogDetails(list []service.AdminAuditLogItem) []service.AdminAuditLogItem {
	const restrictedMessage = "完整审计内容仅高权限管理员可见"
	redacted := make([]service.AdminAuditLogItem, len(list))
	copy(redacted, list)
	restrictedPayload := map[string]interface{}{
		"restricted": true,
		"message":    restrictedMessage,
	}
	for i := range redacted {
		redacted[i].RequestBody = ""
		redacted[i].BeforeState = restrictedPayload
		redacted[i].AfterState = restrictedPayload
		redacted[i].Metadata = restrictedPayload
		redacted[i].ClientIP = ""
		redacted[i].UserAgent = ""
	}
	return redacted
}
