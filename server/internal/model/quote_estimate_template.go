package model

// QuoteEstimateTemplate 智能报价估算模板
type QuoteEstimateTemplate struct {
	Base
	Name        string  `json:"name" gorm:"size:100;not null"`        // 模板名称
	Style       string  `json:"style" gorm:"size:50;not null;index"`  // 装修风格（现代简约、北欧、中式等）
	Region      string  `json:"region" gorm:"size:50;not null;index"` // 区域（一线城市、二线城市等）
	MinArea     float64 `json:"minArea" gorm:"not null"`              // 最小面积
	MaxArea     float64 `json:"maxArea" gorm:"not null"`              // 最大面积
	HalfPackMin float64 `json:"halfPackMin" gorm:"not null"`          // 半包最低价（元/平米）
	HalfPackMax float64 `json:"halfPackMax" gorm:"not null"`          // 半包最高价（元/平米）
	FullPackMin float64 `json:"fullPackMin" gorm:"not null"`          // 全包最低价（元/平米）
	FullPackMax float64 `json:"fullPackMax" gorm:"not null"`          // 全包最高价（元/平米）
	Duration    int     `json:"duration" gorm:"not null"`             // 工期（天）
	Materials   string  `json:"materials" gorm:"type:text"`           // 材料预算明细（JSON）
	RiskItems   string  `json:"riskItems" gorm:"type:text"`           // 风险项提醒（JSON）
	Status      int8    `json:"status" gorm:"default:1;index"`        // 状态（1=启用，0=禁用）
}

// TableName 指定表名
func (QuoteEstimateTemplate) TableName() string {
	return "quote_estimate_templates"
}
