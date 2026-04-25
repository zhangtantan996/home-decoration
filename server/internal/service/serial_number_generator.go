package service

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

const (
	serialTimestampLayout  = "20060102150405"
	serialRedisKeyTTL      = 2 * time.Minute
	businessOrderLength    = 22
	businessOrderSeqWidth  = 6
	paymentRuntimeLength   = 24
	paymentRuntimeSeqWidth = 8
)

const (
	businessOrderTypeCodeDesign             = "21"
	businessOrderTypeCodeConstruction       = "31"
	businessOrderTypeCodeConstructionChange = "32"
	businessOrderTypeCodeMaterial           = "41"
	businessOrderTypeCodeAfterSales         = "51"
)

const (
	paymentRuntimeTypeCodeCollect        = "91"
	paymentRuntimeTypeCodeRefund         = "92"
	paymentRuntimeTypeCodePayout         = "93"
	paymentRuntimeTypeCodeMerchantBond   = "94"
	paymentRuntimeTypeCodeBondAdjustment = "95"
)

const (
	serialNamespaceBusinessOrder = "business_order"
	serialNamespacePaymentNo     = "payment_runtime"
	businessOrderTypeAfterSales  = "after_sales"
)

type localSequenceState struct {
	bucket string
	value  uint64
}

type serialNumberGenerator struct {
	mu    sync.Mutex
	local map[string]localSequenceState
}

var serialNumberSvc = newSerialNumberGenerator()

func newSerialNumberGenerator() *serialNumberGenerator {
	return &serialNumberGenerator{local: make(map[string]localSequenceState)}
}

func generateBusinessOrderNo(orderType string) (string, error) {
	return serialNumberSvc.nextBusinessOrderNo(orderType, time.Now())
}

func generateDesignOrderNo() (string, error) {
	return generateBusinessOrderNo(model.OrderTypeDesign)
}

func generateAfterSalesOrderNo() (string, error) {
	return generateBusinessOrderNo(businessOrderTypeAfterSales)
}

func generateOutTradeNo(fundScene string) (string, error) {
	return serialNumberSvc.nextPaymentRuntimeNo(resolvePaymentTradeTypeCode(fundScene), time.Now())
}

func generateOutRefundNo(fundScene string) (string, error) {
	return serialNumberSvc.nextPaymentRuntimeNo(resolveRefundTypeCode(fundScene), time.Now())
}

func generateOutPayoutNo(fundScene string) (string, error) {
	return serialNumberSvc.nextPaymentRuntimeNo(resolvePayoutTypeCode(fundScene), time.Now())
}

func (g *serialNumberGenerator) nextBusinessOrderNo(orderType string, now time.Time) (string, error) {
	code, err := resolveBusinessOrderTypeCode(orderType)
	if err != nil {
		return "", err
	}
	return g.nextSerialNumber(serialNamespaceBusinessOrder, code, businessOrderSeqWidth, businessOrderLength, now)
}

func (g *serialNumberGenerator) nextPaymentRuntimeNo(typeCode string, now time.Time) (string, error) {
	if len(strings.TrimSpace(typeCode)) != 2 {
		return "", fmt.Errorf("invalid payment runtime type code: %s", typeCode)
	}
	return g.nextSerialNumber(serialNamespacePaymentNo, typeCode, paymentRuntimeSeqWidth, paymentRuntimeLength, now)
}

func (g *serialNumberGenerator) nextSerialNumber(namespace, typeCode string, seqWidth, totalLength int, now time.Time) (string, error) {
	bucket := now.Format(serialTimestampLayout)
	seq, err := g.nextSequence(namespace, bucket)
	if err != nil {
		return "", err
	}
	return formatSerialNumber(typeCode, bucket, seq, seqWidth, totalLength)
}

