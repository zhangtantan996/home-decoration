package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupQuoteTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&model.QuoteEstimateTemplate{})
	assert.NoError(t, err)

	// 插入测试数据
	templates := []model.QuoteEstimateTemplate{
		{
			Name:        "现代简约-一线城市-中户型",
			Style:       "现代简约",
			Region:      "一线城市",
			MinArea:     80,
			MaxArea:     120,
			HalfPackMin: 800,
			HalfPackMax: 1200,
			FullPackMin: 1500,
			FullPackMax: 2000,
			Duration:    90,
			Materials:   `[{"category":"水电材料","budget":15000},{"category":"瓦工材料","budget":20000}]`,
			RiskItems:   `[{"item":"老房拆改","description":"如果是老房需要拆改，费用另计"}]`,
			Status:      1,
		},
	}

	for _, template := range templates {
		err = db.Create(&template).Error
		assert.NoError(t, err)
	}

	return db
}

func TestQuoteEstimateService_EstimateQuote(t *testing.T) {
	db := setupQuoteTestDB(t)
	repository.DB = db

	service := &QuoteEstimateService{}

	t.Run("成功生成报价", func(t *testing.T) {
		result, err := service.EstimateQuote(100, "现代简约", "一线城市")
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, float64(80000), result.HalfPackMin)
		assert.Equal(t, float64(120000), result.HalfPackMax)
		assert.Equal(t, float64(150000), result.FullPackMin)
		assert.Equal(t, float64(200000), result.FullPackMax)
		assert.Greater(t, result.Duration, 0)
		assert.NotEmpty(t, result.Materials)
		assert.NotEmpty(t, result.RiskItems)
	})

	t.Run("面积过小", func(t *testing.T) {
		_, err := service.EstimateQuote(5, "现代简约", "一线城市")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "房屋面积需在 10-9999 ㎡ 之间")
	})

	t.Run("面积过大", func(t *testing.T) {
		_, err := service.EstimateQuote(10000, "现代简约", "一线城市")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "房屋面积需在 10-9999 ㎡ 之间")
	})

	t.Run("风格为空", func(t *testing.T) {
		_, err := service.EstimateQuote(100, "", "一线城市")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "装修风格不能为空")
	})

	t.Run("区域为空", func(t *testing.T) {
		_, err := service.EstimateQuote(100, "现代简约", "")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "区域不能为空")
	})
}

func TestQuoteEstimateService_GetQuoteTemplate(t *testing.T) {
	db := setupQuoteTestDB(t)
	repository.DB = db

	service := &QuoteEstimateService{}

	t.Run("精确匹配", func(t *testing.T) {
		template, err := service.GetQuoteTemplate(100, "现代简约", "一线城市")
		assert.NoError(t, err)
		assert.NotNil(t, template)
		assert.Equal(t, "现代简约", template.Style)
		assert.Equal(t, "一线城市", template.Region)
	})

	t.Run("未找到匹配模板", func(t *testing.T) {
		_, err := service.GetQuoteTemplate(300, "欧式", "三线城市")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "未找到匹配的报价模板")
	})
}

func TestQuoteEstimateService_CalculateDuration(t *testing.T) {
	service := &QuoteEstimateService{}

	tests := []struct {
		name         string
		area         float64
		baseDuration int
		expected     int
	}{
		{"小户型", 60, 90, 90},
		{"中户型", 100, 90, 95},
		{"大户型", 150, 90, 107},
		{"超大户型", 200, 90, 120},
		{"工期下限", 20, 90, 30},
		{"工期上限", 500, 90, 180},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			duration := service.CalculateDuration(tt.area, tt.baseDuration)
			assert.Equal(t, tt.expected, duration)
		})
	}
}

func TestQuoteEstimateService_GetMaterialsBudget(t *testing.T) {
	service := &QuoteEstimateService{}

	materialsJSON := `[{"category":"水电材料","budget":10000},{"category":"瓦工材料","budget":15000}]`

	t.Run("成功解析材料预算", func(t *testing.T) {
		materials, err := service.GetMaterialsBudget(100, materialsJSON)
		assert.NoError(t, err)
		assert.Len(t, materials, 2)
		assert.Equal(t, "水电材料", materials[0].Category)
		assert.Equal(t, float64(10000), materials[0].Budget)
	})

	t.Run("面积调整预算", func(t *testing.T) {
		materials, err := service.GetMaterialsBudget(200, materialsJSON)
		assert.NoError(t, err)
		assert.Equal(t, float64(20000), materials[0].Budget)
		assert.Equal(t, float64(30000), materials[1].Budget)
	})

	t.Run("空JSON", func(t *testing.T) {
		materials, err := service.GetMaterialsBudget(100, "")
		assert.NoError(t, err)
		assert.Empty(t, materials)
	})

	t.Run("无效JSON", func(t *testing.T) {
		_, err := service.GetMaterialsBudget(100, "invalid json")
		assert.Error(t, err)
	})
}

func TestQuoteEstimateService_GetRiskItems(t *testing.T) {
	service := &QuoteEstimateService{}

	riskItemsJSON := `[{"item":"老房拆改","description":"费用另计"}]`

	t.Run("成功解析风险项", func(t *testing.T) {
		riskItems, err := service.GetRiskItems(riskItemsJSON)
		assert.NoError(t, err)
		assert.Len(t, riskItems, 1)
		assert.Equal(t, "老房拆改", riskItems[0].Item)
		assert.Equal(t, "费用另计", riskItems[0].Description)
	})

	t.Run("空JSON", func(t *testing.T) {
		riskItems, err := service.GetRiskItems("")
		assert.NoError(t, err)
		assert.Empty(t, riskItems)
	})

	t.Run("无效JSON", func(t *testing.T) {
		_, err := service.GetRiskItems("invalid json")
		assert.Error(t, err)
	})
}
