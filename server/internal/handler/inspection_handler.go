package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

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
		MilestoneID uint64                   `json:"milestoneId" binding:"required"`
		Category    string                   `json:"category" binding:"required"`
		Items       []model.InspectionItem   `json:"items" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	userID := c.GetUint64("userID")
	svc := &service.InspectionService{}
	checklist, err := svc.CreateInspectionChecklist(projectID, req.MilestoneID, userID, req.Category, req.Items)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
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

	svc := &service.InspectionService{}
	checklist, err := svc.GetInspectionChecklist(projectID, milestoneID)
	if err != nil {
		response.Error(c, http.StatusNotFound, err.Error())
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
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	userID := c.GetUint64("userID")
	svc := &service.InspectionService{}
	checklist, err := svc.UpdateInspectionChecklist(checklistID, userID, req.Items, req.Notes)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
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

	userID := c.GetUint64("userID")
	svc := &service.InspectionService{}
	if err := svc.AcceptAllMilestones(projectID, userID); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
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
		response.Error(c, http.StatusInternalServerError, err.Error())
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

	providerID := c.GetUint64("userID")
	svc := &service.InspectionService{}
	if err := svc.SubmitInspection(milestoneID, providerID); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
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
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	userID := c.GetUint64("userID")
	svc := &service.InspectionService{}
	if err := svc.InspectMilestone(milestoneID, userID, req.Passed, req.Notes); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
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
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	userID := c.GetUint64("userID")
	svc := &service.InspectionService{}
	if err := svc.RequestRectification(milestoneID, userID, req.Notes); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
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
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	providerID := c.GetUint64("userID")
	svc := &service.InspectionService{}
	if err := svc.ResubmitInspection(milestoneID, providerID, req.Notes); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"message": "整改完成，已重新提交验收",
	})
}
