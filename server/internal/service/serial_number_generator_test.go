package service

import (
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestGenerateDesignOrderNoFormat(t *testing.T) {
	oldRedis := repository.RedisClient
	repository.RedisClient = nil
	defer func() { repository.RedisClient = oldRedis }()
	serialNumberSvc.resetForTest()

	orderNo, err := generateDesignOrderNo()
	if err != nil {
		t.Fatalf("expected order number, got %v", err)
	}
	if matched := regexp.MustCompile(`^21\d{20}$`).MatchString(orderNo); !matched {
		t.Fatalf("unexpected order number format: %s", orderNo)
	}
}

func TestBusinessOrderNoUsesExpectedTypeCodes(t *testing.T) {
	generator := newSerialNumberGenerator()
	now := time.Date(2026, 4, 12, 14, 58, 55, 0, time.Local)

	cases := []struct {
		name      string
		orderType string
		prefix    string
	}{
		{name: "design", orderType: model.OrderTypeDesign, prefix: businessOrderTypeCodeDesign},
		{name: "construction", orderType: model.OrderTypeConstruction, prefix: businessOrderTypeCodeConstruction},
		{name: "material", orderType: model.OrderTypeMaterial, prefix: businessOrderTypeCodeMaterial},
		{name: "after_sales", orderType: businessOrderTypeAfterSales, prefix: businessOrderTypeCodeAfterSales},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			value, err := generator.nextBusinessOrderNo(tc.orderType, now)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(value) != businessOrderLength {
				t.Fatalf("unexpected business order length: got=%d value=%s", len(value), value)
			}
			if !regexp.MustCompile(`^\d+$`).MatchString(value) {
				t.Fatalf("expected numeric business order no, got %s", value)
			}
			if !strings.HasPrefix(value, tc.prefix) {
				t.Fatalf("expected prefix %s, got %s", tc.prefix, value)
			}
		})
	}
}

func TestPaymentRuntimeNumbersUseExpectedTypeCodes(t *testing.T) {
	generator := newSerialNumberGenerator()
	now := time.Date(2026, 4, 12, 14, 58, 55, 0, time.Local)

	cases := []struct {
		name   string
		code   string
		prefix string
	}{
		{name: "collect", code: paymentRuntimeTypeCodeCollect, prefix: paymentRuntimeTypeCodeCollect},
		{name: "merchant_bond", code: paymentRuntimeTypeCodeMerchantBond, prefix: paymentRuntimeTypeCodeMerchantBond},
		{name: "refund", code: paymentRuntimeTypeCodeRefund, prefix: paymentRuntimeTypeCodeRefund},
		{name: "bond_adjustment", code: paymentRuntimeTypeCodeBondAdjustment, prefix: paymentRuntimeTypeCodeBondAdjustment},
		{name: "payout", code: paymentRuntimeTypeCodePayout, prefix: paymentRuntimeTypeCodePayout},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			value, err := generator.nextPaymentRuntimeNo(tc.code, now)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(value) != paymentRuntimeLength {
				t.Fatalf("unexpected payment runtime length: got=%d value=%s", len(value), value)
			}
			if !regexp.MustCompile(`^\d+$`).MatchString(value) {
				t.Fatalf("expected numeric payment runtime no, got %s", value)
			}
			if !strings.HasPrefix(value, tc.prefix) {
				t.Fatalf("expected prefix %s, got %s", tc.prefix, value)
			}
		})
	}
}

func TestSerialNumbersWithinSameSecondRemainUniqueAndSortable(t *testing.T) {
	generator := newSerialNumberGenerator()
	now := time.Date(2026, 4, 12, 14, 58, 55, 0, time.Local)

	first, err := generator.nextBusinessOrderNo(model.OrderTypeDesign, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	second, err := generator.nextBusinessOrderNo(model.OrderTypeDesign, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	third, err := generator.nextBusinessOrderNo(model.OrderTypeDesign, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if first == second || second == third || first == third {
		t.Fatalf("expected unique serial numbers, got %s %s %s", first, second, third)
	}

	got := []string{third, first, second}
	sort.Strings(got)
	want := []string{first, second, third}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected lexical order to match generation order, got=%v want=%v", got, want)
		}
	}
}

func TestFormatSerialNumberRejectsOverflow(t *testing.T) {
	if _, err := formatSerialNumber(paymentRuntimeTypeCodeCollect, "20260412145855", maxSequenceValue(paymentRuntimeSeqWidth)+1, paymentRuntimeSeqWidth, paymentRuntimeLength); err == nil {
		t.Fatalf("expected overflow error")
	}
}

func TestOutTradeAndRefundTypeCodesFollowFundScene(t *testing.T) {
	oldRedis := repository.RedisClient
	repository.RedisClient = nil
	defer func() { repository.RedisClient = oldRedis }()
	serialNumberSvc.resetForTest()

	tradeNo, err := generateOutTradeNo(model.FundSceneMerchantDeposit)
	if err != nil {
		t.Fatalf("unexpected trade no error: %v", err)
	}
	if !strings.HasPrefix(tradeNo, paymentRuntimeTypeCodeMerchantBond) {
		t.Fatalf("expected merchant bond trade prefix, got %s", tradeNo)
	}

	refundNo, err := generateOutRefundNo(model.FundSceneMerchantDeposit)
	if err != nil {
		t.Fatalf("unexpected refund no error: %v", err)
	}
	if !strings.HasPrefix(refundNo, paymentRuntimeTypeCodeBondAdjustment) {
		t.Fatalf("expected bond adjustment refund prefix, got %s", refundNo)
	}

	payoutNo, err := generateOutPayoutNo(model.FundSceneSettlementPayout)
	if err != nil {
		t.Fatalf("unexpected payout no error: %v", err)
	}
	if !strings.HasPrefix(payoutNo, paymentRuntimeTypeCodePayout) {
		t.Fatalf("expected payout prefix, got %s", payoutNo)
	}
}
