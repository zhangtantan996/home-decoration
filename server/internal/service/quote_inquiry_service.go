package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/utils"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// QuoteInquiryService 智能报价询价服务
type QuoteInquiryService struct{}

const (
	quoteInquiryUnknownCityCode  = "000000"
	quoteInquiryAccessPurpose    = "quote_inquiry_access"
	quoteInquiryAccessTokenTTL   = 24 * time.Hour
	quoteInquiryDateFormat       = "2006-01-02 15:04:05"
	quoteInquiryDateOnlyFormat   = "2006-01-02"
	residentialAreaMin           = 10
	residentialAreaMax           = 2000
)

type quoteInquiryAccessClaims struct {
	InquiryID uint64 `json:"inquiryId"`
	Purpose   string `json:"purpose"`
	jwt.RegisteredClaims
}

type quoteInquiryCityMeta struct {
	Code    string
	Name    string
	Aliases []string
}

var quoteInquiryCities = []quoteInquiryCityMeta{
	{Code: "110100", Name: "北京", Aliases: []string{"北京市", "北京"}},
	{Code: "310100", Name: "上海", Aliases: []string{"上海市", "上海"}},
	{Code: "440100", Name: "广州", Aliases: []string{"广州市", "广州"}},
	{Code: "440300", Name: "深圳", Aliases: []string{"深圳市", "深圳"}},
	{Code: "330100", Name: "杭州", Aliases: []string{"杭州市", "杭州"}},
	{Code: "510100", Name: "成都", Aliases: []string{"成都市", "成都"}},
	{Code: "420100", Name: "武汉", Aliases: []string{"武汉市", "武汉"}},
	{Code: "610100", Name: "西安", Aliases: []string{"西安市", "西安"}},
	{Code: "320100", Name: "南京", Aliases: []string{"南京市", "南京"}},
	{Code: "500100", Name: "重庆", Aliases: []string{"重庆市", "重庆"}},
}

var quoteInquiryRenovationTypeAliases = map[string]string{
	"new":  "新房装修",
	"新房":   "新房装修",
	"新房装修": "新房装修",
	"old":  "老房翻新",
	"旧房翻新": "老房翻新",
	"老房":   "老房翻新",
	"老房翻新": "老房翻新",
	"partial": "局部改造",
	"局改":     "局部改造",
	"局部改造":  "局部改造",
}

var quoteInquiryStyleAliases = map[string]string{
	"modern": "现代简约",
	"现代":     "现代简约",
	"现代简约":  "现代简约",
	"nordic": "北欧",
	"北欧":     "北欧",
	"北欧风":    "北欧",
	"chinese": "新中式",
	"中式":      "新中式",
	"新中式":    "新中式",
	"light":  "轻奢",
	"轻奢":     "轻奢",
	"轻奢风":    "轻奢",
	"cream":  "奶油风",
	"奶油":     "奶油风",
	"奶油风":    "奶油风",
	"european": "欧式",
	"欧式":       "欧式",
	"american": "美式",
	"美式":       "美式",
	"japanese": "日式",
	"日式":       "日式",
	"industrial": "工业风",
	"工业":         "工业风",
	"工业风":       "工业风",
	"other": "其他",
	"其他":     "其他",
}

// CreateInquiryRequest 创建询价请求
type CreateInquiryRequest struct {
	UserID         *uint64 `json:"userId"`
	OpenID         string  `json:"openId"`
	Phone          string  `json:"phone"`
	Address        string  `json:"address" binding:"required"`
	CityCode       string  `json:"cityCode"`
	Area           float64 `json:"area" binding:"required"`
	HouseLayout    string  `json:"houseLayout"`
	RenovationType string  `json:"renovationType" binding:"required"`
	Style          string  `json:"style" binding:"required"`
	BudgetRange    string  `json:"budgetRange"`
	Source         string  `json:"source"`
}

// QuoteResult 报价结果
type QuoteResult struct {
	TotalMin              float64         `json:"totalMin"`
	TotalMax              float64         `json:"totalMax"`
	DesignFee             PriceRange      `json:"designFee"`
	ConstructionFee       PriceRange      `json:"constructionFee"`
	MaterialFee           PriceRange      `json:"materialFee"`
	EstimatedDuration     int             `json:"estimatedDuration"`
	Breakdown             []BreakdownItem `json:"breakdown"`
	CityCoefficient       float64         `json:"cityCoefficient"`
	AreaCoefficient       float64         `json:"areaCoefficient"`
	StyleCoefficient      float64         `json:"styleCoefficient"`
	ComplexityCoefficient float64         `json:"complexityCoefficient"`
	Tips                  []string        `json:"tips,omitempty"`
}

