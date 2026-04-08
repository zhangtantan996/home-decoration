package service

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectRiskServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(withPaymentCentralTestModels(
		&model.User{},
		&model.Provider{},
		&model.SysAdmin{},
		&model.Notification{},
		&model.AuditLog{},
		&model.Booking{},
		&model.Proposal{},
		&model.Order{},
		&model.Project{},
		&model.Milestone{},
		&model.WorkLog{},
		&model.ProjectPhase{},
		&model.BusinessFlow{},
		&model.EscrowAccount{},
		&model.Transaction{},
		&model.Complaint{},
		&model.ProjectAudit{},
		&model.RefundApplication{},
		&model.MerchantIncome{},
		&model.SystemConfig{},
		&model.PaymentPlan{},
		&model.FinanceReconciliationItem{},
	)...); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	bindRepositorySQLiteTestDB(t, db)

	return db
}

type projectRiskMockGateway struct{}

func (projectRiskMockGateway) Channel() string {
	return model.PaymentChannelAlipay
}

func (projectRiskMockGateway) CreateCollectOrder(ctx context.Context, order *model.PaymentOrder) (string, error) {
	return "<html></html>", nil
}

func (projectRiskMockGateway) CreateCollectQRCode(ctx context.Context, order *model.PaymentOrder) ([]byte, error) {
	return nil, nil
}

func (projectRiskMockGateway) CreateMiniProgramPayment(context.Context, *model.PaymentOrder, string) (*PaymentChannelMiniProgramResult, error) {
	return nil, nil
}

func (projectRiskMockGateway) VerifyNotify(values url.Values) (map[string]string, error) {
	return map[string]string{}, nil
}

func (projectRiskMockGateway) ParseNotifyRequest(context.Context, *http.Request) (*PaymentChannelNotifyResult, error) {
	return nil, nil
}

func (projectRiskMockGateway) QueryCollectOrder(ctx context.Context, order *model.PaymentOrder) (*PaymentChannelTradeResult, error) {
	return &PaymentChannelTradeResult{}, nil
}

func (projectRiskMockGateway) RefundCollectOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	return &PaymentChannelRefundResult{
		ProviderTradeNo: "TRADE-MOCK",
		OutTradeNo:      order.OutTradeNo,
		OutRefundNo:     refund.OutRefundNo,
		Success:         true,
		RawJSON:         `{"code":"10000"}`,
	}, nil
}

func (projectRiskMockGateway) QueryRefundOrder(ctx context.Context, order *model.PaymentOrder, refund *model.RefundOrder) (*PaymentChannelRefundResult, error) {
	return &PaymentChannelRefundResult{
		ProviderTradeNo: "TRADE-MOCK",
		OutTradeNo:      order.OutTradeNo,
		OutRefundNo:     refund.OutRefundNo,
		Success:         true,
		RawJSON:         `{"code":"10000"}`,
	}, nil
}

func seedProjectRiskFixture(t *testing.T, db *gorm.DB) (model.User, model.Provider, model.Project, model.Milestone, model.Booking) {
	t.Helper()
	user := model.User{Base: model.Base{ID: 1}, Phone: "13800138000", Nickname: "业主A", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 2}, Phone: "13800138001", Nickname: "施工方A", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 11}, UserID: providerUser.ID, ProviderType: 2, CompanyName: "施工公司A", Status: 1}
	booking := model.Booking{Base: model.Base{ID: 21}, UserID: user.ID, ProviderID: provider.ID, Address: "测试地址", IntentFee: 1000, IntentFeePaid: true}
	project := model.Project{
		Base:           model.Base{ID: 31},
		OwnerID:        user.ID,
		ProviderID:     provider.ID,
		Name:           "P1 风险项目",
		Address:        "测试地址",
		Status:         model.ProjectStatusActive,
		CurrentPhase:   "水电阶段施工中",
		BusinessStatus: model.ProjectBusinessStatusInProgress,
	}
	milestone := model.Milestone{Base: model.Base{ID: 41}, ProjectID: project.ID, Name: "水电验收", Seq: 1, Amount: 5000, Status: model.MilestoneStatusInProgress}
	flow := model.BusinessFlow{Base: model.Base{ID: 51}, ProjectID: project.ID, CurrentStage: model.BusinessFlowStageInProgress}
	escrow := model.EscrowAccount{Base: model.Base{ID: 61}, ProjectID: project.ID, UserID: user.ID, TotalAmount: 30000, AvailableAmount: 30000, FrozenAmount: 0, Status: escrowStatusActive}
	order := model.Order{Base: model.Base{ID: 71}, ProjectID: project.ID, BookingID: booking.ID, OrderNo: "ORD-P1-001", OrderType: model.OrderTypeDesign, TotalAmount: 5000, PaidAmount: 5000, Status: model.OrderStatusPaid}
	paidAt := time.Now()
	bookingPayment := model.PaymentOrder{
		Base:            model.Base{ID: 81},
		BizType:         model.PaymentBizTypeBookingIntent,
		BizID:           booking.ID,
		PayerUserID:     user.ID,
		Channel:         model.PaymentChannelAlipay,
		Scene:           model.PaymentBizTypeBookingIntent,
		TerminalType:    model.PaymentTerminalPCWeb,
		Subject:         "预约量房费",
		Amount:          booking.IntentFee,
		OutTradeNo:      "OUT-BOOKING-21",
		Status:          model.PaymentStatusPaid,
		ProviderTradeNo: "TRADE-BOOKING-21",
		PaidAt:          &paidAt,
	}
	orderPayment := model.PaymentOrder{
		Base:            model.Base{ID: 82},
		BizType:         model.PaymentBizTypeOrder,
		BizID:           order.ID,
		PayerUserID:     user.ID,
		Channel:         model.PaymentChannelAlipay,
		Scene:           model.PaymentBizTypeOrder,
		TerminalType:    model.PaymentTerminalPCWeb,
		Subject:         "设计费订单支付",
		Amount:          order.PaidAmount,
		OutTradeNo:      "OUT-ORDER-71",
		Status:          model.PaymentStatusPaid,
		ProviderTradeNo: "TRADE-ORDER-71",
		PaidAt:          &paidAt,
	}
	constructionFeeRate := model.SystemConfig{Base: model.Base{ID: 91}, Key: model.ConfigKeyConstructionFeeRate, Value: "0.1", Type: "number"}

	for _, value := range []interface{}{&user, &providerUser, &provider, &booking, &project, &milestone, &flow, &escrow, &order, &bookingPayment, &orderPayment, &constructionFeeRate} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture failed: %v", err)
		}
	}

	return user, provider, project, milestone, booking
}

