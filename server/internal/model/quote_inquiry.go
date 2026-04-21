package model

import "time"

// QuoteInquiry 智能报价询价记录
type QuoteInquiry struct {
	Base

	// 用户信息
	UserID         *uint64 `json:"userId" gorm:"index"`
	OpenID         string  `json:"openId" gorm:"column:open_id;size:128;index"`
	Phone          string  `json:"phone" gorm:"size:20"`
	PhoneEncrypted string  `json:"-" gorm:"column:phone_encrypted;type:text"`

	// 房屋信息
	Address          string  `json:"address" gorm:"size:200"`
	AddressEncrypted string  `json:"-" gorm:"column:address_encrypted;type:text"`
	CityCode         string  `json:"cityCode" gorm:"size:20;index"`
	Area             float64 `json:"area" gorm:"type:decimal(10,2)"`
	HouseLayout      string  `json:"houseLayout" gorm:"size:50"`

	// 装修需求
	RenovationType string  `json:"renovationType" gorm:"size:50"`
	Style          string  `json:"style" gorm:"size:50"`
	BudgetRange    string  `json:"budgetRange" gorm:"size:50"`
	BudgetMin      float64 `json:"budgetMin" gorm:"type:decimal(12,2)"`
	BudgetMax      float64 `json:"budgetMax" gorm:"type:decimal(12,2)"`

	// 报价结果
	QuoteResultJSON       string  `json:"quoteResultJson" gorm:"type:text"`
	TotalMin              float64 `json:"totalMin" gorm:"type:decimal(12,2)"`
	TotalMax              float64 `json:"totalMax" gorm:"type:decimal(12,2)"`
	DesignFeeMin          float64 `json:"designFeeMin" gorm:"type:decimal(12,2)"`
	DesignFeeMax          float64 `json:"designFeeMax" gorm:"type:decimal(12,2)"`
	ConstructionFeeMin    float64 `json:"constructionFeeMin" gorm:"type:decimal(12,2)"`
	ConstructionFeeMax    float64 `json:"constructionFeeMax" gorm:"type:decimal(12,2)"`
	MaterialFeeMin        float64 `json:"materialFeeMin" gorm:"type:decimal(12,2)"`
	MaterialFeeMax        float64 `json:"materialFeeMax" gorm:"type:decimal(12,2)"`
	EstimatedDurationDays int     `json:"estimatedDurationDays"`

	// 转化追踪
	ConversionStatus     string     `json:"conversionStatus" gorm:"size:20;default:'pending';index"`
	ConvertedToBookingID *uint64    `json:"convertedToBookingId"`
	ConvertedAt          *time.Time `json:"convertedAt"`

	// 来源追踪
	Source string `json:"source" gorm:"size:50;default:'mini_program'"`
}

// TableName 指定表名
func (QuoteInquiry) TableName() string {
	return "quote_inquiries"
}

// QuoteFeeBreakdown 报价费用明细
type QuoteFeeBreakdown struct {
	Category string         `json:"category"` // design, construction, material
	Items    []QuoteFeeItem `json:"items"`
	SubTotal float64        `json:"subTotal"`
	MinPrice float64        `json:"minPrice"`
	MaxPrice float64        `json:"maxPrice"`
}

// QuoteFeeItem 费用项
type QuoteFeeItem struct {
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Unit        string  `json:"unit,omitempty"`
	Quantity    float64 `json:"quantity,omitempty"`
	UnitPrice   float64 `json:"unitPrice,omitempty"`
	MinPrice    float64 `json:"minPrice"`
	MaxPrice    float64 `json:"maxPrice"`
	Amount      float64 `json:"amount"`
}

// QuoteInquiryResult 报价结果（用于JSON序列化）
type QuoteInquiryResult struct {
	TotalMin              float64             `json:"totalMin"`
	TotalMax              float64             `json:"totalMax"`
	EstimatedDurationDays int                 `json:"estimatedDurationDays"`
	Breakdown             []QuoteFeeBreakdown `json:"breakdown"`
	Notes                 []string            `json:"notes,omitempty"`
}
