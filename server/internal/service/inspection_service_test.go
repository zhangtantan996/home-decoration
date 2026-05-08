package service

import (
	"strings"
	"testing"

	"home-decoration-server/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type inspectionServiceFixture struct {
	ownerID        uint64
	providerUserID uint64
	providerID     uint64
	outsiderID     uint64
	project        model.Project
	milestone      model.Milestone
}

func setupInspectionServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Project{},
		&model.Milestone{},
		&model.InspectionChecklist{},
	); err != nil {
		t.Fatalf("auto migrate inspection models: %v", err)
	}

	bindRepositorySQLiteTestDB(t, db)
	return db
}

func seedInspectionServiceFixture(t *testing.T, db *gorm.DB) inspectionServiceFixture {
	t.Helper()

	fixture := inspectionServiceFixture{
		ownerID:        7101,
		providerUserID: 7202,
		providerID:     7303,
		outsiderID:     7404,
	}

	users := []model.User{
		{Base: model.Base{ID: fixture.ownerID}, Phone: "13800007101", Nickname: "owner", Status: 1},
		{Base: model.Base{ID: fixture.providerUserID}, Phone: "13800007202", Nickname: "provider-user", Status: 1},
		{Base: model.Base{ID: fixture.outsiderID}, Phone: "13800007404", Nickname: "outsider", Status: 1},
	}
	for _, user := range users {
		if err := db.Create(&user).Error; err != nil {
			t.Fatalf("seed user %d: %v", user.ID, err)
		}
	}

	fixture.project = model.Project{
		Base:       model.Base{ID: 7505},
		OwnerID:    fixture.ownerID,
		ProviderID: fixture.providerID,
		Name:       "inspection service project",
		Status:     model.ProjectStatusActive,
	}
	if err := db.Create(&fixture.project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}

	fixture.milestone = model.Milestone{
		Base:      model.Base{ID: 7606},
		ProjectID: fixture.project.ID,
		Name:      "水电验收",
		Seq:       1,
		Amount:    1000,
		Status:    model.MilestoneStatusInProgress,
	}
	if err := db.Create(&fixture.milestone).Error; err != nil {
		t.Fatalf("seed milestone: %v", err)
	}

	return fixture
}

func TestCreateInspectionChecklist_AllowsProviderScopeWithDistinctUserAndProviderIDs(t *testing.T) {
	db := setupInspectionServiceTestDB(t)
	fixture := seedInspectionServiceFixture(t, db)

	svc := &InspectionService{}
	checklist, err := svc.CreateInspectionChecklist(
		fixture.project.ID,
		fixture.milestone.ID,
		fixture.providerUserID,
		fixture.providerID,
		"水电",
		[]model.InspectionItem{{Name: "线管", Required: true, Passed: true}},
	)
	if err != nil {
		t.Fatalf("expected provider-scoped create success, got %v", err)
	}
	if checklist == nil {
		t.Fatal("expected checklist to be created")
	}
	if checklist.SubmittedBy != fixture.providerID {
		t.Fatalf("expected provider-scoped create submittedBy=%d, got %d", fixture.providerID, checklist.SubmittedBy)
	}

	loaded, err := svc.GetInspectionChecklist(fixture.project.ID, fixture.milestone.ID, fixture.ownerID, 0)
	if err != nil {
		t.Fatalf("expected owner to read checklist, got %v", err)
	}
	if loaded.ID != checklist.ID {
		t.Fatalf("expected owner to read checklist %d, got %d", checklist.ID, loaded.ID)
	}
}

func TestCreateInspectionChecklist_RejectsUnrelatedUser(t *testing.T) {
	db := setupInspectionServiceTestDB(t)
	fixture := seedInspectionServiceFixture(t, db)

	svc := &InspectionService{}
	_, err := svc.CreateInspectionChecklist(
		fixture.project.ID,
		fixture.milestone.ID,
		fixture.outsiderID,
		0,
		"水电",
		[]model.InspectionItem{{Name: "线管", Required: true, Passed: true}},
	)
	if err == nil || !strings.Contains(err.Error(), "无权") {
		t.Fatalf("expected unrelated user create to be denied, got %v", err)
	}
}

func TestInspectionChecklistGetUpdate_RequireProjectOwnership(t *testing.T) {
	db := setupInspectionServiceTestDB(t)
	fixture := seedInspectionServiceFixture(t, db)

	checklist := model.InspectionChecklist{
		Base:        model.Base{ID: 7707},
		MilestoneID: fixture.milestone.ID,
		ProjectID:   fixture.project.ID,
		Category:    "水电",
		Items:       `[{"name":"线管","required":true,"passed":false,"note":""}]`,
		Status:      "pending",
		SubmittedBy: fixture.providerID,
	}
	if err := db.Create(&checklist).Error; err != nil {
		t.Fatalf("seed checklist: %v", err)
	}

	svc := &InspectionService{}
	if _, err := svc.GetInspectionChecklist(fixture.project.ID, fixture.milestone.ID, fixture.outsiderID, 0); err == nil || !strings.Contains(err.Error(), "无权") {
		t.Fatalf("expected outsider get to be denied, got %v", err)
	}

	if _, err := svc.UpdateInspectionChecklist(
		checklist.ID,
		fixture.outsiderID,
		0,
		[]model.InspectionItem{{Name: "线管", Required: true, Passed: true}},
		"越权修改",
	); err == nil || !strings.Contains(err.Error(), "无权") {
		t.Fatalf("expected outsider update to be denied, got %v", err)
	}

	updated, err := svc.UpdateInspectionChecklist(
		checklist.ID,
		fixture.ownerID,
		0,
		[]model.InspectionItem{{Name: "线管", Required: true, Passed: true}},
		"业主确认",
	)
	if err != nil {
		t.Fatalf("expected owner update success, got %v", err)
	}
	if updated.Status != "passed" {
		t.Fatalf("expected owner update to mark checklist passed, got %s", updated.Status)
	}
}

func TestUpdateInspectionChecklist_ProviderCannotReviewOwnChecklist(t *testing.T) {
	db := setupInspectionServiceTestDB(t)
	fixture := seedInspectionServiceFixture(t, db)

	checklist := model.InspectionChecklist{
		Base:        model.Base{ID: 7808},
		MilestoneID: fixture.milestone.ID,
		ProjectID:   fixture.project.ID,
		Category:    "水电",
		Items:       `[{"name":"线管","required":true,"passed":false,"note":""}]`,
		Status:      "pending",
		SubmittedBy: fixture.providerID,
	}
	if err := db.Create(&checklist).Error; err != nil {
		t.Fatalf("seed checklist: %v", err)
	}

	svc := &InspectionService{}
	updated, err := svc.UpdateInspectionChecklist(
		checklist.ID,
		fixture.providerUserID,
		fixture.providerID,
		[]model.InspectionItem{{Name: "线管", Required: true, Passed: true}},
		"商家补充资料",
	)
	if err != nil {
		t.Fatalf("expected provider update success, got %v", err)
	}
	if updated.Status != "pending" {
		t.Fatalf("expected provider update to keep pending status, got %s", updated.Status)
	}
	if updated.ReviewedBy != 0 {
		t.Fatalf("expected provider update not to set reviewedBy, got %d", updated.ReviewedBy)
	}
	if updated.ReviewedAt != nil {
		t.Fatalf("expected provider update not to set reviewedAt")
	}
	if updated.Notes != "商家补充资料" {
		t.Fatalf("expected provider notes persisted, got %s", updated.Notes)
	}
}
