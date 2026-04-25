package service

import (
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"time"

	"gorm.io/gorm"
)

// QuotePKService 多工长报价PK服务
type QuotePKService struct{}

// CreateQuoteTaskRequest 创建报价任务请求
type CreateQuoteTaskRequest struct {
	BookingID   uint64  `json:"bookingId" binding:"required"`
	Area        float64 `json:"area" binding:"required,min=0"`
	Style       string  `json:"style" binding:"required"`
	Region      string  `json:"region" binding:"required"`
	Budget      float64 `json:"budget" binding:"required,min=0"`
	Description string  `json:"description"`
}

// SubmitQuoteRequest 提交报价请求
type SubmitQuoteRequest struct {
	TotalPrice  float64 `json:"totalPrice" binding:"required,min=0"`
	Duration    int     `json:"duration" binding:"required,min=1"`
	Materials   string  `json:"materials"`
	Description string  `json:"description"`
}

// QuoteComparisonItem 报价对比项
type QuoteComparisonItem struct {
	SubmissionID    uint64  `json:"submissionId"`
	ProviderID      uint64  `json:"providerId"`
	ProviderName    string  `json:"providerName"`
	ProviderAvatar  string  `json:"providerAvatar"`
	Rating          float32 `json:"rating"`
	CompletedCnt    int     `json:"completedCnt"`
	YearsExperience int     `json:"yearsExperience"`
	TotalPrice      float64 `json:"totalPrice"`
	Duration        int     `json:"duration"`
	Materials       string  `json:"materials"`
	Description     string  `json:"description"`
	SubmittedAt     string  `json:"submittedAt"`
	Status          string  `json:"status"`
}

// CreateQuoteTask 创建报价任务
func (s *QuotePKService) CreateQuoteTask(userID uint64, req CreateQuoteTaskRequest) (*model.QuoteTask, error) {
	// 验证预约是否存在且属于该用户
	var booking model.Booking
	if err := repository.DB.Where("id = ? AND user_id = ?", req.BookingID, userID).First(&booking).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("预约不存在")
		}
		return nil, fmt.Errorf("查询预约失败: %w", err)
	}

	// 创建报价任务
	expiredAt := time.Now().Add(48 * time.Hour)
	task := &model.QuoteTask{
		BookingID:   req.BookingID,
		UserID:      userID,
		Area:        req.Area,
		Style:       req.Style,
		Region:      req.Region,
		Budget:      req.Budget,
		Description: req.Description,
		Status:      "pending",
		ExpiredAt:   &expiredAt,
	}

	if err := repository.DB.Create(task).Error; err != nil {
		return nil, fmt.Errorf("创建报价任务失败: %w", err)
	}

	// 匹配3个工长
	providers, err := s.MatchProviders(task)
	if err != nil {
		return nil, fmt.Errorf("匹配工长失败: %w", err)
	}

	// 推送报价任务给工长
	if err := s.NotifyProviders(task, providers); err != nil {
		return nil, fmt.Errorf("推送通知失败: %w", err)
	}

	// 更新任务状态为进行中
	task.Status = "in_progress"
	if err := repository.DB.Save(task).Error; err != nil {
		return nil, fmt.Errorf("更新任务状态失败: %w", err)
	}

	return task, nil
}

// MatchProviders 匹配3个工长
func (s *QuotePKService) MatchProviders(task *model.QuoteTask) ([]model.Provider, error) {
	var providers []model.Provider

	// 匹配逻辑：
	// 1. 工长类型（provider_type = 3）
	// 2. 状态正常（status = 1）
	// 3. 已认证（verified = true）
	// 4. 按评分排序
	// 5. 取前3个
	query := repository.DB.Where("provider_type = ? AND status = ? AND verified = ?", 3, 1, true)

	// 如果有区域信息，优先匹配同区域的工长
	if task.Region != "" {
		query = query.Order(fmt.Sprintf("CASE WHEN region = '%s' THEN 0 ELSE 1 END", task.Region)).
			Order("rating DESC").
			Order("completed_cnt DESC")
	} else {
		// 按评分降序排序
		query = query.Order("rating DESC").Order("completed_cnt DESC")
	}

	if err := query.Limit(3).Find(&providers).Error; err != nil {
		return nil, fmt.Errorf("查询工长失败: %w", err)
	}

	if len(providers) == 0 {
		return nil, errors.New("暂无可用工长")
	}

	return providers, nil
}

// NotifyProviders 推送报价任务给工长
func (s *QuotePKService) NotifyProviders(task *model.QuoteTask, providers []model.Provider) error {
	// TODO: 实现推送通知逻辑
	// 1. 创建通知记录
	// 2. 发送站内消息
	// 3. 发送推送通知（如果有）
	return nil
}

