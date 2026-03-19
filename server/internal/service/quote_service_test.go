package service

import (
	"path/filepath"
	"strings"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"github.com/xuri/excelize/v2"
)

func setupQuoteServiceDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.Notification{},
		&model.AuditLog{},
		&model.Provider{},
		&model.Project{},
		&model.BusinessFlow{},
		&model.MerchantServiceSetting{},
		&model.QuoteCategory{},
		&model.QuoteLibraryItem{},
		&model.QuoteList{},
		&model.QuoteListItem{},
		&model.QuoteInvitation{},
		&model.QuoteSubmission{},
		&model.QuoteSubmissionItem{},
		&model.QuoteSubmissionRevision{},
		&model.QuotePriceBook{},
		&model.QuotePriceBookItem{},
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
	filePath := filepath.Join(dir, "erp报价.xlsx")

	workbook := excelize.NewFile()
	sheetName := workbook.GetSheetName(0)
	rows := [][]interface{}{
		{"序号", "项目名称", "工程量", "单位", "综合价", "备注"},
		{"1", "墙体拆除-砖墙120mm", 1, "项", 88.5, ""},
		{"2", "贴墙砖300≤长边长≤600铺贴费", 1, "㎡", 168.0, "按标准工艺"},
	}
	for index, row := range rows {
		cell, err := excelize.CoordinatesToCellName(1, index+1)
		if err != nil {
			t.Fatalf("cell name for row %d: %v", index, err)
		}
		if err := workbook.SetSheetRow(sheetName, cell, &row); err != nil {
			t.Fatalf("set sheet row %d: %v", index, err)
		}
	}
	if err := workbook.SaveAs(filePath); err != nil {
		t.Fatalf("save test erp workbook: %v", err)
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

func TestListQuoteLibraryItems_SearchIsCaseInsensitiveAndMatchesCodes(t *testing.T) {
	setupQuoteServiceDB(t)
	svc := &QuoteService{}

	item := model.QuoteLibraryItem{
		StandardCode: "STD-PW-62",
		ERPItemCode:  "ERP-PW62",
		Name:         "包暖气立管石膏板",
		Unit:         "m",
		CategoryL1:   "包管",
		CategoryL2:   "暖气管",
		Status:       model.QuoteLibraryItemStatusEnabled,
	}
	if err := repository.DB.Create(&item).Error; err != nil {
		t.Fatalf("create quote library item: %v", err)
	}

	result, err := svc.ListQuoteLibraryItems(1, 20, "pw-62", "", 0, nil)
	if err != nil {
		t.Fatalf("list quote library items by code keyword: %v", err)
	}
	if result.Total != 1 || len(result.List) != 1 {
		t.Fatalf("expected case-insensitive code match, total=%d len=%d", result.Total, len(result.List))
	}

	result, err = svc.ListQuoteLibraryItems(1, 20, "erp-pw62", "", 0, nil)
	if err != nil {
		t.Fatalf("list quote library items by erp keyword: %v", err)
	}
	if result.Total != 1 || len(result.List) != 1 {
		t.Fatalf("expected case-insensitive erp match, total=%d len=%d", result.Total, len(result.List))
	}
}

func TestCreateQuoteLibraryItem_AutoFillsMetadataWhenOmitted(t *testing.T) {
	setupQuoteServiceDB(t)
	svc := &QuoteService{}

	category := model.QuoteCategory{
		Code:      "PLUMBING_ELECTRIC",
		Name:      "水电",
		SortOrder: 1,
		Status:    model.QuoteLibraryItemStatusEnabled,
	}
	if err := repository.DB.Create(&category).Error; err != nil {
		t.Fatalf("create quote category: %v", err)
	}

	item, err := svc.CreateQuoteLibraryItem(&QuoteLibraryItemWriteInput{
		CategoryID:         category.ID,
		Name:               "电路开槽布管",
		Unit:               "m",
		ReferencePriceCent: 0,
		Required:           true,
		Status:             model.QuoteLibraryItemStatusEnabled,
		Keywords:           []string{"电路", "开槽"},
	})
	if err != nil {
		t.Fatalf("create quote library item: %v", err)
	}

	if strings.TrimSpace(item.ERPMappingJSON) == "" || item.ERPMappingJSON == "null" {
		t.Fatalf("expected erp mapping json to be auto generated, got %q", item.ERPMappingJSON)
	}
	if strings.TrimSpace(item.SourceMetaJSON) == "" || item.SourceMetaJSON == "null" {
		t.Fatalf("expected source meta json to be auto generated, got %q", item.SourceMetaJSON)
	}
	if !strings.Contains(item.SourceMetaJSON, "admin_manual") {
		t.Fatalf("expected source meta to mark admin manual source, got %q", item.SourceMetaJSON)
	}
	if !strings.Contains(item.ERPMappingJSON, "电路开槽布管") {
		t.Fatalf("expected erp mapping to include item name, got %q", item.ERPMappingJSON)
	}
}

func TestListQuoteLibraryItems_FilterByRootAndLeafCategoryID(t *testing.T) {
	setupQuoteServiceDB(t)
	svc := &QuoteService{}

	root := model.QuoteCategory{Code: "MASONRY", Name: "泥瓦", ParentID: 0, SortOrder: 1, Status: 1}
	if err := repository.DB.Create(&root).Error; err != nil {
		t.Fatalf("create root category: %v", err)
	}
	wallTile := model.QuoteCategory{Code: "MASONRY_WALL_TILE", Name: "墙砖铺贴", ParentID: root.ID, SortOrder: 1, Status: 1}
	floorTile := model.QuoteCategory{Code: "MASONRY_FLOOR_TILE", Name: "地砖铺贴", ParentID: root.ID, SortOrder: 2, Status: 1}
	if err := repository.DB.Create(&wallTile).Error; err != nil {
		t.Fatalf("create wall tile category: %v", err)
	}
	if err := repository.DB.Create(&floorTile).Error; err != nil {
		t.Fatalf("create floor tile category: %v", err)
	}

	items := []model.QuoteLibraryItem{
		{CategoryID: wallTile.ID, CategoryL1: "泥瓦", CategoryL2: "墙砖铺贴", StandardCode: "STD-MW-0001", ERPItemCode: "ERP-MW0001", Name: "墙砖铺贴A", Unit: "㎡", Status: 1},
		{CategoryID: floorTile.ID, CategoryL1: "泥瓦", CategoryL2: "地砖铺贴", StandardCode: "STD-MF-0002", ERPItemCode: "ERP-MF0002", Name: "地砖铺贴B", Unit: "㎡", Status: 1},
	}
	if err := repository.DB.Create(&items).Error; err != nil {
		t.Fatalf("create quote library items: %v", err)
	}

	rootResult, err := svc.ListQuoteLibraryItems(1, 20, "", "", root.ID, nil)
	if err != nil {
		t.Fatalf("list quote library items by root id: %v", err)
	}
	if rootResult.Total != 2 || len(rootResult.List) != 2 {
		t.Fatalf("expected root category to include all child items, total=%d len=%d", rootResult.Total, len(rootResult.List))
	}

	leafResult, err := svc.ListQuoteLibraryItems(1, 20, "", "", wallTile.ID, nil)
	if err != nil {
		t.Fatalf("list quote library items by leaf id: %v", err)
	}
	if leafResult.Total != 1 || len(leafResult.List) != 1 || leafResult.List[0].CategoryID != wallTile.ID {
		t.Fatalf("expected leaf category to include only matching item, total=%d len=%d", leafResult.Total, len(leafResult.List))
	}
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

func TestSaveMerchantSubmission_AllowsEditDuringPricingInProgressAndCreatesRevision(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	provider := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长测试"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "报价任务", Status: model.QuoteListStatusPricingInProgress, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	item := model.QuoteListItem{
		QuoteListID:    quoteList.ID,
		Name:           "水电开槽",
		Unit:           "m",
		Quantity:       12,
		CategoryL1:     "水电",
		ExtensionsJSON: `{"required":true}`,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create quote list item: %v", err)
	}
	invitation := model.QuoteInvitation{QuoteListID: quoteList.ID, ProviderID: provider.ID, Status: model.QuoteInvitationStatusQuoted}
	if err := db.Create(&invitation).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}
	submission := model.QuoteSubmission{
		QuoteListID:     quoteList.ID,
		ProviderID:      provider.ID,
		ProviderType:    provider.ProviderType,
		ProviderSubType: provider.SubType,
		Status:          model.QuoteSubmissionStatusSubmitted,
		Currency:        "CNY",
		TotalCent:       10000,
	}
	if err := db.Create(&submission).Error; err != nil {
		t.Fatalf("create submission: %v", err)
	}
	if err := db.Create(&model.QuoteSubmissionItem{
		QuoteSubmissionID: submission.ID,
		QuoteListItemID:   item.ID,
		UnitPriceCent:     800,
		AmountCent:        9600,
	}).Error; err != nil {
		t.Fatalf("create submission item: %v", err)
	}

	saved, err := svc.SaveMerchantSubmission(quoteList.ID, provider.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{{
			QuoteListItemID: item.ID,
			UnitPriceCent:   900,
			Remark:          "现场调整后重算",
		}},
		Remark: "重新测量后修正",
	}, false)
	if err != nil {
		t.Fatalf("save merchant submission during pricing in progress: %v", err)
	}
	if saved.Status != model.QuoteSubmissionStatusMerchantReviewing {
		t.Fatalf("expected submission status merchant_reviewing, got %s", saved.Status)
	}

	var revisions []model.QuoteSubmissionRevision
	if err := db.Where("quote_submission_id = ?", submission.ID).Order("revision_no ASC").Find(&revisions).Error; err != nil {
		t.Fatalf("query submission revisions: %v", err)
	}
	if len(revisions) != 1 {
		t.Fatalf("expected 1 revision, got %d", len(revisions))
	}
	if revisions[0].PreviousStatus != model.QuoteSubmissionStatusSubmitted || revisions[0].NextStatus != model.QuoteSubmissionStatusMerchantReviewing {
		t.Fatalf("unexpected revision status flow: %+v", revisions[0])
	}
	if revisions[0].PreviousTotalCent != 10000 || revisions[0].NextTotalCent <= 0 {
		t.Fatalf("unexpected revision totals: %+v", revisions[0])
	}
}

