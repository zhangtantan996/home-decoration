package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// CreateInspectionChecklist 创建验收清单
func CreateInspectionChecklist(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "项目ID无效")
		return
	}

	var req struct {
		MilestoneID uint64                 `json:"milestoneId" binding:"required"`
		Category    string                 `json:"category" binding:"required"`
		Items       []model.InspectionItem `json:"items" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	userID := getCurrentUserID(c)
	providerID := c.GetUint64("providerId")
	svc := &service.InspectionService{}
	checklist, err := svc.CreateInspectionChecklist(projectID, req.MilestoneID, userID, providerID, req.Category, req.Items)
	if err != nil {
		respondInspectionError(c, "create inspection checklist", err)
		return
	}

	response.Success(c, checklist)
}

// GetInspectionChecklist 获取验收清单
func GetInspectionChecklist(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "项目ID无效")
		return
	}

	milestoneID, err := strconv.ParseUint(c.Query("milestoneId"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "节点ID无效")
		return
	}

	userID := getCurrentUserID(c)
	providerID := c.GetUint64("providerId")
	svc := &service.InspectionService{}
	checklist, err := svc.GetInspectionChecklist(projectID, milestoneID, userID, providerID)
	if err != nil {
		respondInspectionError(c, "get inspection checklist", err)
		return
	}

	// 解析 Items JSON
	var items []model.InspectionItem
	if err := json.Unmarshal([]byte(checklist.Items), &items); err == nil {
		type ChecklistResponse struct {
			model.InspectionChecklist
			ItemsList []model.InspectionItem `json:"itemsList"`
		}
		resp := ChecklistResponse{
			InspectionChecklist: *checklist,
			ItemsList:           items,
		}
		response.Success(c, resp)
		return
	}

	response.Success(c, checklist)
}

// UpdateInspectionChecklist 更新验收清单
func UpdateInspectionChecklist(c *gin.Context) {
	_, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "项目ID无效")
		return
	}

	checklistID, err := strconv.ParseUint(c.Param("inspection_id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "验收清单ID无效")
		return
	}

	var req struct {
		Items []model.InspectionItem `json:"items" binding:"required"`
		Notes string                 `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	userID := getCurrentUserID(c)
	providerID := c.GetUint64("providerId")
	svc := &service.InspectionService{}
	checklist, err := svc.UpdateInspectionChecklist(checklistID, userID, providerID, req.Items, req.Notes)
	if err != nil {
		respondInspectionError(c, "update inspection checklist", err)
		return
	}

	response.Success(c, checklist)
}

// AcceptAllMilestones 整体验收一次性放款
func AcceptAllMilestones(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "项目ID无效")
		return
	}

	userID := getCurrentUserID(c)
	svc := &service.InspectionService{}
	if err := svc.AcceptAllMilestones(projectID, userID); err != nil {
		respondInspectionError(c, "accept all milestones", err)
		return
	}

	response.Success(c, gin.H{
		"message": "整体验收成功，款项已全部放款",
	})
}

// GetInspectionTemplate 获取验收清单模板
func GetInspectionTemplate(c *gin.Context) {
	category := c.Query("category")
	if category == "" {
		response.Error(c, http.StatusBadRequest, "分类不能为空")
		return
	}

	svc := &service.InspectionService{}
	template, err := svc.GetInspectionTemplate(category)
	if err != nil {
		respondInspectionError(c, "get inspection template", err)
		return
	}

	// 解析 Items JSON
	var items []model.InspectionItem
	if err := json.Unmarshal([]byte(template.Items), &items); err == nil {
		type TemplateResponse struct {
			model.InspectionTemplate
			ItemsList []model.InspectionItem `json:"itemsList"`
		}
		resp := TemplateResponse{
			InspectionTemplate: *template,
			ItemsList:          items,
		}
		response.Success(c, resp)
		return
	}

	response.Success(c, template)
}

// SubmitInspection 商家提交验收申请
func SubmitInspection(c *gin.Context) {
	milestoneID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "节点ID无效")
		return
	}

	providerID := c.GetUint64("providerId")
	svc := &service.InspectionService{}
	if err := svc.SubmitInspection(milestoneID, providerID); err != nil {
		respondInspectionError(c, "submit inspection", err)
		return
	}

	response.Success(c, gin.H{
		"message": "验收申请已提交",
	})
}

// InspectMilestone 用户验收节点
func InspectMilestone(c *gin.Context) {
	milestoneID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "节点ID无效")
		return
	}

	var req struct {
		Passed bool   `json:"passed" binding:"required"`
		Notes  string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	userID := getCurrentUserID(c)
	svc := &service.InspectionService{}
	if err := svc.InspectMilestone(milestoneID, userID, req.Passed, req.Notes); err != nil {
		respondInspectionError(c, "inspect milestone", err)
		return
	}

	message := "验收通过，款项已放款"
	if !req.Passed {
		message = "验收不通过，已通知商家整改"
	}

	response.Success(c, gin.H{
		"message": message,
	})
}

// RequestRectification 用户要求整改
func RequestRectification(c *gin.Context) {
	milestoneID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "节点ID无效")
		return
	}

	var req struct {
		Notes string `json:"notes" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	userID := getCurrentUserID(c)
	svc := &service.InspectionService{}
	if err := svc.RequestRectification(milestoneID, userID, req.Notes); err != nil {
		respondInspectionError(c, "request rectification", err)
		return
	}

	response.Success(c, gin.H{
		"message": "整改要求已发送",
	})
}

// ResubmitInspection 商家重新提交验收
func ResubmitInspection(c *gin.Context) {
	milestoneID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "节点ID无效")
		return
	}

	var req struct {
		Notes string `json:"notes" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	providerID := c.GetUint64("providerId")
	svc := &service.InspectionService{}
	if err := svc.ResubmitInspection(milestoneID, providerID, req.Notes); err != nil {
		respondInspectionError(c, "resubmit inspection", err)
		return
	}

	response.Success(c, gin.H{
		"message": "整改完成，已重新提交验收",
	})
}

func respondInspectionError(c *gin.Context, operation string, err error) {
	if err == nil {
		return
	}

	message := strings.TrimSpace(err.Error())
	switch {
	case strings.Contains(message, "无权"):
		response.Forbidden(c, safeInspectionMessage(message, "无权操作"))
	case strings.Contains(message, "不存在"), strings.Contains(message, "未找到"):
		response.NotFound(c, safeInspectionMessage(message, "验收记录不存在"))
	case strings.Contains(message, "已验收"),
		strings.Contains(message, "未提交验收"),
		strings.Contains(message, "节点未提交验收"),
		strings.Contains(message, "只有验收不通过"):
		response.Conflict(c, safeInspectionConflictMessage(message))
	case strings.Contains(message, "不能为空"):
		response.BadRequest(c, safeInspectionMessage(message, "参数错误"))
	default:
		log.Printf("[Inspection] %s failed: %v", operation, err)
		response.ServerError(c, "操作失败，请稍后重试")
	}
}

func safeInspectionMessage(message, fallback string) string {
	if strings.TrimSpace(message) == "" {
		return fallback
	}
	return message
}

func safeInspectionConflictMessage(message string) string {
	switch {
	case strings.Contains(message, "只有验收不通过"):
		return "当前节点暂不能重新提交验收"
	case strings.Contains(message, "未提交验收"):
		return "当前节点尚未提交验收"
	case strings.Contains(message, "已验收"):
		return "当前节点已验收"
	default:
		return "当前节点状态不允许此操作"
	}
}