// PriceRange 价格区间
type PriceRange struct {
	Min float64 `json:"min"`
	Max float64 `json:"max"`
}

// BreakdownItem 报价明细项
type BreakdownItem struct {
	Category    string  `json:"category"`
	Description string  `json:"description"`
	Min         float64 `json:"min"`
	Max         float64 `json:"max"`
}

// QuoteInquiryPublicInfo 公开结果页基础信息
type QuoteInquiryPublicInfo struct {
	ID             uint64  `json:"id"`
	CityCode       string  `json:"cityCode"`
	CityName       string  `json:"cityName"`
	Area           float64 `json:"area"`
	HouseLayout    string  `json:"houseLayout"`
	RenovationType string  `json:"renovationType"`
	Style          string  `json:"style"`
	BudgetRange    string  `json:"budgetRange,omitempty"`
	CreatedAt      string  `json:"createdAt"`
}

// QuoteInquiryPublicDetail 公开结果页详情
type QuoteInquiryPublicDetail struct {
	Inquiry     QuoteInquiryPublicInfo `json:"inquiry"`
	Result      *QuoteResult           `json:"result"`
	AccessToken string                 `json:"accessToken,omitempty"`
}

// AdminQuoteInquiryListFilter 管理后台筛选条件
type AdminQuoteInquiryListFilter struct {
	Page             int
	PageSize         int
	Keyword          string
	City             string
	CityCode         string
	ConversionStatus string
	StartDate        string
	EndDate          string
	HasPhone         *bool
}

// AdminQuoteInquiryListItem 管理后台列表项
type AdminQuoteInquiryListItem struct {
	ID               uint64  `json:"id"`
	UserID           *uint64 `json:"userId"`
	PhoneMasked      string  `json:"phoneMasked"`
	AddressMasked    string  `json:"addressMasked"`
	CityCode         string  `json:"cityCode"`
	CityName         string  `json:"cityName"`
	Area             float64 `json:"area"`
	HouseLayout      string  `json:"houseLayout"`
	RenovationType   string  `json:"renovationType"`
	Style            string  `json:"style"`
	BudgetRange      string  `json:"budgetRange"`
	TotalMin         float64 `json:"totalMin"`
	TotalMax         float64 `json:"totalMax"`
	ConversionStatus string  `json:"conversionStatus"`
	Source           string  `json:"source"`
	HasPhone         bool    `json:"hasPhone"`
	CreatedAt        string  `json:"createdAt"`
}

// AdminQuoteInquiryDetail 管理后台详情
type AdminQuoteInquiryDetail struct {
	AdminQuoteInquiryListItem
	Phone                 string       `json:"phone,omitempty"`
	Address               string       `json:"address,omitempty"`
	Result                *QuoteResult `json:"result"`
	EstimatedDurationDays int          `json:"estimatedDurationDays"`
	OpenID                string       `json:"openId,omitempty"`
	UpdatedAt             string       `json:"updatedAt"`
}