func seedProjectRiskConstructionRefundUnit(t *testing.T, db *gorm.DB, user model.User, project model.Project, booking model.Booking) model.Order {
	t.Helper()
	paidAt := time.Now()
	order := model.Order{
		Base:        model.Base{ID: 72},
		ProjectID:   project.ID,
		BookingID:   booking.ID,
		OrderNo:     "ORD-P1-CONSTRUCTION-001",
		OrderType:   model.OrderTypeConstruction,
		TotalAmount: 30000,
		PaidAmount:  30000,
		Status:      model.OrderStatusPaid,
	}
	payment := model.PaymentOrder{
		Base:            model.Base{ID: 83},
		BizType:         model.PaymentBizTypeOrder,
		BizID:           order.ID,
		PayerUserID:     user.ID,
		Channel:         model.PaymentChannelAlipay,
		Scene:           model.PaymentBizTypeOrder,
		TerminalType:    model.PaymentTerminalPCWeb,
		Subject:         "施工费订单支付",
		Amount:          order.PaidAmount,
		OutTradeNo:      "OUT-ORDER-72",
		Status:          model.PaymentStatusPaid,
		ProviderTradeNo: "TRADE-ORDER-72",
		PaidAt:          &paidAt,
	}
	for _, value := range []interface{}{&order, &payment} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed project construction refund unit failed: %v", err)
		}
	}
	return order
}

func TestProjectDisputeServicePauseResumeAndBlockMilestone(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, provider, project, milestone, _ := seedProjectRiskFixture(t, db)

	disputeSvc := &ProjectDisputeService{}
	projectSvc := &ProjectService{}

	paused, err := disputeSvc.PauseProject(project.ID, user.ID, &ProjectPauseInput{Reason: "现场临时停工"})
	if err != nil {
		t.Fatalf("PauseProject: %v", err)
	}
	if paused.Status != model.ProjectStatusPaused || paused.PausedAt == nil {
		t.Fatalf("expected paused project, got %+v", paused)
	}
	detail, err := (&ProjectService{}).GetProjectDetail(project.ID)
	if err != nil {
		t.Fatalf("GetProjectDetail after pause: %v", err)
	}
	if detail.FlowSummary != "项目已暂停，待业主恢复施工后再继续推进" {
		t.Fatalf("expected paused flow summary, got %+v", detail)
	}
	if len(detail.AvailableActions) != 0 {
		t.Fatalf("expected no available actions while paused, got %+v", detail.AvailableActions)
	}

	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("load escrow: %v", err)
	}
	if escrow.Status != escrowStatusFrozen {
		t.Fatalf("expected frozen escrow after pause, got %d", escrow.Status)
	}

	if _, err := projectSvc.SubmitMilestone(project.ID, provider.ID, milestone.ID); err == nil || !strings.Contains(err.Error(), "暂停") {
		t.Fatalf("expected paused milestone submit error, got %v", err)
	}

	resumed, err := disputeSvc.ResumeProject(project.ID, user.ID)
	if err != nil {
		t.Fatalf("ResumeProject: %v", err)
	}
	if resumed.Status != model.ProjectStatusActive || resumed.ResumedAt == nil {
		t.Fatalf("expected resumed project, got %+v", resumed)
	}
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("reload escrow: %v", err)
	}
	if escrow.Status != escrowStatusActive {
		t.Fatalf("expected active escrow after resume, got %d", escrow.Status)
	}

	var logs []model.AuditLog
	if err := db.Order("id ASC").Find(&logs).Error; err != nil {
		t.Fatalf("load audit logs: %v", err)
	}
	if len(logs) < 2 || logs[0].OperationType != "pause_project" || logs[1].OperationType != "resume_project" {
		t.Fatalf("expected pause/resume audit logs, got %+v", logs)
	}
}

