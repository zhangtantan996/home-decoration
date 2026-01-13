package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
)

type DictionaryHandler struct {
	service *service.DictionaryService
}

func NewDictionaryHandler(service *service.DictionaryService) *DictionaryHandler {
	return &DictionaryHandler{service: service}
}

// ============ 公开接口（无需认证） ============

// GetDictOptions 获取字典选项
// GET /api/v1/dictionaries/:category
func (h *DictionaryHandler) GetDictOptions(c *gin.Context) {
	category := c.Param("category")
	if category == "" {
		response.Error(c, http.StatusBadRequest, "分类代码不能为空")
		return
	}

	options, err := h.service.GetDictOptions(category)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取字典失败")
		return
	}

	response.Success(c, options)
}

// GetAllCategories 获取所有分类
// GET /api/v1/dictionaries/categories
func (h *DictionaryHandler) GetAllCategories(c *gin.Context) {
	categories, err := h.service.GetAllCategories()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取分类失败")
		return
	}

	response.Success(c, categories)
}

// ============ 管理接口（需要管理员权限） ============

// ListDicts 分页查询字典值
// GET /api/v1/admin/dictionaries
func (h *DictionaryHandler) ListDicts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	categoryCode := c.Query("categoryCode")

	dicts, total, err := h.service.ListDicts(page, pageSize, categoryCode)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"list":     dicts,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// CreateDict 创建字典值
// POST /api/v1/admin/dictionaries
func (h *DictionaryHandler) CreateDict(c *gin.Context) {
	var req model.CreateDictRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	dict, err := h.service.CreateDict(&req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, dict)
}

// UpdateDict 更新字典值
// PUT /api/v1/admin/dictionaries/:id
func (h *DictionaryHandler) UpdateDict(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "ID参数错误")
		return
	}

	var req model.UpdateDictRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	dict, err := h.service.UpdateDict(id, &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, dict)
}

// DeleteDict 删除字典值
// DELETE /api/v1/admin/dictionaries/:id
func (h *DictionaryHandler) DeleteDict(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "ID参数错误")
		return
	}

	if err := h.service.DeleteDict(id); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "删除成功"})
}

// ============ 分类管理接口（可选功能） ============

// ListCategories 查询分类列表
// GET /api/v1/admin/dictionaries/categories
func (h *DictionaryHandler) ListCategories(c *gin.Context) {
	categories, err := h.service.GetAllCategories()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"list":  categories,
		"total": len(categories),
	})
}

// CreateCategory 创建分类
// POST /api/v1/admin/dictionaries/categories
func (h *DictionaryHandler) CreateCategory(c *gin.Context) {
	var cat model.DictionaryCategory
	if err := c.ShouldBindJSON(&cat); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.service.CreateCategory(&cat); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, cat)
}

// UpdateCategory 更新分类
// PUT /api/v1/admin/dictionaries/categories/:code
func (h *DictionaryHandler) UpdateCategory(c *gin.Context) {
	code := c.Param("code")

	var cat model.DictionaryCategory
	if err := c.ShouldBindJSON(&cat); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	cat.Code = code

	if err := h.service.UpdateCategory(&cat); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, cat)
}

// DeleteCategory 删除分类
// DELETE /api/v1/admin/dictionaries/categories/:code
func (h *DictionaryHandler) DeleteCategory(c *gin.Context) {
	code := c.Param("code")

	if err := h.service.DeleteCategory(code); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "删除成功"})
}
