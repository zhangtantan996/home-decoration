package handler

import (
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

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

func AdminFreezeFunds(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
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
	adminID := c.GetUint64("admin_id")
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
	adminID := c.GetUint64("admin_id")
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
	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func AdminExportAuditLogs(c *gin.Context) {
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
