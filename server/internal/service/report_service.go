package service

import (
	"errors"
	"fmt"
	"strings"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

var (
	ErrInvalidUser    = errors.New("invalid user")
	ErrInvalidRequest = errors.New("invalid request")
	ErrTopicRequired  = errors.New("topic is required")
	ErrReasonRequired = errors.New("reason is required")
	ErrReasonTooLong  = errors.New("reason too long")
)

type ReportService struct {
	riskWarningRepo *repository.RiskWarningRepository
}

type SubmitChatReportRequest struct {
	Topic   string `json:"topic"`
	Reason  string `json:"reason"`
	Partner string `json:"partner"`
}

func NewReportService() *ReportService {
	return &ReportService{
		riskWarningRepo: repository.NewRiskWarningRepository(),
	}
}

func (s *ReportService) SubmitChatReport(userID uint64, req *SubmitChatReportRequest) error {
	if userID == 0 {
		return ErrInvalidUser
	}
	if req == nil {
		return ErrInvalidRequest
	}

	topic := strings.TrimSpace(req.Topic)
	reason := strings.TrimSpace(req.Reason)
	partner := strings.TrimSpace(req.Partner)

	if topic == "" {
		return ErrTopicRequired
	}
	if reason == "" {
		return ErrReasonRequired
	}
	if len([]rune(reason)) > 500 {
		return ErrReasonTooLong
	}

	description := fmt.Sprintf("聊天举报 user=%d topic=%s", userID, topic)
	if partner != "" {
		description += fmt.Sprintf(" partner=%s", partner)
	}
	description += fmt.Sprintf(" reason=%s", reason)

	warning := &model.RiskWarning{
		ProjectID:   0,
		ProjectName: "聊天举报",
		Type:        "chat_report",
		Level:       "high",
		Description: description,
		Status:      0,
	}

	return s.riskWarningRepo.Create(warning)
}
