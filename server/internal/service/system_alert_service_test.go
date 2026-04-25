package service

import (
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSystemAlertTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "file:" + t.Name() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.RiskWarning{}, &model.SysAdmin{}, &model.Notification{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	originalDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = originalDB
	})
	return db
}

func TestSystemAlertServiceUpsertAndResolve(t *testing.T) {
	db := setupSystemAlertTestDB(t)
	if err := db.Create(&model.SysAdmin{ID: 7001, Username: "root", Password: "x", Status: 1}).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	svc := &SystemAlertService{}
	first, created, err := svc.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeRefundSyncFailure,
		Level:       "critical",
		Scope:       "退款同步/申请1/退款单2",
		Description: "第一次失败",
		ActionURL:   "/risk/warnings",
	})
	if err != nil {
		t.Fatalf("UpsertAlert first: %v", err)
	}
	if !created || first.ID == 0 {
		t.Fatalf("expected first alert to be created")
	}

	second, created, err := svc.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeRefundSyncFailure,
		Level:       "high",
		Scope:       "退款同步/申请1/退款单2",
		Description: "第二次失败",
	})
	if err != nil {
		t.Fatalf("UpsertAlert second: %v", err)
	}
	if created {
		t.Fatalf("expected second alert to refresh existing record")
	}
	if second.ID != first.ID {
		t.Fatalf("expected same alert record, got %d vs %d", second.ID, first.ID)
	}

	var warnings []model.RiskWarning
	if err := db.Find(&warnings).Error; err != nil {
		t.Fatalf("find warnings: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}

	affected, err := svc.ResolveAlert(SystemAlertTypeRefundSyncFailure, "退款同步/申请1/退款单2", "已恢复")
	if err != nil {
		t.Fatalf("ResolveAlert: %v", err)
	}
	if affected != 1 {
		t.Fatalf("expected 1 resolved warning, got %d", affected)
	}

	var warning model.RiskWarning
	if err := db.First(&warning, first.ID).Error; err != nil {
		t.Fatalf("reload warning: %v", err)
	}
	if warning.Status != 2 || warning.HandleResult != "已恢复" {
		t.Fatalf("unexpected warning after resolve: %+v", warning)
	}
}

func TestSystemAlertServiceListRiskWarningsFiltersStatusAndLevel(t *testing.T) {
	db := setupSystemAlertTestDB(t)
	records := []model.RiskWarning{
		{Base: model.Base{ID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()}, ProjectID: 11, ProjectName: "项目A", Type: "refund", Level: "high", Description: "高风险退款", Status: 0},
		{Base: model.Base{ID: 2, CreatedAt: time.Now(), UpdatedAt: time.Now()}, ProjectID: 12, ProjectName: "项目B", Type: "quality", Level: "medium", Description: "质量问题", Status: 1},
		{Base: model.Base{ID: 3, CreatedAt: time.Now(), UpdatedAt: time.Now()}, ProjectID: 13, ProjectName: "项目C", Type: "refund", Level: "high", Description: "已处理退款", Status: 2},
	}
	for i := range records {
		if err := db.Create(&records[i]).Error; err != nil {
			t.Fatalf("seed warning: %v", err)
		}
	}

	list, total, err := (&SystemAlertService{}).ListRiskWarnings(ListRiskWarningFilter{
		Page:     1,
		PageSize: 10,
		Level:    "high",
		Status:   "0",
	})
	if err != nil {
		t.Fatalf("ListRiskWarnings: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}
	if len(list) != 1 || list[0].ID != 1 {
		t.Fatalf("unexpected list result: %+v", list)
	}
}

func TestSystemAlertServiceHandleRiskWarning(t *testing.T) {
	db := setupSystemAlertTestDB(t)
	if err := db.Create(&model.RiskWarning{
		Base:        model.Base{ID: 10, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		ProjectID:   21,
		ProjectName: "项目D",
		Type:        "payment",
		Level:       "critical",
		Description: "放款失败",
		Status:      0,
	}).Error; err != nil {
		t.Fatalf("seed warning: %v", err)
	}

	view, err := (&SystemAlertService{}).HandleRiskWarning(10, 7001, &HandleRiskWarningInput{
		Status: 2,
		Result: "已完成人工核查",
	})
	if err != nil {
		t.Fatalf("HandleRiskWarning: %v", err)
	}
	if view.Status != 2 || view.HandleResult != "已完成人工核查" {
		t.Fatalf("unexpected warning view: %+v", view)
	}
	if view.HandledBy == nil || *view.HandledBy != 7001 {
		t.Fatalf("expected handledBy=7001, got %+v", view.HandledBy)
	}

	if _, err := (&SystemAlertService{}).HandleRiskWarning(10, 7001, &HandleRiskWarningInput{
		Status: 2,
		Result: "重复处理",
	}); err == nil || err.Error() != "预警已处理" {
		t.Fatalf("expected handled conflict, got %v", err)
	}
}

func TestSystemAlertServiceActionURLsUseAdminFrontendRoutes(t *testing.T) {
	if got := buildAdminPaymentTransactionActionURL(11); got != "/finance/transactions?paymentOrderId=11" {
		t.Fatalf("expected payment transaction frontend route, got %s", got)
	}
	if got := buildAdminFinanceReconciliationActionURL(12); got != "/finance/reconciliations?reconciliationId=12" {
		t.Fatalf("expected reconciliation frontend route, got %s", got)
	}
	if got := buildAdminRefundOrderActionURL(13); got != "/refunds?refundOrderId=13" {
		t.Fatalf("expected refund list frontend route, got %s", got)
	}
	if got := buildAdminSettlementOrderActionURL(14); got != "/finance/settlements?settlementOrderId=14" {
		t.Fatalf("expected settlement list frontend route, got %s", got)
	}
}

func TestSystemAlertServiceGeneratedWarningsDoNotEmbedLegacyAdminRoutes(t *testing.T) {
	db := setupSystemAlertTestDB(t)
	svc := &SystemAlertService{}

	checks := []struct {
		name string
		run  func() error
	}{
		{
			name: "payment callback",
			run:  func() error { return svc.AlertPaymentCallbackFailed(11, "验签失败") },
		},
		{
			name: "payment reconciliation failed",
			run:  func() error { return svc.AlertPaymentReconciliationFailed(12, "网络失败") },
		},
		{
			name: "payment reconciliation difference",
			run:  func() error { return svc.AlertPaymentReconciliationDifference(13, 2, 10.5) },
		},
		{
			name: "refund failed",
			run:  func() error { return svc.AlertRefundFailed(14, "退款失败") },
		},
		{
			name: "refund reconciliation difference",
			run:  func() error { return svc.AlertRefundReconciliationDifference(15, 1) },
		},
		{
			name: "settlement failed",
			run:  func() error { return svc.AlertSettlementFailed(16, "出款失败") },
		},
		{
			name: "settlement reconciliation difference",
			run:  func() error { return svc.AlertSettlementReconciliationDifference(17, 3, 20.5) },
		},
	}

	for _, item := range checks {
		if err := item.run(); err != nil {
			t.Fatalf("%s: %v", item.name, err)
		}
	}

	var warnings []model.RiskWarning
	if err := db.Order("id ASC").Find(&warnings).Error; err != nil {
		t.Fatalf("load warnings: %v", err)
	}
	if len(warnings) != len(checks) {
		t.Fatalf("expected %d warnings, got %d", len(checks), len(warnings))
	}

	for idx, warning := range warnings {
		if strings.Contains(warning.Description, "/admin") {
			t.Fatalf("warning %d still embeds legacy admin route: %s", idx, warning.Description)
		}
		if strings.Contains(warning.Description, "action=") || strings.Contains(warning.Description, "/finance/") || strings.Contains(warning.Description, "/refunds") {
			t.Fatalf("warning %d still embeds route metadata: %s", idx, warning.Description)
		}
	}
}

func TestSystemAlertServiceSanitizesTechnicalWarningDescriptions(t *testing.T) {
	db := setupSystemAlertTestDB(t)
	svc := &SystemAlertService{}

	_, _, err := svc.UpsertAlert(&CreateSystemAlertInput{
		Type:        SystemAlertTypeFinanceReconciliationFailed,
		Level:       "critical",
		Scope:       "财务对账任务",
		Description: `ERROR: relation "finance_reconciliations" does not exist (SQLSTATE 42P01)`,
		ActionURL:   "/risk/warnings",
	})
	if err != nil {
		t.Fatalf("UpsertAlert: %v", err)
	}

	var warning model.RiskWarning
	if err := db.First(&warning).Error; err != nil {
		t.Fatalf("load warning: %v", err)
	}
	if warning.Description != "系统任务异常，请进入风险中心查看处理。" {
		t.Fatalf("expected sanitized description, got %s", warning.Description)
	}
	if strings.Contains(strings.ToLower(warning.Description), "sqlstate") || strings.Contains(warning.Description, "finance_reconciliations") {
		t.Fatalf("technical detail leaked into warning description: %s", warning.Description)
	}
}