// CreateInquiry 创建询价记录并计算报价
func (s *QuoteInquiryService) CreateInquiry(req *CreateInquiryRequest) (*model.QuoteInquiry, *QuoteResult, error) {
	normalizedReq, _, err := normalizeCreateInquiryRequest(req)
	if err != nil {
		return nil, nil, err
	}

	if normalizedReq.Area < residentialAreaMin || normalizedReq.Area > residentialAreaMax {
		return nil, nil, fmt.Errorf("房屋面积需在 %d-%d ㎡ 之间", residentialAreaMin, residentialAreaMax)
	}
	if len([]rune(strings.TrimSpace(normalizedReq.Address))) < 5 {
		return nil, nil, errors.New("地址长度需至少 5 个字符")
	}

	quoteResult, err := s.Calculate(normalizedReq)
	if err != nil {
		return nil, nil, fmt.Errorf("报价计算失败: %w", err)
	}
	quoteResult.Tips = buildQuoteInquiryTips(normalizedReq)

	quoteJSON, err := json.Marshal(quoteResult)
	if err != nil {
		return nil, nil, fmt.Errorf("序列化报价结果失败: %w", err)
	}

	inquiry := &model.QuoteInquiry{
		UserID:                cloneUint64Pointer(normalizedReq.UserID),
		OpenID:                strings.TrimSpace(normalizedReq.OpenID),
		Phone:                 strings.TrimSpace(normalizedReq.Phone),
		Address:               strings.TrimSpace(normalizedReq.Address),
		CityCode:              strings.TrimSpace(normalizedReq.CityCode),
		Area:                  normalizedReq.Area,
		HouseLayout:           strings.TrimSpace(normalizedReq.HouseLayout),
		RenovationType:        normalizedReq.RenovationType,
		Style:                 normalizedReq.Style,
		BudgetRange:           strings.TrimSpace(normalizedReq.BudgetRange),
		QuoteResultJSON:       string(quoteJSON),
		TotalMin:              quoteResult.TotalMin,
		TotalMax:              quoteResult.TotalMax,
		DesignFeeMin:          quoteResult.DesignFee.Min,
		DesignFeeMax:          quoteResult.DesignFee.Max,
		ConstructionFeeMin:    quoteResult.ConstructionFee.Min,
		ConstructionFeeMax:    quoteResult.ConstructionFee.Max,
		MaterialFeeMin:        quoteResult.MaterialFee.Min,
		MaterialFeeMax:        quoteResult.MaterialFee.Max,
		EstimatedDurationDays: quoteResult.EstimatedDuration,
		ConversionStatus:      "pending",
		Source:                normalizedReq.Source,
	}

	if inquiry.Source == "" {
		inquiry.Source = "mini_program"
	}

	if err := encryptQuoteInquirySensitiveFields(inquiry); err != nil {
		return nil, nil, fmt.Errorf("加密敏感信息失败: %w", err)
	}

	if err := repository.DB.Create(inquiry).Error; err != nil {
		return nil, nil, fmt.Errorf("保存询价记录失败: %w", err)
	}

	return inquiry, quoteResult, nil
}

// GetInquiryDetailForPublic 获取公开结果页详情
func (s *QuoteInquiryService) GetInquiryDetailForPublic(id, userID uint64, accessToken string) (*QuoteInquiryPublicDetail, error) {
	inquiry, err := s.getInquiryByID(id)
	if err != nil {
		return nil, err
	}

	if userID > 0 {
		if inquiry.UserID == nil || *inquiry.UserID != userID {
			return nil, errors.New("无权查看该报价记录")
		}
	} else {
		if err := s.VerifyAccessToken(accessToken, id); err != nil {
			return nil, err
		}
	}

	return buildQuoteInquiryPublicDetail(inquiry, parseQuoteInquiryResult(inquiry), ""), nil
}