// SubmitQuote 工长提交报价
func (s *QuotePKService) SubmitQuote(providerID uint64, taskID uint64, req SubmitQuoteRequest) (*model.QuotePKSubmission, error) {
	// 验证报价任务是否存在且未过期
	var task model.QuoteTask
	if err := repository.DB.First(&task, taskID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("报价任务不存在")
		}
		return nil, fmt.Errorf("查询报价任务失败: %w", err)
	}

	// 检查任务状态
	if task.Status == "expired" {
		return nil, errors.New("报价任务已过期")
	}
	if task.Status == "completed" {
		return nil, errors.New("报价任务已完成")
	}

	// 检查是否已过期
	if task.ExpiredAt != nil && time.Now().After(*task.ExpiredAt) {
		// 更新任务状态为已过期
		task.Status = "expired"
		repository.DB.Save(&task)
		return nil, errors.New("报价任务已过期")
	}

	// 检查是否已提交过报价
	var existingSubmission model.QuotePKSubmission
	if err := repository.DB.Where("quote_task_id = ? AND provider_id = ?", taskID, providerID).First(&existingSubmission).Error; err == nil {
		return nil, errors.New("您已提交过报价")
	}

	// 创建报价提交
	now := time.Now()
	submission := &model.QuotePKSubmission{
		QuoteTaskID: taskID,
		ProviderID:  providerID,
		TotalPrice:  req.TotalPrice,
		Duration:    req.Duration,
		Materials:   req.Materials,
		Description: req.Description,
		Status:      "pending",
		SubmittedAt: &now,
	}

	if err := repository.DB.Create(submission).Error; err != nil {
		return nil, fmt.Errorf("提交报价失败: %w", err)
	}

	// TODO: 通知用户有新报价
	return submission, nil
}

// GetQuoteComparison 获取报价对比表
func (s *QuotePKService) GetQuoteComparison(userID uint64, taskID uint64) ([]QuoteComparisonItem, error) {
	// 验证报价任务是否存在且属于该用户
	var task model.QuoteTask
	if err := repository.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("报价任务不存在")
		}
		return nil, fmt.Errorf("查询报价任务失败: %w", err)
	}

	// 查询所有报价提交
	var submissions []model.QuotePKSubmission
	if err := repository.DB.Where("quote_task_id = ?", taskID).Order("total_price ASC").Find(&submissions).Error; err != nil {
		return nil, fmt.Errorf("查询报价失败: %w", err)
	}

	// 构建对比列表
	var items []QuoteComparisonItem
	for _, submission := range submissions {
		// 查询工长信息
		var provider model.Provider
		if err := repository.DB.First(&provider, submission.ProviderID).Error; err != nil {
			continue
		}

		// 查询用户信息获取头像
		var user model.User
		repository.DB.First(&user, provider.UserID)

		item := QuoteComparisonItem{
			SubmissionID:    submission.ID,
			ProviderID:      provider.ID,
			ProviderName:    ResolveProviderDisplayName(provider, &user),
			ProviderAvatar:  ResolveProviderAvatarPathWithUser(provider, &user),
			Rating:          provider.Rating,
			CompletedCnt:    provider.CompletedCnt,
			YearsExperience: provider.YearsExperience,
			TotalPrice:      submission.TotalPrice,
			Duration:        submission.Duration,
			Materials:       submission.Materials,
			Description:     submission.Description,
			Status:          submission.Status,
		}

		if submission.SubmittedAt != nil {
			item.SubmittedAt = submission.SubmittedAt.Format("2006-01-02 15:04:05")
		}

		items = append(items, item)
	}

	return items, nil
}

// SelectQuote 用户选择报价
func (s *QuotePKService) SelectQuote(userID uint64, taskID uint64, submissionID uint64) error {
	// 开启事务
	tx := repository.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 验证报价任务
	var task model.QuoteTask
	if err := tx.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("报价任务不存在")
		}
		return fmt.Errorf("查询报价任务失败: %w", err)
	}

	// 验证报价提交
	var submission model.QuotePKSubmission
	if err := tx.Where("id = ? AND quote_task_id = ?", submissionID, taskID).First(&submission).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("报价不存在")
		}
		return fmt.Errorf("查询报价失败: %w", err)
	}

	// 更新报价任务
	task.Status = "completed"
	task.SelectedQuoteID = submissionID
	if err := tx.Save(&task).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新报价任务失败: %w", err)
	}

	// 更新选中的报价状态
	submission.Status = "selected"
	if err := tx.Save(&submission).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新报价状态失败: %w", err)
	}

	// 更新其他报价状态为rejected
	if err := tx.Model(&model.QuotePKSubmission{}).
		Where("quote_task_id = ? AND id != ?", taskID, submissionID).
		Update("status", "rejected").Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新其他报价状态失败: %w", err)
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}

	// TODO: 通知工长报价结果
	return nil
}

// ExpireQuoteTask 报价任务过期处理（定时任务）
func (s *QuotePKService) ExpireQuoteTask() error {
	// 查询所有已过期但状态未更新的任务
	now := time.Now()
	var tasks []model.QuoteTask
	if err := repository.DB.Where("status IN (?, ?) AND expired_at < ?", "pending", "in_progress", now).Find(&tasks).Error; err != nil {
		return fmt.Errorf("查询过期任务失败: %w", err)
	}

	// 批量更新状态
	for _, task := range tasks {
		task.Status = "expired"
		if err := repository.DB.Save(&task).Error; err != nil {
			return fmt.Errorf("更新任务状态失败: %w", err)
		}
	}

	return nil
}

// GetQuoteTaskByID 根据ID获取报价任务
func (s *QuotePKService) GetQuoteTaskByID(userID uint64, taskID uint64) (*model.QuoteTask, error) {
	var task model.QuoteTask
	if err := repository.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("报价任务不存在")
		}
		return nil, fmt.Errorf("查询报价任务失败: %w", err)
	}
	return &task, nil
}

// GetMerchantQuoteTasks 商家获取报价任务列表
func (s *QuotePKService) GetMerchantQuoteTasks(providerID uint64) ([]model.QuoteTask, error) {
	// TODO: 实现商家获取报价任务列表逻辑
	// 需要关联查询，找出匹配该工长的报价任务
	var tasks []model.QuoteTask
	// 这里需要更复杂的查询逻辑，暂时返回空列表
	return tasks, nil
}