func (g *serialNumberGenerator) nextSequence(namespace, bucket string) (uint64, error) {
	if client := repository.GetRedis(); client != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()

		key := fmt.Sprintf("serial:%s:%s", namespace, bucket)
		value, err := client.Incr(ctx, key).Result()
		if err == nil {
			_ = client.Expire(ctx, key, serialRedisKeyTTL).Err()
			return uint64(value), nil
		}
		log.Printf("[serial_number] redis incr failed namespace=%s bucket=%s err=%v", namespace, bucket, err)
	}

	return g.nextLocalSequence(namespace, bucket), nil
}

func (g *serialNumberGenerator) nextLocalSequence(namespace, bucket string) uint64 {
	g.mu.Lock()
	defer g.mu.Unlock()

	state := g.local[namespace]
	if state.bucket != bucket {
		// 使用加密安全的随机数作为初始值（防止序列号可预测）
		randomStart := secureRandomUint64() % 1000
		state = localSequenceState{bucket: bucket, value: randomStart + 1}
	} else {
		state.value++
	}
	g.local[namespace] = state
	return state.value
}

func (g *serialNumberGenerator) resetForTest() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.local = make(map[string]localSequenceState)
}

func resolveBusinessOrderTypeCode(orderType string) (string, error) {
	switch strings.TrimSpace(orderType) {
	case model.OrderTypeDesign:
		return businessOrderTypeCodeDesign, nil
	case model.OrderTypeConstruction:
		return businessOrderTypeCodeConstruction, nil
	case model.OrderTypeMaterial:
		return businessOrderTypeCodeMaterial, nil
	case businessOrderTypeAfterSales:
		return businessOrderTypeCodeAfterSales, nil
	case "construction_change", "change_order":
		return businessOrderTypeCodeConstructionChange, nil
	default:
		return "", fmt.Errorf("unsupported business order type: %s", orderType)
	}
}

func resolvePaymentTradeTypeCode(fundScene string) string {
	if strings.TrimSpace(fundScene) == model.FundSceneMerchantDeposit {
		return paymentRuntimeTypeCodeMerchantBond
	}
	return paymentRuntimeTypeCodeCollect
}

func resolveRefundTypeCode(fundScene string) string {
	if strings.TrimSpace(fundScene) == model.FundSceneMerchantDeposit {
		return paymentRuntimeTypeCodeBondAdjustment
	}
	return paymentRuntimeTypeCodeRefund
}

func resolvePayoutTypeCode(_ string) string {
	return paymentRuntimeTypeCodePayout
}

func formatSerialNumber(typeCode, bucket string, seq uint64, seqWidth, totalLength int) (string, error) {
	if len(strings.TrimSpace(typeCode)) != 2 {
		return "", fmt.Errorf("invalid type code: %s", typeCode)
	}
	if len(bucket) != len(serialTimestampLayout) {
		return "", fmt.Errorf("invalid serial bucket: %s", bucket)
	}
	if seq == 0 {
		return "", fmt.Errorf("invalid serial sequence: %d", seq)
	}
	maxValue := maxSequenceValue(seqWidth)
	if seq > maxValue {
		return "", fmt.Errorf("serial sequence overflow: namespace width=%d seq=%d", seqWidth, seq)
	}

	serial := fmt.Sprintf("%s%s%0*d", typeCode, bucket, seqWidth, seq)
	if len(serial) != totalLength {
		return "", fmt.Errorf("invalid serial length: got=%d want=%d value=%s", len(serial), totalLength, serial)
	}
	return serial, nil
}

func maxSequenceValue(width int) uint64 {
	value := uint64(1)
	for i := 0; i < width; i++ {
		value *= 10
	}
	return value - 1
}

// secureRandomUint64 生成加密安全的随机uint64（防止订单号可预测）
func secureRandomUint64() uint64 {
	var bytes [8]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		// 降级到时间戳（不应该发生）
		log.Printf("[serial_number] crypto/rand failed, fallback to timestamp: %v", err)
		return uint64(time.Now().UnixNano())
	}
	return binary.BigEndian.Uint64(bytes[:])
}
