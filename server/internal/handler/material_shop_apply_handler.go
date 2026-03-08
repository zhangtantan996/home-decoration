package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"
	"home-decoration-server/pkg/utils"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type materialShopApplyProductInput struct {
	Name   string                 `json:"name"`
	Params map[string]interface{} `json:"params"`
	Price  float64                `json:"price"`
	Images []string               `json:"images"`
}

type materialShopApplyInput struct {
	Phone                  string                          `json:"phone" binding:"required"`
	Code                   string                          `json:"code"`
	EntityType             string                          `json:"entityType"`
	ShopName               string                          `json:"shopName" binding:"required"`
	ShopDescription        string                          `json:"shopDescription"`
	CompanyName            string                          `json:"companyName"`
	BusinessLicenseNo      string                          `json:"businessLicenseNo" binding:"required"`
	BusinessLicense        string                          `json:"businessLicense" binding:"required"`
	LegalPersonName        string                          `json:"legalPersonName"`
	LegalPersonIDCardNo    string                          `json:"legalPersonIdCardNo"`
	LegalPersonIDCardFront string                          `json:"legalPersonIdCardFront"`
	LegalPersonIDCardBack  string                          `json:"legalPersonIdCardBack"`
	BusinessHours          string                          `json:"businessHours"`
	ContactPhone           string                          `json:"contactPhone"`
	ContactName            string                          `json:"contactName"`
	Address                string                          `json:"address"`
	ResubmitToken          string                          `json:"resubmitToken"`
	Products               []materialShopApplyProductInput `json:"products" binding:"required,min=1"`
	LegalAcceptance        LegalAcceptanceInput            `json:"legalAcceptance" binding:"required"`
}

type materialShopUpdateInput struct {
	Name              string `json:"name"`
	CompanyName       string `json:"companyName"`
	Description       string `json:"description"`
	BusinessHours     string `json:"businessHours"`
	ContactPhone      string `json:"contactPhone"`
	ContactName       string `json:"contactName"`
	LegalPersonName   string `json:"legalPersonName"`
	Address           string `json:"address"`
	BusinessLicenseNo string `json:"businessLicenseNo"`
	BusinessLicense   string `json:"businessLicense"`
}

type materialShopProductInput struct {
	Name   string                 `json:"name"`
	Params map[string]interface{} `json:"params"`
	Price  float64                `json:"price"`
	Images []string               `json:"images"`
}

func normalizeMaterialEntityType(raw string) string {
	entityType := strings.ToLower(strings.TrimSpace(raw))
	switch entityType {
	case "company", "individual_business":
		return entityType
	default:
		return "company"
	}
}

func validateMaterialProducts(products []materialShopApplyProductInput) error {
	if len(products) < 5 || len(products) > 20 {
		return fmt.Errorf("主材商品数量需为5-20个")
	}

	for idx := range products {
		products[idx].Name = strings.TrimSpace(products[idx].Name)
		products[idx].Images = normalizeStringSlice(products[idx].Images)

		if products[idx].Name == "" {
			return fmt.Errorf("第%d个商品名称不能为空", idx+1)
		}
		if len([]rune(products[idx].Name)) > 120 {
			return fmt.Errorf("第%d个商品名称不能超过120个字符", idx+1)
		}
		if products[idx].Price <= 0 {
			return fmt.Errorf("第%d个商品价格需大于0", idx+1)
		}
		if len(products[idx].Images) < 1 {
			return fmt.Errorf("第%d个商品至少上传1张图片", idx+1)
		}
		if products[idx].Params == nil || len(products[idx].Params) == 0 {
			return fmt.Errorf("第%d个商品请填写参数信息", idx+1)
		}
	}
	return nil
}

