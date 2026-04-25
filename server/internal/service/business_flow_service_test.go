package service

import (
	"fmt"
	"testing"
	"time"

	"home-decoration-server/internal/model"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupBusinessFlowSummaryTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:business-flow-summary-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(gormsqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&model.Project{}, &model.BusinessFlow{}); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	bindRepositorySQLiteTestDB(t, db)
	return db
}

func containsAction(actions []string, target string) bool {
	for _, action := range actions {
		if action == target {
			return true
		}
	}
	return false
}

func TestBusinessFlowSummaryReadyToStartRequiresPlannedStartDate(t *testing.T) {
	db := setupBusinessFlowSummaryTestDB(t)
	svc := &BusinessFlowService{}

	projectWithoutPlan := model.Project{
		Base:           model.Base{ID: 701},
		Name:           "未排期项目",
		BusinessStatus: model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:   "待监理协调开工",
	}
	plannedDate := time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC)
	projectWithPlan := model.Project{
		Base:           model.Base{ID: 702},
		Name:           "已排期项目",
		BusinessStatus: model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:   "待监理协调开工",
		EntryStartDate: &plannedDate,
	}
	for _, item := range []any{&projectWithoutPlan, &projectWithPlan} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("seed project: %v", err)
		}
	}

	flowWithoutPlan := &model.BusinessFlow{
		CurrentStage: model.BusinessFlowStageReadyToStart,
		ProjectID:    projectWithoutPlan.ID,
	}
	flowWithPlan := &model.BusinessFlow{
		CurrentStage: model.BusinessFlowStageReadyToStart,
		ProjectID:    projectWithPlan.ID,
	}

	withoutPlanSummary := svc.BuildSummary(flowWithoutPlan)
	if containsAction(withoutPlanSummary.AvailableActions, "start_project") {
		t.Fatalf("expected no start_project action before planned start date")
	}

	withPlanSummary := svc.BuildSummary(flowWithPlan)
	if !containsAction(withPlanSummary.AvailableActions, "start_project") {
		t.Fatalf("expected start_project action after planned start date is set")
	}
}

func TestBusinessFlowProjectFallbackSummaryReadyToStartRequiresPlannedStartDate(t *testing.T) {
	db := setupBusinessFlowSummaryTestDB(t)
	svc := &BusinessFlowService{}

	projectWithoutPlan := &model.Project{
		Base:           model.Base{ID: 801},
		Name:           "fallback未排期项目",
		BusinessStatus: model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:   "待监理协调开工",
	}
	if err := db.Create(projectWithoutPlan).Error; err != nil {
		t.Fatalf("seed fallback project without plan: %v", err)
	}
	summaryWithoutPlan := svc.BuildProjectFallbackSummary(projectWithoutPlan, nil)
	if containsAction(summaryWithoutPlan.AvailableActions, "start_project") {
		t.Fatalf("expected fallback summary to hide start_project when planned start date is missing")
	}

	plannedDate := time.Date(2026, 4, 22, 0, 0, 0, 0, time.UTC)
	projectWithPlan := &model.Project{
		Base:           model.Base{ID: 802},
		Name:           "fallback已排期项目",
		BusinessStatus: model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:   "待监理协调开工",
		EntryStartDate: &plannedDate,
	}
	if err := db.Create(projectWithPlan).Error; err != nil {
		t.Fatalf("seed fallback project with plan: %v", err)
	}
	summaryWithPlan := svc.BuildProjectFallbackSummary(projectWithPlan, nil)
	if !containsAction(summaryWithPlan.AvailableActions, "start_project") {
		t.Fatalf("expected fallback summary to expose start_project after planned start date is set")
	}
}
