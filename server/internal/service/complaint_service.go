package service

import (
	"encoding/json"
	"errors"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
)

type ComplaintService struct{}

type CreateComplaintInput struct {
	ProjectID    uint64   `json:"projectId"`
	Category     string   `json:"category"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	EvidenceURLs []string `json:"evidenceUrls"`
}

func marshalStringList(items []string) string {
	if len(items) == 0 {
		return "[]"
	}
	payload, err := json.Marshal(normalizeStoredAssetSlice(items))
	if err != nil {
		return "[]"
	}
	return string(payload)
}

func (s *ComplaintService) CreateComplaint(userID uint64, input *CreateComplaintInput) (*model.Complaint, error) {
	if input.ProjectID == 0 {
		return nil, errors.New("缺少项目ID")
	}
	if input.Title == "" {
		return nil, errors.New("投诉标题不能为空")
	}
	if input.Description == "" {
		return nil, errors.New("投诉说明不能为空")
	}

	var project model.Project
	if err := repository.DB.First(&project, input.ProjectID).Error; err != nil {
		return nil, errors.New("项目不存在")
	}
	if project.OwnerID != userID {
		return nil, errors.New("无权对该项目发起投诉")
	}

	complaint := &model.Complaint{
		ProjectID:        input.ProjectID,
		UserID:           userID,
		ProviderID:       project.ProviderID,
		Category:         input.Category,
		Title:            input.Title,
		Description:      input.Description,
		EvidenceURLs:     marshalStringList(input.EvidenceURLs),
		Status:           "submitted",
		FreezePayment:    false,
		MerchantResponse: "",
	}
	if err := repository.DB.Create(complaint).Error; err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyComplaintCreated(providerUserIDFromProvider(project.ProviderID), complaint.ID, complaint.ProjectID, complaint.Title)
	return complaint, nil
}

func (s *ComplaintService) ListUserComplaints(userID uint64) ([]model.Complaint, error) {
	var items []model.Complaint
	if err := repository.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *ComplaintService) GetUserComplaint(userID, complaintID uint64) (*model.Complaint, error) {
	var item model.Complaint
	if err := repository.DB.First(&item, complaintID).Error; err != nil {
		return nil, errors.New("投诉不存在")
	}
	if item.UserID != userID {
		return nil, errors.New("无权查看该投诉")
	}
	return &item, nil
}

func (s *ComplaintService) ListAdminComplaints() ([]model.Complaint, error) {
	var items []model.Complaint
	if err := repository.DB.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *ComplaintService) ResolveComplaint(adminID, complaintID uint64, resolution string, freezePayment bool) (*model.Complaint, error) {
	var item model.Complaint
	if err := repository.DB.First(&item, complaintID).Error; err != nil {
		return nil, errors.New("投诉不存在")
	}
	item.AdminID = adminID
	item.Resolution = resolution
	item.Status = "resolved"
	item.FreezePayment = freezePayment
	if err := repository.DB.Save(&item).Error; err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyComplaintResolved(item.UserID, providerUserIDFromProvider(item.ProviderID), item.ID, item.ProjectID, resolution)
	return &item, nil
}

func (s *ComplaintService) ListMerchantComplaints(providerID uint64) ([]model.Complaint, error) {
	var items []model.Complaint
	if err := repository.DB.Where("provider_id = ?", providerID).Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *ComplaintService) RespondComplaint(providerID, complaintID uint64, responseText string) (*model.Complaint, error) {
	var item model.Complaint
	if err := repository.DB.First(&item, complaintID).Error; err != nil {
		return nil, errors.New("投诉不存在")
	}
	if item.ProviderID != providerID {
		return nil, errors.New("无权处理该投诉")
	}
	item.MerchantResponse = responseText
	if item.Status == "submitted" {
		item.Status = "processing"
	}
	if err := repository.DB.Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func ParseStringList(raw string) []string {
	if raw == "" {
		return []string{}
	}
	var items []string
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return []string{}
	}
	return imgutil.GetFullImageURLs(items)
}

func FormatTime(value time.Time) string {
	return value.Format(time.RFC3339)
}
