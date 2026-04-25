package service

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log"
	"strconv"
	"strings"
	"time"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
	"gorm.io/gorm"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// WechatBillRecord 微信账单记录
type WechatBillRecord struct {
	TradeTime       string
	MerchantOrderNo string
	WechatOrderNo   string
	TradeType       string
	TradeStatus     string
	OrderAmount     float64
}

// ReconciliationDiff 对账差异
type ReconciliationDiff struct {
	DifferenceType  string
	OutTradeNo      string
	ProviderTradeNo string
	PlatformAmount  float64
	ChannelAmount   float64
	PlatformStatus  string
	ChannelStatus   string
}

// ReconciliationService 对账服务
type ReconciliationService struct {
	db *gorm.DB
}

// NewReconciliationService 创建对账服务实例
func NewReconciliationService(db *gorm.DB) *ReconciliationService {
	if db == nil {
		db = repository.DB
	}
	return &ReconciliationService{db: db}
}

// CreateReconciliationRecord 创建对账记录
func (s *ReconciliationService) CreateReconciliationRecord(
	reconcileDate time.Time,
	reconcileType string,
	channel string,
) (*model.ReconciliationRecord, error) {
	record := &model.ReconciliationRecord{
		ReconcileDate: reconcileDate,
		ReconcileType: reconcileType,
		Channel:       channel,
		Status:        "processing",
	}
	if err := s.db.Create(record).Error; err != nil {
		return nil, fmt.Errorf("创建对账记录失败: %w", err)
	}
	return record, nil
}

// UpdateReconciliationRecord 更新对账记录
func (s *ReconciliationService) UpdateReconciliationRecord(
	recordID uint64,
	totalCount int,
	matchedCount int,
	differenceCount int,
	totalAmount float64,
	differenceAmount float64,
	status string,
	errorMessage string,
) error {
	now := time.Now()
	updates := map[string]interface{}{
		"total_count":       totalCount,
		"matched_count":     matchedCount,
		"difference_count":  differenceCount,
		"total_amount":      totalAmount,
		"difference_amount": differenceAmount,
		"status":            status,
		"error_message":     errorMessage,
	}
	if status == "completed" || status == "failed" {
		updates["completed_at"] = &now
	}
	return s.db.Model(&model.ReconciliationRecord{}).
		Where("id = ?", recordID).
		Updates(updates).Error
}

// AddDifference 添加差异明细
func (s *ReconciliationService) AddDifference(
	reconciliationID uint64,
	diff *ReconciliationDiff,
) error {
	difference := &model.ReconciliationDifference{
		ReconciliationID: reconciliationID,
		DifferenceType:   diff.DifferenceType,
		OutTradeNo:       diff.OutTradeNo,
		ProviderTradeNo:  diff.ProviderTradeNo,
		PlatformAmount:   diff.PlatformAmount,
		ChannelAmount:    diff.ChannelAmount,
		PlatformStatus:   diff.PlatformStatus,
		ChannelStatus:    diff.ChannelStatus,
		Resolved:         false,
	}
	return s.db.Create(difference).Error
}

// ParseWechatBill 解析微信账单CSV
func (s *ReconciliationService) ParseWechatBill(billData []byte) ([]WechatBillRecord, error) {
	if len(billData) == 0 {
		return nil, errors.New("账单数据为空")
	}

	// 尝试 GBK 解码
	decoder := simplifiedchinese.GBK.NewDecoder()
	utf8Data, _, err := transform.Bytes(decoder, billData)
	if err != nil {
		// 如果 GBK 解码失败，尝试直接使用 UTF-8
		utf8Data = billData
	}

	reader := csv.NewReader(strings.NewReader(string(utf8Data)))
	reader.LazyQuotes = true

	var records []WechatBillRecord
	lineNum := 0

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Printf("[Reconciliation] CSV解析错误 (行%d): %v", lineNum, err)
			continue
		}

		lineNum++

		// 跳过表头和汇总行
		if lineNum == 1 || len(row) < 7 {
			continue
		}

		// 微信账单格式: 交易时间,公众账号ID,商户号,特约商户号,设备号,微信订单号,商户订单号,...
		if len(row) < 25 {
			continue
		}

		// 解析订单金额（单位：元）
		amountStr := strings.TrimSpace(row[24])
		amountStr = strings.TrimPrefix(amountStr, "¥")
		amount, err := strconv.ParseFloat(amountStr, 64)
		if err != nil {
			log.Printf("[Reconciliation] 解析金额失败 (行%d): %v", lineNum, err)
			continue
		}

		records = append(records, WechatBillRecord{
			TradeTime:       strings.TrimSpace(row[0]),
			MerchantOrderNo: strings.TrimSpace(row[6]),
			WechatOrderNo:   strings.TrimSpace(row[5]),
			TradeType:       strings.TrimSpace(row[8]),
			TradeStatus:     strings.TrimSpace(row[9]),
			OrderAmount:     amount,
		})
	}

	return records, nil
}

