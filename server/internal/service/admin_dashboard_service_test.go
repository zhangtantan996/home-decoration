package service

import (
	"fmt"
	"math"
	"testing"
	"time"

	"home-decoration-server/internal/model"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAdminDashboardTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:admin-dashboard-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(gormsqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(withPaymentCentralTestModels(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.MaterialShop{},
		&model.Order{},
		&model.Project{},
		&model.Proposal{},
		&model.RefundApplication{},
		&model.Complaint{},
		&model.ProjectAudit{},
		&model.Arbitration{},
	)...); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	bindRepositorySQLiteTestDB(t, db)
	return db
}

func dashboardMetricValueByKey(metrics []DashboardMetricValue, key string) float64 {
	for _, item := range metrics {
		if item.Key == key {
			return item.Value
		}
	}
	return 0
}

func TestAdminDashboardOverviewNorthStarIgnoresUnfinishedRiskProjects(t *testing.T) {
	db := setupAdminDashboardTestDB(t)
	now := time.Now()

	safeCompleted := model.Project{Base: model.Base{ID: 1001, CreatedAt: now.AddDate(0, -2, 0), UpdatedAt: now}, Status: model.ProjectStatusCompleted, BusinessStatus: model.ProjectBusinessStatusCompleted}
	completedComplaint := model.Project{Base: model.Base{ID: 1002, CreatedAt: now.AddDate(0, -1, 0), UpdatedAt: now}, Status: model.ProjectStatusCompleted, BusinessStatus: model.ProjectBusinessStatusCompleted}
	completedDispute := model.Project{Base: model.Base{ID: 1003, CreatedAt: now.AddDate(0, -1, 0), UpdatedAt: now}, Status: model.ProjectStatusCompleted, BusinessStatus: model.ProjectBusinessStatusCompleted, DisputedAt: ptrTimeChangeOrder(now.AddDate(0, 0, -2))}
	completedArbitration := model.Project{Base: model.Base{ID: 1004, CreatedAt: now.AddDate(0, -1, 0), UpdatedAt: now}, Status: model.ProjectStatusCompleted, BusinessStatus: model.ProjectBusinessStatusCompleted}
	inProgressComplaint := model.Project{Base: model.Base{ID: 1005, CreatedAt: now.AddDate(0, 0, -2), UpdatedAt: now}, Status: model.ProjectStatusActive, BusinessStatus: model.ProjectBusinessStatusInProgress}
	for _, project := range []model.Project{safeCompleted, completedComplaint, completedDispute, completedArbitration, inProgressComplaint} {
		if err := db.Create(&project).Error; err != nil {
			t.Fatalf("create project %d: %v", project.ID, err)
		}
	}
	if err := db.Create(&model.Complaint{
		Base:      model.Base{ID: 1101, CreatedAt: now.AddDate(0, 0, -2)},
		ProjectID: completedComplaint.ID,
		Status:    "pending",
	}).Error; err != nil {
		t.Fatalf("create completed complaint: %v", err)
	}
	if err := db.Create(&model.ProjectAudit{
		Base:      model.Base{ID: 1102, CreatedAt: now.AddDate(0, 0, -2)},
		ProjectID: completedDispute.ID,
		AuditType: model.ProjectAuditTypeDispute,
		Status:    model.ProjectAuditStatusPending,
	}).Error; err != nil {
		t.Fatalf("create project audit: %v", err)
	}
	if err := db.Create(&model.Arbitration{
		Base:      model.Base{ID: 1103, CreatedAt: now.AddDate(0, 0, -2)},
		ProjectID: completedArbitration.ID,
		Status:    1,
	}).Error; err != nil {
		t.Fatalf("create arbitration: %v", err)
	}
	if err := db.Create(&model.Complaint{
		Base:      model.Base{ID: 1104, CreatedAt: now.AddDate(0, 0, -1)},
		ProjectID: inProgressComplaint.ID,
		Status:    "pending",
	}).Error; err != nil {
		t.Fatalf("create in-progress complaint: %v", err)
	}

	overview, err := (&AdminDashboardService{}).GetOverview()
	if err != nil {
		t.Fatalf("GetOverview: %v", err)
	}
	if overview.NorthStar.Value != 1 {
		t.Fatalf("expected north star 1 safe completed project, got %.2f", overview.NorthStar.Value)
	}
}

func TestAdminDashboardOverviewRatesUseRecentRollingWindow(t *testing.T) {
	db := setupAdminDashboardTestDB(t)
	now := time.Now()
	oldTime := now.AddDate(0, 0, -90)
	recentTime := now.AddDate(0, 0, -5)

	for i := 0; i < 10; i++ {
		project := model.Project{
			Base:           model.Base{ID: uint64(2000 + i), CreatedAt: oldTime, UpdatedAt: oldTime},
			Status:         model.ProjectStatusCompleted,
			BusinessStatus: model.ProjectBusinessStatusCompleted,
		}
		if err := db.Create(&project).Error; err != nil {
			t.Fatalf("create old project %d: %v", project.ID, err)
		}
		proposal := model.Proposal{
			Base:        model.Base{ID: uint64(3000 + i), CreatedAt: oldTime, UpdatedAt: oldTime},
			Status:      model.ProposalStatusConfirmed,
			ConfirmedAt: &oldTime,
		}
		if err := db.Create(&proposal).Error; err != nil {
			t.Fatalf("create old proposal %d: %v", proposal.ID, err)
		}
	}

	recentProjectA := model.Project{Base: model.Base{ID: 2101, CreatedAt: recentTime, UpdatedAt: recentTime}, Status: model.ProjectStatusActive, BusinessStatus: model.ProjectBusinessStatusConstructionQuoteConfirmed}
	recentProjectB := model.Project{Base: model.Base{ID: 2102, CreatedAt: recentTime.Add(24 * time.Hour), UpdatedAt: recentTime.Add(24 * time.Hour)}, Status: model.ProjectStatusActive, BusinessStatus: model.ProjectBusinessStatusInProgress}
	for _, project := range []model.Project{recentProjectA, recentProjectB} {
		if err := db.Create(&project).Error; err != nil {
			t.Fatalf("create recent project %d: %v", project.ID, err)
		}
	}
	for _, proposal := range []model.Proposal{
		{Base: model.Base{ID: 3101, CreatedAt: recentTime, UpdatedAt: recentTime}, Status: model.ProposalStatusConfirmed, ConfirmedAt: &recentTime},
		{Base: model.Base{ID: 3102, CreatedAt: recentTime.Add(24 * time.Hour), UpdatedAt: recentTime.Add(24 * time.Hour)}, Status: model.ProposalStatusConfirmed, ConfirmedAt: ptrTimeChangeOrder(recentTime.Add(24 * time.Hour))},
	} {
		if err := db.Create(&proposal).Error; err != nil {
			t.Fatalf("create recent proposal %d: %v", proposal.ID, err)
		}
	}
	if err := db.Create(&model.Complaint{
		Base:      model.Base{ID: 3201, CreatedAt: recentTime.Add(12 * time.Hour)},
		ProjectID: recentProjectA.ID,
		Status:    "pending",
	}).Error; err != nil {
		t.Fatalf("create recent complaint: %v", err)
	}
	if err := db.Create(&model.RefundApplication{
		Base:      model.Base{ID: 3202, CreatedAt: recentTime.Add(12 * time.Hour)},
		ProjectID: recentProjectA.ID,
		Status:    model.RefundApplicationStatusPending,
	}).Error; err != nil {
		t.Fatalf("create recent refund: %v", err)
	}

	overview, err := (&AdminDashboardService{}).GetOverview()
	if err != nil {
		t.Fatalf("GetOverview: %v", err)
	}
	if diff := math.Abs(dashboardMetricValueByKey(overview.CoreMetrics, "dispute_rate") - 0.5); diff > 0.0001 {
		t.Fatalf("expected rolling-window dispute rate 0.5, got %.4f", dashboardMetricValueByKey(overview.CoreMetrics, "dispute_rate"))
	}
	if diff := math.Abs(dashboardMetricValueByKey(overview.CoreMetrics, "refund_rate") - 0.5); diff > 0.0001 {
		t.Fatalf("expected rolling-window refund rate 0.5, got %.4f", dashboardMetricValueByKey(overview.CoreMetrics, "refund_rate"))
	}
}