func validateMaterialShopApply(input *materialShopApplyInput) error {
	if !utils.ValidatePhone(input.Phone) {
		return fmt.Errorf("手机号格式不正确")
	}

	input.ShopName = strings.TrimSpace(input.ShopName)
	input.ShopDescription = strings.TrimSpace(input.ShopDescription)
	input.CompanyName = strings.TrimSpace(input.CompanyName)
	input.BusinessLicenseNo = utils.NormalizeLicenseNo(input.BusinessLicenseNo)
	input.BusinessLicense = strings.TrimSpace(input.BusinessLicense)
	input.LegalPersonName = strings.TrimSpace(input.LegalPersonName)
	input.LegalPersonIDCardNo = strings.ToUpper(strings.TrimSpace(input.LegalPersonIDCardNo))
	input.LegalPersonIDCardFront = strings.TrimSpace(input.LegalPersonIDCardFront)
	input.LegalPersonIDCardBack = strings.TrimSpace(input.LegalPersonIDCardBack)
	input.BusinessHours = strings.TrimSpace(input.BusinessHours)
	input.ContactPhone = strings.TrimSpace(input.ContactPhone)
	input.ContactName = strings.TrimSpace(input.ContactName)
	input.Address = strings.TrimSpace(input.Address)
	input.EntityType = normalizeMaterialEntityType(input.EntityType)

	if err := validateLegalAcceptance(&input.LegalAcceptance); err != nil {
		return err
	}

	if len([]rune(input.ShopName)) < 2 || len([]rune(input.ShopName)) > 100 {
		return fmt.Errorf("店铺名称长度需为2-100个字符")
	}
	if len([]rune(input.ShopDescription)) > 5000 {
		return fmt.Errorf("店铺描述不能超过5000个字符")
	}
	if !utils.ValidateCompanyName(input.CompanyName) {
		return fmt.Errorf("公司/个体名称长度应在2-100个字符之间")
	}
	if input.BusinessLicenseNo == "" {
		return fmt.Errorf("请填写统一社会信用代码/营业执照号")
	}
	if err := service.VerifyLicenseForApply(input.BusinessLicenseNo, input.CompanyName); err != nil {
		return err
	}
	if input.BusinessLicense == "" {
		return fmt.Errorf("请上传营业执照图片")
	}
	if input.LegalPersonName == "" {
		return fmt.Errorf("请填写法人/经营者姓名")
	}
	if !utils.ValidateRealName(input.LegalPersonName) {
		return fmt.Errorf("法人/经营者姓名长度应在2-20个字符之间")
	}
	if input.LegalPersonIDCardNo == "" {
		return fmt.Errorf("请填写法人/经营者身份证号")
	}
	if err := service.VerifyIDCardForApply(input.LegalPersonIDCardNo, input.LegalPersonName); err != nil {
		return err
	}
	if input.LegalPersonIDCardFront == "" {
		return fmt.Errorf("请上传法人/经营者身份证正面")
	}
	if input.LegalPersonIDCardBack == "" {
		return fmt.Errorf("请上传法人/经营者身份证反面")
	}
	if input.ContactPhone == "" {
		return fmt.Errorf("请填写联系手机号")
	}
	if !utils.ValidatePhone(input.ContactPhone) {
		return fmt.Errorf("联系手机号格式不正确")
	}
	if input.ContactName == "" {
		input.ContactName = input.LegalPersonName
	}
	if input.BusinessHours == "" {
		return fmt.Errorf("请填写营业时间")
	}
	if input.Address == "" {
		return fmt.Errorf("请填写门店地址")
	}
	if err := validateMaterialProducts(input.Products); err != nil {
		return err
	}
	return nil
}

