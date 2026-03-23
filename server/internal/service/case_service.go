package service

import (
	"encoding/json"
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"math"
	"time"
)

type CaseQuoteItem struct {
	Category      string  `json:"category"`                // 类目
	ItemName      string  `json:"itemName"`                // 项目名称
	Spec          string  `json:"spec,omitempty"`          // 规格/型号
	Unit          string  `json:"unit,omitempty"`          // 单位
	Quantity      float64 `json:"quantity,omitempty"`      // 数量
	UnitPriceCent int64   `json:"unitPriceCent,omitempty"` // 单价（分）
	AmountCent    int64   `json:"amountCent,omitempty"`    // 小计（分）
	Remark        string  `json:"remark,omitempty"`        // 备注
	SortOrder     int     `json:"sortOrder,omitempty"`     // 排序
}

type CaseQuote struct {
	CaseID    uint64          `json:"caseId"`
	TotalCent int64           `json:"totalCent"`
	Currency  string          `json:"currency"`
	Items     []CaseQuoteItem `json:"items"`
	UpdatedAt string          `json:"updatedAt"`
}

type CaseService struct{}

// GetCaseDetail 获取案例详情（公开接口，不含报价明细）
func (s *CaseService) GetCaseDetail(caseID uint64) (*model.ProviderCase, error) {
	var pc model.ProviderCase

	// 查询案例详情，排除敏感的报价明细字段
	if err := applyVisibleInspirationCaseFilter(repository.DB.Model(&model.ProviderCase{})).
		Select("id, provider_id, title, cover_image, style, layout, area, price, quote_total_cent, quote_currency, year, description, images, sort_order, created_at, updated_at").
		First(&pc, caseID).Error; err != nil {
		return nil, err
	}

	return &pc, nil
}

func (s *CaseService) GetCaseQuote(caseID uint64) (*CaseQuote, error) {
	var pc model.ProviderCase
	if err := applyVisibleInspirationCaseFilter(repository.DB.Model(&model.ProviderCase{})).
		Select("id, quote_total_cent, quote_currency, quote_items, updated_at").
		First(&pc, caseID).Error; err != nil {
		return nil, err
	}

	items := make([]CaseQuoteItem, 0)
	if pc.QuoteItems != "" {
		if err := json.Unmarshal([]byte(pc.QuoteItems), &items); err != nil {
			return nil, errors.New("报价明细数据格式错误")
		}
	}

	totalCent := pc.QuoteTotalCent
	if totalCent <= 0 && len(items) > 0 {
		var sum int64
		for i := range items {
			if items[i].AmountCent == 0 && items[i].UnitPriceCent > 0 && items[i].Quantity > 0 {
				items[i].AmountCent = int64(math.Round(items[i].Quantity * float64(items[i].UnitPriceCent)))
			}
			sum += items[i].AmountCent
		}
		totalCent = sum
	}

	currency := pc.QuoteCurrency
	if currency == "" {
		currency = "CNY"
	}

	updatedAt := pc.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = time.Now()
	}

	return &CaseQuote{
		CaseID:    pc.ID,
		TotalCent: totalCent,
		Currency:  currency,
		Items:     items,
		UpdatedAt: updatedAt.Format(time.RFC3339),
	}, nil
}

// NormalizeCaseQuote 规范化报价明细：补齐 amountCent，并返回合计（分）
func NormalizeCaseQuote(items []CaseQuoteItem) (int64, []CaseQuoteItem) {
	var total int64
	for i := range items {
		if items[i].AmountCent == 0 && items[i].UnitPriceCent > 0 && items[i].Quantity > 0 {
			items[i].AmountCent = int64(math.Round(items[i].Quantity * float64(items[i].UnitPriceCent)))
		}
		total += items[i].AmountCent
	}
	return total, items
}
