package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ContractService struct{}

type CreateContractInput struct {
	ProjectID      uint64        `json:"projectId"`
	DemandID       uint64        `json:"demandId"`
	BookingID      uint64        `json:"bookingId"`
	UserID         uint64        `json:"userId"`
	Title          string        `json:"title"`
	ContractType   string        `json:"contractType"`
	TotalAmount    float64       `json:"totalAmount"`
	DepositAmount  float64       `json:"depositAmount"`
	PaymentPlan    []interface{} `json:"paymentPlan"`
	AttachmentURLs []string      `json:"attachmentUrls"`
	TermsSnapshot  interface{}   `json:"termsSnapshot"`
}

type SignContractInput struct {
	SignatureData string `json:"signatureData"`
	SignToken     string `json:"signToken" binding:"required"` // 签署令牌（防重放）
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
	if input.DemandID == 0 && input.ProjectID == 0 && input.BookingID == 0 {
		return nil, errors.New("缺少需求、项目或预约信息")
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

	if input.BookingID > 0 {
		var booking model.Booking
		if err := repository.DB.First(&booking, input.BookingID).Error; err != nil {
			return nil, errors.New("预约不存在")
		}
		if booking.ProviderID != providerID {
			return nil, errors.New("无权为该预约创建合同")
		}
		if resolvedUserID > 0 && resolvedUserID != booking.UserID {
			return nil, errors.New("预约与项目归属冲突")
		}
		resolvedUserID = booking.UserID
	}

	if resolvedUserID == 0 {
		return nil, errors.New("缺少业主信息")
	}

	contractType := input.ContractType
	if contractType == "" {
		contractType = model.ContractTypeDesign
	}

	contract := &model.Contract{
		ProjectID:       input.ProjectID,
		DemandID:        input.DemandID,
		BookingID:       input.BookingID,
		ProviderID:      providerID,
		UserID:          resolvedUserID,
		Title:           input.Title,
		ContractType:    contractType,
		TotalAmount:     input.TotalAmount,
		DepositAmount:   input.DepositAmount,
		PaymentPlan:     toJSONString(input.PaymentPlan, "[]"),
		AttachmentURLs:  toJSONString(input.AttachmentURLs, "[]"),
		TermsSnapshot:   toJSONString(input.TermsSnapshot, "{}"),
		Status:          model.ContractStatusDraft,
		ESignProvider:   "mock",
		ContractContent: s.generateContractContent(input),
	}

	if contract.Title == "" {
		if contractType == model.ContractTypeConstruction {
			contract.Title = "施工合同"
		} else {
			contract.Title = "设计合同"
		}
	}
	contract.ContractNo = fmt.Sprintf("CT-%s-%04d", time.Now().Format("20060102"), time.Now().UnixNano()%10000)
	contract.Status = model.ContractStatusPendingSign

	// 生成签署令牌（防重放攻击）
	userToken, err := generateSignToken()
	if err != nil {
		return nil, fmt.Errorf("生成用户签署令牌失败: %w", err)
	}
	providerToken, err := generateSignToken()
	if err != nil {
		return nil, fmt.Errorf("生成商家签署令牌失败: %w", err)
	}
	contract.UserSignToken = userToken
	contract.ProviderSignToken = providerToken

	if err := repository.DB.Create(contract).Error; err != nil {
		return nil, err
	}

	// 创建电子签章流程
	if err := s.createESignFlow(contract); err != nil {
		return nil, fmt.Errorf("创建电子签章流程失败: %w", err)
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

// generateContractContent 生成合同内容（HTML格式）
func (s *ContractService) generateContractContent(input *CreateContractInput) string {
	content := fmt.Sprintf(`
<html>
<head><title>%s</title></head>
<body>
<h1>%s</h1>
<p>合同编号：待生成</p>
<p>甲方（业主）：待填写</p>
<p>乙方（服务商）：待填写</p>
<h2>一、合同金额</h2>
<p>合同总金额：%.2f 元</p>
<p>定金金额：%.2f 元</p>
<h2>二、付款方式</h2>
<p>详见付款计划</p>
<h2>三、服务内容</h2>
<p>详见附件</p>
<h2>四、双方权利义务</h2>
<p>1. 甲方权利义务...</p>
<p>2. 乙方权利义务...</p>
<h2>五、违约责任</h2>
<p>详见合同条款</p>
<h2>六、争议解决</h2>
<p>双方协商解决，协商不成提交仲裁</p>
</body>
</html>
`, input.Title, input.Title, input.TotalAmount, input.DepositAmount)
	return content
}

// createESignFlow 创建电子签章流程（模拟实现）
func (s *ContractService) createESignFlow(contract *model.Contract) error {
	// 模拟电子签章流程ID
	flowID := fmt.Sprintf("FLOW-%s-%d", time.Now().Format("20060102150405"), contract.ID)
	contract.ESignFlowID = flowID

	// 在实际环境中，这里应该调用第三方电子签章API
	// 例如：e签宝、法大大、上上签等
	// 示例代码：
	// client := esign.NewClient(apiKey, apiSecret)
	// flow, err := client.CreateSignFlow(contract)
	// if err != nil {
	//     return err
	// }
	// contract.ESignFlowID = flow.FlowID

	return repository.DB.Model(contract).Updates(map[string]interface{}{
		"esign_flow_id": flowID,
	}).Error
}

// SignContractByUser 用户签署合同
func (s *ContractService) SignContractByUser(userID, contractID uint64, input *SignContractInput) (*model.Contract, error) {
	if input == nil || input.SignToken == "" {
		return nil, errors.New("签署令牌不能为空")
	}

	var contract model.Contract
	if err := repository.DB.Clauses(clause.Locking{Strength: "UPDATE"}).First(&contract, contractID).Error; err != nil {
		return nil, errors.New("合同不存在")
	}

	if contract.UserID != userID {
		return nil, errors.New("无权签署该合同")
	}

	if contract.Status != model.ContractStatusPendingSign && contract.Status != model.ContractStatusDraft {
		return nil, errors.New("当前合同状态不可签署")
	}

	if contract.UserSignedAt != nil {
		return nil, errors.New("您已签署该合同")
	}

	// 验证签署令牌（防重放攻击）
	if contract.UserSignToken == "" {
		return nil, errors.New("合同签署令牌未初始化")
	}
	if contract.UserSignToken != input.SignToken {
		return nil, errors.New("签署令牌无效")
	}
	if contract.UserTokenUsedAt != nil {
		return nil, errors.New("签署令牌已被使用")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"user_signed_at":    now,
		"user_token_used_at": now,
	}

	// 如果商家也已签署，则合同状态变为已签署
	if contract.ProviderSignedAt != nil {
		updates["status"] = model.ContractStatusSigned
	}

	if err := repository.DB.Model(&contract).Updates(updates).Error; err != nil {
		return nil, err
	}

	contract.UserSignedAt = &now
	contract.UserTokenUsedAt = &now
	if contract.ProviderSignedAt != nil {
		contract.Status = model.ContractStatusSigned
	}

	// 发送通知给商家
	NewNotificationDispatcher().NotifyContractUserSigned(contract.ProviderID, contract.ID, contract.ProjectID)

	return &contract, nil
}

// SignContractByProvider 商家签署合同
func (s *ContractService) SignContractByProvider(providerID, contractID uint64, input *SignContractInput) (*model.Contract, error) {
	if input == nil || input.SignToken == "" {
		return nil, errors.New("签署令牌不能为空")
	}

	var contract model.Contract
	if err := repository.DB.Clauses(clause.Locking{Strength: "UPDATE"}).First(&contract, contractID).Error; err != nil {
		return nil, errors.New("合同不存在")
	}

	if contract.ProviderID != providerID {
		return nil, errors.New("无权签署该合同")
	}

	if contract.Status != model.ContractStatusPendingSign && contract.Status != model.ContractStatusDraft {
		return nil, errors.New("当前合同状态不可签署")
	}

	if contract.ProviderSignedAt != nil {
		return nil, errors.New("您已签署该合同")
	}

	// 验证签署令牌（防重放攻击）
	if contract.ProviderSignToken == "" {
		return nil, errors.New("合同签署令牌未初始化")
	}
	if contract.ProviderSignToken != input.SignToken {
		return nil, errors.New("签署令牌无效")
	}
	if contract.ProviderTokenUsedAt != nil {
		return nil, errors.New("签署令牌已被使用")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"provider_signed_at":    now,
		"provider_token_used_at": now,
	}

	// 如果用户也已签署，则合同状态变为已签署
	if contract.UserSignedAt != nil {
		updates["status"] = model.ContractStatusSigned
	}

	if err := repository.DB.Model(&contract).Updates(updates).Error; err != nil {
		return nil, err
	}

	contract.ProviderSignedAt = &now
	contract.ProviderTokenUsedAt = &now
	if contract.UserSignedAt != nil {
		contract.Status = model.ContractStatusSigned
	}

	// 发送通知给用户
	NewNotificationDispatcher().NotifyContractProviderSigned(contract.UserID, contract.ID, contract.ProjectID)

	return &contract, nil
}

// GetContractStatus 获取合同状态
func (s *ContractService) GetContractStatus(userID, contractID uint64) (map[string]interface{}, error) {
	var contract model.Contract
	if err := repository.DB.First(&contract, contractID).Error; err != nil {
		return nil, errors.New("合同不存在")
	}

	if contract.UserID != userID && contract.ProviderID != userID {
		return nil, errors.New("无权查看该合同")
	}

	status := map[string]interface{}{
		"contractId":         contract.ID,
		"contractNo":         contract.ContractNo,
		"status":             contract.Status,
		"userSigned":         contract.UserSignedAt != nil,
		"providerSigned":     contract.ProviderSignedAt != nil,
		"depositPaid":        contract.DepositPaid,
		"userSignedAt":       contract.UserSignedAt,
		"providerSignedAt":   contract.ProviderSignedAt,
		"depositPaidAt":      contract.DepositPaidAt,
		"canSign":            contract.Status == model.ContractStatusPendingSign || contract.Status == model.ContractStatusDraft,
		"canPayDeposit":      contract.Status == model.ContractStatusSigned && !contract.DepositPaid,
		"contractFileUrl":    contract.ContractFileURL,
		"totalAmount":        contract.TotalAmount,
		"depositAmount":      contract.DepositAmount,
	}

	return status, nil
}

// DownloadContract 下载合同文件
func (s *ContractService) DownloadContract(userID, contractID uint64) (string, error) {
	var contract model.Contract
	if err := repository.DB.First(&contract, contractID).Error; err != nil {
		return "", errors.New("合同不存在")
	}

	if contract.UserID != userID && contract.ProviderID != userID {
		return "", errors.New("无权下载该合同")
	}

	if contract.Status != model.ContractStatusSigned && contract.Status != model.ContractStatusConfirmed && contract.Status != model.ContractStatusActive {
		return "", errors.New("合同尚未签署完成")
	}

	// 如果合同文件URL不存在，生成一个
	if contract.ContractFileURL == "" {
		fileURL := fmt.Sprintf("/contracts/%s.pdf", contract.ContractNo)
		contract.ContractFileURL = fileURL
		repository.DB.Model(&contract).Update("contract_file_url", fileURL)
	}

	return contract.ContractFileURL, nil
}

// generateSignToken 生成加密安全的签署令牌（防重放攻击）
func generateSignToken() (string, error) {
	bytes := make([]byte, 32) // 256位随机数
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("生成随机令牌失败: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}
