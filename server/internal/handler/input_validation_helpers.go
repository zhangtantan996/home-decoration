package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/utils"
)

const (
	adminTextShortMax  = 80
	adminTextMediumMax = 200
	adminTextLongMax   = 1000
	adminPriceMax      = 10000000
)

func validateRuneLength(label, value string, max int) error {
	if len([]rune(strings.TrimSpace(value))) > max {
		return fmt.Errorf("%s不能超过 %d 字符", label, max)
	}
	return nil
}

func optionalStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func requireLocalAssetReference(label, value string) (string, error) {
	normalized := normalizeStoredAsset(strings.TrimSpace(value))
	if normalized == "" {
		return "", nil
	}
	if !imgutil.IsLocalAssetReference(normalized) {
		return "", fmt.Errorf("%s仅支持平台上传文件", label)
	}
	return normalized, nil
}

func requireLocalAssetReferences(label string, values []string, maxCount int) ([]string, error) {
	normalized := normalizeStoredAssetSlice(values)
	if len(normalized) > maxCount {
		return nil, fmt.Errorf("%s最多支持 %d 张", label, maxCount)
	}
	for _, value := range normalized {
		if !imgutil.IsLocalAssetReference(value) {
			return nil, fmt.Errorf("%s仅支持平台上传文件", label)
		}
	}
	return normalized, nil
}

func requireLocalAssetJSONArray(label, raw string, maxCount int) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return "", nil
	}
	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return "", fmt.Errorf("%s格式错误", label)
	}
	normalized, err := requireLocalAssetReferences(label, values, maxCount)
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func validateJSONStringArray(label, value string, maxCount int, itemMax int) error {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return nil
	}
	var items []string
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return fmt.Errorf("%s必须是 JSON 数组格式", label)
	}
	if len(items) > maxCount {
		return fmt.Errorf("%s最多支持 %d 项", label, maxCount)
	}
	for _, item := range items {
		if len([]rune(strings.TrimSpace(item))) > itemMax {
			return fmt.Errorf("%s单项不能超过 %d 字符", label, itemMax)
		}
	}
	return nil
}

func validateOptionalJSON(label, value string) error {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return nil
	}
	var payload interface{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return fmt.Errorf("%s格式错误", label)
	}
	return nil
}

func validateProviderCoreFields(providerType int8, status int8, subType, entityType, priceUnit string, priceMin, priceMax float64) error {
	if providerType < 1 || providerType > 3 {
		return errors.New("服务商类型无效")
	}
	if status < 0 || status > 1 {
		return errors.New("服务商状态无效")
	}
	if subType != "" && !oneOf(subType, "personal", "studio", "company", "foreman", "designer") {
		return errors.New("主体类型无效")
	}
	if entityType != "" && !oneOf(entityType, "personal", "studio", "company") {
		return errors.New("主体属性无效")
	}
	if priceUnit != "" && !oneOf(priceUnit, "元/㎡", "元/天", "元/套", "元/全包", "元/半包") {
		return errors.New("价格单位无效")
	}
	if priceMin < 0 || priceMax < 0 || priceMin > adminPriceMax || priceMax > adminPriceMax {
		return errors.New("价格范围无效")
	}
	if priceMax > 0 && priceMin > priceMax {
		return errors.New("最高价不能低于最低价")
	}
	return nil
}

func validateProviderMetricFields(yearsExperience, followersCount, teamSize, establishedYear int, restoreRate, budgetControl *float32) error {
	if yearsExperience < 0 || yearsExperience > 80 {
		return errors.New("从业年限范围无效")
	}
	if followersCount < 0 || followersCount > 100000000 {
		return errors.New("关注数范围无效")
	}
	if teamSize < 0 || teamSize > 10000 {
		return errors.New("团队规模范围无效")
	}
	if establishedYear != 0 && (establishedYear < 1900 || establishedYear > time.Now().Year()) {
		return errors.New("成立年份范围无效")
	}
	if restoreRate != nil && (*restoreRate < 0 || *restoreRate > 100) {
		return errors.New("还原度范围无效")
	}
	if budgetControl != nil && (*budgetControl < 0 || *budgetControl > 100) {
		return errors.New("预算控制力范围无效")
	}
	return nil
}