func createOrLoadUserForMaterialApply(tx *gorm.DB, phone, nickname string) (*model.User, error) {
	var user model.User
	err := tx.Where("phone = ?", phone).First(&user).Error
	if err == nil {
		return &user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	createdUser, createErr := createMerchantUserWithCompatibility(tx, phone, nickname)
	if createErr != nil {
		if isUserPhoneDuplicateError(createErr) {
			if findErr := tx.Where("phone = ?", phone).First(&user).Error; findErr == nil {
				return &user, nil
			}
		}
		return nil, createErr
	}

	user = createdUser
	return &user, nil
}

func persistMaterialApplyProducts(tx *gorm.DB, applicationID uint64, products []materialShopApplyProductInput) error {
	for idx, product := range products {
		paramsJSON, _ := json.Marshal(product.Params)
		imagesJSON, _ := json.Marshal(product.Images)
		applicationProduct := model.MaterialShopApplicationProduct{
			ApplicationID: applicationID,
			Name:          product.Name,
			ParamsJSON:    string(paramsJSON),
			Price:         product.Price,
			ImagesJSON:    string(imagesJSON),
			SortOrder:     idx,
		}
		if err := tx.Create(&applicationProduct).Error; err != nil {
			return err
		}
	}
	return nil
}

func MaterialShopApply(c *gin.Context) {
	var input materialShopApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	if err := service.VerifySMSCode(input.Phone, service.SMSPurposeIdentityApply, input.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	if err := validateMaterialShopApply(&input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	var existingApp model.MaterialShopApplication
	if err := repository.DB.Where("phone = ? AND status IN (0, 1)", input.Phone).Order("created_at DESC").First(&existingApp).Error; err == nil {
		if existingApp.Status == 0 {
			response.Error(c, 400, "您已提交主材商入驻申请，请等待审核")
		} else {
			response.Error(c, 400, "您已是入驻主材商，请直接登录")
		}
		return
	}

	tx := repository.DB.Begin()
	user, err := createOrLoadUserForMaterialApply(tx, input.Phone, input.LegalPersonName)
	if err != nil {
		tx.Rollback()
		response.Error(c, 500, "提交失败: 创建账号失败")
		return
	}

	if ok, nextAction, checkErr := canSubmitMaterialShopApplication(tx, user.ID); checkErr != nil {
		tx.Rollback()
		response.Error(c, 500, "提交失败: 校验商家身份异常")
		return
	} else if !ok {
		tx.Rollback()
		c.JSON(200, response.Response{
			Code:    409,
			Message: "您已有生效中的商家身份，请登录商家中心或重新发起新类型申请",
			Data: gin.H{
				"nextAction": nextAction,
				"userId":     user.ID,
			},
		})
		return
	}

	acceptedAt := time.Now()
	application := model.MaterialShopApplication{
		UserID:                 user.ID,
		Phone:                  input.Phone,
		EntityType:             input.EntityType,
		ShopName:               input.ShopName,
		ShopDescription:        input.ShopDescription,
		CompanyName:            input.CompanyName,
		BusinessLicenseNo:      encryptSensitiveOrPlain(input.BusinessLicenseNo),
		BusinessLicense:        input.BusinessLicense,
		LegalPersonName:        input.LegalPersonName,
		LegalPersonIDCardNo:    encryptSensitiveOrPlain(input.LegalPersonIDCardNo),
		LegalPersonIDCardFront: input.LegalPersonIDCardFront,
		LegalPersonIDCardBack:  input.LegalPersonIDCardBack,
		BusinessHours:          input.BusinessHours,
		ContactPhone:           input.ContactPhone,
		ContactName:            input.ContactName,
		Address:                input.Address,
		LegalAcceptanceJSON:    buildLegalAcceptanceJSON(input.LegalAcceptance),
		LegalAcceptedAt:        &acceptedAt,
		LegalAcceptSource:      "merchant_web",
		Status:                 0,
	}
	if err := tx.Create(&application).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "提交失败: 创建申请记录失败")
		return
	}

	if err := persistMaterialApplyProducts(tx, application.ID, input.Products); err != nil {
		tx.Rollback()
		response.Error(c, 500, "提交失败: 保存商品失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "提交失败，请稍后重试")
		return
	}

	response.Success(c, gin.H{
		"applicationId": application.ID,
		"userCreated":   true,
		"message":       "申请已提交，账号已创建，审核通过后可登录商家中心",
	})
}

func MaterialShopApplyStatus(c *gin.Context) {
	phone := strings.TrimSpace(c.Param("phone"))
	if phone == "" {
		response.Error(c, 400, "手机号不能为空")
		return
	}

	var app model.MaterialShopApplication
	if err := repository.DB.Where("phone = ?", phone).Order("created_at DESC").First(&app).Error; err != nil {
		response.Error(c, 404, "未找到申请记录")
		return
	}

	var productCount int64
	repository.DB.Model(&model.MaterialShopApplicationProduct{}).
		Where("application_id = ?", app.ID).
		Count(&productCount)

	statusText := map[int8]string{
		0: "待审核",
		1: "审核通过",
		2: "审核拒绝",
	}

	response.Success(c, gin.H{
		"applicationId": app.ID,
		"merchantKind":  "material_shop",
		"role":          "material_shop",
		"entityType":    app.EntityType,
		"status":        app.Status,
		"statusText":    statusText[app.Status],
		"rejectReason":  app.RejectReason,
		"productCount":  productCount,
		"createdAt":     app.CreatedAt,
		"auditedAt":     app.AuditedAt,
	})
}

func MaterialShopApplyDetailForResubmit(c *gin.Context) {
	appID := parseUint64(c.Param("id"))
	var authInput resubmitDetailRequestInput
	if err := c.ShouldBindJSON(&authInput); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	authInput.Phone = strings.TrimSpace(authInput.Phone)
	authInput.Code = strings.TrimSpace(authInput.Code)

	var app model.MaterialShopApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}
	if app.Status != 2 {
		response.Error(c, 400, "当前申请状态不支持重新提交详情回填")
		return
	}
	if app.Phone != authInput.Phone {
		response.Error(c, 403, "手机号与原申请不一致")
		return
	}
	if err := service.VerifySMSCode(authInput.Phone, service.SMSPurposeIdentityApply, authInput.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	resubmitToken, err := issueResubmitToken(merchantIdentityTypeMaterial, app.ID, app.Phone)
	if err != nil {
		response.Error(c, 500, "生成重提授权凭证失败")
		return
	}

	var products []model.MaterialShopApplicationProduct
	_ = repository.DB.Where("application_id = ?", app.ID).Order("sort_order ASC, id ASC").Find(&products).Error

	productList := make([]gin.H, 0, len(products))
	for _, product := range products {
		var params map[string]interface{}
		var images []string
		_ = json.Unmarshal([]byte(product.ParamsJSON), &params)
		_ = json.Unmarshal([]byte(product.ImagesJSON), &images)
		if params == nil {
			params = map[string]interface{}{}
		}
		productList = append(productList, gin.H{
			"name":   product.Name,
			"params": params,
			"price":  product.Price,
			"images": imgutil.GetFullImageURLs(images),
		})
	}

	response.Success(c, gin.H{
		"applicationId": app.ID,
		"merchantKind":  "material_shop",
		"resubmitToken": resubmitToken,
		"resubmitEditable": gin.H{
			"phone":        false,
			"merchantKind": false,
		},
		"form": gin.H{
			"phone":                  app.Phone,
			"entityType":             app.EntityType,
			"shopName":               app.ShopName,
			"shopDescription":        app.ShopDescription,
			"companyName":            app.CompanyName,
			"businessLicenseNo":      displayReadableSensitive(app.BusinessLicenseNo),
			"businessLicense":        imgutil.GetFullImageURL(app.BusinessLicense),
			"legalPersonName":        app.LegalPersonName,
			"legalPersonIdCardNo":    displayReadableSensitive(app.LegalPersonIDCardNo),
			"legalPersonIdCardFront": imgutil.GetFullImageURL(app.LegalPersonIDCardFront),
			"legalPersonIdCardBack":  imgutil.GetFullImageURL(app.LegalPersonIDCardBack),
			"businessHours":          app.BusinessHours,
			"contactPhone":           app.ContactPhone,
			"contactName":            app.ContactName,
			"address":                app.Address,
			"products":               productList,
			"legalAcceptance":        parseLegalAcceptanceJSON(app.LegalAcceptanceJSON),
			"legalAcceptanceReset":   true,
		},
		"rejectReason": app.RejectReason,
	})
}

func MaterialShopApplyResubmit(c *gin.Context) {
	appID := parseUint64(c.Param("id"))

	var input materialShopApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}
	if err := validateMaterialShopApply(&input); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	var app model.MaterialShopApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}
	if app.Status != 2 {
		response.Error(c, 400, "该申请状态不允许重新提交")
		return
	}
	if app.Phone != input.Phone {
		response.Error(c, 400, "手机号与原申请不一致")
		return
	}
	if err := authorizeResubmit(input.Phone, input.ResubmitToken, app.ID, merchantIdentityTypeMaterial, input.Code); err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	tx := repository.DB.Begin()

	app.EntityType = input.EntityType
	app.ShopName = input.ShopName
	app.ShopDescription = input.ShopDescription
	app.CompanyName = input.CompanyName
	app.BusinessLicenseNo = encryptSensitiveOrPlain(input.BusinessLicenseNo)
	app.BusinessLicense = input.BusinessLicense
	app.LegalPersonName = input.LegalPersonName
	app.LegalPersonIDCardNo = encryptSensitiveOrPlain(input.LegalPersonIDCardNo)
	app.LegalPersonIDCardFront = input.LegalPersonIDCardFront
	app.LegalPersonIDCardBack = input.LegalPersonIDCardBack
	app.BusinessHours = input.BusinessHours
	app.ContactPhone = input.ContactPhone
	app.ContactName = input.ContactName
	app.Address = input.Address
	app.LegalAcceptanceJSON = buildLegalAcceptanceJSON(input.LegalAcceptance)
	app.LegalAcceptSource = "merchant_web"
	acceptedAt := time.Now()
	app.LegalAcceptedAt = &acceptedAt
	app.Status = 0
	app.RejectReason = ""
	app.AuditedBy = 0
	app.AuditedAt = nil

	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "重新提交失败")
		return
	}

	if err := tx.Where("application_id = ?", app.ID).Delete(&model.MaterialShopApplicationProduct{}).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "重新提交失败")
		return
	}

	if err := persistMaterialApplyProducts(tx, app.ID, input.Products); err != nil {
		tx.Rollback()
		response.Error(c, 500, "重新提交失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "重新提交失败")
		return
	}

	response.Success(c, gin.H{
		"applicationId": app.ID,
		"message":       "已重新提交，请等待审核",
	})
}

