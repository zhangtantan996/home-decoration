package service

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"
)

// BankTransferInput 银行转账输入参数
type BankTransferInput struct {
	OutTradeNo   string  // 商户订单号
	Amount       float64 // 转账金额（元）
	PayeeName    string  // 收款人姓名
	PayeeAccount string  // 收款账号
	PayeeBank    string  // 收款银行
	PayeeBranch  string  // 收款支行（可选）
	Remark       string  // 转账备注
}

// BankTransferResult 银行转账结果
type BankTransferResult struct {
	OutTradeNo  string    // 商户订单号
	BankTradeNo string    // 银行订单号
	Status      string    // 状态（processing/succeeded/failed）
	SubmittedAt time.Time // 提交时间
	RawJSON     string    // 原始响应JSON
}

// BankTransferQueryResult 银行转账查询结果
type BankTransferQueryResult struct {
	OutTradeNo    string     // 商户订单号
	BankTradeNo   string     // 银行订单号
	Status        string     // 状态
	Amount        float64    // 转账金额
	SucceededAt   *time.Time // 成功时间
	FailureReason string     // 失败原因
	RawJSON       string     // 原始响应JSON
}

// BankTransferGateway 银行转账网关接口
type BankTransferGateway interface {
	Transfer(ctx context.Context, input *BankTransferInput) (*BankTransferResult, error)
	QueryTransfer(ctx context.Context, outTradeNo string) (*BankTransferQueryResult, error)
}

// MockBankTransferGateway 模拟银行转账网关
type MockBankTransferGateway struct{}

// NewMockBankTransferGateway 创建模拟银行转账网关实例
func NewMockBankTransferGateway() *MockBankTransferGateway {
	return &MockBankTransferGateway{}
}

// Transfer 执行银行转账（模拟实现）
func (g *MockBankTransferGateway) Transfer(ctx context.Context, input *BankTransferInput) (*BankTransferResult, error) {
	if input == nil {
		return nil, errors.New("转账参数不能为空")
	}

	// 参数验证
	if strings.TrimSpace(input.OutTradeNo) == "" {
		return nil, errors.New("商户订单号不能为空")
	}
	if input.Amount <= 0 {
		return nil, errors.New("转账金额必须大于0")
	}
	if strings.TrimSpace(input.PayeeName) == "" {
		return nil, errors.New("收款人姓名不能为空")
	}
	if strings.TrimSpace(input.PayeeAccount) == "" {
		return nil, errors.New("收款账号不能为空")
	}
	if strings.TrimSpace(input.PayeeBank) == "" {
		return nil, errors.New("收款银行不能为空")
	}

	log.Printf("[BankTransfer] 银行转账功能暂未实现，需要对接企业网银API")
	log.Printf("[BankTransfer] 转账参数: 订单号=%s, 金额=%.2f元, 收款人=%s, 收款账号=%s, 收款银行=%s",
		input.OutTradeNo, input.Amount, input.PayeeName, maskAccount(input.PayeeAccount), input.PayeeBank)

	return nil, errors.New("银行转账功能暂未实现，需要对接企业网银API")
}

// QueryTransfer 查询银行转账状态（模拟实现）
func (g *MockBankTransferGateway) QueryTransfer(ctx context.Context, outTradeNo string) (*BankTransferQueryResult, error) {
	if strings.TrimSpace(outTradeNo) == "" {
		return nil, errors.New("商户订单号不能为空")
	}

	log.Printf("[BankTransfer] 银行转账查询功能暂未实现，订单号=%s", outTradeNo)

	return nil, errors.New("银行转账查询功能暂未实现")
}

// maskAccount 脱敏账号（仅显示前4位和后4位）
func maskAccount(account string) string {
	trimmed := strings.TrimSpace(account)
	if len(trimmed) <= 8 {
		return "****"
	}
	return trimmed[:4] + "****" + trimmed[len(trimmed)-4:]
}
