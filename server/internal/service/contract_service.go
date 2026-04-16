package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
)

type ContractService struct{}

type CreateContractInput struct {
	ProjectID      uint64        `json:"projectId"`
	DemandID       uint64        `json:"demandId"`
	UserID         uint64        `json:"userId"`
	Title          string        `json:"title"`
	TotalAmount    float64       `json:"totalAmount"`
	PaymentPlan    []interface{} `json:"paymentPlan"`
	AttachmentURLs []string      `json:"attachmentUrls"`
	TermsSnapshot  interface{}   `json:"termsSnapshot"`
}

func toJSONString(value interface{}, fallback string) string {
	if value == nil {
		return fallback
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return fallback
	}
	return string(payload)
}

func (s *ContractService) CreateContract(providerID uint64, input *CreateContractInput) (*model.Contract, error) {
	if providerID == 0 {
		return nil, errors.New("缺少商家身份")
	}
	if input == nil {
		return nil, errors.New("参数不能为空")
	}
	if input.DemandID == 0 && input.ProjectID == 0 {
		return nil, errors.New("缺少需求或项目信息")
	}

	resolvedUserID := uint64(0)
	if input.ProjectID > 0 {
		var project model.Project
		if err := repository.DB.First(&project, input.ProjectID).Error; err != nil {
			return nil, errors.New("项目不存在")
		}
		if !canProjectProviderOperate(&project, providerID) {
			return nil, errors.New("无权为该项目创建合同")
		}
		resolvedUserID = project.OwnerID
	}

	if input.DemandID > 0 {
		var demand model.Demand
		if err := repository.DB.First(&demand, input.DemandID).Error; err != nil {
			return nil, errors.New("需求不存在")
		}

		var match model.DemandMatch
		if err := repository.DB.Where("demand_id = ? AND provider_id = ?", input.DemandID, providerID).First(&match).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("无权为该需求创建合同")
			}
			return nil, err
		}

		if resolvedUserID > 0 && resolvedUserID != demand.UserID {
			return nil, errors.New("项目与需求归属冲突")
		}
		resolvedUserID = demand.UserID
	}

	if resolvedUserID == 0 {
		return nil, errors.New("缺少业主信息")
	}

	contract := &model.Contract{
		ProjectID:      input.ProjectID,
		DemandID:       input.DemandID,
		ProviderID:     providerID,
		UserID:         resolvedUserID,
		Title:          input.Title,
		TotalAmount:    input.TotalAmount,
		PaymentPlan:    toJSONString(input.PaymentPlan, "[]"),
		AttachmentURLs: toJSONString(input.AttachmentURLs, "[]"),
		TermsSnapshot:  toJSONString(input.TermsSnapshot, "{}"),
		Status:         model.ContractStatusDraft,
	}

	if contract.Title == "" {
		contract.Title = "装修合同"
	}
	contract.ContractNo = fmt.Sprintf("CT-%s-%04d", time.Now().Format("20060102"), time.Now().UnixNano()%10000)
	contract.Status = model.ContractStatusPendingConfirm
	if err := repository.DB.Create(contract).Error; err != nil {
		return nil, err
	}
	NewNotificationDispatcher().NotifyContractPendingConfirm(contract.UserID, contract.ID, contract.ProjectID)
	return contract, nil
}

func (s *ContractService) ConfirmContract(userID, contractID uint64) (*model.Contract, error) {
	var contract model.Contract
	if err := repository.DB.First(&contract, contractID).Error; err != nil {
		return nil, errors.New("合同不存在")
	}
	if contract.UserID != userID {
		return nil, errors.New("无权确认该合同")
	}
	if contract.Status != model.ContractStatusDraft && contract.Status != model.ContractStatusPendingConfirm {
		return nil, errors.New("当前合同状态不可确认")
	}
	now := time.Now()
	contract.Status = model.ContractStatusConfirmed
	contract.ConfirmedAt = &now
	if err := repository.DB.Save(&contract).Error; err != nil {
		return nil, err
	}
	return &contract, nil
}

func (s *ContractService) GetProjectContract(userID, projectID uint64) (*model.Contract, error) {
	var contract model.Contract
	if err := repository.DB.Where("project_id = ?", projectID).Order("created_at DESC").First(&contract).Error; err != nil {
		return nil, errors.New("合同不存在")
	}
	if contract.UserID != userID {
		return nil, errors.New("无权查看该合同")
	}
	return &contract, nil
}

func (s *ContractService) GetContract(userID, contractID uint64) (*model.Contract, error) {
	var contract model.Contract
	if err := repository.DB.First(&contract, contractID).Error; err != nil {
		return nil, errors.New("合同不存在")
	}
	if contract.UserID != userID {
		return nil, errors.New("无权查看该合同")
	}
	return &contract, nil
}
