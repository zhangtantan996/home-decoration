package service

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
)

// MaterialShopService 主材门店服务
type MaterialShopService struct{}

// MaterialShopQuery 查询参数
type MaterialShopQuery struct {
	Type      string  `form:"type"`      // showroom | brand
	Keyword   string  `form:"keyword"`   // 名称/品类/品牌关键词
	City      string  `form:"city"`      // 城市
	RatingMin float64 `form:"ratingMin"` // 最低评分
	Lat       float64 `form:"lat"`       // 用户纬度
	Lng       float64 `form:"lng"`       // 用户经度
	SortBy    string  `form:"sortBy"`    // recommend | distance
	Page      int     `form:"page"`
	PageSize  int     `form:"pageSize"`
}

// MaterialShopListItem 列表返回项
type MaterialShopListItem struct {
	ID                uint64                    `json:"id"`
	Type              string                    `json:"type"`
	Name              string                    `json:"name"`
	Cover             string                    `json:"cover"`
	BrandLogo         string                    `json:"brandLogo,omitempty"`
	Description       string                    `json:"description,omitempty"`
	Rating            float32                   `json:"rating"`
	ReviewCount       int                       `json:"reviewCount"`
	MainProducts      []string                  `json:"mainProducts"`
	ProductCategories []string                  `json:"productCategories"`
	Address           string                    `json:"address"`
	Distance          string                    `json:"distance"`
	OpenTime          string                    `json:"openTime"`
	Tags              []string                  `json:"tags"`
	IsVerified        bool                      `json:"isVerified"`
	IsSettled         bool                      `json:"isSettled"`
	Products          []MaterialShopProductItem `json:"products,omitempty"`
}

type MaterialShopProductItem struct {
	ID          uint64   `json:"id"`
	Name        string   `json:"name"`
	Unit        string   `json:"unit"`
	Description string   `json:"description"`
	Price       float64  `json:"price"`
	Images      []string `json:"images"`
	CoverImage  string   `json:"coverImage"`
}

func buildPublicMaterialShopDescription(_ *model.MaterialShop) string {
	// 公开门店描述暂不复用后台原始 description，避免把招商/审核备注直接暴露到消费者端。
	return ""
}

// ListMaterialShops 获取门店列表
func (s *MaterialShopService) ListMaterialShops(query *MaterialShopQuery) ([]MaterialShopListItem, int64, error) {
	// 默认分页
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 || query.PageSize > 50 {
		query.PageSize = 10
	}

	var shops []model.MaterialShop
	var total int64

	db := applyVisibleMaterialShopFilter(repository.DB.Model(&model.MaterialShop{}))

	// 类型筛选
	if query.Type != "" && query.Type != "all" {
		db = db.Where("type = ?", query.Type)
	}

	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		db = db.Where(
			`name LIKE ? OR company_name LIKE ? OR description LIKE ? OR address LIKE ? OR main_products LIKE ? OR product_categories LIKE ? OR main_brands LIKE ? OR main_categories LIKE ? OR tags LIKE ?`,
			pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern,
		)
	}

	if city := strings.TrimSpace(query.City); city != "" {
		pattern := "%" + city + "%"
		altPattern := pattern
		if !strings.HasSuffix(city, "市") {
			altPattern = "%" + city + "市%"
		}
		db = db.Where("(address LIKE ? OR service_area LIKE ? OR address LIKE ? OR service_area LIKE ?)", pattern, pattern, altPattern, altPattern)
	}

	if query.RatingMin > 0 {
		db = db.Where("rating >= ?", query.RatingMin)
	}

	// 统计总数
	db.Count(&total)

	// 排序
	switch query.SortBy {
	case "distance":
		// 如果有用户坐标则按距离排序，否则按 ID
		if query.Lat != 0 && query.Lng != 0 {
			// 使用 Haversine 近似（简化版，仅适用于小范围）
			db = db.Order("(latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?) ASC")
			db = db.Where("1=1", query.Lat, query.Lat, query.Lng, query.Lng) // placeholder for order
		} else {
			db = db.Order("id ASC")
		}
	case "rating", "recommend":
		db = db.Order("rating DESC, review_count DESC")
	default:
		// 综合排序：评分优先
		db = db.Order("rating DESC, review_count DESC")
	}

	// 分页
	offset := (query.Page - 1) * query.PageSize
	if err := db.Offset(offset).Limit(query.PageSize).Find(&shops).Error; err != nil {
		return nil, 0, err
	}

	// 转换为返回格式
	result := make([]MaterialShopListItem, len(shops))
	for i, shop := range shops {
		// 解析 JSON 字段
		var mainProducts []string
		var tags []string
		_ = json.Unmarshal([]byte(shop.MainProducts), &mainProducts)
		_ = json.Unmarshal([]byte(shop.Tags), &tags)

		// 计算距离
		distance := "附近"
		if query.Lat != 0 && query.Lng != 0 && shop.Latitude != 0 && shop.Longitude != 0 {
			dist := haversine(query.Lat, query.Lng, shop.Latitude, shop.Longitude)
			distance = formatDistance(dist)
		}

		// 解析产品分类
		var productCategories []string
		if shop.ProductCategories != "" {
			for _, cat := range splitComma(shop.ProductCategories) {
				productCategories = append(productCategories, cat)
			}
		}

		settled := materialShopSettlementValue(&shop)
		result[i] = MaterialShopListItem{
			ID:                shop.ID,
			Type:              shop.Type,
			Name:              shop.Name,
			Cover:             imgutil.GetFullImageURL(shop.Cover),
			BrandLogo:         imgutil.GetFullImageURL(shop.BrandLogo),
			Description:       buildPublicMaterialShopDescription(&shop),
			Rating:            shop.Rating,
			ReviewCount:       shop.ReviewCount,
			MainProducts:      mainProducts,
			ProductCategories: productCategories,
			Address:           shop.Address,
			Distance:          distance,
			OpenTime:          shop.OpenTime,
			Tags:              tags,
			IsVerified:        settled && shop.IsVerified,
			IsSettled:         settled,
		}
	}

	return result, total, nil
}