func TestSaveMerchantSubmission_BlockedAfterSubmittedToUser(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	provider := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长测试"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "报价任务", Status: model.QuoteListStatusSubmittedToUser, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	item := model.QuoteListItem{QuoteListID: quoteList.ID, Name: "水电开槽", Unit: "m", Quantity: 12, CategoryL1: "水电"}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}
	invitation := model.QuoteInvitation{QuoteListID: quoteList.ID, ProviderID: provider.ID, Status: model.QuoteInvitationStatusQuoted}
	if err := db.Create(&invitation).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	_, err := svc.SaveMerchantSubmission(quoteList.ID, provider.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{{
			QuoteListItemID: item.ID,
			UnitPriceCent:   1000,
		}},
	}, false)
	if err == nil {
		t.Fatalf("expected save to be blocked after submitted_to_user")
	}
	if !strings.Contains(err.Error(), "联系平台发起重报价") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestListQuoteSubmissionRevisions_ReturnsStructuredHistory(t *testing.T) {
	setupQuoteServiceDB(t)
	svc := &QuoteService{}

	submission := model.QuoteSubmission{QuoteListID: 11, ProviderID: 22, Status: model.QuoteSubmissionStatusSubmitted, Currency: "CNY"}
	if err := repository.DB.Create(&submission).Error; err != nil {
		t.Fatalf("create submission: %v", err)
	}
	revision := model.QuoteSubmissionRevision{
		QuoteSubmissionID: submission.ID,
		QuoteListID:       11,
		ProviderID:        22,
		RevisionNo:        1,
		Action:            "submit",
		PreviousStatus:    "draft",
		NextStatus:        "submitted",
		PreviousTotalCent: 120000,
		NextTotalCent:     135000,
		PreviousItemsJSON: `[{"quoteListItemId":1,"unitPriceCent":10000,"amountCent":120000}]`,
		NextItemsJSON:     `[{"quoteListItemId":1,"unitPriceCent":11250,"amountCent":135000,"remark":"涨价"}]`,
		ChangeReason:      "现场复尺后调整",
	}
	if err := repository.DB.Create(&revision).Error; err != nil {
		t.Fatalf("create revision: %v", err)
	}

	rows, err := svc.ListQuoteSubmissionRevisions(submission.ID)
	if err != nil {
		t.Fatalf("list revisions: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 revision, got %d", len(rows))
	}
	if rows[0].Action != "submit" || len(rows[0].PreviousItems) != 1 || len(rows[0].NextItems) != 1 {
		t.Fatalf("unexpected revision payload: %+v", rows[0])
	}
	if rows[0].NextItems[0].Remark != "涨价" {
		t.Fatalf("expected parsed next item remark, got %+v", rows[0].NextItems[0])
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

func TestQuotePriceBookPublish_AndRecommendForemen(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	category := model.QuoteCategory{Code: "WATERPROOF", Name: "防水", Status: 1}
	if err := db.Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	libraryItem := model.QuoteLibraryItem{
		CategoryID:   category.ID,
		StandardCode: "STD-WP-001",
		ERPItemCode:  "ERP-WP-001",
		Name:         "墙地面防水",
		Unit:         "㎡",
		CategoryL1:   "防水",
		Status:       1,
	}
	if err := db.Create(&libraryItem).Error; err != nil {
		t.Fatalf("create library item: %v", err)
	}

	foreman := model.Provider{
		ProviderType: 3,
		SubType:      "foreman",
		CompanyName:  "工长价格库A",
		Status:       1,
		WorkTypes:    "waterproof,mason",
		ServiceArea:  `["浦东新区"]`,
	}
	if err := db.Create(&foreman).Error; err != nil {
		t.Fatalf("create foreman: %v", err)
	}
	if err := db.Create(&model.MerchantServiceSetting{ProviderID: foreman.ID, AcceptBooking: true}).Error; err != nil {
		t.Fatalf("create merchant setting: %v", err)
	}

	if _, err := svc.UpsertProviderPriceBook(foreman.ID, &QuotePriceBookUpdateInput{
		Remark: "工长价格库",
		Items: []QuotePriceBookItemInput{{
			StandardItemID: libraryItem.ID,
			Unit:           "㎡",
			UnitPriceCent:  2300,
			MinChargeCent:  10000,
			Status:         1,
		}},
	}); err != nil {
		t.Fatalf("upsert price book: %v", err)
	}
	detail, err := svc.PublishProviderPriceBook(foreman.ID)
	if err != nil {
		t.Fatalf("publish price book: %v", err)
	}
	if detail.Book.Status != model.QuotePriceBookStatusActive {
		t.Fatalf("unexpected price book status: %s", detail.Book.Status)
	}

	task, err := svc.CreateQuoteList(&QuoteListCreateInput{
		ProjectID:          1001,
		OwnerUserID:        7001,
		DesignerProviderID: 8001,
		Title:              "报价任务",
	})
	if err != nil {
		t.Fatalf("create quote task: %v", err)
	}
	if _, err := svc.BatchUpsertQuoteListItems(task.ID, []QuoteListItemUpsertInput{{
		StandardItemID: libraryItem.ID,
		Name:           libraryItem.Name,
		Unit:           "㎡",
		Quantity:       12,
		CategoryL1:     "防水",
	}}); err != nil {
		t.Fatalf("batch upsert items: %v", err)
	}
	if _, err := svc.UpdateTaskPrerequisites(task.ID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              89,
		Layout:            "3室2厅",
		RenovationType:    "全屋翻新",
		ConstructionScope: "防水",
		ServiceAreas:      []string{"浦东新区"},
		WorkTypes:         []string{"waterproof"},
	}); err != nil {
		t.Fatalf("update prerequisites: %v", err)
	}
	recommendations, err := svc.RecommendForemen(task.ID)
	if err != nil {
		t.Fatalf("recommend foremen: %v", err)
	}
	if len(recommendations) != 1 || recommendations[0].ProviderID != foreman.ID {
		t.Fatalf("unexpected recommendation result: %+v", recommendations)
	}
}

func TestQuotePriceBookPublish_RequiresAllRequiredItemsPriced(t *testing.T) {
	db := setupQuoteServiceDB(t)

	foreman := model.Provider{Base: model.Base{ID: 2001}, ProviderType: 3, CompanyName: "工长发布校验"}
	if err := db.Create(&foreman).Error; err != nil {
		t.Fatalf("create foreman: %v", err)
	}

	requiredItem := model.QuoteLibraryItem{
		Base:           model.Base{ID: 2101},
		ERPItemCode:    "ERP-REQ-001",
		Name:           "必填施工项",
		StandardCode:   "REQ-001",
		CategoryL1:     "基础施工",
		CategoryL2:     "拆改",
		Unit:           "项",
		Status:         model.QuoteLibraryItemStatusEnabled,
		ExtensionsJSON: `{"required":true}`,
	}
	optionalItem := model.QuoteLibraryItem{
		Base:           model.Base{ID: 2102},
		ERPItemCode:    "ERP-OPT-001",
		Name:           "可选施工项",
		StandardCode:   "OPT-001",
		CategoryL1:     "基础施工",
		CategoryL2:     "拆改",
		Unit:           "项",
		Status:         model.QuoteLibraryItemStatusEnabled,
		ExtensionsJSON: `{"required":false}`,
	}
	if err := db.Create(&[]model.QuoteLibraryItem{requiredItem, optionalItem}).Error; err != nil {
		t.Fatalf("create library items: %v", err)
	}

	svc := &QuoteService{}
	if _, err := svc.UpsertProviderPriceBook(foreman.ID, &QuotePriceBookUpdateInput{
		Items: []QuotePriceBookItemInput{
			{
				StandardItemID: optionalItem.ID,
				Unit:           optionalItem.Unit,
				UnitPriceCent:  18800,
				Status:         model.QuoteLibraryItemStatusEnabled,
			},
		},
	}); err != nil {
		t.Fatalf("UpsertProviderPriceBook: %v", err)
	}

	if _, err := svc.PublishProviderPriceBook(foreman.ID); err == nil {
		t.Fatalf("expected publish to fail when required item is missing")
	}
}

func TestGetProviderPriceBook_IncludesAllEnabledStandardItems(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	category := model.QuoteCategory{Code: "MASONRY", Name: "泥瓦", Status: 1}
	if err := db.Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	itemA := model.QuoteLibraryItem{
		CategoryID:   category.ID,
		StandardCode: "STD-MS-0001",
		ERPItemCode:  "ERP-MS0001",
		Name:         "墙砖铺贴",
		Unit:         "㎡",
		CategoryL1:   "泥瓦",
		CategoryL2:   "墙砖铺贴",
		Status:       1,
	}
	itemB := model.QuoteLibraryItem{
		CategoryID:   category.ID,
		StandardCode: "STD-MS-0002",
		ERPItemCode:  "ERP-MS0002",
		Name:         "地砖铺贴",
		Unit:         "㎡",
		CategoryL1:   "泥瓦",
		CategoryL2:   "地砖铺贴",
		Status:       1,
	}
	if err := db.Create(&itemA).Error; err != nil {
		t.Fatalf("create itemA: %v", err)
	}
	if err := db.Create(&itemB).Error; err != nil {
		t.Fatalf("create itemB: %v", err)
	}

	provider := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长价格库"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	if _, err := svc.UpsertProviderPriceBook(provider.ID, &QuotePriceBookUpdateInput{
		Items: []QuotePriceBookItemInput{{
			StandardItemID: itemA.ID,
			Unit:           itemA.Unit,
			UnitPriceCent:  2300,
			Status:         1,
		}},
	}); err != nil {
		t.Fatalf("upsert provider price book: %v", err)
	}

	detail, err := svc.GetProviderPriceBook(provider.ID)
	if err != nil {
		t.Fatalf("get provider price book: %v", err)
	}
	if len(detail.Items) != 2 {
		t.Fatalf("expected merged standard items length 2, got %d", len(detail.Items))
	}
	if detail.Items[0].StandardItemName == "" || detail.Items[0].StandardCode == "" {
		t.Fatalf("expected standard item metadata in detail: %+v", detail.Items[0])
	}
	foundBlank := false
	for _, row := range detail.Items {
		if row.StandardItemID == itemB.ID && row.UnitPriceCent == 0 {
			foundBlank = true
		}
	}
	if !foundBlank {
		t.Fatalf("expected unpriced standard item to be included in detail: %+v", detail.Items)
	}
}

