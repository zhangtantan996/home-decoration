package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

var contractService = &service.ContractService{}

func CreateContract(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	var input service.CreateContractInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	contract, err := contractService.CreateContract(providerID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "创建合同失败")
		return
	}
	response.Success(c, contract)
}

func ConfirmContract(c *gin.Context) {
	userID := c.GetUint64("userId")
	contractID := parseUint64(c.Param("id"))
	contract, err := contractService.ConfirmContract(userID, contractID)
	if err != nil {
		respondDomainMutationError(c, err, "确认合同失败")
		return
	}
	response.Success(c, contract)
}

func GetProjectContract(c *gin.Context) {
	userID := c.GetUint64("userId")
	projectID := parseUint64(c.Param("id"))
	contract, err := contractService.GetProjectContract(userID, projectID)
	if err != nil {
		respondScopedAccessError(c, err, "获取项目合同失败")
		return
	}
	response.Success(c, contract)
}

func GetContract(c *gin.Context) {
	userID := c.GetUint64("userId")
	contractID := parseUint64(c.Param("id"))
	contract, err := contractService.GetContract(userID, contractID)
	if err != nil {
		respondScopedAccessError(c, err, "获取合同失败")
		return
	}
	response.Success(c, contract)
}

// SignContractByUser 用户签署合同
func SignContractByUser(c *gin.Context) {
	userID := c.GetUint64("userId")
	contractID := parseUint64(c.Param("id"))

	var input service.SignContractInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	contract, err := contractService.SignContractByUser(userID, contractID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "签署合同失败")
		return
	}

	response.Success(c, contract)
}

// SignContractByProvider 商家签署合同
func SignContractByProvider(c *gin.Context) {
	providerID := c.GetUint64("providerId")
	contractID := parseUint64(c.Param("id"))

	var input service.SignContractInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	contract, err := contractService.SignContractByProvider(providerID, contractID, &input)
	if err != nil {
		respondDomainMutationError(c, err, "签署合同失败")
		return
	}

	response.Success(c, contract)
}

// GetContractStatus 获取合同状态
func GetContractStatus(c *gin.Context) {
	userID := c.GetUint64("userId")
	contractID := parseUint64(c.Param("id"))

	status, err := contractService.GetContractStatus(userID, contractID)
	if err != nil {
		respondScopedAccessError(c, err, "获取合同状态失败")
		return
	}

	response.Success(c, status)
}

// DownloadContract 下载合同文件
func DownloadContract(c *gin.Context) {
	userID := c.GetUint64("userId")
	contractID := parseUint64(c.Param("id"))

	fileURL, err := contractService.DownloadContract(userID, contractID)
	if err != nil {
		respondScopedAccessError(c, err, "下载合同失败")
		return
	}

	response.Success(c, gin.H{
		"fileUrl": fileURL,
	})
}

// StartContractDepositPayment 发起合同定金支付
func StartContractDepositPayment(c *gin.Context) {
	userID := c.GetUint64("userId")
	contractID := parseUint64(c.Param("id"))

	type PaymentInput struct {
		Channel      string `json:"channel"`
		TerminalType string `json:"terminalType"`
	}

	var input PaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	launchResp, err := paymentService.StartContractDepositPayment(userID, contractID, input.Channel, input.TerminalType)
	if err != nil {
		respondDomainMutationError(c, err, "发起支付失败")
		return
	}

	response.Success(c, launchResp)
}