// CompareOrders 对比订单数据
func (s *ReconciliationService) CompareOrders(
	ctx context.Context,
	reconcileDate time.Time,
	billRecords []WechatBillRecord,
) ([]ReconciliationDiff, error) {
	// 查询平台当日支付单
	startTime := time.Date(reconcileDate.Year(), reconcileDate.Month(), reconcileDate.Day(), 0, 0, 0, 0, reconcileDate.Location())
	endTime := startTime.Add(24 * time.Hour)

	var platformOrders []model.PaymentOrder
	if err := s.db.Where("channel = ? AND created_at >= ? AND created_at < ?",
		model.PaymentChannelWechat, startTime, endTime).
		Find(&platformOrders).Error; err != nil {
		return nil, fmt.Errorf("查询平台支付单失败: %w", err)
	}

	// 构建映射表
	billMap := make(map[string]WechatBillRecord)
	for _, record := range billRecords {
		if record.MerchantOrderNo != "" {
			billMap[record.MerchantOrderNo] = record
		}
	}

	platformMap := make(map[string]model.PaymentOrder)
	for _, order := range platformOrders {
		platformMap[order.OutTradeNo] = order
	}

	var diffs []ReconciliationDiff

	// 检测平台有、微信没有（漏单）
	for _, order := range platformOrders {
		if _, exists := billMap[order.OutTradeNo]; !exists {
			// 只记录已支付的订单差异
			if order.Status == model.PaymentStatusPaid {
				diffs = append(diffs, ReconciliationDiff{
					DifferenceType:  "missing_in_channel",
					OutTradeNo:      order.OutTradeNo,
					ProviderTradeNo: order.ProviderTradeNo,
					PlatformAmount:  order.Amount,
					ChannelAmount:   0,
					PlatformStatus:  order.Status,
					ChannelStatus:   "",
				})
			}
		}
	}

	// 检测微信有、平台没有（多单）
	for _, record := range billRecords {
		if _, exists := platformMap[record.MerchantOrderNo]; !exists {
			// 只记录成功交易的差异
			if record.TradeStatus == "SUCCESS" || record.TradeStatus == "支付成功" {
				diffs = append(diffs, ReconciliationDiff{
					DifferenceType:  "missing_in_platform",
					OutTradeNo:      record.MerchantOrderNo,
					ProviderTradeNo: record.WechatOrderNo,
					PlatformAmount:  0,
					ChannelAmount:   record.OrderAmount,
					PlatformStatus:  "",
					ChannelStatus:   record.TradeStatus,
				})
			}
		}
	}

	// 检测金额不符和状态不符
	for outTradeNo, order := range platformMap {
		if record, exists := billMap[outTradeNo]; exists {
			// 金额不符
			if order.Amount != record.OrderAmount {
				diffs = append(diffs, ReconciliationDiff{
					DifferenceType:  "amount_mismatch",
					OutTradeNo:      outTradeNo,
					ProviderTradeNo: order.ProviderTradeNo,
					PlatformAmount:  order.Amount,
					ChannelAmount:   record.OrderAmount,
					PlatformStatus:  order.Status,
					ChannelStatus:   record.TradeStatus,
				})
			}

			// 状态不符
			platformSuccess := order.Status == model.PaymentStatusPaid
			channelSuccess := record.TradeStatus == "SUCCESS" || record.TradeStatus == "支付成功"
			if platformSuccess != channelSuccess {
				diffs = append(diffs, ReconciliationDiff{
					DifferenceType:  "status_mismatch",
					OutTradeNo:      outTradeNo,
					ProviderTradeNo: order.ProviderTradeNo,
					PlatformAmount:  order.Amount,
					ChannelAmount:   record.OrderAmount,
					PlatformStatus:  order.Status,
					ChannelStatus:   record.TradeStatus,
				})
			}
		}
	}

	return diffs, nil
}