func TestGenerateDrafts_AndUserConfirmFlow(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	foreman := model.Provider{
		ProviderType: 3,
		SubType:      "foreman",
		CompanyName:  "工长生成A",
		Status:       1,
		WorkTypes:    "waterproof",
		ServiceArea:  `["浦东新区"]`,
	}
	if err := db.Create(&foreman).Error; err != nil {
		t.Fatalf("create foreman: %v", err)
	}
	if err := db.Create(&model.MerchantServiceSetting{ProviderID: foreman.ID, AcceptBooking: true}).Error; err != nil {
		t.Fatalf("create merchant setting: %v", err)
	}
	libraryItem := model.QuoteLibraryItem{
		StandardCode: "STD-WP-002",
		ERPItemCode:  "ERP-WP-002",
		Name:         "墙地面防水",
		Unit:         "㎡",
		CategoryL1:   "防水",
		Status:       1,
	}
	if err := db.Create(&libraryItem).Error; err != nil {
		t.Fatalf("create library item: %v", err)
	}
	if _, err := svc.UpsertProviderPriceBook(foreman.ID, &QuotePriceBookUpdateInput{
		Items: []QuotePriceBookItemInput{{
			StandardItemID: libraryItem.ID,
			Unit:           "㎡",
			UnitPriceCent:  1800,
			MinChargeCent:  0,
			Status:         1,
		}},
	}); err != nil {
		t.Fatalf("upsert price book: %v", err)
	}
	if _, err := svc.PublishProviderPriceBook(foreman.ID); err != nil {
		t.Fatalf("publish price book: %v", err)
	}
	task, err := svc.CreateQuoteList(&QuoteListCreateInput{
		ProjectID:          1002,
		OwnerUserID:        9001,
		DesignerProviderID: 8002,
		Title:              "报价任务生成",
	})
	if err != nil {
		t.Fatalf("create quote task: %v", err)
	}
	items, err := svc.BatchUpsertQuoteListItems(task.ID, []QuoteListItemUpsertInput{{
		StandardItemID: libraryItem.ID,
		Name:           libraryItem.Name,
		Unit:           "㎡",
		Quantity:       10,
		CategoryL1:     "防水",
	}})
	if err != nil {
		t.Fatalf("upsert task item: %v", err)
	}
	if _, err := svc.UpdateTaskPrerequisites(task.ID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              100,
		Layout:            "3室2厅",
		RenovationType:    "全屋翻新",
		ConstructionScope: "防水",
		ServiceAreas:      []string{"浦东新区"},
		WorkTypes:         []string{"waterproof"},
	}); err != nil {
		t.Fatalf("update prerequisites: %v", err)
	}
	if _, err := svc.SelectForemen(task.ID, 1, []uint64{foreman.ID}); err != nil {
		t.Fatalf("select foreman: %v", err)
	}
	comparison, err := svc.GenerateDrafts(task.ID)
	if err != nil {
		t.Fatalf("generate drafts: %v", err)
	}
	if len(comparison.Submissions) != 1 {
		t.Fatalf("unexpected submissions after generation: %+v", comparison.Submissions)
	}

	var submission model.QuoteSubmission
	if err := db.Where("quote_list_id = ? AND provider_id = ?", task.ID, foreman.ID).First(&submission).Error; err != nil {
		t.Fatalf("query submission: %v", err)
	}
	if submission.Status != model.QuoteSubmissionStatusGenerated {
		t.Fatalf("unexpected generated submission status: %s", submission.Status)
	}

	if _, err := svc.SaveMerchantSubmission(task.ID, foreman.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{{
			QuoteListItemID: items[0].ID,
			UnitPriceCent:   2000,
			Remark:          "工长微调",
		}},
		EstimatedDays: 30,
		Remark:        "提交正式报价",
	}, true); err != nil {
		t.Fatalf("merchant submit quote: %v", err)
	}

	taskAfterSubmit, err := svc.SubmitTaskToUser(task.ID, submission.ID)
	if err != nil {
		t.Fatalf("submit task to user: %v", err)
	}
	if taskAfterSubmit.Status != model.QuoteListStatusSubmittedToUser {
		t.Fatalf("unexpected task status after submit to user: %s", taskAfterSubmit.Status)
	}

	confirmedTask, err := svc.UserConfirmQuoteSubmission(submission.ID, 9001)
	if err != nil {
		t.Fatalf("user confirm quote: %v", err)
	}
	if confirmedTask.Status != model.QuoteListStatusUserConfirmed {
		t.Fatalf("unexpected confirmed task status: %s", confirmedTask.Status)
	}

	html, err := svc.BuildSubmissionPrintHTML(submission.ID)
	if err != nil {
		t.Fatalf("build submission print html: %v", err)
	}
	if html == "" || !strings.Contains(html, "报价任务生成") {
		t.Fatalf("unexpected print html: %s", html)
	}
}

