package service

import (
	"testing"

	"home-decoration-server/internal/model"
)

func TestAdminBusinessFlowServiceResolveAvailableAdminActionsForQuoteAndChangeOrders(t *testing.T) {
	svc := NewAdminBusinessFlowService()
	ctx := &adminBusinessFlowContext{
		project: &model.Project{
			Base:           model.Base{ID: 901},
			BusinessStatus: model.ProjectBusinessStatusInProgress,
		},
		quoteTask: &model.QuoteList{
			Base: model.Base{ID: 902},
		},
		quoteSubmission: &model.QuoteSubmission{
			Base:         model.Base{ID: 903},
			ReviewStatus: model.QuoteSubmissionReviewStatusPending,
		},
		changeOrders: []ChangeOrderView{
			{ID: 904, Status: model.ChangeOrderStatusAdminSettlementRequired, Title: "减项结算"},
			{ID: 905, Status: model.ChangeOrderStatusPendingUserConfirm, Title: "待用户确认"},
		},
	}

	actions := svc.resolveAvailableAdminActions(ctx)
	actionMap := make(map[string]AdminBusinessFlowAction, len(actions))
	for _, action := range actions {
		actionMap[action.Key] = action
	}

	reviewAction, ok := actionMap["review_construction_quote"]
	if !ok {
		t.Fatalf("expected review_construction_quote action")
	}
	if reviewAction.Route != "/projects/quotes/compare/902" {
		t.Fatalf("unexpected quote review route: %s", reviewAction.Route)
	}
	if reviewAction.TargetRoute != "/projects/quotes/compare/902" || reviewAction.TargetModule != "quote_erp" || reviewAction.Focus != "quote_review" {
		t.Fatalf("expected quote review navigation metadata, got %+v", reviewAction)
	}

	settleAction, ok := actionMap["settle_change_order"]
	if !ok {
		t.Fatalf("expected settle_change_order action")
	}
	if settleAction.APIPath != "/admin/change-orders/904/settle" {
		t.Fatalf("unexpected settle API path: %s", settleAction.APIPath)
	}

	viewChangeAction, ok := actionMap["view_change_orders"]
	if !ok {
		t.Fatalf("expected view_change_orders action")
	}
	if viewChangeAction.Route != "/orders?projectId=901&focus=change-order" {
		t.Fatalf("unexpected change order route: %s", viewChangeAction.Route)
	}
	if viewChangeAction.TargetRoute != "/orders?projectId=901&focus=change-order" || viewChangeAction.TargetModule != "orders" || viewChangeAction.Focus != "change-order" {
		t.Fatalf("expected change-order navigation metadata, got %+v", viewChangeAction)
	}
}

