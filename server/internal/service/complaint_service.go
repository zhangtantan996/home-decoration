package service

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"

	"gorm.io/gorm"
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

func marshalSafeEvidenceURLList(items []string) (string, error) {
	if len(items) == 0 {
		return "[]", nil
	}
	if len(items) > 10 {
		return "", errors.New("证据最多支持 10 条")
	}
	result := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		value := imgutil.NormalizeStoredImagePath(strings.TrimSpace(item))
		if value == "" {
			continue
		}
		if !imgutil.IsSafeEvidenceURL(value) {
			return "", errors.New("证据链接格式不正确")
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	payload, err := json.Marshal(result)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func (s *ComplaintService) CreateComplaint(userID uint64, input *CreateComplaintInput) (*model.Complaint, error) {
	if input.ProjectID == 0 {
		return nil, errors.New("缺少项目ID")
	}
	input.Category = strings.TrimSpace(input.Category)
	if !isAllowedComplaintCategory(input.Category) {
		return nil, errors.New("请选择有效投诉类型")
	}
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" || len([]rune(input.Title)) > 80 {
		return nil, errors.New("投诉标题不能为空")
	}
	input.Description = strings.TrimSpace(input.Description)
	if input.Description == "" || len([]rune(input.Description)) > 2000 {
		return nil, errors.New("投诉说明不能为空")
	}
	evidenceJSON, err := marshalSafeEvidenceURLList(input.EvidenceURLs)
	if err != nil {
		return nil, err
	}

	var complaint *model.Complaint
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.First(&project, input.ProjectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权对该项目发起投诉")
		}

		complaint = &model.Complaint{
			ProjectID:        input.ProjectID,
			UserID:           userID,
			ProviderID:       project.ProviderID,
			Category:         input.Category,
			Title:            input.Title,
			Description:      input.Description,
			EvidenceURLs:     evidenceJSON,
			Status:           "submitted",
			FreezePayment:    false,
			MerchantResponse: "",
		}
		if err := tx.Create(complaint).Error; err != nil {
			return err
		}
		return enqueueProjectDisputeCreatedOutboxTx(tx, &project, getProviderUserIDTx(tx, project.ProviderID), 0, complaint.Title)
	})
	if err != nil {
		return nil, err
	}
	return complaint, nil
}

var allowedComplaintCategories = map[string]struct{}{
	"quality":         {},
	"delay":           {},
	"service":         {},
	"payment":         {},
	"other":           {},
	"工程质量":            {},
	"进度延期":            {},
	"服务态度":            {},
	"费用争议":            {},
	"其他":              {},
	"project_dispute": {},
}

func isAllowedComplaintCategory(value string) bool {
	_, ok := allowedComplaintCategories[strings.TrimSpace(value)]
	return ok
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