func requireMaterialShopID(c *gin.Context) (uint64, bool) {
	materialShopID := c.GetUint64("materialShopId")
	if materialShopID == 0 {
		response.Error(c, 403, "当前账号不是主材商账号")
		return 0, false
	}
	return materialShopID, true
}

func parseMaterialProduct(product model.MaterialShopProduct) gin.H {
	var params map[string]interface{}
	var images []string
	_ = json.Unmarshal([]byte(product.ParamsJSON), &params)
	_ = json.Unmarshal([]byte(product.ImagesJSON), &images)

	if params == nil {
		params = map[string]interface{}{}
	}

	return gin.H{
		"id":         product.ID,
		"name":       product.Name,
		"params":     params,
		"price":      product.Price,
		"images":     images,
		"coverImage": product.CoverImage,
		"status":     product.Status,
		"sortOrder":  product.SortOrder,
		"createdAt":  product.CreatedAt,
		"updatedAt":  product.UpdatedAt,
	}
}

func MaterialShopGetMe(c *gin.Context) {
	shopID, ok := requireMaterialShopID(c)
	if !ok {
		return
	}

	var shop model.MaterialShop
	if err := repository.DB.First(&shop, shopID).Error; err != nil {
		response.Error(c, 404, "主材商不存在")
		return
	}

	entityType := resolveMaterialShopEntityType(shop.ID, shop.UserID)

	response.Success(c, gin.H{
		"id":                  shop.ID,
		"sourceApplicationId": shop.SourceApplicationID,
		"merchantKind":        "material_shop",
		"entityType":          entityType,
		"shopName":            shop.Name,
		"companyName":         shop.CompanyName,
		"shopDescription":     shop.Description,
		"businessLicenseNo":   shop.BusinessLicenseNo,
		"businessLicense":     shop.BusinessLicense,
		"legalPersonName":     shop.LegalPersonName,
		"businessHours":       shop.OpenTime,
		"contactPhone":        shop.ContactPhone,
		"contactName":         shop.ContactName,
		"address":             shop.Address,
		"isVerified":          shop.IsVerified,
	})
}

