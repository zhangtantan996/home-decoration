package service

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
	"unicode/utf16"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupQuoteServiceDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.Provider{},
		&model.QuoteLibraryItem{},
		&model.QuoteList{},
		&model.QuoteListItem{},
		&model.QuoteInvitation{},
		&model.QuoteSubmission{},
		&model.QuoteSubmissionItem{},
	); err != nil {
		t.Fatalf("auto migrate quote models: %v", err)
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

func TestImportQuoteLibraryFromERP_IsIdempotent(t *testing.T) {
	setupQuoteServiceDB(t)
	svc := &QuoteService{}

	dir := t.TempDir()
	filePath := filepath.Join(dir, "erp报价.xls")
	content := encodeUTF16LE("项目名称", "单位", "墙体拆除-砖墙120mm", "贴墙砖300≤长边长≤600铺贴费")
	if err := os.WriteFile(filePath, content, 0o644); err != nil {
		t.Fatalf("write test erp file: %v", err)
	}

	first, err := svc.ImportQuoteLibraryFromERP(filePath)
	if err != nil {
		t.Fatalf("first import: %v", err)
	}
	if first.Imported == 0 {
		t.Fatalf("expected imported items on first import")
	}

	second, err := svc.ImportQuoteLibraryFromERP(filePath)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}
	if second.Imported != 0 {
		t.Fatalf("expected no fresh imports on second import, got %d", second.Imported)
	}
	if second.Updated == 0 {
		t.Fatalf("expected updated items on second import")
	}

	var count int64
	if err := repository.DB.Model(&model.QuoteLibraryItem{}).Count(&count).Error; err != nil {
		t.Fatalf("count quote library items: %v", err)
	}
	if count != int64(first.Imported) {
		t.Fatalf("unexpected quote library item count: got=%d want=%d", count, first.Imported)
	}
}

func encodeUTF16LE(parts ...string) []byte {
	joined := ""
	for _, part := range parts {
		joined += part + " "
	}
	encoded := utf16.Encode([]rune(joined))
	buf := make([]byte, 0, len(encoded)*2)
	for _, value := range encoded {
		tmp := make([]byte, 2)
		binary.LittleEndian.PutUint16(tmp, value)
		buf = append(buf, tmp...)
	}
	return buf
}

func TestSaveMerchantSubmission_ComputesTotalCent(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	provider := model.Provider{ProviderType: 2, SubType: "company", CompanyName: "测试施工队"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "测试清单", Status: model.QuoteListStatusQuoting, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	items := []model.QuoteListItem{
		{QuoteListID: quoteList.ID, Name: "墙地面防水", Unit: "㎡", Quantity: 10, CategoryL1: "防水"},
		{QuoteListID: quoteList.ID, Name: "贴墙砖", Unit: "㎡", Quantity: 5, CategoryL1: "泥瓦"},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("create quote list items: %v", err)
	}
	invitation := model.QuoteInvitation{QuoteListID: quoteList.ID, ProviderID: provider.ID, Status: model.QuoteInvitationStatusInvited}
	if err := db.Create(&invitation).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	submission, err := svc.SaveMerchantSubmission(quoteList.ID, provider.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{
			{QuoteListItemID: items[0].ID, UnitPriceCent: 1200},
			{QuoteListItemID: items[1].ID, UnitPriceCent: 2300},
		},
	}, true)
	if err != nil {
		t.Fatalf("save merchant submission: %v", err)
	}

	expected := int64(10*1200 + 5*2300)
	if submission.TotalCent != expected {
		t.Fatalf("unexpected total cent: got=%d want=%d", submission.TotalCent, expected)
	}

	var storedInvitation model.QuoteInvitation
	if err := db.Where("quote_list_id = ? AND provider_id = ?", quoteList.ID, provider.ID).First(&storedInvitation).Error; err != nil {
		t.Fatalf("query invitation: %v", err)
	}
	if storedInvitation.Status != model.QuoteInvitationStatusQuoted {
		t.Fatalf("unexpected invitation status: %s", storedInvitation.Status)
	}
}

func TestBatchUpsertQuoteListItems_BlockedAfterQuoting(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	quoteList := model.QuoteList{Title: "测试清单", Status: model.QuoteListStatusQuoting, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}

	_, err := svc.BatchUpsertQuoteListItems(quoteList.ID, []QuoteListItemUpsertInput{{
		Name:     "墙地面防水",
		Unit:     "㎡",
		Quantity: 8,
	}})
	if err == nil {
		t.Fatalf("expected editing items to be blocked after quoting")
	}
}