func TestQuoteListResponses_IncludeBusinessFlowSummary(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	project := model.Project{
		OwnerID:    9001,
		ProviderID: 8001,
		Name:       "闭环项目",
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}

	flow := model.BusinessFlow{
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           101,
		CustomerUserID:     9001,
		DesignerProviderID: 8001,
		ProjectID:          project.ID,
		CurrentStage:       model.BusinessFlowStageReadyToStart,
	}
	if err := db.Create(&flow).Error; err != nil {
		t.Fatalf("create business flow: %v", err)
	}

	provider := model.Provider{
		ProviderType: 3,
		SubType:      "foreman",
		CompanyName:  "闭环工长",
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	quoteList := model.QuoteList{
		ProjectID:              project.ID,
		OwnerUserID:            9001,
		Title:                  "闭环施工报价",
		Status:                 model.QuoteListStatusSubmittedToUser,
		Currency:               "CNY",
		PrerequisiteStatus:     "complete",
		UserConfirmationStatus: model.QuoteUserConfirmationPending,
	}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}

	if err := db.Create(&model.QuoteInvitation{
		QuoteListID: quoteList.ID,
		ProviderID:  provider.ID,
		Status:      model.QuoteInvitationStatusInvited,
	}).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	adminList, err := svc.ListQuoteLists(1, 20, "", "")
	if err != nil {
		t.Fatalf("list quote lists: %v", err)
	}
	if len(adminList.List) != 1 {
		t.Fatalf("unexpected admin list length: %d", len(adminList.List))
	}
	if adminList.List[0].BusinessStage != model.BusinessFlowStageReadyToStart {
		t.Fatalf("unexpected admin business stage: %s", adminList.List[0].BusinessStage)
	}
	if !strings.Contains(adminList.List[0].FlowSummary, "待开工") {
		t.Fatalf("unexpected admin flow summary: %s", adminList.List[0].FlowSummary)
	}
	if len(adminList.List[0].AvailableActions) != 1 || adminList.List[0].AvailableActions[0] != "start_project" {
		t.Fatalf("unexpected admin available actions: %+v", adminList.List[0].AvailableActions)
	}

	merchantList, err := svc.ListMerchantQuoteLists(provider.ID)
	if err != nil {
		t.Fatalf("list merchant quote lists: %v", err)
	}
	if len(merchantList) != 1 {
		t.Fatalf("unexpected merchant list length: %d", len(merchantList))
	}
	if merchantList[0].BusinessStage != model.BusinessFlowStageReadyToStart {
		t.Fatalf("unexpected merchant business stage: %s", merchantList[0].BusinessStage)
	}

	comparison, err := svc.GetQuoteComparison(quoteList.ID)
	if err != nil {
		t.Fatalf("get quote comparison: %v", err)
	}
	if comparison.BusinessStage != model.BusinessFlowStageReadyToStart {
		t.Fatalf("unexpected comparison business stage: %s", comparison.BusinessStage)
	}
	if !strings.Contains(comparison.FlowSummary, "待开工") {
		t.Fatalf("unexpected comparison flow summary: %s", comparison.FlowSummary)
	}
}