func MaterialShopUpdateMe(c *gin.Context) {
	shopID, ok := requireMaterialShopID(c)
	if !ok {
		return
	}

	var input materialShopUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	updates := map[string]interface{}{}
	if strings.TrimSpace(input.Name) != "" {
		name := strings.TrimSpace(input.Name)
		if len([]rune(name)) < 2 || len([]rune(name)) > 100 {
			response.Error(c, 400, "店铺名称长度需为2-100个字符")
			return
		}
		updates["name"] = name
	}

	if strings.TrimSpace(input.CompanyName) != "" {
		companyName := strings.TrimSpace(input.CompanyName)
		if !utils.ValidateCompanyName(companyName) {
			response.Error(c, 400, "公司/个体名称长度应在2-100个字符之间")
			return
		}
		updates["company_name"] = companyName
	}
	if input.Description != "" {
		desc := strings.TrimSpace(input.Description)
		if len([]rune(desc)) > 5000 {
			response.Error(c, 400, "店铺描述不能超过5000个字符")
			return
		}
		updates["description"] = desc
	}
	if input.BusinessHours != "" {
		updates["open_time"] = strings.TrimSpace(input.BusinessHours)
	}
	if input.ContactPhone != "" {
		phone := strings.TrimSpace(input.ContactPhone)
		if !utils.ValidatePhone(phone) {
			response.Error(c, 400, "联系人手机号格式不正确")
			return
		}
		updates["contact_phone"] = phone
	}
	if input.ContactName != "" {
		updates["contact_name"] = strings.TrimSpace(input.ContactName)
	}
	if input.LegalPersonName != "" {
		legalPersonName := strings.TrimSpace(input.LegalPersonName)
		if !utils.ValidateRealName(legalPersonName) {
			response.Error(c, 400, "法人/经营者姓名长度应在2-20个字符之间")
			return
		}
		updates["legal_person_name"] = legalPersonName
	}
	if input.Address != "" {
		updates["address"] = strings.TrimSpace(input.Address)
	}
	if input.BusinessLicenseNo != "" {
		updates["business_license_no"] = encryptSensitiveOrPlain(input.BusinessLicenseNo)
	}
	if input.BusinessLicense != "" {
		updates["business_license"] = strings.TrimSpace(input.BusinessLicense)
	}

	if len(updates) == 0 {
		response.Success(c, gin.H{"status": "ok"})
		return
	}

	if err := repository.DB.Model(&model.MaterialShop{}).Where("id = ?", shopID).Updates(updates).Error; err != nil {
		response.Error(c, 500, "更新失败")
		return
	}
	response.Success(c, gin.H{"status": "ok"})
}

