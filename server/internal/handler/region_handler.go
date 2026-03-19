package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type regionTreeItem struct {
	model.Region
	HasChildren bool `json:"hasChildren"`
}

func appendRegionHasChildren(regions []model.Region) ([]regionTreeItem, error) {
	if len(regions) == 0 {
		return []regionTreeItem{}, nil
	}

	codes := make([]string, 0, len(regions))
	for _, region := range regions {
		codes = append(codes, region.Code)
	}

	var parentCodes []string
	if err := repository.DB.Model(&model.Region{}).
		Distinct("parent_code").
		Where("parent_code IN ?", codes).
		Pluck("parent_code", &parentCodes).Error; err != nil {
		return nil, err
	}

	hasChildrenMap := make(map[string]struct{}, len(parentCodes))
	for _, code := range parentCodes {
		hasChildrenMap[code] = struct{}{}
	}

	items := make([]regionTreeItem, 0, len(regions))
	for _, region := range regions {
		_, hasChildren := hasChildrenMap[region.Code]
		items = append(items, regionTreeItem{
			Region:      region,
			HasChildren: hasChildren,
		})
	}

	return items, nil
}

// ==================== 行政区划 API ====================

// GetProvinces 获取所有省份
func GetProvinces(c *gin.Context) {
	var provinces []model.Region
	if err := repository.DB.Where("level = ? AND enabled = ?", 1, true).
		Order("sort_order ASC, code ASC").
		Find(&provinces).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}
	response.Success(c, provinces)
}

// GetCitiesByProvince 根据省份代码获取城市列表
func GetCitiesByProvince(c *gin.Context) {
	provinceCode := c.Param("provinceCode")

	var cities []model.Region
	if err := repository.DB.Where("level = ? AND parent_code = ? AND enabled = ?", 2, provinceCode, true).
		Order("sort_order ASC, code ASC").
		Find(&cities).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}
	response.Success(c, cities)
}

// GetCities 获取所有启用城市
func GetCities(c *gin.Context) {
	var cities []model.Region
	if err := repository.DB.Where("level = ? AND enabled = ?", 2, true).
		Order("sort_order ASC, code ASC").
		Find(&cities).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}
	response.Success(c, cities)
}

// GetDistrictsByCity 根据城市代码获取区/县列表
func GetDistrictsByCity(c *gin.Context) {
	cityCode := c.Param("cityCode")

	var districts []model.Region
	if err := repository.DB.Where("level = ? AND parent_code = ? AND enabled = ?", 3, cityCode, true).
		Order("sort_order ASC, code ASC").
		Find(&districts).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}
	response.Success(c, districts)
}

// GetChildrenByParentCode 根据父级代码获取子区域（懒加载用）
func GetChildrenByParentCode(c *gin.Context) {
	parentCode := c.Param("parentCode")

	var children []model.Region
	if err := repository.DB.Where("parent_code = ? AND enabled = ?", parentCode, true).
		Order("sort_order ASC, code ASC").
		Find(&children).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}
	response.Success(c, children)
}

// AdminGetChildrenByParentCode 管理员获取子区域（包含已禁用的）
func AdminGetChildrenByParentCode(c *gin.Context) {
	parentCode := c.Param("parentCode")

	var children []model.Region
	if err := repository.DB.Where("parent_code = ?", parentCode).
		Order("sort_order ASC, code ASC").
		Find(&children).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	items, err := appendRegionHasChildren(children)
	if err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	response.Success(c, items)
}

// AdminListRegions 管理员查看行政区划列表（支持分页和层级筛选）
func AdminListRegions(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 20)
	level := c.Query("level")           // 可选：筛选层级 1/2/3
	parentCode := c.Query("parentCode") // 可选：筛选父级

	var regions []model.Region
	var total int64

	db := repository.DB.Model(&model.Region{})

	if level != "" {
		db = db.Where("level = ?", level)
	}
	if parentCode != "" {
		db = db.Where("parent_code = ?", parentCode)
	}

	db.Count(&total)
	db.Offset((page - 1) * pageSize).Limit(pageSize).
		Order("level ASC, sort_order ASC, code ASC").
		Find(&regions)

	items, err := appendRegionHasChildren(regions)
	if err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"list":  items,
		"total": total,
	})
}

// AdminToggleRegion 管理员启用/禁用行政区划（级联操作）
func AdminToggleRegion(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// 查询当前区域
	var region model.Region
	if err := repository.DB.Where("id = ?", id).First(&region).Error; err != nil {
		response.ServerError(c, "区域不存在")
		return
	}

	// 开启事务：更新当前区域和所有子区域
	tx := repository.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 更新当前区域
	if err := tx.Model(&model.Region{}).Where("id = ?", id).Update("enabled", req.Enabled).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "操作失败")
		return
	}

	// 级联更新所有子区域（递归）
	if err := cascadeUpdateChildren(tx, region.Code, req.Enabled); err != nil {
		tx.Rollback()
		response.ServerError(c, "级联更新失败")
		return
	}

	// 子节点启用时，自动启用所有上级；子节点禁用后，若同级全部关闭则自动关闭上级
	if req.Enabled {
		if err := cascadeEnableParents(tx, region.ParentCode); err != nil {
			tx.Rollback()
			response.ServerError(c, "更新上级区域失败")
			return
		}
	} else {
		if err := syncParentEnabledState(tx, region.ParentCode); err != nil {
			tx.Rollback()
			response.ServerError(c, "同步上级区域失败")
			return
		}
	}

	tx.Commit()
	response.Success(c, nil)
}

// cascadeUpdateChildren 递归更新所有子区域的状态
func cascadeUpdateChildren(tx *gorm.DB, parentCode string, enabled bool) error {
	// 查找所有直接子节点
	var children []model.Region
	if err := tx.Where("parent_code = ?", parentCode).Find(&children).Error; err != nil {
		return err
	}

	// 更新直接子节点
	if len(children) > 0 {
		if err := tx.Model(&model.Region{}).Where("parent_code = ?", parentCode).Update("enabled", enabled).Error; err != nil {
			return err
		}

		// 递归更新孙子节点
		for _, child := range children {
			if err := cascadeUpdateChildren(tx, child.Code, enabled); err != nil {
				return err
			}
		}
	}

	return nil
}

// cascadeEnableParents 递归启用所有上级区域
func cascadeEnableParents(tx *gorm.DB, parentCode string) error {
	if parentCode == "" {
		return nil
	}

	var parent model.Region
	if err := tx.Where("code = ?", parentCode).First(&parent).Error; err != nil {
		return err
	}

	if !parent.Enabled {
		if err := tx.Model(&model.Region{}).Where("code = ?", parentCode).Update("enabled", true).Error; err != nil {
			return err
		}
	}

	return cascadeEnableParents(tx, parent.ParentCode)
}

// syncParentEnabledState 子区域关闭后，根据兄弟节点状态同步父级状态
func syncParentEnabledState(tx *gorm.DB, parentCode string) error {
	if parentCode == "" {
		return nil
	}

	var parent model.Region
	if err := tx.Where("code = ?", parentCode).First(&parent).Error; err != nil {
		return err
	}

	var enabledChildren int64
	if err := tx.Model(&model.Region{}).
		Where("parent_code = ? AND enabled = ?", parentCode, true).
		Count(&enabledChildren).Error; err != nil {
		return err
	}

	nextEnabled := enabledChildren > 0
	if err := tx.Model(&model.Region{}).Where("code = ?", parentCode).Update("enabled", nextEnabled).Error; err != nil {
		return err
	}

	return syncParentEnabledState(tx, parent.ParentCode)
}