func TestQuoteListResponses_FallbackWhenBusinessFlowMissing(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	provider := model.Provider{
		ProviderType: 3,
		SubType:      "foreman",
		CompanyName:  "无 flow 工长",
		Status:       1,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	quoteList := model.QuoteList{
		OwnerUserID:            9001,
		Title:                  "无 flow 施工报价",
		Status:                 model.QuoteListStatusSubmittedToUser,
		Currency:               "CNY",
		UserConfirmationStatus: model.QuoteUserConfirmationPending,
	}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	if err := db.Create(&model.QuoteInvitation{
		QuoteListID: quoteList.ID,
		ProviderID:  provider.ID,
		Status:      model.QuoteInvitationStatusInvited,
	}).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	merchantList, err := svc.ListMerchantQuoteLists(provider.ID)
	if err != nil {
		t.Fatalf("list merchant quote lists: %v", err)
	}
	if len(merchantList) != 1 {
		t.Fatalf("unexpected merchant list length: %d", len(merchantList))
	}
	if merchantList[0].BusinessStage != model.BusinessFlowStageConstructionQuotePending {
		t.Fatalf("unexpected fallback business stage: %s", merchantList[0].BusinessStage)
	}
	if merchantList[0].FlowSummary == "" || merchantList[0].FlowSummary == "业务主链待初始化" {
		t.Fatalf("unexpected fallback flow summary: %s", merchantList[0].FlowSummary)
	}
}