func MaterialShopListProducts(c *gin.Context) {
	shopID, ok := requireMaterialShopID(c)
	if !ok {
		return
	}

	var products []model.MaterialShopProduct
	if err := repository.DB.Where("shop_id = ? AND status >= 0", shopID).Order("sort_order ASC, id DESC").Find(&products).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	list := make([]gin.H, 0, len(products))
	for _, product := range products {
		list = append(list, parseMaterialProduct(product))
	}

	response.Success(c, gin.H{
		"list":  list,
		"total": len(list),
	})
}

func toMaterialShopProduct(input materialShopProductInput) (model.MaterialShopProduct, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Images = normalizeStringSlice(input.Images)

	if input.Name == "" {
		return model.MaterialShopProduct{}, fmt.Errorf("商品名称不能为空")
	}
	if len([]rune(input.Name)) > 120 {
		return model.MaterialShopProduct{}, fmt.Errorf("商品名称不能超过120个字符")
	}
	if input.Price <= 0 {
		return model.MaterialShopProduct{}, fmt.Errorf("商品价格需大于0")
	}
	if len(input.Images) < 1 {
		return model.MaterialShopProduct{}, fmt.Errorf("商品至少上传1张图片")
	}
	if input.Params == nil || len(input.Params) == 0 {
		return model.MaterialShopProduct{}, fmt.Errorf("请填写商品参数")
	}

	paramsJSON, _ := json.Marshal(input.Params)
	imagesJSON, _ := json.Marshal(input.Images)

	product := model.MaterialShopProduct{
		Name:       input.Name,
		ParamsJSON: string(paramsJSON),
		Price:      input.Price,
		ImagesJSON: string(imagesJSON),
		CoverImage: input.Images[0],
		Status:     1,
	}

	return product, nil
}

func MaterialShopCreateProduct(c *gin.Context) {
	shopID, ok := requireMaterialShopID(c)
	if !ok {
		return
	}

	var input materialShopProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	var count int64
	repository.DB.Model(&model.MaterialShopProduct{}).Where("shop_id = ? AND status = 1", shopID).Count(&count)
	if count >= 20 {
		response.Error(c, 400, "商品最多支持20个")
		return
	}

	product, err := toMaterialShopProduct(input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}
	product.ShopID = shopID
	product.SortOrder = int(count)

	if err := repository.DB.Create(&product).Error; err != nil {
		response.Error(c, 500, "创建失败")
		return
	}

	response.Success(c, gin.H{
		"id":      product.ID,
		"message": "创建成功",
	})
}

func MaterialShopUpdateProduct(c *gin.Context) {
	shopID, ok := requireMaterialShopID(c)
	if !ok {
		return
	}
	productID := parseUint64(c.Param("id"))

	var existing model.MaterialShopProduct
	if err := repository.DB.Where("id = ? AND shop_id = ?", productID, shopID).First(&existing).Error; err != nil {
		response.Error(c, 404, "商品不存在")
		return
	}

	var input materialShopProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	updated, err := toMaterialShopProduct(input)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	existing.Name = updated.Name
	existing.ParamsJSON = updated.ParamsJSON
	existing.Price = updated.Price
	existing.ImagesJSON = updated.ImagesJSON
	existing.CoverImage = updated.CoverImage

	if err := repository.DB.Save(&existing).Error; err != nil {
		response.Error(c, 500, "更新失败")
		return
	}

	response.Success(c, gin.H{"message": "更新成功"})
}

func MaterialShopDeleteProduct(c *gin.Context) {
	shopID, ok := requireMaterialShopID(c)
	if !ok {
		return
	}
	productID := parseUint64(c.Param("id"))

	result := repository.DB.Where("id = ? AND shop_id = ?", productID, shopID).Delete(&model.MaterialShopProduct{})
	if result.Error != nil {
		response.Error(c, 500, "删除失败")
		return
	}
	if result.RowsAffected == 0 {
		response.Error(c, 404, "商品不存在")
		return
	}

	response.Success(c, gin.H{"message": "删除成功"})
}