// ListReconciliationRecordsInput 查询对账记录列表输入
type ListReconciliationRecordsInput struct {
	ReconcileType string
	Status        string
	Page          int
	PageSize      int
}

// ListReconciliationRecordsOutput 查询对账记录列表输出
type ListReconciliationRecordsOutput struct {
	List     []model.ReconciliationRecord
	Total    int64
	Page     int
	PageSize int
}

// ListReconciliationRecords 查询对账记录列表
func (s *ReconciliationService) ListReconciliationRecords(input *ListReconciliationRecordsInput) (*ListReconciliationRecordsOutput, error) {
	if input == nil {
		return nil, errors.New("输入参数不能为空")
	}

	query := s.db.Model(&model.ReconciliationRecord{}).Order("created_at DESC")

	if input.ReconcileType != "" {
		query = query.Where("reconcile_type = ?", input.ReconcileType)
	}
	if input.Status != "" {
		query = query.Where("status = ?", input.Status)
	}

	page := input.Page
	if page < 1 {
		page = 1
	}
	pageSize := input.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("查询对账记录总数失败: %w", err)
	}

	var list []model.ReconciliationRecord
	if err := query.Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, fmt.Errorf("查询对账记录列表失败: %w", err)
	}

	return &ListReconciliationRecordsOutput{
		List:     list,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetReconciliationDetail 获取对账记录详情
func (s *ReconciliationService) GetReconciliationDetail(recordID uint64) (*model.ReconciliationRecord, error) {
	var record model.ReconciliationRecord
	if err := s.db.First(&record, recordID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("对账记录不存在")
		}
		return nil, fmt.Errorf("查询对账记录失败: %w", err)
	}
	return &record, nil
}

// ListDifferencesInput 查询差异明细列表输入
type ListDifferencesInput struct {
	ReconciliationID uint64
	DifferenceType   string
	Resolved         *bool
	Page             int
	PageSize         int
}

// ListDifferencesOutput 查询差异明细列表输出
type ListDifferencesOutput struct {
	List     []model.ReconciliationDifference
	Total    int64
	Page     int
	PageSize int
}

// ListDifferences 查询差异明细列表
func (s *ReconciliationService) ListDifferences(input *ListDifferencesInput) (*ListDifferencesOutput, error) {
	if input == nil {
		return nil, errors.New("输入参数不能为空")
	}

	query := s.db.Model(&model.ReconciliationDifference{}).
		Where("reconciliation_id = ?", input.ReconciliationID).
		Order("created_at DESC")

	if input.DifferenceType != "" {
		query = query.Where("difference_type = ?", input.DifferenceType)
	}
	if input.Resolved != nil {
		query = query.Where("resolved = ?", *input.Resolved)
	}

	page := input.Page
	if page < 1 {
		page = 1
	}
	pageSize := input.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("查询差异明细总数失败: %w", err)
	}

	var list []model.ReconciliationDifference
	if err := query.Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, fmt.Errorf("查询差异明细列表失败: %w", err)
	}

	return &ListDifferencesOutput{
		List:     list,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// ResolveDifferenceInput 标记差异已处理输入
type ResolveDifferenceInput struct {
	DifferenceID uint64
	ResolvedBy   uint64
	ResolveNotes string
}

// ResolveDifference 标记差异已处理
func (s *ReconciliationService) ResolveDifference(input *ResolveDifferenceInput) error {
	if input == nil {
		return errors.New("输入参数不能为空")
	}
	if input.DifferenceID == 0 {
		return errors.New("差异ID不能为空")
	}
	if input.ResolvedBy == 0 {
		return errors.New("操作人ID不能为空")
	}

	var diff model.ReconciliationDifference
	if err := s.db.First(&diff, input.DifferenceID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("差异记录不存在")
		}
		return fmt.Errorf("查询差异记录失败: %w", err)
	}

	if diff.Resolved {
		return errors.New("该差异已经处理过了")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"resolved":      true,
		"resolved_at":   &now,
		"resolved_by":   input.ResolvedBy,
		"resolve_notes": strings.TrimSpace(input.ResolveNotes),
	}

	if err := s.db.Model(&diff).Updates(updates).Error; err != nil {
		return fmt.Errorf("更新差异记录失败: %w", err)
	}

	return nil
}

// InvestigateDifferenceInput 标记差异为调查中输入
type InvestigateDifferenceInput struct {
	DifferenceID uint64
	AdminID      uint64
	Notes        string
}