func TestPausedProjectDoesNotExposeCompletionActionEvenWhenMilestonesAccepted(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, milestone, _ := seedProjectRiskFixture(t, db)

	if err := db.Model(&milestone).Updates(map[string]interface{}{
		"status": model.MilestoneStatusAccepted,
		"name":   "竣工验收",
	}).Error; err != nil {
		t.Fatalf("set milestone accepted: %v", err)
	}

	disputeSvc := &ProjectDisputeService{}
	if _, err := disputeSvc.PauseProject(project.ID, user.ID, &ProjectPauseInput{Reason: "完工前暂停处理"}); err != nil {
		t.Fatalf("PauseProject: %v", err)
	}

	detail, err := (&ProjectService{}).GetProjectDetail(project.ID)
	if err != nil {
		t.Fatalf("GetProjectDetail after pause: %v", err)
	}
	if detail.FlowSummary != "项目已暂停，待业主恢复施工后再继续推进" {
		t.Fatalf("expected paused flow summary, got %+v", detail)
	}
	if len(detail.AvailableActions) != 0 {
		t.Fatalf("expected no available actions while paused, got %+v", detail.AvailableActions)
	}
	for _, action := range detail.AvailableActions {
		if action == "submit_completion" {
			t.Fatalf("expected paused project to hide submit_completion action, got %+v", detail.AvailableActions)
		}
	}
}