func AdminListMaterialShopApplications(c *gin.Context) {
	page := parseInt(c.Query("page"), 1)
	pageSize := parseInt(c.Query("pageSize"), 10)
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	var apps []model.MaterialShopApplication
	query := repository.DB.Model(&model.MaterialShopApplication{}).Order("created_at DESC")

	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		pattern := "%" + keyword + "%"
		query = query.Where("phone LIKE ? OR shop_name LIKE ? OR company_name LIKE ? OR contact_name LIKE ? OR legal_person_name LIKE ?", pattern, pattern, pattern, pattern, pattern)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}
	if err := query.Offset((page - 1) * pageSize).Limit(pageSize).Find(&apps).Error; err != nil {
		response.Error(c, 500, "查询失败")
		return
	}

	list := make([]gin.H, 0, len(apps))
	for _, app := range apps {
		list = append(list, gin.H{
			"id":           app.ID,
			"phone":        app.Phone,
			"entityType":   app.EntityType,
			"shopName":     app.ShopName,
			"companyName":  app.CompanyName,
			"contactName":  app.ContactName,
			"contactPhone": app.ContactPhone,
			"status":       app.Status,
			"rejectReason": app.RejectReason,
			"createdAt":    app.CreatedAt,
			"auditedAt":    app.AuditedAt,
		})
	}

	response.Success(c, gin.H{
		"list":  list,
		"total": total,
	})
}

func AdminGetMaterialShopApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))

	var app model.MaterialShopApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}

	var products []model.MaterialShopApplicationProduct
	_ = repository.DB.Where("application_id = ?", app.ID).Order("sort_order ASC, id ASC").Find(&products).Error

	productList := make([]gin.H, 0, len(products))
	for _, product := range products {
		var params map[string]interface{}
		var images []string
		_ = json.Unmarshal([]byte(product.ParamsJSON), &params)
		_ = json.Unmarshal([]byte(product.ImagesJSON), &images)

		productList = append(productList, gin.H{
			"id":        product.ID,
			"name":      product.Name,
			"params":    params,
			"price":     product.Price,
			"images":    imgutil.GetFullImageURLs(images),
			"sortOrder": product.SortOrder,
		})
	}

	response.Success(c, gin.H{
		"id":                     app.ID,
		"merchantKind":           "material_shop",
		"phone":                  app.Phone,
		"sourceApplicationId":    app.ID,
		"entityType":             app.EntityType,
		"shopName":               app.ShopName,
		"shopDescription":        app.ShopDescription,
		"companyName":            app.CompanyName,
		"businessLicenseNo":      displayReadableSensitive(app.BusinessLicenseNo),
		"businessLicense":        imgutil.GetFullImageURL(app.BusinessLicense),
		"legalPersonName":        app.LegalPersonName,
		"legalPersonIdCardNo":    displayMaskedSensitive(app.LegalPersonIDCardNo, maskSensitiveID),
		"legalPersonIdCardFront": imgutil.GetFullImageURL(app.LegalPersonIDCardFront),
		"legalPersonIdCardBack":  imgutil.GetFullImageURL(app.LegalPersonIDCardBack),
		"businessHours":          app.BusinessHours,
		"contactPhone":           app.ContactPhone,
		"contactName":            app.ContactName,
		"address":                app.Address,
		"status":                 app.Status,
		"rejectReason":           app.RejectReason,
		"createdAt":              app.CreatedAt,
		"auditedAt":              app.AuditedAt,
		"auditedBy":              app.AuditedBy,
		"products":               productList,
	})
}

func AdminApproveMaterialShopApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var app model.MaterialShopApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}
	if app.Status != 0 {
		response.Error(c, 400, "该申请已处理")
		return
	}

	tx := repository.DB.Begin()

	var user model.User
	userErr := gorm.ErrRecordNotFound
	if app.UserID > 0 {
		userErr = tx.First(&user, app.UserID).Error
	}
	if errors.Is(userErr, gorm.ErrRecordNotFound) {
		userErr = tx.Where("phone = ?", app.Phone).First(&user).Error
	}
	if userErr != nil {
		tx.Rollback()
		response.Error(c, 400, "用户不存在，请先注册")
		return
	}

	previousIdentity, err := findLatestActiveMerchantIdentity(tx, user.ID, "", 0)
	if err != nil {
		tx.Rollback()
		response.Error(c, 500, "校验旧商家身份失败: "+err.Error())
		return
	}

	var appProducts []model.MaterialShopApplicationProduct
	if err := tx.Where("application_id = ?", app.ID).Order("sort_order ASC, id ASC").Find(&appProducts).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "读取申请商品失败")
		return
	}
	if len(appProducts) < 5 {
		tx.Rollback()
		response.Error(c, 400, "主材商申请商品不足5个，无法审核通过")
		return
	}

	mainProducts := make([]string, 0, len(appProducts))
	for _, product := range appProducts {
		mainProducts = append(mainProducts, product.Name)
	}
	mainProductsJSON, _ := json.Marshal(mainProducts)

	shop := model.MaterialShop{
		UserID:                 user.ID,
		Type:                   "showroom",
		Name:                   app.ShopName,
		SourceApplicationID:    app.ID,
		CompanyName:            app.CompanyName,
		Description:            app.ShopDescription,
		BusinessLicenseNo:      app.BusinessLicenseNo,
		BusinessLicense:        app.BusinessLicense,
		LegalPersonName:        app.LegalPersonName,
		LegalPersonIDCardNo:    app.LegalPersonIDCardNo,
		LegalPersonIDCardFront: app.LegalPersonIDCardFront,
		LegalPersonIDCardBack:  app.LegalPersonIDCardBack,
		ContactPhone:           app.ContactPhone,
		ContactName:            app.ContactName,
		Address:                app.Address,
		OpenTime:               app.BusinessHours,
		MainProducts:           string(mainProductsJSON),
		IsVerified:             true,
	}
	if err := tx.Create(&shop).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "创建主材商失败")
		return
	}

	for _, appProduct := range appProducts {
		var images []string
		_ = json.Unmarshal([]byte(appProduct.ImagesJSON), &images)
		coverImage := ""
		if len(images) > 0 {
			coverImage = images[0]
		}

		product := model.MaterialShopProduct{
			ShopID:     shop.ID,
			Name:       appProduct.Name,
			ParamsJSON: appProduct.ParamsJSON,
			Price:      appProduct.Price,
			ImagesJSON: appProduct.ImagesJSON,
			CoverImage: coverImage,
			Status:     1,
			SortOrder:  appProduct.SortOrder,
		}
		if err := tx.Create(&product).Error; err != nil {
			tx.Rollback()
			response.Error(c, 500, "创建商品失败")
			return
		}
	}

	now := time.Now()
	if err := freezeMerchantIdentity(tx, user.ID, previousIdentity); err != nil {
		tx.Rollback()
		response.Error(c, 500, "冻结旧商家身份失败: "+err.Error())
		return
	}
	if err := ensureMerchantIdentity(tx, user.ID, merchantIdentityTypeMaterial, shop.ID, adminID, merchantIdentityStatusActive); err != nil {
		tx.Rollback()
		response.Error(c, 500, "激活主材商身份失败: "+err.Error())
		return
	}
	app.Status = 1
	app.AuditedBy = adminID
	app.AuditedAt = &now
	app.UserID = user.ID
	app.ShopID = shop.ID
	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		response.Error(c, 500, "更新申请状态失败")
		return
	}

	if err := tx.Commit().Error; err != nil {
		response.Error(c, 500, "审核失败，请稍后重试")
		return
	}

	response.Success(c, gin.H{
		"message": "审核通过",
		"userId":  user.ID,
		"shopId":  shop.ID,
	})
}

func AdminRejectMaterialShopApplication(c *gin.Context) {
	appID := parseUint64(c.Param("id"))
	adminID := c.GetUint64("adminId")

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.Error(c, 400, "请填写拒绝原因")
		return
	}

	var app model.MaterialShopApplication
	if err := repository.DB.First(&app, appID).Error; err != nil {
		response.Error(c, 404, "申请不存在")
		return
	}
	if app.Status != 0 {
		response.Error(c, 400, "该申请已处理")
		return
	}

	now := time.Now()
	app.Status = 2
	app.RejectReason = strings.TrimSpace(input.Reason)
	app.AuditedBy = adminID
	app.AuditedAt = &now

	if err := repository.DB.Save(&app).Error; err != nil {
		response.Error(c, 500, "操作失败")
		return
	}

	response.Success(c, gin.H{"message": "已拒绝"})
}