// IssueAccessToken 为匿名结果页生成短时访问凭证
func (s *QuoteInquiryService) IssueAccessToken(inquiryID uint64) (string, error) {
	secret := strings.TrimSpace(config.GetConfig().JWT.Secret)
	if secret == "" {
		return "", errors.New("JWT_SECRET 未配置")
	}

	now := time.Now()
	claims := quoteInquiryAccessClaims{
		InquiryID: inquiryID,
		Purpose:   quoteInquiryAccessPurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(inquiryID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(quoteInquiryAccessTokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// VerifyAccessToken 验证匿名结果页访问凭证
func (s *QuoteInquiryService) VerifyAccessToken(accessToken string, inquiryID uint64) error {
	accessToken = strings.TrimSpace(accessToken)
	if accessToken == "" {
		return errors.New("无权查看该报价记录：缺少访问凭证")
	}

	secret := strings.TrimSpace(config.GetConfig().JWT.Secret)
	if secret == "" {
		return errors.New("JWT_SECRET 未配置")
	}

	var claims quoteInquiryAccessClaims
	token, err := jwt.ParseWithClaims(accessToken, &claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return errors.New("无权查看该报价记录：访问凭证无效或已过期")
	}
	if claims.Purpose != quoteInquiryAccessPurpose || claims.InquiryID != inquiryID {
		return errors.New("无权查看该报价记录：访问凭证无效或已过期")
	}

	return nil
}

// GetInquiryDetailForAdmin 获取管理后台详情
func (s *QuoteInquiryService) GetInquiryDetailForAdmin(id uint64) (*AdminQuoteInquiryDetail, error) {
	inquiry, err := s.getInquiryByID(id)
	if err != nil {
		return nil, err
	}

	return buildAdminQuoteInquiryDetail(inquiry, parseQuoteInquiryResult(inquiry)), nil
}

// AdminListInquiries 管理后台查询询价列表
func (s *QuoteInquiryService) AdminListInquiries(filter AdminQuoteInquiryListFilter) ([]AdminQuoteInquiryListItem, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 10
	}

	query := repository.DB.Model(&model.QuoteInquiry{})
	query = applyQuoteInquiryAdminFilters(query, filter)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计询价记录失败: %w", err)
	}

	var inquiries []model.QuoteInquiry
	offset := (filter.Page - 1) * filter.PageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(filter.PageSize).Find(&inquiries).Error; err != nil {
		return nil, 0, fmt.Errorf("查询询价记录失败: %w", err)
	}

	items := make([]AdminQuoteInquiryListItem, 0, len(inquiries))
	for i := range inquiries {
		items = append(items, buildAdminQuoteInquiryListItem(&inquiries[i]))
	}

	return items, total, nil
}

// Calculate 计算报价
func (s *QuoteInquiryService) Calculate(req *CreateInquiryRequest) (*QuoteResult, error) {
	normalizedReq, _, err := normalizeCreateInquiryRequest(req)
	if err != nil {
		return nil, err
	}
	if normalizedReq.Area < residentialAreaMin || normalizedReq.Area > residentialAreaMax {
		return nil, fmt.Errorf("房屋面积需在 %d-%d ㎡ 之间", residentialAreaMin, residentialAreaMax)
	}

	baseUnitPrice := s.getBaseUnitPrices(normalizedReq.RenovationType)
	cityCoef := s.getCityCoefficient(normalizedReq.CityCode)
	styleCoef := s.getStyleCoefficient(normalizedReq.Style)
	areaCoef := s.getAreaCoefficient(normalizedReq.Area)
	complexityCoef := s.getLayoutComplexity(normalizedReq.HouseLayout)

	finalUnitPrice := baseUnitPrice * cityCoef * styleCoef * areaCoef * complexityCoef
	totalBase := finalUnitPrice * normalizedReq.Area

	designFee := PriceRange{
		Min: math.Round(totalBase * 0.10 * 0.8),
		Max: math.Round(totalBase * 0.10 * 1.2),
	}
	constructionFee := PriceRange{
		Min: math.Round(totalBase * 0.45 * 0.85),
		Max: math.Round(totalBase * 0.45 * 1.15),
	}
	materialFee := PriceRange{
		Min: math.Round(totalBase * 0.45 * 0.75),
		Max: math.Round(totalBase * 0.45 * 1.35),
	}

	totalMin := designFee.Min + constructionFee.Min + materialFee.Min
	totalMax := designFee.Max + constructionFee.Max + materialFee.Max
	duration := s.calculateDuration(normalizedReq.Area, normalizedReq.RenovationType, normalizedReq.Style)

	return &QuoteResult{
		TotalMin:              totalMin,
		TotalMax:              totalMax,
		DesignFee:             designFee,
		ConstructionFee:       constructionFee,
		MaterialFee:           materialFee,
		EstimatedDuration:     duration,
		Breakdown:             s.buildBreakdown(designFee, constructionFee, materialFee),
		CityCoefficient:       cityCoef,
		AreaCoefficient:       areaCoef,
		StyleCoefficient:      styleCoef,
		ComplexityCoefficient: complexityCoef,
	}, nil
}

func (s *QuoteInquiryService) getInquiryByID(id uint64) (*model.QuoteInquiry, error) {
	var inquiry model.QuoteInquiry
	if err := repository.DB.First(&inquiry, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("报价记录不存在")
		}
		return nil, fmt.Errorf("查询报价记录失败: %w", err)
	}
	return &inquiry, nil
}

func buildQuoteInquiryPublicDetail(inquiry *model.QuoteInquiry, result *QuoteResult, accessToken string) *QuoteInquiryPublicDetail {
	if inquiry == nil {
		return nil
	}

	return &QuoteInquiryPublicDetail{
		Inquiry: QuoteInquiryPublicInfo{
			ID:             inquiry.ID,
			CityCode:       strings.TrimSpace(inquiry.CityCode),
			CityName:       cityNameByCode(inquiry.CityCode),
			Area:           inquiry.Area,
			HouseLayout:    strings.TrimSpace(inquiry.HouseLayout),
			RenovationType: strings.TrimSpace(inquiry.RenovationType),
			Style:          strings.TrimSpace(inquiry.Style),
			BudgetRange:    strings.TrimSpace(inquiry.BudgetRange),
			CreatedAt:      inquiry.CreatedAt.Format(quoteInquiryDateFormat),
		},
		Result:      result,
		AccessToken: accessToken,
	}
}

func buildAdminQuoteInquiryListItem(inquiry *model.QuoteInquiry) AdminQuoteInquiryListItem {
	if inquiry == nil {
		return AdminQuoteInquiryListItem{}
	}

	phone := strings.TrimSpace(inquiry.Phone)
	address := strings.TrimSpace(inquiry.Address)

	return AdminQuoteInquiryListItem{
		ID:               inquiry.ID,
		UserID:           cloneUint64Pointer(inquiry.UserID),
		PhoneMasked:      maskPhoneForDisplay(phone),
		AddressMasked:    maskAddressForDisplay(address),
		CityCode:         strings.TrimSpace(inquiry.CityCode),
		CityName:         cityNameByCode(inquiry.CityCode),
		Area:             inquiry.Area,
		HouseLayout:      strings.TrimSpace(inquiry.HouseLayout),
		RenovationType:   strings.TrimSpace(inquiry.RenovationType),
		Style:            strings.TrimSpace(inquiry.Style),
		BudgetRange:      strings.TrimSpace(inquiry.BudgetRange),
		TotalMin:         inquiry.TotalMin,
		TotalMax:         inquiry.TotalMax,
		ConversionStatus: strings.TrimSpace(inquiry.ConversionStatus),
		Source:           strings.TrimSpace(inquiry.Source),
		HasPhone:         phone != "",
		CreatedAt:        inquiry.CreatedAt.Format(quoteInquiryDateFormat),
	}
}

func buildAdminQuoteInquiryDetail(inquiry *model.QuoteInquiry, result *QuoteResult) *AdminQuoteInquiryDetail {
	item := buildAdminQuoteInquiryListItem(inquiry)
	return &AdminQuoteInquiryDetail{
		AdminQuoteInquiryListItem: item,
		Phone:                    strings.TrimSpace(inquiry.Phone),
		Address:                  strings.TrimSpace(inquiry.Address),
		Result:                   result,
		EstimatedDurationDays:    inquiry.EstimatedDurationDays,
		OpenID:                   strings.TrimSpace(inquiry.OpenID),
		UpdatedAt:                inquiry.UpdatedAt.Format(quoteInquiryDateFormat),
	}
}

func parseQuoteInquiryResult(inquiry *model.QuoteInquiry) *QuoteResult {
	if inquiry == nil {
		return nil
	}

	var result QuoteResult
	if strings.TrimSpace(inquiry.QuoteResultJSON) != "" {
		if err := json.Unmarshal([]byte(inquiry.QuoteResultJSON), &result); err == nil {
			if len(result.Tips) == 0 {
				result.Tips = buildQuoteInquiryTips(&CreateInquiryRequest{
					Address:        inquiry.Address,
					CityCode:       inquiry.CityCode,
					Area:           inquiry.Area,
					HouseLayout:    inquiry.HouseLayout,
					RenovationType: inquiry.RenovationType,
					Style:          inquiry.Style,
					BudgetRange:    inquiry.BudgetRange,
					Source:         inquiry.Source,
				})
			}
			return &result
		}
	}

	fallback := &QuoteResult{
		TotalMin:          inquiry.TotalMin,
		TotalMax:          inquiry.TotalMax,
		DesignFee:         PriceRange{Min: inquiry.DesignFeeMin, Max: inquiry.DesignFeeMax},
		ConstructionFee:   PriceRange{Min: inquiry.ConstructionFeeMin, Max: inquiry.ConstructionFeeMax},
		MaterialFee:       PriceRange{Min: inquiry.MaterialFeeMin, Max: inquiry.MaterialFeeMax},
		EstimatedDuration: inquiry.EstimatedDurationDays,
		Breakdown: []BreakdownItem{
			{Category: "设计费", Description: "包含方案设计、效果图、施工图等", Min: inquiry.DesignFeeMin, Max: inquiry.DesignFeeMax},
			{Category: "施工费", Description: "包含人工费、辅材费、管理费等", Min: inquiry.ConstructionFeeMin, Max: inquiry.ConstructionFeeMax},
			{Category: "主材费", Description: "包含地板、瓷砖、洁具、橱柜等主材", Min: inquiry.MaterialFeeMin, Max: inquiry.MaterialFeeMax},
		},
		Tips: buildQuoteInquiryTips(&CreateInquiryRequest{
			Address:        inquiry.Address,
			CityCode:       inquiry.CityCode,
			Area:           inquiry.Area,
			HouseLayout:    inquiry.HouseLayout,
			RenovationType: inquiry.RenovationType,
			Style:          inquiry.Style,
			BudgetRange:    inquiry.BudgetRange,
			Source:         inquiry.Source,
		}),
	}
	return fallback
}

func applyQuoteInquiryAdminFilters(query *gorm.DB, filter AdminQuoteInquiryListFilter) *gorm.DB {
	if filter.ConversionStatus != "" {
		query = query.Where("conversion_status = ?", strings.TrimSpace(filter.ConversionStatus))
	}

	if cityFilter := strings.TrimSpace(quoteInquiryFirstNonEmpty(filter.City, filter.CityCode)); cityFilter != "" {
		cityCodes := resolveCityCodes(cityFilter)
		if len(cityCodes) > 0 {
			query = query.Where("(city_code IN ? OR address LIKE ?)", cityCodes, "%"+cityFilter+"%")
		} else {
			query = query.Where("address LIKE ?", "%"+cityFilter+"%")
		}
	}

	if filter.HasPhone != nil {
		if *filter.HasPhone {
			query = query.Where("(COALESCE(phone_encrypted, '') <> '' OR COALESCE(phone, '') <> '')")
		} else {
			query = query.Where("(COALESCE(phone_encrypted, '') = '' AND COALESCE(phone, '') = '')")
		}
	}

	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		likeKeyword := "%" + keyword + "%"
		query = query.Where(`(
			CAST(id AS TEXT) LIKE ? OR
			CAST(COALESCE(user_id, 0) AS TEXT) LIKE ? OR
			address LIKE ? OR
			phone LIKE ? OR
			city_code LIKE ? OR
			house_layout LIKE ? OR
			renovation_type LIKE ? OR
			style LIKE ? OR
			budget_range LIKE ? OR
			source LIKE ?
		)`, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword)
	}

	if startDate := parseQuoteInquiryDate(filter.StartDate); !startDate.IsZero() {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate := parseQuoteInquiryDate(filter.EndDate); !endDate.IsZero() {
		query = query.Where("created_at < ?", endDate.Add(24*time.Hour))
	}

	return query
}

func normalizeCreateInquiryRequest(req *CreateInquiryRequest) (*CreateInquiryRequest, string, error) {
	if req == nil {
		return nil, "", errors.New("参数不能为空")
	}

	address := strings.TrimSpace(req.Address)
	if address == "" {
		return nil, "", errors.New("请输入房屋地址")
	}

	renovationType, err := normalizeQuoteInquiryRenovationType(req.RenovationType)
	if err != nil {
		return nil, "", err
	}
	style, err := normalizeQuoteInquiryStyle(req.Style)
	if err != nil {
		return nil, "", err
	}

	cityCode := normalizeQuoteInquiryCityCode(req.CityCode)
	cityName := cityNameByCode(cityCode)
	if cityCode == "" || cityCode == quoteInquiryUnknownCityCode || cityName == "" {
		detectedCode, detectedName := detectQuoteInquiryCity(address)
		if detectedCode != "" {
			cityCode = detectedCode
			cityName = detectedName
		}
	}
	if cityCode == "" {
		cityCode = quoteInquiryUnknownCityCode
	}

	return &CreateInquiryRequest{
		UserID:         cloneUint64Pointer(req.UserID),
		OpenID:         strings.TrimSpace(req.OpenID),
		Phone:          strings.TrimSpace(req.Phone),
		Address:        address,
		CityCode:       cityCode,
		Area:           req.Area,
		HouseLayout:    strings.TrimSpace(req.HouseLayout),
		RenovationType: renovationType,
		Style:          style,
		BudgetRange:    strings.TrimSpace(req.BudgetRange),
		Source:         strings.TrimSpace(req.Source),
	}, cityName, nil
}

func normalizeQuoteInquiryRenovationType(raw string) (string, error) {
	key := strings.ToLower(strings.TrimSpace(raw))
	if value, ok := quoteInquiryRenovationTypeAliases[key]; ok {
		return value, nil
	}
	return "", errors.New("不支持的装修类型")
}

func normalizeQuoteInquiryStyle(raw string) (string, error) {
	key := strings.ToLower(strings.TrimSpace(raw))
	if value, ok := quoteInquiryStyleAliases[key]; ok {
		return value, nil
	}
	return "", errors.New("不支持的装修风格")
}

func normalizeQuoteInquiryCityCode(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	for _, city := range quoteInquiryCities {
		if city.Code == raw {
			return city.Code
		}
		if city.Name == raw {
			return city.Code
		}
		for _, alias := range city.Aliases {
			if alias == raw {
				return city.Code
			}
		}
	}
	return raw
}

func cityNameByCode(code string) string {
	code = strings.TrimSpace(code)
	for _, city := range quoteInquiryCities {
		if city.Code == code {
			return city.Name
		}
	}
	return ""
}

func detectQuoteInquiryCity(address string) (string, string) {
	address = strings.TrimSpace(address)
	for _, city := range quoteInquiryCities {
		for _, alias := range city.Aliases {
			if strings.Contains(address, alias) {
				return city.Code, city.Name
			}
		}
	}
	return quoteInquiryUnknownCityCode, ""
}

func resolveCityCodes(keyword string) []string {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return nil
	}

	if matchedCode := normalizeQuoteInquiryCityCode(keyword); matchedCode != "" {
		if matchedCode != keyword || regexp.MustCompile(`^\d{6}$`).MatchString(keyword) {
			return []string{matchedCode}
		}
	}

	seen := make(map[string]struct{})
	result := make([]string, 0, 2)
	for _, city := range quoteInquiryCities {
		if strings.Contains(city.Name, keyword) || strings.Contains(keyword, city.Name) {
			if _, ok := seen[city.Code]; !ok {
				seen[city.Code] = struct{}{}
				result = append(result, city.Code)
			}
			continue
		}
		for _, alias := range city.Aliases {
			if strings.Contains(alias, keyword) || strings.Contains(keyword, alias) {
				if _, ok := seen[city.Code]; !ok {
					seen[city.Code] = struct{}{}
					result = append(result, city.Code)
				}
				break
			}
		}
	}
	return result
}