func TestAdminBusinessFlowContextToDetailKeepsChangeOrdersAndActions(t *testing.T) {
	ctx := &adminBusinessFlowContext{
		flowID:     "project:1001",
		sourceType: "project",
		sourceID:   1001,
		summary: BusinessFlowSummary{
			CurrentStage: "construction_quote_pending",
			FlowSummary:  "待处理施工报价与变更",
		},
		project: &model.Project{
			Base: model.Base{ID: 1001},
			Name: "治理工作台测试项目",
		},
		orders: []model.Order{
			{
				Base:      model.Base{ID: 1002},
				OrderNo:   "ORD-ADMIN-1002",
				OrderType: model.OrderTypeConstruction,
				Status:    model.OrderStatusPending,
				ProjectID: 1001,
			},
		},
		paymentPlans: []model.PaymentPlan{
			{
				Base:    model.Base{ID: 1003},
				OrderID: 1002,
				Name:    "首付款",
				Type:    "first_payment",
				Status:  model.PaymentPlanStatusPending,
			},
		},
		paymentOrders: []model.PaymentOrder{
			{
				Base:       model.Base{ID: 1007},
				BizType:    "order",
				BizID:      1002,
				OutTradeNo: "PAY-ADMIN-1007",
				Status:     "paid",
			},
		},
		changeOrders: []ChangeOrderView{
			{ID: 1004, ProjectID: 1001, Title: "减项调整", Status: model.ChangeOrderStatusAdminSettlementRequired},
		},
		changeOrderSummary: &ChangeOrderSummary{
			TotalCount:             1,
			PendingSettlementCount: 1,
			LatestChangeOrderID:    1004,
		},
		settlementSummary: &SettlementSummary{
			LatestSettlementID: 1005,
			Status:             model.SettlementStatusScheduled,
			NetAmount:          8800,
		},
		payoutSummary: &PayoutSummary{
			LatestPayoutID: 1006,
			Status:         model.PayoutStatusProcessing,
		},
		financialClosureStatus: "settlement_scheduled",
		nextPendingAction:      "wait_payout",
		availableAdminActions: []AdminBusinessFlowAction{
			{Key: "settle_change_order", Label: "处理减项结算", Kind: "mutation"},
		},
	}

	detail := ctx.toDetail()
	if detail == nil {
		t.Fatalf("expected detail to be built")
	}
	if len(detail.ChangeOrders) != 1 || detail.ChangeOrders[0].ID != 1004 {
		t.Fatalf("expected change orders to be preserved, got %+v", detail.ChangeOrders)
	}
	if len(detail.AvailableAdminActions) != 1 || detail.AvailableAdminActions[0].Key != "settle_change_order" {
		t.Fatalf("expected available actions to be preserved, got %+v", detail.AvailableAdminActions)
	}
	if len(detail.Orders) != 1 {
		t.Fatalf("expected one order snapshot, got %+v", detail.Orders)
	}
	if len(detail.Orders[0].PaymentPlan) != 1 || detail.Orders[0].PaymentPlan[0].ID != 1003 {
		t.Fatalf("expected payment plan snapshot to stay attached, got %+v", detail.Orders[0].PaymentPlan)
	}
	if len(detail.PaymentOrders) != 1 || detail.PaymentOrders[0].OutTradeNo != "PAY-ADMIN-1007" {
		t.Fatalf("expected payment orders to be exposed, got %+v", detail.PaymentOrders)
	}
	if detail.ChangeOrderSummary == nil || detail.ChangeOrderSummary.PendingSettlementCount != 1 {
		t.Fatalf("expected change-order summary to be exposed, got %+v", detail.ChangeOrderSummary)
	}
	if detail.SettlementSummary == nil || detail.SettlementSummary.Status != model.SettlementStatusScheduled {
		t.Fatalf("expected settlement summary to be exposed, got %+v", detail.SettlementSummary)
	}
	if detail.PayoutSummary == nil || detail.PayoutSummary.Status != model.PayoutStatusProcessing {
		t.Fatalf("expected payout summary to be exposed, got %+v", detail.PayoutSummary)
	}
	if detail.FinancialClosureStatus != "settlement_scheduled" || detail.NextPendingAction != "wait_payout" {
		t.Fatalf("expected financial closure conclusion, got status=%s action=%s", detail.FinancialClosureStatus, detail.NextPendingAction)
	}
}

func TestAdminBusinessFlowFilterMatchesSettlementAndPayoutStatus(t *testing.T) {
	ctx := &adminBusinessFlowContext{
		settlementStatus: model.SettlementStatusScheduled,
		payoutStatus:     model.PayoutStatusProcessing,
	}
	item := ctx.toListItem()

	if !matchesBusinessFlowFilter(ctx, item, AdminBusinessFlowFilter{
		SettlementStatus: model.SettlementStatusScheduled,
		PayoutStatus:     model.PayoutStatusProcessing,
	}) {
		t.Fatalf("expected matching settlement/payout filters")
	}
	if matchesBusinessFlowFilter(ctx, item, AdminBusinessFlowFilter{SettlementStatus: model.SettlementStatusPaid}) {
		t.Fatalf("expected mismatched settlement status to be filtered out")
	}
	if matchesBusinessFlowFilter(ctx, item, AdminBusinessFlowFilter{PayoutStatus: model.PayoutStatusFailed}) {
		t.Fatalf("expected mismatched payout status to be filtered out")
	}
}

func TestAdminBusinessFlowRiskSnapshotUsesFilterableStatuses(t *testing.T) {
	warningSnapshot := summarizeRiskSnapshot(&adminBusinessFlowContext{
		riskWarnings: []model.RiskWarning{{Status: 0, Type: "payment"}},
	})
	if warningSnapshot.Status != "warning_open" {
		t.Fatalf("expected warning_open risk status, got %+v", warningSnapshot)
	}

	auditSnapshot := summarizeRiskSnapshot(&adminBusinessFlowContext{
		projectAudits: []ProjectAuditView{{Status: model.ProjectAuditStatusPending}},
	})
	if auditSnapshot.Status != "audit_open" {
		t.Fatalf("expected audit_open risk status, got %+v", auditSnapshot)
	}

	disputeSnapshot := summarizeRiskSnapshot(&adminBusinessFlowContext{
		arbitrations: []model.Arbitration{{Status: 0}},
		projectAudits: []ProjectAuditView{
			{Status: model.ProjectAuditStatusPending},
		},
	})
	if disputeSnapshot.Status != "disputed" {
		t.Fatalf("expected arbitration to take disputed priority, got %+v", disputeSnapshot)
	}
}
