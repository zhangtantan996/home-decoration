package service

import (
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupContractServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Project{},
		&model.Demand{},
		&model.DemandMatch{},
		&model.Contract{},
	); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func TestContractServiceCreateContractChecksOwnership(t *testing.T) {
	db := setupContractServiceTestDB(t)

	owner := model.User{Base: model.Base{ID: 3001}, Phone: "13800138301", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 3002}, UserID: 9001, ProviderType: 2, CompanyName: "当前商家"}
	foreignProvider := model.Provider{Base: model.Base{ID: 3003}, UserID: 9002, ProviderType: 2, CompanyName: "其他商家"}
	project := model.Project{Base: model.Base{ID: 3004}, OwnerID: owner.ID, ProviderID: provider.ID, Name: "合同项目", Address: "合同地址"}
	foreignProject := model.Project{Base: model.Base{ID: 3005}, OwnerID: owner.ID, ProviderID: foreignProvider.ID, Name: "外部项目", Address: "外部地址"}
	demand := model.Demand{Base: model.Base{ID: 3006}, UserID: owner.ID, Title: "装修需求", Status: model.DemandStatusMatched}
	match := model.DemandMatch{Base: model.Base{ID: 3007}, DemandID: demand.ID, ProviderID: provider.ID, Status: model.DemandMatchStatusAccepted}
	foreignDemand := model.Demand{Base: model.Base{ID: 3008}, UserID: owner.ID, Title: "他人需求", Status: model.DemandStatusMatched}

	for _, record := range []interface{}{&owner, &provider, &foreignProvider, &project, &foreignProject, &demand, &match, &foreignDemand} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed contract data: %v", err)
		}
	}

	svc := &ContractService{}
	contract, err := svc.CreateContract(provider.ID, &CreateContractInput{
		ProjectID:   project.ID,
		UserID:      999999,
		Title:       "装修合同",
		TotalAmount: 100000,
	})
	if err != nil {
		t.Fatalf("CreateContract project scope: %v", err)
	}
	if contract.UserID != owner.ID {
		t.Fatalf("expected contract user derived from project owner, got %+v", contract)
	}

	if _, err := svc.CreateContract(provider.ID, &CreateContractInput{
		ProjectID:   foreignProject.ID,
		Title:       "越权项目合同",
		TotalAmount: 8888,
	}); err == nil || !strings.Contains(err.Error(), "无权") {
		t.Fatalf("expected foreign project contract failure, got %v", err)
	}

	if _, err := svc.CreateContract(provider.ID, &CreateContractInput{
		DemandID:    demand.ID,
		UserID:      owner.ID,
		Title:       "需求合同",
		TotalAmount: 9999,
	}); err != nil {
		t.Fatalf("CreateContract demand scope: %v", err)
	}

	if _, err := svc.CreateContract(provider.ID, &CreateContractInput{
		DemandID:    foreignDemand.ID,
		Title:       "越权需求合同",
		TotalAmount: 6666,
	}); err == nil || !strings.Contains(err.Error(), "无权") {
		t.Fatalf("expected foreign demand contract failure, got %v", err)
	}
}