func parseQuoteInquiryDate(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}
	}
	parsed, err := time.ParseInLocation(quoteInquiryDateOnlyFormat, raw, time.Local)
	if err != nil {
		return time.Time{}
	}
	return parsed
}

func cloneUint64Pointer(value *uint64) *uint64 {
	if value == nil || *value == 0 {
		return nil
	}
	cloned := *value
	return &cloned
}

func quoteInquiryFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func maskPhoneForDisplay(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if strings.Contains(value, "*") {
		return value
	}
	return utils.MaskPhone(value)
}

func maskAddressForDisplay(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if strings.Contains(value, "***") {
		return value
	}
	return maskAddressForStorage(value)
}

func buildQuoteInquiryTips(req *CreateInquiryRequest) []string {
	tips := []string{
		"以上报价为系统估算，实际价格以量房后的正式报价为准。",
		"报价不包含家具、家电等软装费用，复杂拆改与特殊工艺可能产生额外费用。",
	}

	switch strings.TrimSpace(req.RenovationType) {
	case "老房翻新":
		tips = append(tips, "老房翻新通常涉及拆改、水电更新和隐蔽工程排查，预算波动会更明显。")
	case "局部改造":
		tips = append(tips, "局部改造受现场衔接和成品保护影响较大，建议量房后再确认最终施工方案。")
	default:
		tips = append(tips, "建议在确认服务商前预约量房，结合现场条件进一步收敛预算和工期。")
	}

	return tips
}

