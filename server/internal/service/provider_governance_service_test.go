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

func setupProviderGovernanceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:provider-governance-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(gormsqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(withPaymentCentralTestModels(
		&model.Provider{},
		&model.Booking{},
		&model.Proposal{},
		&model.Project{},
		&model.Milestone{},
		&model.Complaint{},
		&model.ProjectAudit{},
		&model.Arbitration{},
		&model.RefundApplication{},
		&model.ProviderCase{},
		&model.ProviderReview{},
	)...); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}
	bindRepositorySQLiteTestDB(t, db)
	return db
}

func TestProviderGovernanceSummaryUsesRollingThirtyDayRiskRates(t *testing.T) {
	db := setupProviderGovernanceTestDB(t)
	now := time.Now()
	provider := model.Provider{Base: model.Base{ID: 4101}, ProviderType: 2, CompanyName: "测试施工商家"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	oldTime := now.AddDate(0, 0, -90)
	for i := 0; i < 10; i++ {
		booking := model.Booking{Base: model.Base{ID: uint64(4200 + i), CreatedAt: oldTime, UpdatedAt: oldTime}, ProviderID: provider.ID, Status: 2}
		proposal := model.Proposal{
			Base:        model.Base{ID: uint64(4300 + i), CreatedAt: oldTime, UpdatedAt: oldTime},
			BookingID:   booking.ID,
			DesignerID:  provider.ID,
			Status:      model.ProposalStatusConfirmed,
			SubmittedAt: &oldTime,
			ConfirmedAt: &oldTime,
		}
		project := model.Project{
			Base:           model.Base{ID: uint64(4400 + i), CreatedAt: oldTime, UpdatedAt: oldTime},
			ProviderID:     provider.ID,
			Status:         model.ProjectStatusCompleted,
			BusinessStatus: model.ProjectBusinessStatusCompleted,
		}
		milestone := model.Milestone{
			Base:        model.Base{ID: uint64(4500 + i), CreatedAt: oldTime, UpdatedAt: oldTime},
			ProjectID:   project.ID,
			SubmittedAt: &oldTime,
			AcceptedAt:  &oldTime,
		}
		for _, item := range []any{&booking, &proposal, &project, &milestone} {
			if err := db.Create(item).Error; err != nil {
				t.Fatalf("seed old governance record: %v", err)
			}
		}
	}

	recentTime := now.AddDate(0, 0, -5)
	recentBooking := model.Booking{Base: model.Base{ID: 5001, CreatedAt: recentTime, UpdatedAt: recentTime}, ProviderID: provider.ID, Status: 2}
	recentProposal := model.Proposal{
		Base:        model.Base{ID: 5002, CreatedAt: recentTime, UpdatedAt: recentTime},
		BookingID:   recentBooking.ID,
		DesignerID:  provider.ID,
		Status:      model.ProposalStatusConfirmed,
		SubmittedAt: &recentTime,
		ConfirmedAt: &recentTime,
	}
	recentProject := model.Project{
		Base:           model.Base{ID: 5003, CreatedAt: recentTime, UpdatedAt: recentTime},
		ProviderID:     provider.ID,
		Status:         model.ProjectStatusActive,
		BusinessStatus: model.ProjectBusinessStatusInProgress,
	}
	for _, item := range []any{&recentBooking, &recentProposal, &recentProject} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed recent governance record: %v", err)
		}
	}
	if err := db.Create(&model.Complaint{
		Base:       model.Base{ID: 5004, CreatedAt: recentTime.Add(12 * time.Hour), UpdatedAt: recentTime.Add(12 * time.Hour)},
		ProviderID: provider.ID,
		ProjectID:  recentProject.ID,
		Status:     "pending",
	}).Error; err != nil {
		t.Fatalf("create recent complaint: %v", err)
	}
	if err := db.Create(&model.RefundApplication{
		Base:      model.Base{ID: 5005, CreatedAt: recentTime.Add(12 * time.Hour), UpdatedAt: recentTime.Add(12 * time.Hour)},
		ProjectID: recentProject.ID,
		Status:    model.RefundApplicationStatusPending,
	}).Error; err != nil {
		t.Fatalf("create recent refund application: %v", err)
	}

	summary := (&ProviderGovernanceService{}).BuildSummary(provider.ID)
	if summary == nil {
		t.Fatalf("expected governance summary")
	}
	if diff := math.Abs(summary.ScoreSummary.ComplaintRate - 1); diff > 0.0001 {
		t.Fatalf("expected complaint rate 1.0 from recent window, got %.4f", summary.ScoreSummary.ComplaintRate)
	}
	if diff := math.Abs(summary.ScoreSummary.RefundRate - 1); diff > 0.0001 {
		t.Fatalf("expected refund rate 1.0 from recent window, got %.4f", summary.ScoreSummary.RefundRate)
	}
	if summary.GovernanceTier != "风险观察期" {
		t.Fatalf("expected risk governance tier, got %s", summary.GovernanceTier)
	}
	if len(summary.RiskFlags) == 0 {
		t.Fatalf("expected risk flags to be raised")
	}
}