// InvestigateDifference 标记差异为调查中
func (s *ReconciliationService) InvestigateDifference(input *InvestigateDifferenceInput) error {
	if input == nil {
		return errors.New("输入参数不能为空")
	}
	if input.DifferenceID == 0 {
		return errors.New("差异ID不能为空")
	}
	if input.AdminID == 0 {
		return errors.New("操作人ID不能为空")
	}

	var diff model.ReconciliationDifference
	if err := s.db.First(&diff, input.DifferenceID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("差异记录不存在")
		}
		return fmt.Errorf("查询差异记录失败: %w", err)
	}

	if diff.Resolved {
		return errors.New("该差异已经处理过了")
	}

	updates := map[string]interface{}{
		"handle_status": model.DifferenceStatusInvestigating,
		"resolve_notes": strings.TrimSpace(input.Notes),
		"resolved_by":   input.AdminID,
	}

	if err := s.db.Model(&diff).Updates(updates).Error; err != nil {
		return fmt.Errorf("更新差异记录失败: %w", err)
	}

	return nil
}

// IgnoreDifferenceInput 忽略差异输入
type IgnoreDifferenceInput struct {
	DifferenceID uint64
	AdminID      uint64
	Reason       string
}

// IgnoreDifference 忽略差异
func (s *ReconciliationService) IgnoreDifference(input *IgnoreDifferenceInput) error {
	if input == nil {
		return errors.New("输入参数不能为空")
	}
	if input.DifferenceID == 0 {
		return errors.New("差异ID不能为空")
	}
	if input.AdminID == 0 {
		return errors.New("操作人ID不能为空")
	}
	if strings.TrimSpace(input.Reason) == "" {
		return errors.New("忽略原因不能为空")
	}

	var diff model.ReconciliationDifference
	if err := s.db.First(&diff, input.DifferenceID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("差异记录不存在")
		}
		return fmt.Errorf("查询差异记录失败: %w", err)
	}

	if diff.Resolved {
		return errors.New("该差异已经处理过了")
	}

	updates := map[string]interface{}{
		"handle_status": model.DifferenceStatusIgnored,
		"ignore_reason": strings.TrimSpace(input.Reason),
		"resolved_by":   input.AdminID,
	}

	if err := s.db.Model(&diff).Updates(updates).Error; err != nil {
		return fmt.Errorf("更新差异记录失败: %w", err)
	}

	return nil
}

// ResolveDifferenceEnhancedInput 解决差异输入（增强版）
type ResolveDifferenceEnhancedInput struct {
	DifferenceID uint64
	AdminID      uint64
	Solution     string
	Notes        string
}

// ResolveDifferenceEnhanced 解决差异（增强版）
func (s *ReconciliationService) ResolveDifferenceEnhanced(input *ResolveDifferenceEnhancedInput) error {
	if input == nil {
		return errors.New("输入参数不能为空")
	}
	if input.DifferenceID == 0 {
		return errors.New("差异ID不能为空")
	}
	if input.AdminID == 0 {
		return errors.New("操作人ID不能为空")
	}
	if strings.TrimSpace(input.Solution) == "" {
		return errors.New("解决方案不能为空")
	}

	var diff model.ReconciliationDifference
	if err := s.db.First(&diff, input.DifferenceID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("差异记录不存在")
		}
		return fmt.Errorf("查询差异记录失败: %w", err)
	}

	if diff.Resolved {
		return errors.New("该差异已经处理过了")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"handle_status": model.DifferenceStatusResolved,
		"resolved":      true,
		"resolved_at":   &now,
		"resolved_by":   input.AdminID,
		"solution":      strings.TrimSpace(input.Solution),
		"resolve_notes": strings.TrimSpace(input.Notes),
	}

	if err := s.db.Model(&diff).Updates(updates).Error; err != nil {
		return fmt.Errorf("更新差异记录失败: %w", err)
	}

	return nil
}

// GetPendingDifferencesOverdue 获取超时未处理的差异
func (s *ReconciliationService) GetPendingDifferencesOverdue(hours int) ([]model.ReconciliationDifference, error) {
	if hours <= 0 {
		hours = 24
	}

	cutoffTime := time.Now().Add(-time.Duration(hours) * time.Hour)

	var diffs []model.ReconciliationDifference
	if err := s.db.Where("handle_status = ? AND created_at < ?",
		model.DifferenceStatusPending, cutoffTime).
		Find(&diffs).Error; err != nil {
		return nil, fmt.Errorf("查询超时差异失败: %w", err)
	}

	return diffs, nil
}