// getBaseUnitPrices 获取基础单价（元/㎡）
func (s *QuoteInquiryService) getBaseUnitPrices(renovationType string) float64 {
	switch renovationType {
	case "新房装修":
		return 1200.0
	case "老房翻新":
		return 1500.0
	case "局部改造":
		return 1800.0
	default:
		return 1200.0
	}
}

// getCityCoefficient 获取城市系数
func (s *QuoteInquiryService) getCityCoefficient(cityCode string) float64 {
	firstTierCities := map[string]bool{
		"110000": true,
		"110100": true,
		"310000": true,
		"310100": true,
		"440100": true,
		"440300": true,
	}

	secondTierCities := map[string]bool{
		"330100": true,
		"320100": true,
		"510100": true,
		"420100": true,
		"610100": true,
	}

	if firstTierCities[strings.TrimSpace(cityCode)] {
		return 1.3
	}
	if secondTierCities[strings.TrimSpace(cityCode)] {
		return 1.1
	}
	return 1.0
}

// getStyleCoefficient 获取风格系数
func (s *QuoteInquiryService) getStyleCoefficient(style string) float64 {
	styleCoefficients := map[string]float64{
		"现代简约": 1.0,
		"北欧":   1.1,
		"新中式":  1.3,
		"轻奢":   1.4,
		"奶油风":  1.15,
		"欧式":   1.5,
		"美式":   1.4,
		"日式":   1.2,
		"工业风":  1.1,
		"其他":   1.0,
	}

	if coef, ok := styleCoefficients[strings.TrimSpace(style)]; ok {
		return coef
	}
	return 1.0
}

