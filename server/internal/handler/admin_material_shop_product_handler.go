package handler

import (
	"errors"
	"fmt"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func AdminListMaterialShopProducts(c *gin.Context) {
	shopID := parseUint64(c.Param("id"))
	if shopID == 0 {
		response.BadRequest(c, "无效门店ID")
		return
	}

	if err := ensureAdminMaterialShopExists(shopID); err != nil {
		response.NotFound(c, "门店不存在")
		return
	}

	var products []model.MaterialShopProduct
	if err := repository.DB.Where("shop_id = ? AND status >= 0", shopID).
		Order("sort_order ASC, id DESC").
		Find(&products).Error; err != nil {
		response.ServerError(c, "查询失败")
		return
	}

	list := make([]gin.H, 0, len(products))
	for _, product := range products {
		list = append(list, parseMaterialProduct(product))
	}
	response.Success(c, gin.H{"list": list, "total": len(list)})
}

func AdminCreateMaterialShopProduct(c *gin.Context) {
	shopID := parseUint64(c.Param("id"))
	if shopID == 0 {
		response.BadRequest(c, "无效门店ID")
		return
	}
	if err := ensureAdminMaterialShopExists(shopID); err != nil {
		response.NotFound(c, "门店不存在")
		return
	}

	var input materialShopProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var count int64
	if err := repository.DB.Model(&model.MaterialShopProduct{}).
		Where("shop_id = ? AND status = 1", shopID).
		Count(&count).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}
	if count >= 20 {
		response.BadRequest(c, "商品最多支持20个")
		return
	}

	product, err := toMaterialShopProduct(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	product.ShopID = shopID
	if product.SortOrder == 0 {
		product.SortOrder = int(count)
	}
	if input.Status != nil && (*input.Status == 0 || *input.Status == 1) {
		product.Status = int8(*input.Status)
	}

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&product).Error; err != nil {
			return err
		}
		if err := syncMaterialShopSummaryFromProducts(tx, shopID); err != nil {
			return err
		}
		return auditAdminMaterialShopProductTx(c, tx, "create", shopID, product.ID, nil, product)
	}); err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	response.Success(c, parseMaterialProduct(product))
}

func AdminUpdateMaterialShopProduct(c *gin.Context) {
	shopID := parseUint64(c.Param("id"))
	productID := parseUint64(c.Param("productId"))
	if shopID == 0 || productID == 0 {
		response.BadRequest(c, "无效商品ID")
		return
	}

	var existing model.MaterialShopProduct
	if err := repository.DB.Where("id = ? AND shop_id = ?", productID, shopID).First(&existing).Error; err != nil {
		response.NotFound(c, "商品不存在")
		return
	}
	before := existing

	var input materialShopProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	updated, err := toMaterialShopProduct(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	existing.Name = updated.Name
	existing.Unit = updated.Unit
	existing.Description = updated.Description
	existing.ParamsJSON = updated.ParamsJSON
	existing.Price = updated.Price
	existing.ImagesJSON = updated.ImagesJSON
	existing.CoverImage = updated.CoverImage
	existing.SortOrder = updated.SortOrder
	if input.Status != nil && (*input.Status == 0 || *input.Status == 1) {
		existing.Status = int8(*input.Status)
	}

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&existing).Error; err != nil {
			return err
		}
		if err := syncMaterialShopSummaryFromProducts(tx, shopID); err != nil {
			return err
		}
		return auditAdminMaterialShopProductTx(c, tx, "update", shopID, existing.ID, before, existing)
	}); err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.Success(c, parseMaterialProduct(existing))
}

func AdminDeleteMaterialShopProduct(c *gin.Context) {
	shopID := parseUint64(c.Param("id"))
	productID := parseUint64(c.Param("productId"))
	if shopID == 0 || productID == 0 {
		response.BadRequest(c, "无效商品ID")
		return
	}

	var existing model.MaterialShopProduct
	if err := repository.DB.Where("id = ? AND shop_id = ?", productID, shopID).First(&existing).Error; err != nil {
		response.NotFound(c, "商品不存在")
		return
	}

	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Where("id = ? AND shop_id = ?", productID, shopID).Delete(&model.MaterialShopProduct{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		if err := syncMaterialShopSummaryFromProducts(tx, shopID); err != nil {
			return err
		}
		return auditAdminMaterialShopProductTx(c, tx, "delete", shopID, productID, existing, nil)
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "商品不存在")
			return
		}
		response.ServerError(c, "删除失败")
		return
	}

	response.Success(c, gin.H{"message": "删除成功"})
}

func ensureAdminMaterialShopExists(shopID uint64) error {
	var count int64
	if err := repository.DB.Model(&model.MaterialShop{}).Where("id = ?", shopID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func auditAdminMaterialShopProductTx(c *gin.Context, tx *gorm.DB, operation string, shopID uint64, productID uint64, before interface{}, after interface{}) error {
	if c == nil {
		return nil
	}
	return (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
		OperatorType:  "admin",
		OperatorID:    c.GetUint64("adminId"),
		Action:        fmt.Sprintf("admin.material_shop_product.%s", operation),
		OperationType: operation,
		Resource:      "material_shop_product",
		ResourceType:  "material_shop_product",
		ResourceID:    productID,
		Reason:        "Ops维护主材商品",
		Result:        "success",
		BeforeState:   before,
		AfterState:    after,
		Metadata: map[string]interface{}{
			"source": "ops",
			"shopId": shopID,
		},
		ClientIP:   c.ClientIP(),
		UserAgent:  c.Request.UserAgent(),
		StatusCode: 200,
	})
}