func validateProviderOptionalMetricFields(yearsExperience, followersCount, teamSize, establishedYear *int, restoreRate, budgetControl *float32) error {
	if yearsExperience != nil && (*yearsExperience < 0 || *yearsExperience > 80) {
		return errors.New("从业年限范围无效")
	}
	if followersCount != nil && (*followersCount < 0 || *followersCount > 100000000) {
		return errors.New("关注数范围无效")
	}
	if teamSize != nil && (*teamSize < 0 || *teamSize > 10000) {
		return errors.New("团队规模范围无效")
	}
	if establishedYear != nil && *establishedYear != 0 && (*establishedYear < 1900 || *establishedYear > time.Now().Year()) {
		return errors.New("成立年份范围无效")
	}
	if restoreRate != nil && (*restoreRate < 0 || *restoreRate > 100) {
		return errors.New("还原度范围无效")
	}
	if budgetControl != nil && (*budgetControl < 0 || *budgetControl > 100) {
		return errors.New("预算控制力范围无效")
	}
	return nil
}

func validateAdminProviderTextFields(companyName, specialty, workTypes, highlightTags, serviceIntro, certifications, officeAddress string) error {
	if strings.TrimSpace(companyName) == "" || len([]rune(strings.TrimSpace(companyName))) > adminTextShortMax {
		return errors.New("展示名称需在 1-80 字符之间")
	}
	for label, value := range map[string]string{
		"擅长领域": specialty,
		"服务类型": workTypes,
		"亮点标签": highlightTags,
		"资质证书": certifications,
		"办公地址": officeAddress,
	} {
		if err := validateRuneLength(label, value, adminTextMediumMax); err != nil {
			return err
		}
	}
	return validateRuneLength("服务介绍", serviceIntro, adminTextLongMax)
}

func validateMaterialShopTextFields(companyName, address, contactName, serviceArea, mainBrands, mainCategories, productCategories, description, deliveryCapability, installationCapability, afterSalesPolicy, invoiceCapability string) error {
	for label, value := range map[string]string{
		"公司名称": companyName,
		"地址":   address,
		"联系人":  contactName,
		"服务区域": serviceArea,
		"主营品牌": mainBrands,
		"主营品类": mainCategories,
		"产品分类": productCategories,
	} {
		if err := validateRuneLength(label, value, adminTextMediumMax); err != nil {
			return err
		}
	}
	for label, value := range map[string]string{
		"门店介绍": description,
		"配送能力": deliveryCapability,
		"安装能力": installationCapability,
		"售后政策": afterSalesPolicy,
		"发票能力": invoiceCapability,
	} {
		if err := validateRuneLength(label, value, adminTextLongMax); err != nil {
			return err
		}
	}
	return nil
}

func validateMaterialShopType(value string) error {
	if value == "" || oneOf(value, "showroom", "brand") {
		return nil
	}
	return errors.New("门店类型无效")
}

func validateMaterialShopContactPhone(value string) error {
	phone := strings.TrimSpace(value)
	if phone == "" {
		return nil
	}
	if utils.ValidatePhone(phone) {
		return nil
	}
	if regexp.MustCompile(`^0\d{2,3}-?\d{7,8}$`).MatchString(phone) {
		return nil
	}
	return errors.New("联系电话格式不正确")
}

func validateLatLng(lat, lng *float64) error {
	if lat != nil && (math.IsNaN(*lat) || *lat < -90 || *lat > 90) {
		return errors.New("纬度范围无效")
	}
	if lng != nil && (math.IsNaN(*lng) || *lng < -180 || *lng > 180) {
		return errors.New("经度范围无效")
	}
	return nil
}

func validateYearText(value string) error {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return nil
	}
	year, err := strconv.Atoi(raw)
	if err != nil || year < 1900 || year > time.Now().Year() {
		return errors.New("年份范围无效")
	}
	return nil
}

func oneOf(value string, allowed ...string) bool {
	for _, item := range allowed {
		if value == item {
			return true
		}
	}
	return false
}