// getAreaCoefficient 获取面积系数
func (s *QuoteInquiryService) getAreaCoefficient(area float64) float64 {
	switch {
	case area < 60:
		return 1.15
	case area < 90:
		return 1.05
	case area < 120:
		return 1.0
	case area < 150:
		return 0.95
	case area < 200:
		return 0.90
	default:
		return 0.85
	}
}

// getLayoutComplexity 获取户型复杂度系数
func (s *QuoteInquiryService) getLayoutComplexity(houseLayout string) float64 {
	if strings.TrimSpace(houseLayout) == "" {
		return 1.0
	}

	complexity := 1.0
	re := regexp.MustCompile(`(\d+)室`)
	if matches := re.FindStringSubmatch(houseLayout); len(matches) > 1 {
		if rooms, err := strconv.Atoi(matches[1]); err == nil && rooms >= 4 {
			complexity += 0.1
		}
	}

	re = regexp.MustCompile(`(\d+)卫`)
	if matches := re.FindStringSubmatch(houseLayout); len(matches) > 1 {
		if bathrooms, err := strconv.Atoi(matches[1]); err == nil && bathrooms >= 2 {
			complexity += 0.05 * float64(bathrooms-1)
		}
	}

	return complexity
}

// calculateDuration 计算工期（天）
func (s *QuoteInquiryService) calculateDuration(area float64, renovationType, style string) int {
	baseDuration := 60

	extraDays := int(math.Floor((area - 80) / 20 * 3))
	if extraDays < 0 {
		extraDays = 0
	}
	duration := baseDuration + extraDays

	switch renovationType {
	case "老房翻新":
		duration += 10
	case "局部改造":
		duration -= 10
	}

	switch style {
	case "新中式":
		duration += 10
	case "欧式":
		duration += 15
	case "美式":
		duration += 10
	}

	if duration < 30 {
		duration = 30
	}
	if duration > 180 {
		duration = 180
	}

	return duration
}

// buildBreakdown 构建报价明细
func (s *QuoteInquiryService) buildBreakdown(designFee, constructionFee, materialFee PriceRange) []BreakdownItem {
	return []BreakdownItem{
		{
			Category:    "设计费",
			Description: "包含方案设计、效果图、施工图等",
			Min:         designFee.Min,
			Max:         designFee.Max,
		},
		{
			Category:    "施工费",
			Description: "包含人工费、辅材费、管理费等",
			Min:         constructionFee.Min,
			Max:         constructionFee.Max,
		},
		{
			Category:    "主材费",
			Description: "包含地板、瓷砖、洁具、橱柜等主材",
			Min:         materialFee.Min,
			Max:         materialFee.Max,
		},
	}
}
