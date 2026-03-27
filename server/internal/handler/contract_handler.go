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