func TestProjectDisputeServiceCreatesComplaintAndAudit(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, _, _ := seedProjectRiskFixture(t, db)

	result, err := (&ProjectDisputeService{}).SubmitProjectDispute(project.ID, user.ID, &ProjectDisputeInput{
		Reason:   "施工质量存在严重问题",
		Evidence: []string{"https://example.com/e1.jpg", "https://example.com/e2.jpg"},
	})
	if err != nil {
		t.Fatalf("SubmitProjectDispute: %v", err)
	}
	if result.AuditID == 0 || result.ComplaintID == 0 {
		t.Fatalf("expected complaint and audit ids, got %+v", result)
	}

	var refreshedProject model.Project
	if err := db.First(&refreshedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if refreshedProject.DisputedAt == nil || refreshedProject.DisputeReason == "" {
		t.Fatalf("expected disputed project fields, got %+v", refreshedProject)
	}

	var complaint model.Complaint
	if err := db.First(&complaint, result.ComplaintID).Error; err != nil {
		t.Fatalf("load complaint: %v", err)
	}
	if !complaint.FreezePayment || complaint.Status != "submitted" {
		t.Fatalf("unexpected complaint state: %+v", complaint)
	}

	var audit model.ProjectAudit
	if err := db.First(&audit, result.AuditID).Error; err != nil {
		t.Fatalf("load audit: %v", err)
	}
	if audit.Status != model.ProjectAuditStatusPending || audit.AuditType != model.ProjectAuditTypeDispute {
		t.Fatalf("unexpected audit state: %+v", audit)
	}

	var flow model.BusinessFlow
	if err := db.Where("project_id = ?", project.ID).First(&flow).Error; err != nil {
		t.Fatalf("load business flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageDisputed {
		t.Fatalf("expected disputed flow stage, got %s", flow.CurrentStage)
	}

	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("load escrow: %v", err)
	}
	if escrow.Status != escrowStatusFrozen {
		t.Fatalf("expected frozen escrow, got %d", escrow.Status)
	}

	var auditLog model.AuditLog
	if err := db.Where("operation_type = ?", "submit_project_dispute").Order("id DESC").First(&auditLog).Error; err != nil {
		t.Fatalf("expected dispute audit log: %v", err)
	}
	if auditLog.RecordKind != "business" || auditLog.ResourceID != project.ID {
		t.Fatalf("unexpected dispute audit log: %+v", auditLog)
	}

	detail, err := (&ProjectService{}).GetProjectDetail(project.ID)
	if err != nil {
		t.Fatalf("GetProjectDetail: %v", err)
	}
	if detail.RiskSummary == nil {
		t.Fatalf("expected risk summary")
	}
	if detail.RiskSummary.DisputeReason != "施工质量存在严重问题" {
		t.Fatalf("unexpected risk dispute reason: %+v", detail.RiskSummary)
	}
	if !detail.RiskSummary.EscrowFrozen || detail.RiskSummary.AuditStatus != model.ProjectAuditStatusPending {
		t.Fatalf("unexpected risk summary state: %+v", detail.RiskSummary)
	}
}

func TestProjectAuditServiceArbitrateContinueClearsDispute(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, _, _ := seedProjectRiskFixture(t, db)

	disputeSvc := &ProjectDisputeService{}
	result, err := disputeSvc.SubmitProjectDispute(project.ID, user.ID, &ProjectDisputeInput{Reason: "需要平台介入"})
	if err != nil {
		t.Fatalf("SubmitProjectDispute: %v", err)
	}

	view, err := (&ProjectAuditService{}).Arbitrate(result.AuditID, 9001, &ArbitrateProjectAuditInput{
		Conclusion:       model.ProjectAuditConclusionContinue,
		ConclusionReason: "双方已协商一致，恢复施工",
		ExecutionPlan:    map[string]interface{}{"continueConstruction": true},
	})
	if err != nil {
		t.Fatalf("Arbitrate: %v", err)
	}
	if view.Status != model.ProjectAuditStatusCompleted || view.Conclusion != model.ProjectAuditConclusionContinue {
		t.Fatalf("unexpected audit result: %+v", view)
	}

	var refreshedProject model.Project
	if err := db.First(&refreshedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if refreshedProject.DisputedAt != nil || refreshedProject.DisputeReason != "" {
		t.Fatalf("expected dispute cleared, got %+v", refreshedProject)
	}

	var complaint model.Complaint
	if err := db.First(&complaint, result.ComplaintID).Error; err != nil {
		t.Fatalf("reload complaint: %v", err)
	}
	if complaint.Status != "resolved" {
		t.Fatalf("expected resolved complaint, got %+v", complaint)
	}

	var flow model.BusinessFlow
	if err := db.Where("project_id = ?", project.ID).First(&flow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageInProgress {
		t.Fatalf("expected in_progress flow, got %s", flow.CurrentStage)
	}

	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("reload escrow: %v", err)
	}
	if escrow.Status != escrowStatusActive {
		t.Fatalf("expected active escrow after continue, got %d", escrow.Status)
	}

	var auditLog model.AuditLog
	if err := db.Where("operation_type = ?", "arbitrate_project_audit").Order("id DESC").First(&auditLog).Error; err != nil {
		t.Fatalf("expected arbitrate audit log: %v", err)
	}
	if !strings.Contains(auditLog.AfterState, model.ProjectAuditConclusionContinue) {
		t.Fatalf("expected conclusion in audit log after_state, got %+v", auditLog)
	}
}

func TestProjectAuditServiceArbitrateCannotRepeatAfterCompletion(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, _, _ := seedProjectRiskFixture(t, db)

	disputeSvc := &ProjectDisputeService{}
	result, err := disputeSvc.SubmitProjectDispute(project.ID, user.ID, &ProjectDisputeInput{Reason: "需要关闭项目"})
	if err != nil {
		t.Fatalf("SubmitProjectDispute: %v", err)
	}

	auditService := &ProjectAuditService{}
	if _, err := auditService.Arbitrate(result.AuditID, 9001, &ArbitrateProjectAuditInput{
		Conclusion:       model.ProjectAuditConclusionClose,
		ConclusionReason: "平台裁定关闭",
	}); err != nil {
		t.Fatalf("Arbitrate close: %v", err)
	}

	if _, err := auditService.Arbitrate(result.AuditID, 9001, &ArbitrateProjectAuditInput{
		Conclusion:       model.ProjectAuditConclusionContinue,
		ConclusionReason: "重复仲裁",
	}); err == nil {
		t.Fatalf("expected repeat arbitrate on completed audit to fail")
	}
}

func TestProjectAuditServiceArbitrateCloseMarksProjectClosed(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, _, _ := seedProjectRiskFixture(t, db)

	disputeSvc := &ProjectDisputeService{}
	result, err := disputeSvc.SubmitProjectDispute(project.ID, user.ID, &ProjectDisputeInput{Reason: "需要关闭项目"})
	if err != nil {
		t.Fatalf("SubmitProjectDispute: %v", err)
	}

	auditService := &ProjectAuditService{}
	if _, err := auditService.Arbitrate(result.AuditID, 9001, &ArbitrateProjectAuditInput{
		Conclusion:       model.ProjectAuditConclusionClose,
		ConclusionReason: "平台裁定关闭项目",
	}); err != nil {
		t.Fatalf("Arbitrate close: %v", err)
	}

	var refreshedProject model.Project
	if err := db.First(&refreshedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if refreshedProject.Status != model.ProjectStatusClosed {
		t.Fatalf("expected closed project status, got %+v", refreshedProject)
	}
	if refreshedProject.BusinessStatus != model.ProjectBusinessStatusCancelled {
		t.Fatalf("expected cancelled business status, got %+v", refreshedProject)
	}
	if refreshedProject.CurrentPhase != "仲裁关闭" {
		t.Fatalf("expected arbitration closed phase, got %+v", refreshedProject)
	}

	var flow model.BusinessFlow
	if err := db.Where("project_id = ?", project.ID).First(&flow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageCancelled {
		t.Fatalf("expected cancelled flow stage, got %+v", flow)
	}
}

func TestProjectAuditServiceArbitrateRefundMarksProjectClosed(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, _, booking := seedProjectRiskFixture(t, db)
	constructionOrder := seedProjectRiskConstructionRefundUnit(t, db, user, project, booking)

	disputeSvc := &ProjectDisputeService{}
	result, err := disputeSvc.SubmitProjectDispute(project.ID, user.ID, &ProjectDisputeInput{Reason: "需要退款关闭项目"})
	if err != nil {
		t.Fatalf("SubmitProjectDispute: %v", err)
	}

	auditService := &ProjectAuditService{}
	view, err := auditService.Arbitrate(result.AuditID, 9001, &ArbitrateProjectAuditInput{
		Conclusion:       model.ProjectAuditConclusionRefund,
		ConclusionReason: "平台裁定退款关闭项目",
	})
	if err != nil {
		t.Fatalf("Arbitrate refund: %v", err)
	}
	if view.RefundApplicationID == 0 {
		t.Fatalf("expected generated refund application, got %+v", view)
	}

	var refreshedProject model.Project
	if err := db.First(&refreshedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if refreshedProject.Status != model.ProjectStatusClosed {
		t.Fatalf("expected closed project status, got %+v", refreshedProject)
	}
	if refreshedProject.BusinessStatus != model.ProjectBusinessStatusCancelled {
		t.Fatalf("expected cancelled business status, got %+v", refreshedProject)
	}
	if refreshedProject.CurrentPhase != "退款关闭" {
		t.Fatalf("expected refund closed phase, got %+v", refreshedProject)
	}

	var flow model.BusinessFlow
	if err := db.Where("project_id = ?", project.ID).First(&flow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageCancelled {
		t.Fatalf("expected cancelled flow stage, got %+v", flow)
	}

	var refund model.RefundApplication
	if err := db.First(&refund, view.RefundApplicationID).Error; err != nil {
		t.Fatalf("reload refund application: %v", err)
	}
	if refund.Status != model.RefundApplicationStatusCompleted {
		t.Fatalf("expected completed refund application, got %+v", refund)
	}
	if refund.OrderID != constructionOrder.ID {
		t.Fatalf("expected refund application bound to construction order %d, got %+v", constructionOrder.ID, refund)
	}

	var refundOrders int64
	if err := db.Model(&model.RefundOrder{}).Where("refund_application_id = ?", refund.ID).Count(&refundOrders).Error; err != nil {
		t.Fatalf("count refund orders: %v", err)
	}
	if refundOrders == 0 {
		t.Fatalf("expected refund orders for project refund")
	}

	var refundTxn model.Transaction
	if err := db.Where("type = ?", "refund").Order("id DESC").First(&refundTxn).Error; err != nil {
		t.Fatalf("load refund transaction: %v", err)
	}
	if !strings.Contains(refundTxn.Remark, "refundApplicationId=") || !strings.Contains(refundTxn.Remark, "orderId=") {
		t.Fatalf("expected refund transaction remark to include order/application, got %+v", refundTxn)
	}

	var refundAudit model.AuditLog
	if err := db.Where("operation_type = ?", "execute_refund_application").Order("id DESC").First(&refundAudit).Error; err != nil {
		t.Fatalf("expected refund execution audit log: %v", err)
	}
	if refundAudit.ResourceID != refund.ID {
		t.Fatalf("unexpected refund execution audit log: %+v", refundAudit)
	}
}

func TestProjectAuditServiceArbitratePartialRefundKeepsProjectActiveWhenContinuing(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, _, booking := seedProjectRiskFixture(t, db)
	seedProjectRiskConstructionRefundUnit(t, db, user, project, booking)

	disputeSvc := &ProjectDisputeService{}
	result, err := disputeSvc.SubmitProjectDispute(project.ID, user.ID, &ProjectDisputeInput{Reason: "部分退款后继续施工"})
	if err != nil {
		t.Fatalf("SubmitProjectDispute: %v", err)
	}

	auditService := &ProjectAuditService{}
	view, err := auditService.Arbitrate(result.AuditID, 9001, &ArbitrateProjectAuditInput{
		Conclusion:       model.ProjectAuditConclusionPartialRefund,
		ConclusionReason: "平台裁定部分退款并继续施工",
		ExecutionPlan: map[string]interface{}{
			"refundAmount":         12000.0,
			"continueConstruction": true,
		},
	})
	if err != nil {
		t.Fatalf("Arbitrate partial_refund: %v", err)
	}
	if view.RefundApplicationID == 0 {
		t.Fatalf("expected generated refund application, got %+v", view)
	}

	var refreshedProject model.Project
	if err := db.First(&refreshedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if refreshedProject.Status != model.ProjectStatusActive {
		t.Fatalf("expected active project status, got %+v", refreshedProject)
	}
	if refreshedProject.BusinessStatus != model.ProjectBusinessStatusInProgress {
		t.Fatalf("expected in_progress business status, got %+v", refreshedProject)
	}
	if refreshedProject.DisputedAt != nil || refreshedProject.DisputeReason != "" {
		t.Fatalf("expected dispute state cleared, got %+v", refreshedProject)
	}

	var flow model.BusinessFlow
	if err := db.Where("project_id = ?", project.ID).First(&flow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageInProgress {
		t.Fatalf("expected in_progress flow stage, got %+v", flow)
	}

	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("reload escrow: %v", err)
	}
	if escrow.Status != escrowStatusActive {
		t.Fatalf("expected active escrow after partial refund continue, got %+v", escrow)
	}
	if escrow.TotalAmount != 18000 || escrow.AvailableAmount != 18000 || escrow.FrozenAmount != 0 {
		t.Fatalf("expected remaining escrow released back to available balance, got %+v", escrow)
	}

	var refund model.RefundApplication
	if err := db.First(&refund, view.RefundApplicationID).Error; err != nil {
		t.Fatalf("reload refund application: %v", err)
	}
	if refund.Status != model.RefundApplicationStatusCompleted || refund.ApprovedAmount != 12000 {
		t.Fatalf("expected completed partial refund application, got %+v", refund)
	}
}

func TestProjectAuditServiceArbitratePartialRefundClosesProjectWhenNotContinuing(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, project, _, booking := seedProjectRiskFixture(t, db)
	seedProjectRiskConstructionRefundUnit(t, db, user, project, booking)

	disputeSvc := &ProjectDisputeService{}
	result, err := disputeSvc.SubmitProjectDispute(project.ID, user.ID, &ProjectDisputeInput{Reason: "部分退款后不再继续施工"})
	if err != nil {
		t.Fatalf("SubmitProjectDispute: %v", err)
	}

	auditService := &ProjectAuditService{}
	view, err := auditService.Arbitrate(result.AuditID, 9001, &ArbitrateProjectAuditInput{
		Conclusion:       model.ProjectAuditConclusionPartialRefund,
		ConclusionReason: "平台裁定部分退款并关闭项目",
		ExecutionPlan: map[string]interface{}{
			"refundAmount":         12000.0,
			"continueConstruction": false,
		},
	})
	if err != nil {
		t.Fatalf("Arbitrate partial_refund close: %v", err)
	}
	if view.RefundApplicationID == 0 {
		t.Fatalf("expected generated refund application, got %+v", view)
	}

	var refreshedProject model.Project
	if err := db.First(&refreshedProject, project.ID).Error; err != nil {
		t.Fatalf("reload project: %v", err)
	}
	if refreshedProject.Status != model.ProjectStatusClosed {
		t.Fatalf("expected closed project status, got %+v", refreshedProject)
	}
	if refreshedProject.BusinessStatus != model.ProjectBusinessStatusCancelled {
		t.Fatalf("expected cancelled business status, got %+v", refreshedProject)
	}
	if refreshedProject.CurrentPhase != "退款关闭" {
		t.Fatalf("expected refund closed phase, got %+v", refreshedProject)
	}

	var flow model.BusinessFlow
	if err := db.Where("project_id = ?", project.ID).First(&flow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if flow.CurrentStage != model.BusinessFlowStageCancelled {
		t.Fatalf("expected cancelled flow stage, got %+v", flow)
	}

	var refund model.RefundApplication
	if err := db.First(&refund, view.RefundApplicationID).Error; err != nil {
		t.Fatalf("reload refund application: %v", err)
	}
	if refund.Status != model.RefundApplicationStatusCompleted || refund.ApprovedAmount != 12000 {
		t.Fatalf("expected completed partial refund application, got %+v", refund)
	}
}

func TestRefundApplicationApproveIntentFee(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	previousGatewayFactory := paymentChannelServiceFactory
	paymentChannelServiceFactory = func() map[string]PaymentChannelService {
		return map[string]PaymentChannelService{
			model.PaymentChannelAlipay: projectRiskMockGateway{},
		}
	}
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousGatewayFactory
	})
	user, provider, project, _, booking := seedProjectRiskFixture(t, db)
	service := &RefundApplicationService{}

	application, err := service.CreateApplication(booking.ID, user.ID, &CreateRefundApplicationInput{
		RefundType: model.RefundTypeIntentFee,
		Reason:     "用户主动申请退出",
	})
	if err != nil {
		t.Fatalf("CreateApplication: %v", err)
	}

	approved, err := service.ApproveApplication(application.ID, 7001, &ReviewRefundApplicationInput{AdminNotes: "同意退款"})
	if err != nil {
		t.Fatalf("ApproveApplication: %v", err)
	}
	if approved.Status != model.RefundApplicationStatusCompleted {
		t.Fatalf("expected completed application, got %+v", approved)
	}
	var createdNotification model.Notification
	if err := db.Where("user_id = ? AND type = ?", provider.UserID, "refund.application.created").Order("id DESC").First(&createdNotification).Error; err != nil {
		t.Fatalf("expected provider refund created notification: %v", err)
	}
	if createdNotification.ActionURL != buildProjectDisputeActionURL(project.ID) {
		t.Fatalf("expected project dispute actionUrl, got %+v", createdNotification)
	}
	var approvedNotification model.Notification
	if err := db.Where("user_id = ? AND type = ?", provider.UserID, "refund.application.approved").Order("id DESC").First(&approvedNotification).Error; err != nil {
		t.Fatalf("expected provider refund approved notification: %v", err)
	}
	if approvedNotification.ActionURL != buildProjectDisputeActionURL(project.ID) {
		t.Fatalf("expected provider refund approved actionUrl, got %+v", approvedNotification)
	}

	var approveAudit model.AuditLog
	if err := db.Where("operation_type = ?", "approve_refund_application").Order("id DESC").First(&approveAudit).Error; err != nil {
		t.Fatalf("expected approve refund audit log: %v", err)
	}

	var refreshedBooking model.Booking
	if err := db.First(&refreshedBooking, booking.ID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if !refreshedBooking.IntentFeeRefunded || refreshedBooking.IntentFeeRefundedAt == nil {
		t.Fatalf("expected refunded booking, got %+v", refreshedBooking)
	}
	if _, err := service.ApproveApplication(application.ID, 7001, &ReviewRefundApplicationInput{AdminNotes: "重复批准"}); err == nil {
		t.Fatalf("expected duplicate approve to fail")
	}
}

func TestRefundApplicationRejectKeepsBookingUnchanged(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, provider, project, _, booking := seedProjectRiskFixture(t, db)
	service := &RefundApplicationService{}

	application, err := service.CreateApplication(booking.ID, user.ID, &CreateRefundApplicationInput{
		RefundType: model.RefundTypeIntentFee,
		Reason:     "先申请后撤回",
	})
	if err != nil {
		t.Fatalf("CreateApplication: %v", err)
	}

	rejected, err := service.RejectApplication(application.ID, 7002, &RejectRefundApplicationInput{AdminNotes: "证据不足"})
	if err != nil {
		t.Fatalf("RejectApplication: %v", err)
	}
	if rejected.Status != model.RefundApplicationStatusRejected {
		t.Fatalf("expected rejected application, got %+v", rejected)
	}
	var rejectedNotification model.Notification
	if err := db.Where("user_id = ? AND type = ?", provider.UserID, "refund.application.rejected").Order("id DESC").First(&rejectedNotification).Error; err != nil {
		t.Fatalf("expected provider refund rejected notification: %v", err)
	}
	if rejectedNotification.ActionURL != buildProjectDisputeActionURL(project.ID) {
		t.Fatalf("expected provider refund rejected actionUrl, got %+v", rejectedNotification)
	}

	var rejectAudit model.AuditLog
	if err := db.Where("operation_type = ?", "reject_refund_application").Order("id DESC").First(&rejectAudit).Error; err != nil {
		t.Fatalf("expected reject refund audit log: %v", err)
	}

	var refreshedBooking model.Booking
	if err := db.First(&refreshedBooking, booking.ID).Error; err != nil {
		t.Fatalf("reload booking: %v", err)
	}
	if refreshedBooking.IntentFeeRefunded {
		t.Fatalf("expected booking refund untouched, got %+v", refreshedBooking)
	}
}

func TestRefundApplicationPartialDesignFeeTracksRemainingBalance(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	previousGatewayFactory := paymentChannelServiceFactory
	paymentChannelServiceFactory = func() map[string]PaymentChannelService {
		return map[string]PaymentChannelService{
			model.PaymentChannelAlipay: projectRiskMockGateway{},
		}
	}
	t.Cleanup(func() {
		paymentChannelServiceFactory = previousGatewayFactory
	})
	user, _, _, _, booking := seedProjectRiskFixture(t, db)
	service := &RefundApplicationService{}

	first, err := service.CreateApplication(booking.ID, user.ID, &CreateRefundApplicationInput{
		RefundType: model.RefundTypeDesignFee,
		Reason:     "设计费部分退款",
	})
	if err != nil {
		t.Fatalf("CreateApplication first: %v", err)
	}
	if first.RequestedAmount != 5000 {
		t.Fatalf("expected initial design refundable amount 5000, got %+v", first)
	}

	if _, err := service.ApproveApplication(first.ID, 7001, &ReviewRefundApplicationInput{
		ApprovedAmount: 2000,
		AdminNotes:     "部分退款",
	}); err != nil {
		t.Fatalf("ApproveApplication first: %v", err)
	}

	second, err := service.CreateApplication(booking.ID, user.ID, &CreateRefundApplicationInput{
		RefundType: model.RefundTypeDesignFee,
		Reason:     "再次申请剩余设计费",
	})
	if err != nil {
		t.Fatalf("CreateApplication second: %v", err)
	}
	if second.RequestedAmount != 3000 {
		t.Fatalf("expected remaining refundable design fee 3000, got %+v", second)
	}

	if _, err := service.ApproveApplication(second.ID, 7001, &ReviewRefundApplicationInput{
		ApprovedAmount: 3000,
		AdminNotes:     "退完剩余设计费",
	}); err != nil {
		t.Fatalf("ApproveApplication second: %v", err)
	}

	if _, err := service.CreateApplication(booking.ID, user.ID, &CreateRefundApplicationInput{
		RefundType: model.RefundTypeDesignFee,
		Reason:     "第三次申请设计费",
	}); err == nil {
		t.Fatalf("expected no refundable design fee after full refund")
	}
}

func TestRefundApplicationBuildBookingSummaryAndListFilters(t *testing.T) {
	db := setupProjectRiskServiceTestDB(t)
	user, _, _, _, booking := seedProjectRiskFixture(t, db)
	service := &RefundApplicationService{}

	secondBooking := model.Booking{
		Base:          model.Base{ID: 22},
		UserID:        user.ID,
		ProviderID:    booking.ProviderID,
		Address:       "第二套房",
		IntentFee:     1500,
		IntentFeePaid: true,
	}
	if err := db.Create(&secondBooking).Error; err != nil {
		t.Fatalf("create second booking: %v", err)
	}

	first, err := service.CreateApplication(booking.ID, user.ID, &CreateRefundApplicationInput{
		RefundType: model.RefundTypeIntentFee,
		Reason:     "第一笔退款",
	})
	if err != nil {
		t.Fatalf("CreateApplication first: %v", err)
	}
	if _, err := service.RejectApplication(first.ID, 8001, &RejectRefundApplicationInput{AdminNotes: "资料不足"}); err != nil {
		t.Fatalf("RejectApplication first: %v", err)
	}
	if _, err := service.CreateApplication(secondBooking.ID, user.ID, &CreateRefundApplicationInput{
		RefundType: model.RefundTypeIntentFee,
		Reason:     "第二笔退款",
	}); err != nil {
		t.Fatalf("CreateApplication second: %v", err)
	}

	summary, err := service.BuildBookingRefundSummary(secondBooking.ID)
	if err != nil {
		t.Fatalf("BuildBookingRefundSummary: %v", err)
	}
	if summary == nil || summary.CanApplyRefund {
		t.Fatalf("expected pending refund to block duplicate apply, got %+v", summary)
	}
	if summary.LatestRefundStatus != model.RefundApplicationStatusPending || summary.LatestRefundID == 0 {
		t.Fatalf("unexpected latest refund summary: %+v", summary)
	}
	if summary.RefundableAmount <= 0 || len(summary.RefundableTypes) == 0 {
		t.Fatalf("expected refundable breakdown, got %+v", summary)
	}

	filtered, total, err := service.ListMyApplications(user.ID, &ListMyRefundApplicationsQuery{
		BookingID: secondBooking.ID,
		Status:    model.RefundApplicationStatusPending,
		Page:      1,
		PageSize:  10,
	})
	if err != nil {
		t.Fatalf("ListMyApplications filtered: %v", err)
	}
	if total != 1 || len(filtered) != 1 || filtered[0].BookingID != secondBooking.ID {
		t.Fatalf("unexpected filtered refunds: total=%d list=%+v", total, filtered)
	}

	rejected, rejectedTotal, err := service.ListMyApplications(user.ID, &ListMyRefundApplicationsQuery{
		Status:   model.RefundApplicationStatusRejected,
		Page:     1,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("ListMyApplications rejected: %v", err)
	}
	if rejectedTotal != 1 || len(rejected) != 1 || rejected[0].Status != model.RefundApplicationStatusRejected {
		t.Fatalf("unexpected rejected refunds: total=%d list=%+v", rejectedTotal, rejected)
	}
}
