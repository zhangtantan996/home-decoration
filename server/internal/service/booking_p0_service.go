package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"

	"gorm.io/gorm"
)

type SurveyDimension struct {
	Length float64 `json:"length"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	Unit   string  `json:"unit"`
}

type SiteSurveyPayload struct {
	Photos     []string                   `json:"photos"`
	Dimensions map[string]SurveyDimension `json:"dimensions"`
	Notes      string                     `json:"notes"`
}

type SiteSurveyDetail struct {
	ID                    uint64                     `json:"id"`
	BookingID             uint64                     `json:"bookingId"`
	ProviderID            uint64                     `json:"providerId"`
	Photos                []string                   `json:"photos"`
	Dimensions            map[string]SurveyDimension `json:"dimensions"`
	Notes                 string                     `json:"notes"`
	Status                string                     `json:"status"`
	SubmittedAt           *time.Time                 `json:"submittedAt,omitempty"`
	ConfirmedAt           *time.Time                 `json:"confirmedAt,omitempty"`
	RevisionRequestedAt   *time.Time                 `json:"revisionRequestedAt,omitempty"`
	RevisionRequestReason string                     `json:"revisionRequestReason,omitempty"`
}

type BudgetIncludes struct {
	DesignFee       bool `json:"design_fee"`
	ConstructionFee bool `json:"construction_fee"`
	MaterialFee     bool `json:"material_fee"`
	FurnitureFee    bool `json:"furniture_fee"`
}

type BudgetConfirmationPayload struct {
	BudgetMin            float64        `json:"budgetMin"`
	BudgetMax            float64        `json:"budgetMax"`
	Includes             BudgetIncludes `json:"includes"`
	Notes                string         `json:"notes"`
	DesignIntent         string         `json:"designIntent"`
	StyleDirection       string         `json:"styleDirection"`
	SpaceRequirements    string         `json:"spaceRequirements"`
	ExpectedDurationDays int            `json:"expectedDurationDays"`
	SpecialRequirements  string         `json:"specialRequirements"`
}

type BudgetConfirmationDetail struct {
	ID                   uint64         `json:"id"`
	BookingID            uint64         `json:"bookingId"`
	ProviderID           uint64         `json:"providerId"`
	BudgetMin            float64        `json:"budgetMin"`
	BudgetMax            float64        `json:"budgetMax"`
	Includes             BudgetIncludes `json:"includes"`
	Notes                string         `json:"notes"`
	DesignIntent         string         `json:"designIntent"`
	StyleDirection       string         `json:"styleDirection"`
	SpaceRequirements    string         `json:"spaceRequirements"`
	ExpectedDurationDays int            `json:"expectedDurationDays"`
	SpecialRequirements  string         `json:"specialRequirements"`
	Status               string         `json:"status"`
	RejectCount          int            `json:"rejectCount"`
	RejectLimit          int            `json:"rejectLimit"`
	CanResubmit          bool           `json:"canResubmit"`
	SubmittedAt          *time.Time     `json:"submittedAt,omitempty"`
	AcceptedAt           *time.Time     `json:"acceptedAt,omitempty"`
	RejectedAt           *time.Time     `json:"rejectedAt,omitempty"`
	LastRejectedAt       *time.Time     `json:"lastRejectedAt,omitempty"`
	RejectionReason      string         `json:"rejectionReason,omitempty"`
}

type BookingP0Summary struct {
	CurrentStage     string                    `json:"currentStage"`
	FlowSummary      string                    `json:"flowSummary"`
	AvailableActions []string                  `json:"availableActions"`
	SiteSurvey       *SiteSurveyDetail         `json:"siteSurveySummary,omitempty"`
	BudgetConfirm    *BudgetConfirmationDetail `json:"budgetConfirmSummary,omitempty"`
}

func (s *BookingService) GetMerchantSiteSurvey(providerID, bookingID uint64) (*SiteSurveyDetail, error) {
	booking, err := s.getBookingForProvider(providerID, bookingID)
	if err != nil {
		return nil, err
	}
	return s.getSiteSurveyByBooking(booking.ID)
}

func (s *BookingService) SubmitMerchantSiteSurvey(providerID, bookingID uint64, req *SiteSurveyPayload) (*SiteSurveyDetail, error) {
	booking, err := s.getBookingForProvider(providerID, bookingID)
	if err != nil {
		return nil, err
	}
	if booking.Status != 2 {
		return nil, errors.New("预约状态不正确，需为已确认")
	}
	if !booking.SurveyDepositPaid {
		return nil, errors.New("请等待用户先支付量房费")
	}
	if err := validateSiteSurveyPayload(req); err != nil {
		return nil, err
	}

	photosJSON, err := json.Marshal(normalizeStoredAssetSlice(req.Photos))
	if err != nil {
		return nil, fmt.Errorf("序列化量房照片失败: %w", err)
	}
	dimensionsJSON, err := json.Marshal(req.Dimensions)
	if err != nil {
		return nil, fmt.Errorf("序列化量房尺寸失败: %w", err)
	}

	now := time.Now()
	var survey model.SiteSurvey
	err = repository.DB.Where("booking_id = ?", booking.ID).First(&survey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			survey = model.SiteSurvey{BookingID: booking.ID, ProviderID: booking.ProviderID}
		} else {
			return nil, err
		}
	}
	survey.ProviderID = booking.ProviderID
	survey.Photos = string(photosJSON)
	survey.Dimensions = string(dimensionsJSON)
	survey.Notes = strings.TrimSpace(req.Notes)
	survey.Status = model.SiteSurveyStatusSubmitted
	survey.SubmittedAt = &now
	survey.ConfirmedAt = nil
	survey.RevisionRequestedAt = nil
	survey.RevisionRequestReason = ""

	if survey.ID == 0 {
		if err := repository.DB.Create(&survey).Error; err != nil {
			return nil, err
		}
	} else {
		if err := repository.DB.Save(&survey).Error; err != nil {
			return nil, err
		}
	}
	NewNotificationDispatcher().NotifySiteSurveySubmitted(booking.UserID, booking.ID, survey.ID)
	return toSiteSurveyDetail(&survey)
}

func (s *BookingService) GetUserSiteSurvey(userID, bookingID uint64) (*SiteSurveyDetail, error) {
	booking, err := s.getBookingForUser(userID, bookingID)
	if err != nil {
		return nil, err
	}
	return s.getSiteSurveyByBooking(booking.ID)
}

func (s *BookingService) ConfirmSiteSurvey(userID, bookingID uint64) (*SiteSurveyDetail, error) {
	if _, err := s.getBookingForUser(userID, bookingID); err != nil {
		return nil, err
	}
	return nil, errors.New("量房资料仅供查看，无需用户确认，请直接等待沟通确认")
}

func (s *BookingService) RejectSiteSurvey(userID, bookingID uint64, _ string) (*SiteSurveyDetail, error) {
	if _, err := s.getBookingForUser(userID, bookingID); err != nil {
		return nil, err
	}
	return nil, errors.New("量房资料仅供查看，无需用户退回，请在沟通确认节点填写调整意见")
}

func (s *BookingService) GetMerchantBudgetConfirmation(providerID, bookingID uint64) (*BudgetConfirmationDetail, error) {
	booking, err := s.getBookingForProvider(providerID, bookingID)
	if err != nil {
		return nil, err
	}
	return s.getBudgetConfirmationByBooking(booking.ID)
}

func (s *BookingService) SubmitMerchantBudgetConfirmation(providerID, bookingID uint64, req *BudgetConfirmationPayload) (*BudgetConfirmationDetail, error) {
	booking, err := s.getBookingForProvider(providerID, bookingID)
	if err != nil {
		return nil, err
	}
	if booking.Status != 2 {
		return nil, errors.New("预约状态不正确，需为已确认")
	}
	if !booking.SurveyDepositPaid {
		return nil, errors.New("请等待用户先支付量房费")
	}
	if err := validateBudgetConfirmationPayload(req); err != nil {
		return nil, err
	}

	survey, err := s.getSiteSurveyByBooking(booking.ID)
	if err != nil {
		return nil, errors.New("请先完成量房资料")
	}
	if survey.Status != model.SiteSurveyStatusSubmitted && survey.Status != model.SiteSurveyStatusConfirmed {
		return nil, errors.New("请先上传量房资料")
	}

	includesJSON, err := json.Marshal(req.Includes)
	if err != nil {
		return nil, fmt.Errorf("序列化预算包含项失败: %w", err)
	}

	now := time.Now()
	var confirmation model.BudgetConfirmation
	err = repository.DB.Where("booking_id = ?", booking.ID).First(&confirmation).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			confirmation = model.BudgetConfirmation{
				BookingID:    booking.ID,
				ProviderID:   booking.ProviderID,
				RejectLimit:  configSvc.GetBudgetConfirmRejectLimit(),
			}
		} else {
			return nil, err
		}
	}
	if confirmation.ID > 0 && confirmation.Status == model.BudgetConfirmationStatusAccepted {
		return nil, errors.New("沟通确认已通过，无需重复提交")
	}
	if confirmation.RejectLimit <= 0 {
		confirmation.RejectLimit = configSvc.GetBudgetConfirmRejectLimit()
	}
	confirmation.ProviderID = booking.ProviderID
	confirmation.BudgetMin = req.BudgetMin
	confirmation.BudgetMax = req.BudgetMax
	confirmation.Includes = string(includesJSON)
	confirmation.Notes = strings.TrimSpace(req.Notes)
	confirmation.DesignIntent = strings.TrimSpace(req.DesignIntent)
	confirmation.StyleDirection = strings.TrimSpace(req.StyleDirection)
	confirmation.SpaceRequirements = strings.TrimSpace(req.SpaceRequirements)
	confirmation.ExpectedDurationDays = req.ExpectedDurationDays
	confirmation.SpecialRequirements = strings.TrimSpace(req.SpecialRequirements)
	confirmation.Status = model.BudgetConfirmationStatusSubmitted
	confirmation.SubmittedAt = &now
	confirmation.AcceptedAt = nil
	confirmation.RejectedAt = nil
	confirmation.LastRejectedAt = nil
	confirmation.RejectionReason = ""

	if confirmation.ID == 0 {
		if err := repository.DB.Create(&confirmation).Error; err != nil {
			return nil, err
		}
	} else {
		if err := repository.DB.Save(&confirmation).Error; err != nil {
			return nil, err
		}
	}
	dispatcher := NewNotificationDispatcher()
	if confirmation.RejectCount > 0 {
		dispatcher.NotifyBudgetConfirmationResubmitted(booking.UserID, booking.ID, confirmation.ID, confirmation.RejectCount, confirmation.RejectLimit)
	} else {
		dispatcher.NotifyBudgetConfirmationSubmitted(booking.UserID, booking.ID, confirmation.ID)
	}
	return toBudgetConfirmationDetail(&confirmation)
}

func (s *BookingService) GetUserBudgetConfirmation(userID, bookingID uint64) (*BudgetConfirmationDetail, error) {
	booking, err := s.getBookingForUser(userID, bookingID)
	if err != nil {
		return nil, err
	}
	return s.getBudgetConfirmationByBooking(booking.ID)
}

func (s *BookingService) AcceptBudgetConfirmation(userID, bookingID uint64) (*BudgetConfirmationDetail, error) {
	booking, err := s.getBookingForUser(userID, bookingID)
	if err != nil {
		return nil, err
	}

	var confirmation model.BudgetConfirmation
	if err := repository.DB.Where("booking_id = ?", booking.ID).First(&confirmation).Error; err != nil {
		return nil, errors.New("沟通确认不存在")
	}
	if confirmation.Status == model.BudgetConfirmationStatusAccepted {
		return toBudgetConfirmationDetail(&confirmation)
	}
	if confirmation.Status != model.BudgetConfirmationStatusSubmitted {
		return nil, errors.New("当前沟通确认不可接受")
	}

	now := time.Now()
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&confirmation).Updates(map[string]interface{}{
			"status":           model.BudgetConfirmationStatusAccepted,
			"accepted_at":      now,
			"rejected_at":      nil,
			"last_rejected_at": nil,
			"rejection_reason": "",
		}).Error; err != nil {
			return err
		}
		return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageDesignPendingSubmission,
		})
	}); err != nil {
		return nil, err
	}
	if err := repository.DB.First(&confirmation, confirmation.ID).Error; err != nil {
		return nil, err
	}
	return toBudgetConfirmationDetail(&confirmation)
}

func (s *BookingService) RejectBudgetConfirmation(userID, bookingID uint64, reason string) (*BudgetConfirmationDetail, error) {
	booking, err := s.getBookingForUser(userID, bookingID)
	if err != nil {
		return nil, err
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("请填写拒绝原因")
	}

	var confirmation model.BudgetConfirmation
	if err := repository.DB.Where("booking_id = ?", booking.ID).First(&confirmation).Error; err != nil {
		return nil, errors.New("沟通确认不存在")
	}
	if confirmation.Status != model.BudgetConfirmationStatusSubmitted && confirmation.Status != model.BudgetConfirmationStatusAccepted {
		return nil, errors.New("当前沟通确认不可拒绝")
	}

	now := time.Now()
	providerUserID := providerUserIDFromProvider(booking.ProviderID)
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		rejectLimit := confirmation.RejectLimit
		if rejectLimit <= 0 {
			rejectLimit = configSvc.GetBudgetConfirmRejectLimitTx(tx)
		}
		nextRejectCount := confirmation.RejectCount + 1
		updates := map[string]interface{}{
			"status":             model.BudgetConfirmationStatusRejected,
			"accepted_at":        nil,
			"rejected_at":        now,
			"last_rejected_at":   now,
			"rejection_reason":   reason,
			"reject_count":       nextRejectCount,
			"reject_limit":       rejectLimit,
		}
		if err := tx.Model(&confirmation).Updates(updates).Error; err != nil {
			return err
		}
		if nextRejectCount >= rejectLimit {
			if err := tx.Model(&model.Booking{}).Where("id = ?", booking.ID).Update("status", 4).Error; err != nil {
				return err
			}
			return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]interface{}{
				"current_stage": model.BusinessFlowStageCancelled,
				"closed_reason": reason,
			})
		}
		return businessFlowSvc.AdvanceBySource(tx, model.BusinessFlowSourceBooking, booking.ID, map[string]interface{}{
			"current_stage": model.BusinessFlowStageNegotiating,
		})
	}); err != nil {
		return nil, err
	}
	if err := repository.DB.First(&confirmation, confirmation.ID).Error; err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyBudgetConfirmationRejected(providerUserID, booking.ID, confirmation.ID, confirmation.RejectCount, confirmation.RejectLimit, reason)
	return toBudgetConfirmationDetail(&confirmation)
}

func (s *BookingService) GetBookingP0Summary(bookingID uint64) (*BookingP0Summary, error) {
	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		return nil, err
	}
	flow, err := businessFlowSvc.GetBySource(model.BusinessFlowSourceBooking, bookingID)
	if err != nil {
		return nil, err
	}
	summary := businessFlowSvc.BuildSummary(flow)
	siteSurvey, _ := s.getSiteSurveyByBooking(bookingID)
	budgetConfirm, _ := s.getBudgetConfirmationByBooking(bookingID)
	availableActions := append([]string(nil), summary.AvailableActions...)
	flowSummary := summary.FlowSummary
	currentStage := summary.CurrentStage
	normalizedStage := model.NormalizeBusinessFlowStage(currentStage)

	switch {
	case booking.Status == 4:
		currentStage = model.BusinessFlowStageCancelled
		flowSummary = "当前预约已取消。"
		availableActions = nil
	case booking.Status == 1:
		currentStage = model.BusinessFlowStageLeadPending
		flowSummary = "预约待商家确认，确认前不进入量房与沟通确认阶段。"
		availableActions = nil
	case !booking.SurveyDepositPaid:
		currentStage = model.BusinessFlowStageSurveyDepositPending
		flowSummary = "商家已确认预约，等待用户支付量房费后继续推进。"
		availableActions = nil
	case normalizedStage != "" &&
		normalizedStage != model.BusinessFlowStageLeadPending &&
		normalizedStage != model.BusinessFlowStageSurveyDepositPending &&
		normalizedStage != model.BusinessFlowStageNegotiating:
		return &BookingP0Summary{
			CurrentStage:     currentStage,
			FlowSummary:      flowSummary,
			AvailableActions: availableActions,
			SiteSurvey:       siteSurvey,
			BudgetConfirm:    budgetConfirm,
		}, nil
	case siteSurvey == nil || siteSurvey.Status == model.SiteSurveyStatusRevisionRequested:
		currentStage = model.BusinessFlowStageSurveyDepositPending
		if siteSurvey != nil && strings.TrimSpace(siteSurvey.RevisionRequestReason) != "" {
			flowSummary = "历史量房资料曾被退回，待商家重新上传最新资料。"
		} else {
			flowSummary = "量房费已支付，待商家上传量房资料。"
		}
		availableActions = []string{"submit_site_survey"}
	case (siteSurvey.Status == model.SiteSurveyStatusSubmitted || siteSurvey.Status == model.SiteSurveyStatusConfirmed) && (budgetConfirm == nil || budgetConfirm.Status == model.BudgetConfirmationStatusRejected):
		currentStage = model.BusinessFlowStageNegotiating
		if budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusRejected {
			flowSummary = fmt.Sprintf("沟通确认已被退回（%d/%d），待商家重新整理后提交。", budgetConfirm.RejectCount, normalizeBudgetRejectLimit(budgetConfirm.RejectLimit))
		} else {
			flowSummary = "量房资料已上传，待商家提交沟通确认。"
		}
		availableActions = []string{"submit_budget"}
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusSubmitted:
		currentStage = model.BusinessFlowStageNegotiating
		flowSummary = "沟通确认已提交，等待用户确认。"
		availableActions = nil
	case budgetConfirm != nil && budgetConfirm.Status == model.BudgetConfirmationStatusAccepted:
		currentStage = model.BusinessFlowStageDesignQuotePending
		flowSummary = "沟通确认已完成，待发起设计费报价。"
		availableActions = []string{"create_design_fee_quote"}
	}

	return &BookingP0Summary{
		CurrentStage:     currentStage,
		FlowSummary:      flowSummary,
		AvailableActions: availableActions,
		SiteSurvey:       siteSurvey,
		BudgetConfirm:    budgetConfirm,
	}, nil
}

func (s *BookingService) getBookingForUser(userID, bookingID uint64) (*model.Booking, error) {
	if bookingID == 0 || userID == 0 {
		return nil, errors.New("无效预约")
	}
	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.UserID != userID {
		return nil, errors.New("无权操作此预约")
	}
	return &booking, nil
}

func (s *BookingService) getBookingForProvider(providerID, bookingID uint64) (*model.Booking, error) {
	if bookingID == 0 || providerID == 0 {
		return nil, errors.New("无效预约")
	}
	var booking model.Booking
	if err := repository.DB.First(&booking, bookingID).Error; err != nil {
		return nil, errors.New("预约不存在")
	}
	if booking.ProviderID != providerID {
		return nil, errors.New("无权操作此预约")
	}
	return &booking, nil
}

func (s *BookingService) getSiteSurveyByBooking(bookingID uint64) (*SiteSurveyDetail, error) {
	var survey model.SiteSurvey
	if err := repository.DB.Where("booking_id = ?", bookingID).First(&survey).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return toSiteSurveyDetail(&survey)
}

func (s *BookingService) getBudgetConfirmationByBooking(bookingID uint64) (*BudgetConfirmationDetail, error) {
	var confirmation model.BudgetConfirmation
	if err := repository.DB.Where("booking_id = ?", bookingID).First(&confirmation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return toBudgetConfirmationDetail(&confirmation)
}

func toSiteSurveyDetail(survey *model.SiteSurvey) (*SiteSurveyDetail, error) {
	if survey == nil {
		return nil, nil
	}
	var photos []string
	if strings.TrimSpace(survey.Photos) != "" {
		if err := json.Unmarshal([]byte(survey.Photos), &photos); err != nil {
			return nil, fmt.Errorf("解析量房照片失败: %w", err)
		}
	}
	dimensions := map[string]SurveyDimension{}
	if strings.TrimSpace(survey.Dimensions) != "" {
		if err := json.Unmarshal([]byte(survey.Dimensions), &dimensions); err != nil {
			return nil, fmt.Errorf("解析量房尺寸失败: %w", err)
		}
	}
	return &SiteSurveyDetail{
		ID:                    survey.ID,
		BookingID:             survey.BookingID,
		ProviderID:            survey.ProviderID,
		Photos:                imgutil.GetFullImageURLs(photos),
		Dimensions:            dimensions,
		Notes:                 survey.Notes,
		Status:                survey.Status,
		SubmittedAt:           survey.SubmittedAt,
		ConfirmedAt:           survey.ConfirmedAt,
		RevisionRequestedAt:   survey.RevisionRequestedAt,
		RevisionRequestReason: survey.RevisionRequestReason,
	}, nil
}

func toBudgetConfirmationDetail(confirmation *model.BudgetConfirmation) (*BudgetConfirmationDetail, error) {
	if confirmation == nil {
		return nil, nil
	}
	rejectLimit := normalizeBudgetRejectLimit(confirmation.RejectLimit)
	includes := BudgetIncludes{}
	if strings.TrimSpace(confirmation.Includes) != "" {
		if err := json.Unmarshal([]byte(confirmation.Includes), &includes); err != nil {
			return nil, fmt.Errorf("解析预算包含项失败: %w", err)
		}
	}
	return &BudgetConfirmationDetail{
		ID:                   confirmation.ID,
		BookingID:            confirmation.BookingID,
		ProviderID:           confirmation.ProviderID,
		BudgetMin:            confirmation.BudgetMin,
		BudgetMax:            confirmation.BudgetMax,
		Includes:             includes,
		Notes:                confirmation.Notes,
		DesignIntent:         confirmation.DesignIntent,
		StyleDirection:       confirmation.StyleDirection,
		SpaceRequirements:    confirmation.SpaceRequirements,
		ExpectedDurationDays: confirmation.ExpectedDurationDays,
		SpecialRequirements:  confirmation.SpecialRequirements,
		Status:               confirmation.Status,
		RejectCount:          confirmation.RejectCount,
		RejectLimit:          rejectLimit,
		CanResubmit:          confirmation.Status == model.BudgetConfirmationStatusRejected && confirmation.RejectCount < rejectLimit,
		SubmittedAt:          confirmation.SubmittedAt,
		AcceptedAt:           confirmation.AcceptedAt,
		RejectedAt:           confirmation.RejectedAt,
		LastRejectedAt:       firstNonNilTime(confirmation.LastRejectedAt, confirmation.RejectedAt),
		RejectionReason:      confirmation.RejectionReason,
	}, nil
}

func normalizeBudgetRejectLimit(limit int) int {
	if limit <= 0 {
		return 3
	}
	return limit
}

func firstNonNilTime(values ...*time.Time) *time.Time {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func validateSiteSurveyPayload(req *SiteSurveyPayload) error {
	if req == nil {
		return errors.New("参数不能为空")
	}
	if len(req.Photos) == 0 {
		return errors.New("请至少上传一张量房照片")
	}
	if len(req.Photos) > 20 {
		return errors.New("量房照片最多上传 20 张")
	}
	for area, item := range req.Dimensions {
		if strings.TrimSpace(area) == "" {
			return errors.New("尺寸区域名称不能为空")
		}
		if item.Length <= 0 || item.Width <= 0 || item.Height <= 0 {
			return fmt.Errorf("%s 的长宽高需大于 0", area)
		}
		if strings.TrimSpace(item.Unit) == "" {
			req.Dimensions[area] = SurveyDimension{Length: item.Length, Width: item.Width, Height: item.Height, Unit: "m"}
		}
	}
	if len(strings.TrimSpace(req.Notes)) > 1000 {
		return errors.New("量房备注不能超过 1000 字符")
	}
	return nil
}

func validateBudgetConfirmationPayload(req *BudgetConfirmationPayload) error {
	if req == nil {
		return errors.New("参数不能为空")
	}
	if req.BudgetMin <= 0 || req.BudgetMax <= 0 {
		return errors.New("预算范围必须大于 0")
	}
	if req.BudgetMax < req.BudgetMin {
		return errors.New("预算最大值不能小于最小值")
	}
	if !req.Includes.DesignFee && !req.Includes.ConstructionFee && !req.Includes.MaterialFee && !req.Includes.FurnitureFee {
		return errors.New("请至少选择一个预算包含项")
	}
	if strings.TrimSpace(req.DesignIntent) == "" {
		return errors.New("请填写设计意向")
	}
	if strings.TrimSpace(req.StyleDirection) == "" {
		return errors.New("请填写风格方向")
	}
	if strings.TrimSpace(req.SpaceRequirements) == "" {
		return errors.New("请填写空间需求")
	}
	if req.ExpectedDurationDays <= 0 {
		return errors.New("请填写可接受工期")
	}
	if len(strings.TrimSpace(req.Notes)) > 1000 {
		return errors.New("预算说明不能超过 1000 字符")
	}
	if len(strings.TrimSpace(req.DesignIntent)) > 1000 {
		return errors.New("设计意向不能超过 1000 字符")
	}
	if len(strings.TrimSpace(req.StyleDirection)) > 200 {
		return errors.New("风格方向不能超过 200 字符")
	}
	if len(strings.TrimSpace(req.SpaceRequirements)) > 1000 {
		return errors.New("空间需求不能超过 1000 字符")
	}
	if len(strings.TrimSpace(req.SpecialRequirements)) > 1000 {
		return errors.New("特殊要求不能超过 1000 字符")
	}
	return nil
}