// GetMaterialShopByID 获取门店详情
func (s *MaterialShopService) GetMaterialShopByID(id uint64) (*MaterialShopListItem, error) {
	var shop model.MaterialShop
	if err := applyVisibleMaterialShopFilter(repository.DB.Model(&model.MaterialShop{})).
		Where("id = ?", id).
		First(&shop).Error; err != nil {
		return nil, err
	}

	var mainProducts []string
	var tags []string
	_ = json.Unmarshal([]byte(shop.MainProducts), &mainProducts)
	_ = json.Unmarshal([]byte(shop.Tags), &tags)

	var productCategories []string
	for _, cat := range splitComma(shop.ProductCategories) {
		productCategories = append(productCategories, cat)
	}

	var products []model.MaterialShopProduct
	if err := repository.DB.
		Where("shop_id = ? AND status = ?", id, 1).
		Order("sort_order ASC, id DESC").
		Find(&products).Error; err != nil {
		return nil, err
	}

	productItems := make([]MaterialShopProductItem, 0, len(products))
	resolvedCover := strings.TrimSpace(shop.Cover)
	for _, product := range products {
		var images []string
		_ = json.Unmarshal([]byte(product.ImagesJSON), &images)

		coverImage := strings.TrimSpace(product.CoverImage)
		if coverImage == "" && len(images) > 0 {
			coverImage = strings.TrimSpace(images[0])
		}
		if resolvedCover == "" && coverImage != "" {
			resolvedCover = coverImage
		}

		productItems = append(productItems, MaterialShopProductItem{
			ID:          product.ID,
			Name:        product.Name,
			Unit:        product.Unit,
			Description: product.Description,
			Price:       product.Price,
			Images:      imgutil.GetFullImageURLs(images),
			CoverImage:  imgutil.GetFullImageURL(coverImage),
		})
	}

	settled := materialShopSettlementValue(&shop)
	return &MaterialShopListItem{
		ID:                shop.ID,
		Type:              shop.Type,
		Name:              shop.Name,
		Cover:             imgutil.GetFullImageURL(resolvedCover),
		BrandLogo:         imgutil.GetFullImageURL(shop.BrandLogo),
		Description:       buildPublicMaterialShopDescription(&shop),
		Rating:            shop.Rating,
		ReviewCount:       shop.ReviewCount,
		MainProducts:      mainProducts,
		ProductCategories: productCategories,
		Address:           shop.Address,
		Distance:          "—",
		OpenTime:          shop.OpenTime,
		Tags:              tags,
		IsVerified:        settled && shop.IsVerified,
		IsSettled:         settled,
		Products:          productItems,
	}, nil
}

// haversine 计算两点间距离 (km)
func haversine(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371 // 地球半径 km
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// formatDistance 格式化距离
func formatDistance(km float64) string {
	if km < 1 {
		return fmt.Sprintf("%.0fm", km*1000)
	}
	return fmt.Sprintf("%.1fkm", km)
}

// splitComma 逗号分割
func splitComma(s string) []string {
	if s == "" {
		return nil
	}
	var result []string
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