func TestAwardQuote_BlocksFurtherSubmissionUpdates(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	provider := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长队伍"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "测试清单", Status: model.QuoteListStatusQuoting, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	item := model.QuoteListItem{QuoteListID: quoteList.ID, Name: "墙地面防水", Unit: "㎡", Quantity: 10, CategoryL1: "防水"}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}
	invitation := model.QuoteInvitation{QuoteListID: quoteList.ID, ProviderID: provider.ID, Status: model.QuoteInvitationStatusInvited}
	if err := db.Create(&invitation).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	submission, err := svc.SaveMerchantSubmission(quoteList.ID, provider.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{{QuoteListItemID: item.ID, UnitPriceCent: 3000}},
	}, true)
	if err != nil {
		t.Fatalf("submit quote: %v", err)
	}

	if _, err := svc.AwardQuote(quoteList.ID, submission.ID); err != nil {
		t.Fatalf("award quote: %v", err)
	}

	_, err = svc.SaveMerchantSubmission(quoteList.ID, provider.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{{QuoteListItemID: item.ID, UnitPriceCent: 3600}},
	}, false)
	if err == nil {
		t.Fatalf("expected awarded quote list to reject further submission updates")
	}
}

func TestQuoteFlow_AdminToMerchantToAward(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	company := model.Provider{ProviderType: 2, SubType: "company", CompanyName: "装修公司A"}
	foreman := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长B"}
	if err := db.Create(&company).Error; err != nil {
		t.Fatalf("create company: %v", err)
	}
	if err := db.Create(&foreman).Error; err != nil {
		t.Fatalf("create foreman: %v", err)
	}

	quoteList, err := svc.CreateQuoteList(&QuoteListCreateInput{
		ProjectID:    101,
		CustomerID:   201,
		HouseID:      301,
		OwnerUserID:  401,
		ScenarioType: "plan_a",
		Title:        "方案A基础施工清单",
	})
	if err != nil {
		t.Fatalf("create quote list: %v", err)
	}

	items, err := svc.BatchUpsertQuoteListItems(quoteList.ID, []QuoteListItemUpsertInput{
		{Name: "墙地面防水", Unit: "㎡", Quantity: 12, CategoryL1: "防水", SortOrder: 1},
		{Name: "贴墙砖", Unit: "㎡", Quantity: 20, CategoryL1: "泥瓦", SortOrder: 2},
	})
	if err != nil {
		t.Fatalf("batch upsert quote list items: %v", err)
	}

	if _, err := svc.InviteProviders(quoteList.ID, 9001, []uint64{company.ID, foreman.ID}); err != nil {
		t.Fatalf("invite providers: %v", err)
	}
	if _, err := svc.StartQuoteList(quoteList.ID); err != nil {
		t.Fatalf("start quote list: %v", err)
	}

	if _, err := svc.SaveMerchantSubmission(quoteList.ID, company.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{
			{QuoteListItemID: items[0].ID, UnitPriceCent: 1500},
			{QuoteListItemID: items[1].ID, UnitPriceCent: 2300},
		},
	}, true); err != nil {
		t.Fatalf("company submit quote: %v", err)
	}

	if _, err := svc.SaveMerchantSubmission(quoteList.ID, foreman.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{
			{QuoteListItemID: items[0].ID, UnitPriceCent: 1600},
			{QuoteListItemID: items[1].ID, UnitPriceCent: 2500},
		},
	}, true); err != nil {
		t.Fatalf("foreman submit quote: %v", err)
	}

	comparison, err := svc.GetQuoteComparison(quoteList.ID)
	if err != nil {
		t.Fatalf("get quote comparison: %v", err)
	}
	if len(comparison.Submissions) != 2 {
		t.Fatalf("unexpected submission count: got=%d want=2", len(comparison.Submissions))
	}

	awarded, err := svc.AwardQuote(quoteList.ID, comparison.Submissions[0].SubmissionID)
	if err != nil {
		t.Fatalf("award quote: %v", err)
	}
	if awarded.Status != model.QuoteListStatusAwarded {
		t.Fatalf("unexpected awarded status: %s", awarded.Status)
	}
	if awarded.AwardedQuoteSubmissionID == 0 || awarded.AwardedProviderID == 0 {
		t.Fatalf("award info should be persisted: %+v", awarded)
	}
}
