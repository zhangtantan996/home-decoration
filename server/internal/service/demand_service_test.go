package service

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupDemandServiceDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Demand{},
		&model.DemandMatch{},
		&model.Proposal{},
		&model.BusinessFlow{},
		&model.Notification{},
	); err != nil {
		t.Fatalf("migrate sqlite db: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		_ = sqlDB.Close()
	})

	return db
}

func seedDemandScenario(t *testing.T, db *gorm.DB) (user model.User, providerUser model.User, provider model.Provider, demand model.Demand, match model.DemandMatch) {
	t.Helper()

	user = model.User{Base: model.Base{ID: 1}, Phone: "13800138000", Nickname: "业主A", Status: 1}
	providerUser = model.User{Base: model.Base{ID: 2}, Phone: "13900139000", Nickname: "设计师A", Status: 1}
	provider = model.Provider{Base: model.Base{ID: 11}, UserID: providerUser.ID, ProviderType: 1, CompanyName: "设计师A", Verified: true, Rating: 4.8, CompletedCnt: 12, Status: 1}
	demand = model.Demand{
		Base:        model.Base{ID: 21},
		UserID:      user.ID,
		DemandType:  model.DemandTypeRenovation,
		Title:       "老房翻新",
		City:        "西安",
		District:    "雁塔区",
		Address:     "科技路 88 号",
		Area:        98,
		BudgetMin:   100000,
		BudgetMax:   180000,
		Timeline:    "3month",
		Description: "需要重做收纳与动线",
		Status:      model.DemandStatusApproved,
		MaxMatch:    3,
	}
	match = model.DemandMatch{Base: model.Base{ID: 31}, DemandID: demand.ID, ProviderID: provider.ID, Status: model.DemandMatchStatusAccepted}

	for _, record := range []interface{}{&user, &providerUser, &provider, &demand, &match} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	return
}

func TestDemandServiceAssignAndAcceptLead(t *testing.T) {
	db := setupDemandServiceDB(t)

	user := model.User{Base: model.Base{ID: 7}, Phone: "13800138001", Nickname: "业主B", Status: 1}
	admin := model.SysAdmin{}
	providerUser := model.User{Base: model.Base{ID: 8}, Phone: "13900139001", Nickname: "商家B", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 18}, UserID: providerUser.ID, ProviderType: 2, CompanyName: "整装公司", Verified: true, Rating: 4.6, CompletedCnt: 6, Status: 1, ServiceArea: `["雁塔区"]`}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Create(&providerUser).Error; err != nil {
		t.Fatalf("create provider user: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	svc := NewDemandService()
	created, err := svc.CreateDemand(user.ID, &UpsertDemandInput{
		DemandType:  model.DemandTypeRenovation,
		Title:       "测试需求",
		City:        "西安",
		District:    "雁塔区",
		Address:     "科技路 18 号",
		Area:        88,
		BudgetMin:   80000,
		BudgetMax:   160000,
		Timeline:    "1month",
		Description: "需要尽快开工",
	})
	if err != nil {
		t.Fatalf("create demand: %v", err)
	}

	if _, err := svc.SubmitDemand(user.ID, created.ID); err != nil {
		t.Fatalf("submit demand: %v", err)
	}

	if _, err := svc.ReviewDemand(admin.ID, created.ID, &ReviewDemandInput{Action: "approve", Note: "信息完整"}); err != nil {
		t.Fatalf("review demand: %v", err)
	}

	matches, err := svc.AssignDemand(100, created.ID, &AssignDemandInput{
		ProviderIDs:           []uint64{provider.ID},
		ResponseDeadlineHours: 48,
	})
	if err != nil {
		t.Fatalf("assign demand: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(matches))
	}

	accepted, err := svc.AcceptLead(provider.ID, matches[0].ID)
	if err != nil {
		t.Fatalf("accept lead: %v", err)
	}
	if accepted.Status != model.DemandMatchStatusAccepted {
		t.Fatalf("expected accepted lead, got %s", accepted.Status)
	}

	detail, err := svc.GetDemandDetailForUser(user.ID, created.ID)
	if err != nil {
		t.Fatalf("get demand detail: %v", err)
	}
	if detail.Status != model.DemandStatusMatched {
		t.Fatalf("expected demand status matched after accepting lead, got %s", detail.Status)
	}
}

func TestProposalServiceSubmitProposal_DemandSource(t *testing.T) {
	db := setupDemandServiceDB(t)
	_, _, provider, demand, match := seedDemandScenario(t, db)

	svc := &ProposalService{}
	proposal, err := svc.SubmitProposal(provider.ID, &SubmitProposalInput{
		SourceType:      model.ProposalSourceDemand,
		DemandMatchID:   match.ID,
		Summary:         "需求来源方案",
		DesignFee:       5000,
		ConstructionFee: 120000,
		MaterialFee:     30000,
		EstimatedDays:   75,
		Attachments:     `["https://example.com/a.pdf"]`,
	})
	if err != nil {
		t.Fatalf("submit demand proposal: %v", err)
	}
	if proposal.SourceType != model.ProposalSourceDemand {
		t.Fatalf("expected proposal source demand, got %s", proposal.SourceType)
	}
	if proposal.DemandID != demand.ID || proposal.DemandMatchID != match.ID {
		t.Fatalf("unexpected demand source linkage: %+v", proposal)
	}

	var storedMatch model.DemandMatch
	if err := db.First(&storedMatch, match.ID).Error; err != nil {
		t.Fatalf("reload match: %v", err)
	}
	if storedMatch.Status != model.DemandMatchStatusQuoted {
		t.Fatalf("expected quoted match status, got %s", storedMatch.Status)
	}
	if storedMatch.ProposalID == 0 {
		t.Fatalf("expected proposal id to be attached to demand match")
	}
}

func TestProposalServiceSubmitProposal_BookingSourceRegression(t *testing.T) {
	db := setupDemandServiceDB(t)

	user := model.User{Base: model.Base{ID: 101}, Phone: "13800138101", Nickname: "业主C", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 102}, Phone: "13900139102", Nickname: "设计师C", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 111}, UserID: providerUser.ID, ProviderType: 1, CompanyName: "设计师C", Verified: true, Rating: 4.9, Status: 1}
	booking := model.Booking{Base: model.Base{ID: 121}, UserID: user.ID, ProviderID: provider.ID, Address: "高新一路", Area: 120, BudgetRange: "20-30万", Status: 2}

	for _, record := range []interface{}{&user, &providerUser, &provider, &booking} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	svc := &ProposalService{}
	proposal, err := svc.SubmitProposal(provider.ID, &SubmitProposalInput{
		BookingID:       booking.ID,
		Summary:         "预约来源方案",
		DesignFee:       8000,
		ConstructionFee: 160000,
		MaterialFee:     40000,
		EstimatedDays:   90,
	})
	if err != nil {
		t.Fatalf("submit booking proposal: %v", err)
	}
	if proposal.SourceType != model.ProposalSourceBooking {
		t.Fatalf("expected booking source, got %s", proposal.SourceType)
	}
	if proposal.BookingID != booking.ID {
		t.Fatalf("expected booking id %d, got %d", booking.ID, proposal.BookingID)
	}
}
