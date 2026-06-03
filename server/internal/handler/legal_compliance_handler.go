package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func AdminGetLegalComplianceCurrent(c *gin.Context) {
	view, err := (&service.LegalComplianceService{}).CurrentView()
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"legalCompliance": view})
}

func AdminGetLegalComplianceDraft(c *gin.Context) {
	view, err := (&service.LegalComplianceService{}).DraftView()
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{"draft": view})
}

func AdminSaveLegalComplianceDraftDocument(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	var input struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	view, err := (&service.LegalComplianceService{}).SaveDraftDocument(slug, input.Content)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	response.Success(c, gin.H{
		"message": "协议草稿已保存，正式发布前不会影响前台展示",
		"draft":   view,
	})
}

func AdminPublishLegalComplianceDraft(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	var input struct {
		VersionBump    string `json:"versionBump"`
		EffectiveAt    string `json:"effectiveAt"`
		ChangeSummary  string `json:"changeSummary"`
		Reason         string `json:"reason"`
		RecentReauthID string `json:"recentReauthProof"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	reason := readAdminReason(c, input.Reason, "发布协议与规则")
	view, err := (&service.LegalComplianceService{}).PublishDraft(service.PublishLegalComplianceInput{
		VersionBump:   input.VersionBump,
		EffectiveAt:   input.EffectiveAt,
		ChangeSummary: input.ChangeSummary,
		Reason:        reason,
		AdminID:       adminID,
	})
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	_ = (&service.AuditLogService{}).CreateBusinessRecord(&service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    adminID,
		OperationType: "publish_legal_compliance_release",
		ResourceType:  "legal_compliance_release",
		ResourceID:    view.ID,
		Reason:        reason,
		Result:        "success",
		AfterState: map[string]interface{}{
			"id":            view.ID,
			"version":       view.Version,
			"effectiveAt":   view.EffectiveAt,
			"publishedAt":   view.PublishedAt,
			"contentHash":   view.ContentHash,
			"documentCount": len(view.Documents),
		},
		Metadata: map[string]interface{}{
			"changeSummary": view.ChangeSummary,
			"versionBump":   input.VersionBump,
		},
	})
	response.Success(c, gin.H{
		"message": "协议包发布成功",
		"release": view,
	})
}

func AdminListLegalComplianceReleases(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	items, total, err := (&service.LegalComplianceService{}).ListReleases(page, pageSize)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, gin.H{
		"items":    items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func AdminGetLegalComplianceRelease(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, 400, "版本ID不正确")
		return
	}
	view, err := (&service.LegalComplianceService{}).GetRelease(id)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	if view == nil {
		response.Error(c, 404, "协议版本不存在")
		return
	}
	response.Success(c, gin.H{"release": view})
}
