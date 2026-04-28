package service

import (
	"encoding/base64"
	"encoding/json"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	cryptoutil "home-decoration-server/pkg/utils"

	"github.com/xuri/excelize/v2"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupQuoteServiceDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "file:" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()) + "?mode=memory&cache=shared"
	db, err := gorm.Open(gormsqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	if err := cryptoutil.InitCrypto(); err != nil {
		t.Fatalf("init crypto: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Notification{},
		&model.AuditLog{},
		&model.OutboxEvent{},
		&model.Provider{},
		&model.QuoteTask{},
		&model.QuotePKSubmission{},
		&model.Booking{},
		&model.Proposal{},
		&model.Project{},
		&model.Order{},
		&model.PaymentPlan{},
		&model.ChangeOrder{},
		&model.SettlementOrder{},
		&model.PayoutOrder{},
		&model.MerchantIncome{},
		&model.EscrowAccount{},
		&model.ProjectPhase{},
		&model.PhaseTask{},
		&model.Milestone{},
		&model.BusinessFlow{},
		&model.SystemConfig{},
		&model.MerchantServiceSetting{},
		&model.QuoteCategory{},
		&model.QuoteLibraryItem{},
		&model.QuoteTemplate{},
		&model.QuoteTemplateItem{},
		&model.QuantityBase{},
		&model.QuantityBaseItem{},
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
	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(4)

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		_ = sqlDB.Close()
	})

	return db
}

func mustParseTimePointer(t *testing.T, value string) *time.Time {
	t.Helper()
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		t.Fatalf("parse time %q: %v", value, err)
	}
	return &parsed
}

func seedQuotePreparationTemplate(
	t *testing.T,
	db *gorm.DB,
	roomType string,
	renovationType string,
	libraryItem model.QuoteLibraryItem,
	required bool,
) (model.QuoteTemplate, model.QuoteLibraryItem) {
	t.Helper()

	libraryItem.Status = model.QuoteLibraryItemStatusEnabled
	if err := db.Create(&libraryItem).Error; err != nil {
		t.Fatalf("create quote library item: %v", err)
	}

	tmpl := model.QuoteTemplate{
		Name:           strings.TrimSpace(firstNonBlank(roomType, "默认")) + "-" + strings.TrimSpace(firstNonBlank(renovationType, "默认")) + "-模板",
		RoomType:       roomType,
		RenovationType: renovationType,
		Status:         1,
	}
	if err := db.Create(&tmpl).Error; err != nil {
		t.Fatalf("create quote template: %v", err)
	}
	if err := db.Create(&model.QuoteTemplateItem{
		TemplateID:    tmpl.ID,
		LibraryItemID: libraryItem.ID,
		Required:      required,
		SortOrder:     1,
	}).Error; err != nil {
		t.Fatalf("create quote template item: %v", err)
	}

	return tmpl, libraryItem
}

func setupQuoteServiceDBWithoutAuditLog(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupQuoteServiceDB(t)
	if err := db.Migrator().DropTable(&model.AuditLog{}); err != nil {
		t.Fatalf("drop audit_logs: %v", err)
	}
	return db
}

func setupQuoteServiceDBWithoutOutboxEvent(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupQuoteServiceDB(t)
	if err := db.Migrator().DropTable(&model.OutboxEvent{}); err != nil {
		t.Fatalf("drop outbox_events: %v", err)
	}
	return db
}

type quoteConfirmationFixture struct {
	owner      model.User
	designer   model.Provider
	foreman    model.Provider
	booking    model.Booking
	proposal   model.Proposal
	flow       model.BusinessFlow
	quoteList  model.QuoteList
	submission model.QuoteSubmission
}

func seedQuoteConfirmationFixture(t *testing.T, db *gorm.DB, quoteStatus string) quoteConfirmationFixture {
	t.Helper()

	configSvc.ClearCache()
	if err := db.Create(&model.SystemConfig{
		Key:      model.ConfigKeyConstructionPaymentMode,
		Value:    "milestone",
		Editable: true,
	}).Error; err != nil {
		t.Fatalf("seed construction payment config: %v", err)
	}

	owner := model.User{Base: model.Base{ID: 9101}, Phone: "13800139101", Nickname: "业主A", Status: 1}
	designerUser := model.User{Base: model.Base{ID: 9102}, Phone: "13800139102", Nickname: "设计师A", Status: 1}
	designer := model.Provider{Base: model.Base{ID: 9201}, UserID: designerUser.ID, ProviderType: 1, CompanyName: "设计工作室A", Status: 1}
	foreman := model.Provider{Base: model.Base{ID: 9202}, ProviderType: 3, SubType: "foreman", CompanyName: "工长A", Status: 1}
	booking := model.Booking{
		Base:       model.Base{ID: 9301},
		UserID:     owner.ID,
		ProviderID: designer.ID,
		Address:    "上海市浦东新区成山路 66 号",
		Area:       96,
		Status:     2,
	}
	proposal := model.Proposal{
		Base:            model.Base{ID: 9401},
		BookingID:       booking.ID,
		DesignerID:      designer.ID,
		Summary:         "施工确认前正式方案",
		DesignFee:       10000,
		ConstructionFee: 180000,
		MaterialFee:     20000,
		Status:          model.ProposalStatusConfirmed,
		SourceType:      model.ProposalSourceBooking,
		Version:         1,
	}
	flow := model.BusinessFlow{
		Base:                      model.Base{ID: 9501},
		SourceType:                model.BusinessFlowSourceBooking,
		SourceID:                  booking.ID,
		CustomerUserID:            owner.ID,
		DesignerProviderID:        designer.ID,
		SelectedForemanProviderID: foreman.ID,
		CurrentStage:              model.BusinessFlowStageConstructionQuotePending,
	}
	quoteList := model.QuoteList{
		Base:                   model.Base{ID: 9601},
		ProposalID:             proposal.ID,
		DesignerProviderID:     designer.ID,
		OwnerUserID:            owner.ID,
		Title:                  "施工报价确认单",
		Status:                 quoteStatus,
		Currency:               "CNY",
		PrerequisiteStatus:     model.QuoteTaskPrerequisiteComplete,
		UserConfirmationStatus: model.QuoteUserConfirmationPending,
	}
	submission := model.QuoteSubmission{
		Base:            model.Base{ID: 9701},
		QuoteListID:     quoteList.ID,
		ProviderID:      foreman.ID,
		ProviderType:    foreman.ProviderType,
		ProviderSubType: foreman.SubType,
		Status:          model.QuoteSubmissionStatusSubmitted,
		TaskStatus:      model.QuoteListStatusSubmittedToUser,
		Currency:        "CNY",
		TotalCent:       18800000,
		EstimatedDays:   45,
		SubmittedToUser: true,
		UserConfirmedAt: nil,
	}

	for _, record := range []interface{}{
		&owner,
		&designerUser,
		&designer,
		&foreman,
		&booking,
		&proposal,
		&flow,
		&quoteList,
		&submission,
	} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed quote confirmation fixture: %v", err)
		}
	}

	return quoteConfirmationFixture{
		owner:      owner,
		designer:   designer,
		foreman:    foreman,
		booking:    booking,
		proposal:   proposal,
		flow:       flow,
		quoteList:  quoteList,
		submission: submission,
	}
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

func TestListProviderPriceBookInspectionUsesApplicableScopeAndIssues(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	user := model.User{Base: model.Base{ID: 61101}, Phone: "13800161101", Nickname: "水电施工队"}
	provider := model.Provider{
		Base:         model.Base{ID: 61102},
		UserID:       user.ID,
		ProviderType: 3,
		SubType:      "foreman",
		CompanyName:  "水电施工队",
		WorkTypes:    "plumber",
		Status:       1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	waterItem := model.QuoteLibraryItem{
		Base:               model.Base{ID: 61201},
		ERPItemCode:        "ERP-WATER-INSPECT",
		StandardCode:       "STD-WATER-INSPECT",
		Name:               "水路改造",
		Unit:               "m",
		CategoryL1:         "水路",
		ReferencePriceCent: 1000,
		Status:             model.QuoteLibraryItemStatusEnabled,
		ExtensionsJSON:     `{"required":true}`,
	}
	masonItem := model.QuoteLibraryItem{
		Base:               model.Base{ID: 61202},
		ERPItemCode:        "ERP-MASON-INSPECT",
		StandardCode:       "STD-MASON-INSPECT",
		Name:               "墙砖铺贴",
		Unit:               "㎡",
		CategoryL1:         "泥瓦",
		ReferencePriceCent: 2000,
		Status:             model.QuoteLibraryItemStatusEnabled,
		ExtensionsJSON:     `{"required":true}`,
	}
	if err := db.Create(&waterItem).Error; err != nil {
		t.Fatalf("create water item: %v", err)
	}
	if err := db.Create(&masonItem).Error; err != nil {
		t.Fatalf("create mason item: %v", err)
	}

	book := model.QuotePriceBook{
		ProviderID: provider.ID,
		Status:     model.QuotePriceBookStatusActive,
		Version:    2,
	}
	if err := db.Create(&book).Error; err != nil {
		t.Fatalf("create price book: %v", err)
	}
	if err := db.Create(&model.QuotePriceBookItem{
		PriceBookID:    book.ID,
		StandardItemID: waterItem.ID,
		Unit:           waterItem.Unit,
		UnitPriceCent:  1600,
		Status:         model.QuoteLibraryItemStatusEnabled,
	}).Error; err != nil {
		t.Fatalf("create price item: %v", err)
	}

	items, err := svc.ListProviderPriceBookInspection("")
	if err != nil {
		t.Fatalf("inspection: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one provider inspection item, got %d", len(items))
	}
	got := items[0]
	if got.CoverageRate != 1 {
		t.Fatalf("coverage should use applicable plumber items only, got %.2f", got.CoverageRate)
	}
	if got.MissingRequiredCount != 0 {
		t.Fatalf("mason item should not count as missing for plumber provider, got %d", got.MissingRequiredCount)
	}
	if got.AbnormalPriceCount != 1 {
		t.Fatalf("expected one abnormal applicable price, got %d", got.AbnormalPriceCount)
	}
	if len(got.Issues) != 1 || got.Issues[0].IssueType != "abnormal_price" || got.Issues[0].StandardItemID != waterItem.ID {
		t.Fatalf("expected abnormal price issue for water item, got %+v", got.Issues)
	}
}

func TestBuildSubmissionHealthSummaryCountsMissingRequiredListItems(t *testing.T) {
	db := setupQuoteServiceDB(t)

	quoteList := model.QuoteList{Title: "缺行报价", Status: model.QuoteListStatusPricingInProgress, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	first := model.QuoteListItem{
		QuoteListID:    quoteList.ID,
		Name:           "水路改造",
		Unit:           "m",
		Quantity:       10,
		ExtensionsJSON: `{"required":true}`,
	}
	second := model.QuoteListItem{
		QuoteListID:    quoteList.ID,
		Name:           "电路改造",
		Unit:           "m",
		Quantity:       8,
		ExtensionsJSON: `{"required":true}`,
	}
	if err := db.Create(&first).Error; err != nil {
		t.Fatalf("create first item: %v", err)
	}
	if err := db.Create(&second).Error; err != nil {
		t.Fatalf("create second item: %v", err)
	}
	submission := model.QuoteSubmission{
		QuoteListID: quoteList.ID,
		ProviderID:  1,
		Status:      model.QuoteSubmissionStatusDraft,
	}
	if err := db.Create(&submission).Error; err != nil {
		t.Fatalf("create submission: %v", err)
	}
	submissionItem := model.QuoteSubmissionItem{
		QuoteSubmissionID: submission.ID,
		QuoteListItemID:   first.ID,
		UnitPriceCent:     1200,
		QuotedQuantity:    10,
		AmountCent:        12000,
	}
	if err := db.Create(&submissionItem).Error; err != nil {
		t.Fatalf("create submission item: %v", err)
	}

	summary := buildSubmissionHealthSummaryWithDB(db, &quoteList, &submission, []model.QuoteSubmissionItem{submissionItem})
	if summary.MissingPriceCount != 1 {
		t.Fatalf("expected missing required quote list item to be counted, got %d", summary.MissingPriceCount)
	}
	if summary.CanSubmit {
		t.Fatalf("expected canSubmit=false while required item is missing")
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

func TestSaveMerchantSubmission_TracksQuantityDeviationAndReviewStatus(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	provider := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长偏差测试"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "偏差报价任务", Status: model.QuoteListStatusPricingInProgress, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	item := model.QuoteListItem{
		QuoteListID:            quoteList.ID,
		Name:                   "地砖铺贴",
		Unit:                   "㎡",
		Quantity:               20,
		QuantityAdjustableFlag: false,
		CategoryL1:             "泥瓦",
		ExtensionsJSON:         `{"required":true}`,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create quote list item: %v", err)
	}
	if err := db.Model(&model.QuoteListItem{}).Where("id = ?", item.ID).Update("quantity_adjustable_flag", false).Error; err != nil {
		t.Fatalf("persist quantity adjustable flag: %v", err)
	}
	if err := db.Create(&model.QuoteInvitation{
		QuoteListID: quoteList.ID,
		ProviderID:  provider.ID,
		Status:      model.QuoteInvitationStatusInvited,
	}).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	submission, err := svc.SaveMerchantSubmission(quoteList.ID, provider.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{{
			QuoteListItemID:      item.ID,
			UnitPriceCent:        1600,
			QuotedQuantity:       24,
			QuantityChangeReason: "现场复尺后墙面找平面积增加",
		}},
	}, true)
	if err != nil {
		t.Fatalf("save merchant submission: %v", err)
	}
	if submission.ReviewStatus != model.QuoteSubmissionReviewStatusPending {
		t.Fatalf("expected review status pending, got %s", submission.ReviewStatus)
	}

	var storedItem model.QuoteSubmissionItem
	if err := db.Where("quote_submission_id = ?", submission.ID).First(&storedItem).Error; err != nil {
		t.Fatalf("load stored submission item: %v", err)
	}
	if storedItem.QuotedQuantity != 24 {
		t.Fatalf("expected quoted quantity=24, got %.2f", storedItem.QuotedQuantity)
	}
	if !storedItem.DeviationFlag {
		t.Fatalf("expected deviation flag true")
	}
	if !storedItem.RequiresUserConfirmation {
		t.Fatalf("expected requires user confirmation true")
	}
}

func TestSaveMerchantSubmission_RejectsQuantityChangeWithoutReason(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	provider := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长必填原因测试"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "数量调整任务", Status: model.QuoteListStatusPricingInProgress, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	item := model.QuoteListItem{QuoteListID: quoteList.ID, Name: "墙面修补", Unit: "㎡", Quantity: 10, CategoryL1: "油工"}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create quote list item: %v", err)
	}
	if err := db.Create(&model.QuoteInvitation{
		QuoteListID: quoteList.ID,
		ProviderID:  provider.ID,
		Status:      model.QuoteInvitationStatusInvited,
	}).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	_, err := svc.SaveMerchantSubmission(quoteList.ID, provider.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{{
			QuoteListItemID: item.ID,
			UnitPriceCent:   800,
			QuotedQuantity:  12,
		}},
	}, false)
	if err == nil || !strings.Contains(err.Error(), "必须填写偏差原因") {
		t.Fatalf("expected quantity change reason validation error, got %v", err)
	}
}

func TestSaveMerchantSubmission_RejectsPriceChangeWithoutReason(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	provider := model.Provider{ProviderType: 3, SubType: "foreman", CompanyName: "工长改价原因测试"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{Title: "改单价任务", Status: model.QuoteListStatusPricingInProgress, Currency: "CNY"}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	item := model.QuoteListItem{QuoteListID: quoteList.ID, Name: "乳胶漆", Unit: "㎡", Quantity: 18, CategoryL1: "油工"}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create quote list item: %v", err)
	}
	if err := db.Create(&model.QuoteInvitation{
		QuoteListID: quoteList.ID,
		ProviderID:  provider.ID,
		Status:      model.QuoteInvitationStatusQuoted,
	}).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}
	submission := model.QuoteSubmission{
		QuoteListID:     quoteList.ID,
		ProviderID:      provider.ID,
		ProviderType:    provider.ProviderType,
		ProviderSubType: provider.SubType,
		Status:          model.QuoteSubmissionStatusSubmitted,
		Currency:        "CNY",
		TotalCent:       18000,
	}
	if err := db.Create(&submission).Error; err != nil {
		t.Fatalf("create submission: %v", err)
	}
	if err := db.Create(&model.QuoteSubmissionItem{
		QuoteSubmissionID: submission.ID,
		QuoteListItemID:   item.ID,
		UnitPriceCent:     1000,
		QuotedQuantity:    18,
		AmountCent:        18000,
	}).Error; err != nil {
		t.Fatalf("create submission item: %v", err)
	}

	_, err := svc.SaveMerchantSubmission(quoteList.ID, provider.ID, &QuoteSubmissionSaveInput{
		Items: []QuoteSubmissionItemInput{{
			QuoteListItemID: item.ID,
			UnitPriceCent:   1200,
		}},
	}, false)
	if err == nil || !strings.Contains(err.Error(), "必须填写偏差原因") {
		t.Fatalf("expected price change reason validation error, got %v", err)
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
			QuoteListItemID:      item.ID,
			UnitPriceCent:        900,
			QuantityChangeReason: "单价按最新现场条件复核后上调",
			Remark:               "现场调整后重算",
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

func TestQuotePriceBookPublish_OnlyChecksApplicableRequiredItems(t *testing.T) {
	db := setupQuoteServiceDB(t)

	foreman := model.Provider{
		Base:         model.Base{ID: 2201},
		ProviderType: 3,
		SubType:      "foreman",
		CompanyName:  "泥瓦工长",
		Status:       1,
		WorkTypes:    "mason",
	}
	if err := db.Create(&foreman).Error; err != nil {
		t.Fatalf("create foreman: %v", err)
	}

	applicableRequired := model.QuoteLibraryItem{
		Base:           model.Base{ID: 2202},
		ERPItemCode:    "ERP-MS-REQ-001",
		Name:           "墙地面防水",
		StandardCode:   "MS-REQ-001",
		CategoryL1:     "泥瓦",
		CategoryL2:     "防水",
		Unit:           "㎡",
		Status:         model.QuoteLibraryItemStatusEnabled,
		ExtensionsJSON: `{"required":true}`,
	}
	notApplicableRequired := model.QuoteLibraryItem{
		Base:           model.Base{ID: 2203},
		ERPItemCode:    "ERP-WE-REQ-001",
		Name:           "强弱电改造",
		StandardCode:   "WE-REQ-001",
		CategoryL1:     "水电",
		CategoryL2:     "电路",
		Unit:           "项",
		Status:         model.QuoteLibraryItemStatusEnabled,
		ExtensionsJSON: `{"required":true}`,
	}
	if err := db.Create(&[]model.QuoteLibraryItem{applicableRequired, notApplicableRequired}).Error; err != nil {
		t.Fatalf("create library items: %v", err)
	}

	svc := &QuoteService{}
	if _, err := svc.UpsertProviderPriceBook(foreman.ID, &QuotePriceBookUpdateInput{
		Items: []QuotePriceBookItemInput{
			{
				StandardItemID: applicableRequired.ID,
				Unit:           applicableRequired.Unit,
				UnitPriceCent:  18800,
				Status:         model.QuoteLibraryItemStatusEnabled,
			},
		},
	}); err != nil {
		t.Fatalf("UpsertProviderPriceBook: %v", err)
	}

	detail, err := svc.PublishProviderPriceBook(foreman.ID)
	if err != nil {
		t.Fatalf("expected publish success for applicable required items only, got %v", err)
	}
	if detail.Book.Status != model.QuotePriceBookStatusActive {
		t.Fatalf("unexpected price book status: %s", detail.Book.Status)
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
	owner := model.User{Base: model.Base{ID: 9001}, Phone: "13800139001", Nickname: "报价业主A", Status: 1}
	designerUser := model.User{Base: model.Base{ID: 9002}, Phone: "13800139002", Nickname: "设计师A", Status: 1}
	designer := model.Provider{Base: model.Base{ID: 8002}, UserID: designerUser.ID, ProviderType: 1, CompanyName: "设计工作室B", Status: 1}
	booking := model.Booking{
		Base:       model.Base{ID: 1002},
		UserID:     owner.ID,
		ProviderID: designer.ID,
		Address:    "上海市浦东新区成山路 88 号",
		Area:       100,
		Status:     2,
	}
	proposal := model.Proposal{
		Base:            model.Base{ID: 1003},
		BookingID:       booking.ID,
		DesignerID:      designer.ID,
		Summary:         "报价前已确认方案",
		DesignFee:       12000,
		ConstructionFee: 188000,
		MaterialFee:     20000,
		Status:          model.ProposalStatusConfirmed,
		SourceType:      model.ProposalSourceBooking,
		Version:         1,
	}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 1004},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     owner.ID,
		DesignerProviderID: designer.ID,
		CurrentStage:       model.BusinessFlowStageConstructionQuotePending,
	}
	for _, record := range []interface{}{&owner, &designerUser, &designer, &booking, &proposal, &flow} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed quote generation flow fixture: %v", err)
		}
	}

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
		ProposalID:         proposal.ID,
		ProposalVersion:    proposal.Version,
		OwnerUserID:        owner.ID,
		DesignerProviderID: designer.ID,
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
			QuoteListItemID:      items[0].ID,
			UnitPriceCent:        2000,
			QuantityChangeReason: "结合现场条件与价格库做工长复核",
			Remark:               "工长微调",
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

	confirmedTask, err := svc.UserConfirmQuoteSubmission(submission.ID, owner.ID)
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

func TestQuoteTaskPrerequisiteValidation_ReturnsMessageAndBlocksActions(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	task := model.QuoteList{
		Title:              "前置校验任务",
		Status:             model.QuoteListStatusDraft,
		Currency:           "CNY",
		PrerequisiteStatus: model.QuoteTaskPrerequisiteDraft,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	if err := db.Create(&model.QuoteListItem{
		QuoteListID: task.ID,
		Name:        "墙地面防水",
		Unit:        "㎡",
		Quantity:    8,
		CategoryL1:  "防水",
	}).Error; err != nil {
		t.Fatalf("create quote item: %v", err)
	}

	validation, err := svc.ValidateTaskPrerequisites(task.ID)
	if err != nil {
		t.Fatalf("validate prerequisites: %v", err)
	}
	if validation.OK {
		t.Fatalf("expected validation to fail")
	}
	if !strings.Contains(validation.Message, "房屋面积") || !strings.Contains(validation.Message, "房型") {
		t.Fatalf("expected localized missing-fields message, got %q", validation.Message)
	}

	if _, err := svc.RecommendForemen(task.ID); err == nil || !strings.Contains(err.Error(), "报价前置资料未补齐") {
		t.Fatalf("expected recommend foremen to be blocked with missing-fields message, got %v", err)
	}
	if _, err := svc.GenerateDrafts(task.ID); err == nil || !strings.Contains(err.Error(), "报价前置资料未补齐") {
		t.Fatalf("expected generate drafts to be blocked with missing-fields message, got %v", err)
	}
}

func TestUpdateTaskPrerequisites_DerivesWorkTypesFromQuantityBaseItems(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	seedQuotePreparationTemplate(t, db, "三居", "旧房翻新", model.QuoteLibraryItem{
		Base:         model.Base{ID: 3320},
		StandardCode: "STD-WP-001",
		ERPItemCode:  "ERP-WP-001",
		Name:         "墙地面防水",
		Unit:         "㎡",
		CategoryL1:   "泥瓦",
		CategoryL2:   "防水",
	}, true)

	task, err := svc.CreateQuoteList(&QuoteListCreateInput{
		ProjectID:          3301,
		OwnerUserID:        9301,
		DesignerProviderID: 8301,
		Title:              "施工准备派生工种",
	})
	if err != nil {
		t.Fatalf("create quote task: %v", err)
	}

	quantityBase := model.QuantityBase{
		Base:               model.Base{ID: 3302},
		ProposalID:         1,
		ProposalVersion:    1,
		OwnerUserID:        9301,
		DesignerProviderID: 8301,
		Status:             model.QuantityBaseStatusActive,
		Version:            1,
		Title:              "防水基线",
	}
	if err := db.Create(&quantityBase).Error; err != nil {
		t.Fatalf("create quantity base: %v", err)
	}
	if err := db.Create(&model.QuantityBaseItem{
		Base:           model.Base{ID: 3303},
		QuantityBaseID: quantityBase.ID,
		SourceItemName: "墙地面防水",
		Unit:           "㎡",
		Quantity:       18,
		CategoryL1:     "泥瓦",
		CategoryL2:     "防水",
		SortOrder:      1,
	}).Error; err != nil {
		t.Fatalf("create quantity base item: %v", err)
	}

	if err := db.Model(&model.QuoteList{}).Where("id = ?", task.ID).Updates(map[string]interface{}{
		"quantity_base_id":      quantityBase.ID,
		"quantity_base_version": quantityBase.Version,
	}).Error; err != nil {
		t.Fatalf("bind quantity base: %v", err)
	}
	task.QuantityBaseID = quantityBase.ID
	task.QuantityBaseVersion = quantityBase.Version

	if err := svc.syncQuoteListItemsFromQuantityBase(task); err != nil {
		t.Fatalf("sync quote list items: %v", err)
	}

	updated, err := svc.UpdateTaskPrerequisites(task.ID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              98,
		Layout:            "3室2厅2卫",
		RenovationType:    "旧房翻新",
		ConstructionScope: "防水",
		ServiceAreas:      []string{"浦东新区"},
	})
	if err != nil {
		t.Fatalf("update task prerequisites: %v", err)
	}
	if updated.PrerequisiteStatus != model.QuoteTaskPrerequisiteComplete {
		t.Fatalf("expected prerequisite complete, got %s", updated.PrerequisiteStatus)
	}
	if updated.Status != model.QuoteListStatusReadyForSelection {
		t.Fatalf("expected quote list ready_for_selection, got %s", updated.Status)
	}

	reloaded, err := svc.getPrerequisiteSnapshot(updated)
	if err != nil {
		t.Fatalf("get prerequisite snapshot: %v", err)
	}
	if !slices.Contains(reloaded.WorkTypes, "waterproof") {
		t.Fatalf("expected derived waterproof work type, got %v", reloaded.WorkTypes)
	}
	if !slices.Contains(reloaded.WorkTypes, "mason") {
		t.Fatalf("expected derived mason work type, got %v", reloaded.WorkTypes)
	}
}

func TestFindPreparationTemplate_FallbackOrder(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	if err := db.Create(&model.QuoteTemplate{
		Base:           model.Base{ID: 3401},
		Name:           "默认模板",
		RoomType:       "",
		RenovationType: "",
		Status:         1,
	}).Error; err != nil {
		t.Fatalf("create default template: %v", err)
	}
	if err := db.Create(&model.QuoteTemplate{
		Base:           model.Base{ID: 3402},
		Name:           "旧房翻新模板",
		RoomType:       "",
		RenovationType: "旧房翻新",
		Status:         1,
	}).Error; err != nil {
		t.Fatalf("create renovation template: %v", err)
	}
	if err := db.Create(&model.QuoteTemplate{
		Base:           model.Base{ID: 3403},
		Name:           "三居旧房翻新模板",
		RoomType:       "三居",
		RenovationType: "旧房翻新",
		Status:         1,
	}).Error; err != nil {
		t.Fatalf("create exact template: %v", err)
	}

	exact, err := svc.findPreparationTemplateWithDB(db, QuoteTaskPrerequisiteSnapshot{
		Layout:         "3室2厅2卫",
		RenovationType: "旧房翻新",
	})
	if err != nil {
		t.Fatalf("find exact template: %v", err)
	}
	if exact == nil || exact.ID != 3403 {
		t.Fatalf("expected exact template 3403, got %+v", exact)
	}

	fallback, err := svc.findPreparationTemplateWithDB(db, QuoteTaskPrerequisiteSnapshot{
		Layout:         "2室1厅1卫",
		RenovationType: "旧房翻新",
	})
	if err != nil {
		t.Fatalf("find fallback template: %v", err)
	}
	if fallback == nil || fallback.ID != 3402 {
		t.Fatalf("expected renovation fallback template 3402, got %+v", fallback)
	}

	global, err := svc.findPreparationTemplateWithDB(db, QuoteTaskPrerequisiteSnapshot{
		Layout:         "2室1厅1卫",
		RenovationType: "毛坯装修",
	})
	if err != nil {
		t.Fatalf("find global template: %v", err)
	}
	if global == nil || global.ID != 3401 {
		t.Fatalf("expected global fallback template 3401, got %+v", global)
	}
}

func TestEnsurePreparationTemplate_AutoCreatesExactBucket(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	items := []model.QuoteLibraryItem{
		{
			Base:           model.Base{ID: 3411},
			ERPItemCode:    "ERP-WP-3411",
			StandardCode:   "STD-WP-3411",
			Name:           "墙地面防水",
			Unit:           "㎡",
			CategoryL1:     "泥瓦",
			CategoryL2:     "防水",
			Status:         model.QuoteLibraryItemStatusEnabled,
			ExtensionsJSON: `{"required":true}`,
		},
		{
			Base:           model.Base{ID: 3412},
			ERPItemCode:    "ERP-CA-3412",
			StandardCode:   "STD-CA-3412",
			Name:           "成品保护",
			Unit:           "项",
			CategoryL1:     "保护",
			CategoryL2:     "成保",
			Status:         model.QuoteLibraryItemStatusEnabled,
			ExtensionsJSON: `{"required":false}`,
		},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("create library items: %v", err)
	}
	if err := db.Create(&model.QuoteTemplate{
		Base:           model.Base{ID: 3413},
		Name:           "旧房翻新通用模板",
		RoomType:       "",
		RenovationType: "旧房翻新",
		Status:         1,
	}).Error; err != nil {
		t.Fatalf("create fallback template: %v", err)
	}

	result, err := svc.EnsurePreparationTemplate("三居", "旧房翻新", false)
	if err != nil {
		t.Fatalf("ensure preparation template: %v", err)
	}
	if result == nil || result.Template.ID == 0 {
		t.Fatalf("expected ensure result with template")
	}
	if !result.Created {
		t.Fatalf("expected exact bucket auto created")
	}
	if result.Template.RoomType != "三居" || result.Template.RenovationType != "旧房翻新" {
		t.Fatalf("unexpected ensured template bucket: %+v", result.Template)
	}
	if len(result.Items) != 2 {
		t.Fatalf("expected 2 template items, got %d", len(result.Items))
	}
	if !result.Items[0].Required {
		t.Fatalf("expected first item required")
	}

	again, err := svc.EnsurePreparationTemplate("三居", "旧房翻新", false)
	if err != nil {
		t.Fatalf("ensure preparation template again: %v", err)
	}
	if again.Created || again.Repaired {
		t.Fatalf("expected valid template not rewritten, got created=%v repaired=%v", again.Created, again.Repaired)
	}

	var count int64
	if err := db.Model(&model.QuoteTemplate{}).Where("room_type = ? AND renovation_type = ?", "三居", "旧房翻新").Count(&count).Error; err != nil {
		t.Fatalf("count exact templates: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 exact template, got %d", count)
	}
}

func TestEnsurePreparationTemplate_RepairsEmptyTemplateItems(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	items := []model.QuoteLibraryItem{
		{
			Base:           model.Base{ID: 3421},
			ERPItemCode:    "ERP-WD-3421",
			StandardCode:   "STD-WD-3421",
			Name:           "水电改造",
			Unit:           "项",
			CategoryL1:     "水电",
			CategoryL2:     "改造",
			Status:         model.QuoteLibraryItemStatusEnabled,
			ExtensionsJSON: `{"required":true}`,
		},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("create library items: %v", err)
	}
	if err := db.Create(&model.QuoteTemplate{
		Base:           model.Base{ID: 3422},
		Name:           "空模板",
		RoomType:       "三居",
		RenovationType: "全屋翻新",
		Status:         1,
	}).Error; err != nil {
		t.Fatalf("create empty template: %v", err)
	}

	result, err := svc.EnsurePreparationTemplate("三居", "全屋翻新", false)
	if err != nil {
		t.Fatalf("ensure preparation template: %v", err)
	}
	if result == nil || !result.Repaired {
		t.Fatalf("expected empty template to be repaired")
	}
	if len(result.Items) != 1 || result.Items[0].LibraryItemID != 3421 {
		t.Fatalf("unexpected repaired items: %+v", result.Items)
	}
}

func TestBuildPreparationTemplateState_ReturnsBlockStateWhenLibraryEmpty(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	task, err := svc.CreateQuoteList(&QuoteListCreateInput{
		ProjectID:          3491,
		OwnerUserID:        9491,
		DesignerProviderID: 8491,
		Title:              "无标准项阻断测试",
	})
	if err != nil {
		t.Fatalf("create quote list: %v", err)
	}

	state, err := svc.buildPreparationTemplateStateWithDB(db, task, QuoteTaskPrerequisiteSnapshot{
		Layout:         "3室2厅1卫",
		RenovationType: "旧房翻新",
	}, nil, true)
	if err != nil {
		t.Fatalf("build preparation template state: %v", err)
	}
	if state.TemplateError != errNoAvailablePreparationLibraryItems.Error() {
		t.Fatalf("unexpected template error: %s", state.TemplateError)
	}
}

func TestListUserQuoteTasks_HidesTasksBeforeSubmitToUser(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	hidden := model.QuoteList{
		Title:                  "未提交用户任务",
		OwnerUserID:            9001,
		Status:                 model.QuoteListStatusPricingInProgress,
		UserConfirmationStatus: model.QuoteUserConfirmationPending,
		ActiveSubmissionID:     501,
		Currency:               "CNY",
	}
	visible := model.QuoteList{
		Title:                  "已提交用户任务",
		OwnerUserID:            9001,
		Status:                 model.QuoteListStatusSubmittedToUser,
		UserConfirmationStatus: model.QuoteUserConfirmationPending,
		ActiveSubmissionID:     502,
		Currency:               "CNY",
	}
	if err := db.Create(&hidden).Error; err != nil {
		t.Fatalf("create hidden task: %v", err)
	}
	if err := db.Create(&visible).Error; err != nil {
		t.Fatalf("create visible task: %v", err)
	}

	list, err := svc.ListUserQuoteTasks(9001)
	if err != nil {
		t.Fatalf("list user quote tasks: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected exactly one visible task, got %+v", list)
	}
	if list[0].ID != visible.ID {
		t.Fatalf("expected submitted_to_user task to remain visible, got %+v", list[0])
	}
}

func TestGetUserQuoteTask_BlocksAccessBeforeSubmitToUser(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	task := model.QuoteList{
		Title:                  "用户不可见任务",
		OwnerUserID:            9001,
		Status:                 model.QuoteListStatusPricingInProgress,
		UserConfirmationStatus: model.QuoteUserConfirmationPending,
		ActiveSubmissionID:     888,
		Currency:               "CNY",
	}
	submission := model.QuoteSubmission{
		Base:        model.Base{ID: 888},
		QuoteListID: 1,
		ProviderID:  666,
		Status:      model.QuoteSubmissionStatusSubmitted,
		Currency:    "CNY",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}
	submission.QuoteListID = task.ID
	if err := db.Create(&submission).Error; err != nil {
		t.Fatalf("create submission: %v", err)
	}

	if _, err := svc.GetUserQuoteTask(task.ID, 9001); err == nil || !strings.Contains(err.Error(), "尚未开放用户确认入口") {
		t.Fatalf("expected user-view access to be blocked before submit-to-user, got %v", err)
	}
}

func TestSubmitTaskToUser_RequiresSubmittedVersionAndLocksUniqueActiveSubmission(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	task := model.QuoteList{
		Title:              "提交用户确认任务",
		Status:             model.QuoteListStatusPricingInProgress,
		Currency:           "CNY",
		OwnerUserID:        9001,
		DesignerProviderID: 8001,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}
	submissionDraft := model.QuoteSubmission{
		QuoteListID: task.ID,
		ProviderID:  3001,
		Status:      model.QuoteSubmissionStatusGenerated,
		TaskStatus:  model.QuoteListStatusPricingInProgress,
		Currency:    "CNY",
	}
	submissionSubmittedA := model.QuoteSubmission{
		QuoteListID: task.ID,
		ProviderID:  3002,
		Status:      model.QuoteSubmissionStatusSubmitted,
		TaskStatus:  model.QuoteListStatusPricingInProgress,
		Currency:    "CNY",
	}
	submissionSubmittedB := model.QuoteSubmission{
		QuoteListID: task.ID,
		ProviderID:  3003,
		Status:      model.QuoteSubmissionStatusSubmitted,
		TaskStatus:  model.QuoteListStatusPricingInProgress,
		Currency:    "CNY",
	}
	if err := db.Create(&submissionDraft).Error; err != nil {
		t.Fatalf("create draft submission: %v", err)
	}
	if err := db.Create(&submissionSubmittedA).Error; err != nil {
		t.Fatalf("create submitted submission A: %v", err)
	}
	if err := db.Create(&submissionSubmittedB).Error; err != nil {
		t.Fatalf("create submitted submission B: %v", err)
	}

	if _, err := svc.SubmitTaskToUser(task.ID, submissionDraft.ID); err == nil || !strings.Contains(err.Error(), "只能提交已由工长正式提交的报价版本") {
		t.Fatalf("expected non-submitted version to be blocked, got %v", err)
	}

	if _, err := svc.SubmitTaskToUser(task.ID, submissionSubmittedA.ID); err != nil {
		t.Fatalf("submit first submitted version to user: %v", err)
	}
	var refreshedTask model.QuoteList
	if err := db.First(&refreshedTask, task.ID).Error; err != nil {
		t.Fatalf("reload task: %v", err)
	}
	if refreshedTask.Status != model.QuoteListStatusSubmittedToUser {
		t.Fatalf("expected task status submitted_to_user, got %s", refreshedTask.Status)
	}
	if refreshedTask.ActiveSubmissionID != submissionSubmittedA.ID {
		t.Fatalf("expected active submission %d, got %d", submissionSubmittedA.ID, refreshedTask.ActiveSubmissionID)
	}

	var rows []model.QuoteSubmission
	if err := db.Where("quote_list_id = ?", task.ID).Order("id ASC").Find(&rows).Error; err != nil {
		t.Fatalf("reload submissions: %v", err)
	}
	submittedToUserCount := 0
	for _, row := range rows {
		if row.SubmittedToUser {
			submittedToUserCount++
			if row.ID != submissionSubmittedA.ID {
				t.Fatalf("unexpected active submitted_to_user row: %+v", row)
			}
		}
	}
	if submittedToUserCount != 1 {
		t.Fatalf("expected exactly one submitted_to_user submission, got %d", submittedToUserCount)
	}
}

func TestSubmitTaskToUser_RequiresReviewApprovedOrNotRequired(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	task := model.QuoteList{
		Title:       "待复核报价任务",
		Status:      model.QuoteListStatusPricingInProgress,
		Currency:    "CNY",
		OwnerUserID: 9001,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}
	submission := model.QuoteSubmission{
		QuoteListID:  task.ID,
		ProviderID:   3002,
		Status:       model.QuoteSubmissionStatusSubmitted,
		TaskStatus:   model.QuoteListStatusPricingInProgress,
		Currency:     "CNY",
		ReviewStatus: model.QuoteSubmissionReviewStatusPending,
	}
	if err := db.Create(&submission).Error; err != nil {
		t.Fatalf("create submission: %v", err)
	}

	if _, err := svc.SubmitTaskToUser(task.ID, submission.ID); err == nil || !strings.Contains(err.Error(), "待平台复核") {
		t.Fatalf("expected review gate error, got %v", err)
	}

	if _, err := svc.ReviewQuoteSubmission(submission.ID, 1001, &QuoteSubmissionReviewInput{Approved: true}); err != nil {
		t.Fatalf("approve review: %v", err)
	}
	if _, err := svc.SubmitTaskToUser(task.ID, submission.ID); err != nil {
		t.Fatalf("submit after review approved: %v", err)
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
	if !strings.Contains(adminList.List[0].FlowSummary, "待监理协调") {
		t.Fatalf("unexpected admin flow summary: %s", adminList.List[0].FlowSummary)
	}
	if len(adminList.List[0].AvailableActions) != 0 {
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
	if !strings.Contains(comparison.FlowSummary, "待监理协调") {
		t.Fatalf("unexpected comparison flow summary: %s", comparison.FlowSummary)
	}
}

func TestUserConfirmQuoteSubmissionCreatesProjectAndBindsFlow(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}
	fixture := seedQuoteConfirmationFixture(t, db, model.QuoteListStatusSubmittedToUser)
	listItem := model.QuoteListItem{
		Base:           model.Base{ID: 98101},
		QuoteListID:    fixture.quoteList.ID,
		StandardItemID: 88101,
		LineNo:         1,
		Name:           "水路改造",
		Unit:           "m",
		Quantity:       12,
		CategoryL1:     "水电",
		CategoryL2:     "水路",
		PricingNote:    "按实际延米结算",
		ExtensionsJSON: `{"required":true}`,
	}
	if err := db.Create(&listItem).Error; err != nil {
		t.Fatalf("create quote list item: %v", err)
	}
	if err := db.Create(&model.QuoteSubmissionItem{
		Base:                   model.Base{ID: 98201},
		QuoteSubmissionID:      fixture.submission.ID,
		QuoteListItemID:        listItem.ID,
		GeneratedUnitPriceCent: 1500,
		UnitPriceCent:          1600,
		QuotedQuantity:         12,
		AmountCent:             19200,
		AdjustedFlag:           true,
		Remark:                 "现场按标准工艺施工",
	}).Error; err != nil {
		t.Fatalf("create quote submission item: %v", err)
	}

	confirmedTask, err := svc.UserConfirmQuoteSubmission(fixture.submission.ID, fixture.owner.ID)
	if err != nil {
		t.Fatalf("UserConfirmQuoteSubmission: %v", err)
	}
	if confirmedTask.Status != model.QuoteListStatusUserConfirmed {
		t.Fatalf("unexpected quote list status: %s", confirmedTask.Status)
	}
	if confirmedTask.ProjectID == 0 {
		t.Fatalf("expected project created after quote confirmation")
	}

	var projectCount int64
	if err := db.Model(&model.Project{}).Where("proposal_id = ?", fixture.proposal.ID).Count(&projectCount).Error; err != nil {
		t.Fatalf("count projects by proposal: %v", err)
	}
	if projectCount != 1 {
		t.Fatalf("expected exactly one project, got %d", projectCount)
	}

	var project model.Project
	if err := db.First(&project, confirmedTask.ProjectID).Error; err != nil {
		t.Fatalf("load created project: %v", err)
	}
	if project.ProposalID != fixture.proposal.ID {
		t.Fatalf("unexpected project proposal id: %d", project.ProposalID)
	}
	if project.BusinessStatus != model.ProjectBusinessStatusConstructionQuoteConfirmed {
		t.Fatalf("unexpected project business status: %s", project.BusinessStatus)
	}
	if project.CurrentPhase != "待监理协调开工" {
		t.Fatalf("unexpected project current phase: %s", project.CurrentPhase)
	}
	if !project.PaymentPaused {
		t.Fatalf("expected project payment paused before first construction payment")
	}
	if project.ProviderID != fixture.foreman.ID || project.ConstructionProviderID != 0 || project.ForemanID != fixture.foreman.ID {
		t.Fatalf("expected foreman-only subject binding, got provider_id=%d construction_provider_id=%d foreman_id=%d", project.ProviderID, project.ConstructionProviderID, project.ForemanID)
	}
	if strings.TrimSpace(project.ConstructionQuoteSnapshot) == "" {
		t.Fatalf("expected construction quote snapshot")
	}

	var order model.Order
	if err := db.Where("project_id = ? AND order_type = ?", project.ID, model.OrderTypeConstruction).First(&order).Error; err != nil {
		t.Fatalf("load construction order: %v", err)
	}
	if order.TotalAmount != float64(fixture.submission.TotalCent)/100 {
		t.Fatalf("unexpected construction order amount: %.2f", order.TotalAmount)
	}

	var plans []model.PaymentPlan
	if err := db.Where("order_id = ?", order.ID).Order("seq ASC").Find(&plans).Error; err != nil {
		t.Fatalf("load payment plans: %v", err)
	}
	if len(plans) == 0 {
		t.Fatalf("expected payment plans generated")
	}
	if plans[0].DueAt == nil {
		t.Fatalf("expected first payment plan due date")
	}
	var snapshot struct {
		QuoteListID        uint64 `json:"quoteListId"`
		QuoteSubmissionID  uint64 `json:"quoteSubmissionId"`
		TotalCent          int64  `json:"totalCent"`
		Items              []any  `json:"items"`
		PaymentPlanSummary []any  `json:"paymentPlanSummary"`
	}
	if err := json.Unmarshal([]byte(project.ConstructionQuoteSnapshot), &snapshot); err != nil {
		t.Fatalf("decode construction quote snapshot: %v", err)
	}
	if snapshot.QuoteListID != fixture.quoteList.ID || snapshot.QuoteSubmissionID != fixture.submission.ID || snapshot.TotalCent != fixture.submission.TotalCent {
		t.Fatalf("unexpected snapshot identity: %+v", snapshot)
	}
	if len(snapshot.Items) != 1 {
		t.Fatalf("expected confirmed snapshot to include quote line items, got %d", len(snapshot.Items))
	}
	if len(snapshot.PaymentPlanSummary) != len(plans) {
		t.Fatalf("expected confirmed snapshot to include payment plans, got %d want %d", len(snapshot.PaymentPlanSummary), len(plans))
	}

	var escrow model.EscrowAccount
	if err := db.Where("project_id = ?", project.ID).First(&escrow).Error; err != nil {
		t.Fatalf("load escrow: %v", err)
	}

	var phaseCount int64
	if err := db.Model(&model.ProjectPhase{}).Where("project_id = ?", project.ID).Count(&phaseCount).Error; err != nil {
		t.Fatalf("count phases: %v", err)
	}
	if phaseCount == 0 {
		t.Fatalf("expected project phases initialized")
	}

	var milestoneCount int64
	if err := db.Model(&model.Milestone{}).Where("project_id = ?", project.ID).Count(&milestoneCount).Error; err != nil {
		t.Fatalf("count milestones: %v", err)
	}
	if milestoneCount == 0 {
		t.Fatalf("expected milestones initialized")
	}

	var flow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, fixture.booking.ID).First(&flow).Error; err != nil {
		t.Fatalf("reload business flow: %v", err)
	}
	if flow.ProjectID != project.ID {
		t.Fatalf("expected flow bound to project %d, got %d", project.ID, flow.ProjectID)
	}
	if flow.CurrentStage != model.BusinessFlowStageReadyToStart {
		t.Fatalf("expected flow ready_to_start, got %s", flow.CurrentStage)
	}

	var persistedQuoteList model.QuoteList
	if err := db.First(&persistedQuoteList, fixture.quoteList.ID).Error; err != nil {
		t.Fatalf("reload quote list: %v", err)
	}
	if persistedQuoteList.ProjectID != project.ID {
		t.Fatalf("expected quote list bound to project %d, got %d", project.ID, persistedQuoteList.ProjectID)
	}
	if !persistedQuoteList.PaymentPlanGeneratedFlag {
		t.Fatalf("expected payment plan generated flag true")
	}

	var persistedSubmission model.QuoteSubmission
	if err := db.First(&persistedSubmission, fixture.submission.ID).Error; err != nil {
		t.Fatalf("reload submission: %v", err)
	}
	if persistedSubmission.Status != model.QuoteSubmissionStatusUserConfirmed {
		t.Fatalf("expected submission user confirmed, got %s", persistedSubmission.Status)
	}
}

func TestUserConfirmQuoteSubmissionBindsCompanyConstructionSubject(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}
	fixture := seedQuoteConfirmationFixture(t, db, model.QuoteListStatusSubmittedToUser)

	company := model.Provider{
		Base:         model.Base{ID: 9203},
		ProviderType: 2,
		SubType:      "company",
		CompanyName:  "装修公司B",
		Status:       1,
	}
	if err := db.Create(&company).Error; err != nil {
		t.Fatalf("create company provider: %v", err)
	}
	if err := db.Model(&fixture.flow).Updates(map[string]interface{}{
		"selected_foreman_provider_id": company.ID,
	}).Error; err != nil {
		t.Fatalf("update flow selected subject: %v", err)
	}
	if err := db.Model(&fixture.submission).Updates(map[string]interface{}{
		"provider_id":       company.ID,
		"provider_type":     company.ProviderType,
		"provider_sub_type": company.SubType,
	}).Error; err != nil {
		t.Fatalf("update submission provider: %v", err)
	}

	confirmedTask, err := svc.UserConfirmQuoteSubmission(fixture.submission.ID, fixture.owner.ID)
	if err != nil {
		t.Fatalf("UserConfirmQuoteSubmission company subject: %v", err)
	}

	var project model.Project
	if err := db.First(&project, confirmedTask.ProjectID).Error; err != nil {
		t.Fatalf("load created project: %v", err)
	}
	if project.ProviderID != company.ID || project.ConstructionProviderID != company.ID || project.ForemanID != 0 {
		t.Fatalf("expected company-only subject binding, got provider_id=%d construction_provider_id=%d foreman_id=%d", project.ProviderID, project.ConstructionProviderID, project.ForemanID)
	}

	var updatedFlow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, fixture.booking.ID).First(&updatedFlow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if updatedFlow.SelectedForemanProviderID != company.ID {
		t.Fatalf("expected business flow selected subject=%d, got %d", company.ID, updatedFlow.SelectedForemanProviderID)
	}
}

func TestCreateQuoteListBindsActiveQuantityBaseFromProposal(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	owner := model.User{Base: model.Base{ID: 9501}, Phone: "13800139501", Nickname: "桥接业主", Status: 1}
	designer := model.Provider{Base: model.Base{ID: 9502}, ProviderType: 1, CompanyName: "桥接设计师", Status: 1}
	booking := model.Booking{Base: model.Base{ID: 9503}, UserID: owner.ID, ProviderID: designer.ID, Address: "桥接测试地址", Status: 2}
	proposal := model.Proposal{
		Base:              model.Base{ID: 9504},
		BookingID:         booking.ID,
		DesignerID:        designer.ID,
		Summary:           "桥接正式方案",
		Status:            model.ProposalStatusConfirmed,
		Version:           2,
		InternalDraftJSON: `{"rooms":[{"name":"客厅","items":[{"name":"地砖铺贴","unit":"㎡","quantity":32,"note":"800x800"}]}]}`,
	}
	for _, record := range []interface{}{&owner, &designer, &booking, &proposal} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed create quote list fixture: %v", err)
		}
	}

	task, err := svc.CreateQuoteList(&QuoteListCreateInput{
		ProposalID:         proposal.ID,
		ProposalVersion:    proposal.Version,
		DesignerProviderID: designer.ID,
		OwnerUserID:        owner.ID,
		Title:              "施工报价任务",
		Currency:           "CNY",
	})
	if err != nil {
		t.Fatalf("CreateQuoteList: %v", err)
	}
	if task.QuantityBaseID == 0 {
		t.Fatalf("expected quantity base id on quote list")
	}
	if task.QuantityBaseVersion != proposal.Version {
		t.Fatalf("expected quantity base version=%d, got %d", proposal.Version, task.QuantityBaseVersion)
	}
	if task.SourceType != model.QuantitySourceTypeProposal || task.SourceID != proposal.ID {
		t.Fatalf("unexpected quote list source: %+v", task)
	}

	var base model.QuantityBase
	if err := db.First(&base, task.QuantityBaseID).Error; err != nil {
		t.Fatalf("load quantity base: %v", err)
	}
	if base.ProposalID != proposal.ID || base.Version != proposal.Version {
		t.Fatalf("unexpected quantity base binding: %+v", base)
	}

	var item model.QuantityBaseItem
	if err := db.Where("quantity_base_id = ?", base.ID).First(&item).Error; err != nil {
		t.Fatalf("load quantity base item: %v", err)
	}
	if item.SourceItemName != "地砖铺贴" || item.Quantity != 32 {
		t.Fatalf("unexpected quantity base item: %+v", item)
	}
}

func TestCreateQuoteListDoesNotRegressConstructionBridgeStage(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	owner := model.User{Base: model.Base{ID: 9801}, Phone: "13800139801", Nickname: "桥接业主B", Status: 1}
	designer := model.Provider{Base: model.Base{ID: 9802}, ProviderType: 1, CompanyName: "桥接设计师B", Status: 1}
	booking := model.Booking{Base: model.Base{ID: 9803}, UserID: owner.ID, ProviderID: designer.ID, Address: "桥接回归测试地址", Status: 2}
	proposal := model.Proposal{
		Base:              model.Base{ID: 9804},
		BookingID:         booking.ID,
		DesignerID:        designer.ID,
		Summary:           "桥接正式方案B",
		Status:            model.ProposalStatusConfirmed,
		Version:           3,
		InternalDraftJSON: `{"rooms":[{"name":"主卧","items":[{"name":"乳胶漆","unit":"㎡","quantity":28,"note":"两遍面漆"}]}]}`,
	}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 9805},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     owner.ID,
		DesignerProviderID: designer.ID,
		CurrentStage:       model.BusinessFlowStageConstructionPartyPending,
	}
	for _, record := range []interface{}{&owner, &designer, &booking, &proposal, &flow} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed bridge regression fixture: %v", err)
		}
	}

	task, err := svc.CreateQuoteList(&QuoteListCreateInput{
		ProposalID:         proposal.ID,
		ProposalVersion:    proposal.Version,
		DesignerProviderID: designer.ID,
		OwnerUserID:        owner.ID,
		Title:              "施工报价任务-桥接回归",
		Currency:           "CNY",
	})
	if err != nil {
		t.Fatalf("CreateQuoteList: %v", err)
	}

	var updatedFlow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&updatedFlow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if updatedFlow.CurrentStage != model.BusinessFlowStageConstructionPartyPending {
		t.Fatalf("expected stage remain construction_party_pending, got %s", updatedFlow.CurrentStage)
	}
	if updatedFlow.SelectedQuoteTaskID != task.ID {
		t.Fatalf("expected selected quote task id=%d, got %d", task.ID, updatedFlow.SelectedQuoteTaskID)
	}
}

func TestCreateQuoteListPromotesEarlierStagesOnlyToConstructionBridge(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	owner := model.User{Base: model.Base{ID: 9811}, Phone: "13800139811", Nickname: "设计交付业主", Status: 1}
	designer := model.Provider{Base: model.Base{ID: 9812}, ProviderType: 1, CompanyName: "设计交付商家", Status: 1}
	booking := model.Booking{Base: model.Base{ID: 9813}, UserID: owner.ID, ProviderID: designer.ID, Address: "前置阶段推进地址", Status: 2}
	proposal := model.Proposal{
		Base:              model.Base{ID: 9814},
		BookingID:         booking.ID,
		DesignerID:        designer.ID,
		Summary:           "前置阶段方案",
		Status:            model.ProposalStatusConfirmed,
		Version:           1,
		InternalDraftJSON: `{"rooms":[{"name":"客餐厅","items":[{"name":"木地板铺设","unit":"㎡","quantity":20,"note":"浅色"}]}]}`,
	}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 9815},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     owner.ID,
		DesignerProviderID: designer.ID,
		CurrentStage:       model.BusinessFlowStageDesignDeliveryPending,
	}
	for _, record := range []interface{}{&owner, &designer, &booking, &proposal, &flow} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed promotion fixture: %v", err)
		}
	}

	task, err := svc.CreateQuoteList(&QuoteListCreateInput{
		ProposalID:         proposal.ID,
		ProposalVersion:    proposal.Version,
		DesignerProviderID: designer.ID,
		OwnerUserID:        owner.ID,
		Title:              "施工报价任务-前置阶段",
		Currency:           "CNY",
	})
	if err != nil {
		t.Fatalf("CreateQuoteList: %v", err)
	}

	var updatedFlow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&updatedFlow).Error; err != nil {
		t.Fatalf("reload flow: %v", err)
	}
	if updatedFlow.CurrentStage != model.BusinessFlowStageConstructionPartyPending {
		t.Fatalf("expected earlier stage promoted to construction_party_pending, got %s", updatedFlow.CurrentStage)
	}
	if updatedFlow.SelectedQuoteTaskID != task.ID {
		t.Fatalf("expected selected quote task id=%d, got %d", task.ID, updatedFlow.SelectedQuoteTaskID)
	}

	var notification model.Notification
	if err := db.Where("user_id = ? AND type = ?", owner.ID, NotificationTypeConstructionBridgePending).Order("id DESC").First(&notification).Error; err != nil {
		t.Fatalf("expected construction bridge notification: %v", err)
	}
	if notification.ActionURL != "/quote-tasks/1" {
		t.Fatalf("unexpected construction bridge action url: %+v", notification)
	}
	if notification.RelatedID != task.ID || notification.RelatedType != "quote_list" {
		t.Fatalf("unexpected construction bridge relation: %+v", notification)
	}
}

func TestMerchantConstructionPreparation_SelectSingleForemanStartsPricing(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	owner := model.User{Base: model.Base{ID: 9821}, Phone: "13800139821", Nickname: "桥接业主C", Status: 1}
	designerUser := model.User{Base: model.Base{ID: 9822}, Phone: "13800139822", Nickname: "桥接设计师C", Status: 1}
	designer := model.Provider{Base: model.Base{ID: 9823}, UserID: designerUser.ID, ProviderType: 1, CompanyName: "桥接设计师C", Status: 1}
	booking := model.Booking{
		Base:           model.Base{ID: 9824},
		UserID:         owner.ID,
		ProviderID:     designer.ID,
		Address:        "上海市浦东新区桥接路 88 号",
		Area:           108,
		HouseLayout:    "3室2厅2卫",
		RenovationType: "全屋翻新",
		Notes:          "按确认方案推进施工报价",
		Status:         2,
	}
	proposal := model.Proposal{
		Base:              model.Base{ID: 9825},
		BookingID:         booking.ID,
		DesignerID:        designer.ID,
		Summary:           "施工桥接正式方案",
		Status:            model.ProposalStatusConfirmed,
		SourceType:        model.ProposalSourceBooking,
		Version:           1,
		InternalDraftJSON: `{"rooms":[{"name":"卫生间","items":[{"name":"墙地面防水","unit":"㎡","quantity":24,"note":"两遍施工"}]}]}`,
	}
	flow := model.BusinessFlow{
		Base:               model.Base{ID: 9826},
		SourceType:         model.BusinessFlowSourceBooking,
		SourceID:           booking.ID,
		CustomerUserID:     owner.ID,
		DesignerProviderID: designer.ID,
		CurrentStage:       model.BusinessFlowStageConstructionPartyPending,
	}
	for _, record := range []interface{}{&owner, &designerUser, &designer, &booking, &proposal, &flow} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed merchant construction preparation fixture: %v", err)
		}
	}

	_, libraryItem := seedQuotePreparationTemplate(t, db, "三居", "全屋翻新", model.QuoteLibraryItem{
		Base:         model.Base{ID: 9827},
		StandardCode: "STD-WP-003",
		ERPItemCode:  "ERP-WP-003",
		Name:         "墙地面防水",
		Unit:         "㎡",
		CategoryL1:   "防水",
	}, true)
	foreman := model.Provider{
		Base:         model.Base{ID: 9828},
		ProviderType: 3,
		SubType:      "foreman",
		CompanyName:  "桥接工长C",
		Status:       1,
		WorkTypes:    "waterproof",
		ServiceArea:  `["浦东新区"]`,
	}
	if err := db.Create(&foreman).Error; err != nil {
		t.Fatalf("create foreman: %v", err)
	}
	if err := db.Create(&model.MerchantServiceSetting{ProviderID: foreman.ID, AcceptBooking: true}).Error; err != nil {
		t.Fatalf("create foreman merchant setting: %v", err)
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
		t.Fatalf("upsert foreman price book: %v", err)
	}
	if _, err := svc.PublishProviderPriceBook(foreman.ID); err != nil {
		t.Fatalf("publish foreman price book: %v", err)
	}

	preparation, err := svc.StartMerchantConstructionPreparation(designer.ID, booking.ID)
	if err != nil {
		t.Fatalf("StartMerchantConstructionPreparation: %v", err)
	}
	if preparation.QuoteListID == 0 {
		t.Fatalf("expected quote list id after preparation start")
	}
	if len(preparation.QuantityItems) == 0 {
		t.Fatalf("expected quantity items generated from proposal")
	}

	preparation, err = svc.UpdateMerchantConstructionPreparationPrerequisites(designer.ID, preparation.QuoteListID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              booking.Area,
		Layout:            booking.HouseLayout,
		RenovationType:    booking.RenovationType,
		ConstructionScope: "防水",
		ServiceAreas:      []string{"浦东新区"},
		WorkTypes:         []string{"waterproof"},
		HouseUsage:        "自住",
		Notes:             "施工报价准备完成",
	})
	if err != nil {
		t.Fatalf("UpdateMerchantConstructionPreparationPrerequisites: %v", err)
	}
	if preparation.PrerequisiteStatus != model.QuoteTaskPrerequisiteComplete {
		t.Fatalf("expected prerequisite complete, got %s", preparation.PrerequisiteStatus)
	}

	preparation, err = svc.SelectMerchantConstructionForemen(designer.ID, owner.ID, preparation.QuoteListID, []uint64{foreman.ID})
	if err != nil {
		t.Fatalf("SelectMerchantConstructionForemen: %v", err)
	}
	if preparation.SelectedForemanID != foreman.ID {
		t.Fatalf("expected selected foreman id=%d, got %d", foreman.ID, preparation.SelectedForemanID)
	}

	var quoteList model.QuoteList
	if err := db.First(&quoteList, preparation.QuoteListID).Error; err != nil {
		t.Fatalf("reload quote list: %v", err)
	}
	if quoteList.Status != model.QuoteListStatusPricingInProgress {
		t.Fatalf("expected quote list status pricing_in_progress, got %s", quoteList.Status)
	}

	var updatedFlow model.BusinessFlow
	if err := db.Where("source_type = ? AND source_id = ?", model.BusinessFlowSourceBooking, booking.ID).First(&updatedFlow).Error; err != nil {
		t.Fatalf("reload business flow: %v", err)
	}
	if updatedFlow.SelectedQuoteTaskID != quoteList.ID {
		t.Fatalf("expected selected quote task id=%d, got %d", quoteList.ID, updatedFlow.SelectedQuoteTaskID)
	}
	if updatedFlow.SelectedForemanProviderID != foreman.ID {
		t.Fatalf("expected selected foreman provider id=%d, got %d", foreman.ID, updatedFlow.SelectedForemanProviderID)
	}
	if updatedFlow.CurrentStage != model.BusinessFlowStageConstructionPartyPending {
		t.Fatalf("expected current stage remain construction_party_pending, got %s", updatedFlow.CurrentStage)
	}

	var submissionCount int64
	if err := db.Model(&model.QuoteSubmission{}).Where("quote_list_id = ?", quoteList.ID).Count(&submissionCount).Error; err != nil {
		t.Fatalf("count quote submissions: %v", err)
	}
	if submissionCount != 1 {
		t.Fatalf("expected one generated quote submission, got %d", submissionCount)
	}
}

func TestGetMerchantQuoteListDetailIncludesQuantityBase(t *testing.T) {
	db := setupQuoteServiceDB(t)

	user := model.User{Phone: "13800138010", Nickname: "业主A"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	provider := model.Provider{UserID: user.ID, ProviderType: 3, SubType: "foreman", CompanyName: "工长A"}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	quoteList := model.QuoteList{
		Title:               "施工报价任务",
		Status:              model.QuoteListStatusPricingInProgress,
		Currency:            "CNY",
		OwnerUserID:         user.ID,
		ProposalID:          66,
		ProposalVersion:     3,
		QuantityBaseID:      88,
		QuantityBaseVersion: 3,
		SourceType:          model.QuantitySourceTypeProposal,
		SourceID:            66,
	}
	if err := db.Create(&quoteList).Error; err != nil {
		t.Fatalf("create quote list: %v", err)
	}
	quantityBase := model.QuantityBase{
		Base:            model.Base{ID: 88},
		ProposalID:      66,
		ProposalVersion: 3,
		OwnerUserID:     user.ID,
		SourceType:      model.QuantitySourceTypeProposal,
		SourceID:        66,
		Status:          model.QuantityBaseStatusActive,
		Version:         3,
		Title:           "方案 66 工程量基础表",
	}
	if err := db.Create(&quantityBase).Error; err != nil {
		t.Fatalf("create quantity base: %v", err)
	}
	quantityItem := model.QuantityBaseItem{
		QuantityBaseID: 88,
		SourceItemName: "地面找平",
		Unit:           "㎡",
		Quantity:       18,
		BaselineNote:   "按设计方案基准量计算",
		CategoryL1:     "泥瓦",
		CategoryL2:     "地面",
		SortOrder:      1,
	}
	if err := db.Create(&quantityItem).Error; err != nil {
		t.Fatalf("create quantity item: %v", err)
	}
	invitation := model.QuoteInvitation{
		QuoteListID: quoteList.ID,
		ProviderID:  provider.ID,
		Status:      model.QuoteInvitationStatusInvited,
	}
	if err := db.Create(&invitation).Error; err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	detail, err := (&QuoteService{}).GetMerchantQuoteListDetail(quoteList.ID, provider.ID)
	if err != nil {
		t.Fatalf("GetMerchantQuoteListDetail: %v", err)
	}
	if detail.QuantityBase == nil {
		t.Fatalf("expected quantity base in merchant detail")
	}
	if detail.QuantityBase.ID != quantityBase.ID {
		t.Fatalf("expected quantity base id=%d, got %d", quantityBase.ID, detail.QuantityBase.ID)
	}
	if len(detail.QuantityItems) != 1 {
		t.Fatalf("expected 1 quantity item, got %d", len(detail.QuantityItems))
	}
	if detail.QuantityItems[0].BaselineNote != "按设计方案基准量计算" {
		t.Fatalf("expected baseline note to be returned")
	}
}

func TestRebuildQuoteListFromLegacy_IsIdempotentAndPersistsSource(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	owner := model.User{Base: model.Base{ID: 6001}, Phone: "13800600001", Nickname: "业主", Status: 1}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	legacyTask := model.QuoteTask{
		Base:        model.Base{ID: 6101},
		UserID:      owner.ID,
		Area:        98,
		Style:       "现代简约",
		Region:      "上海",
		Budget:      280000,
		Description: "旧链待重建任务",
		Status:      "completed",
	}
	if err := db.Create(&legacyTask).Error; err != nil {
		t.Fatalf("create legacy task: %v", err)
	}
	quantityBase := model.QuantityBase{
		Base:        model.Base{ID: 6201},
		OwnerUserID: owner.ID,
		SourceType:  model.QuantitySourceTypeAdminImported,
		SourceID:    legacyTask.ID,
		Status:      model.QuantityBaseStatusActive,
		Version:     2,
		Title:       "旧链重建基线",
	}
	if err := db.Create(&quantityBase).Error; err != nil {
		t.Fatalf("create quantity base: %v", err)
	}
	quantityItem := model.QuantityBaseItem{
		Base:           model.Base{ID: 6202},
		QuantityBaseID: quantityBase.ID,
		SourceItemName: "水电点位调整",
		Unit:           "项",
		Quantity:       2,
		CategoryL1:     "水电",
		SortOrder:      1,
	}
	if err := db.Create(&quantityItem).Error; err != nil {
		t.Fatalf("create quantity item: %v", err)
	}

	first, err := svc.RebuildQuoteListFromLegacy(&LegacyQuotePKRebuildInput{
		LegacyTaskID:   legacyTask.ID,
		QuantityBaseID: quantityBase.ID,
		Title:          "旧链重建报价单",
	})
	if err != nil {
		t.Fatalf("first rebuild: %v", err)
	}
	if first.QuoteListID == 0 {
		t.Fatalf("expected quote list id")
	}
	if !first.Created {
		t.Fatalf("expected first rebuild to create new quote list")
	}

	second, err := svc.RebuildQuoteListFromLegacy(&LegacyQuotePKRebuildInput{
		LegacyTaskID:   legacyTask.ID,
		QuantityBaseID: quantityBase.ID,
		Title:          "旧链重建报价单",
	})
	if err != nil {
		t.Fatalf("second rebuild: %v", err)
	}
	if second.QuoteListID != first.QuoteListID {
		t.Fatalf("expected idempotent quote list id, got first=%d second=%d", first.QuoteListID, second.QuoteListID)
	}
	if second.Created {
		t.Fatalf("expected second rebuild to reuse existing quote list")
	}

	var quoteList model.QuoteList
	if err := db.First(&quoteList, first.QuoteListID).Error; err != nil {
		t.Fatalf("load rebuilt quote list: %v", err)
	}
	if quoteList.SourceType != QuoteListSourceTypeLegacyQuotePKRebuild {
		t.Fatalf("unexpected source type: %s", quoteList.SourceType)
	}
	if quoteList.SourceID != legacyTask.ID {
		t.Fatalf("unexpected source id: got=%d want=%d", quoteList.SourceID, legacyTask.ID)
	}
	if quoteList.QuantityBaseID != quantityBase.ID {
		t.Fatalf("unexpected quantity base id: got=%d want=%d", quoteList.QuantityBaseID, quantityBase.ID)
	}

	var itemCount int64
	if err := db.Model(&model.QuoteListItem{}).Where("quote_list_id = ?", quoteList.ID).Count(&itemCount).Error; err != nil {
		t.Fatalf("count rebuilt quote list items: %v", err)
	}
	if itemCount != 1 {
		t.Fatalf("expected quantity-base items to be synchronized, got %d", itemCount)
	}
}

func TestUnifiedQuoteRuntimeSummariesExposeSameTruthAcrossDetails(t *testing.T) {
	db := setupQuoteServiceDB(t)
	svc := &QuoteService{}

	owner := model.User{Base: model.Base{ID: 7101}, Phone: "13800710101", Nickname: "业主B", Status: 1}
	providerUser := model.User{Base: model.Base{ID: 7102}, Phone: "13800710102", Nickname: "施工商B", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 7103}, UserID: providerUser.ID, ProviderType: 2, CompanyName: "施工公司B", Status: 1}
	project := model.Project{
		Base:                      model.Base{ID: 7104},
		OwnerID:                   owner.ID,
		ProviderID:                provider.ID,
		Name:                      "统一摘要项目",
		Address:                   "上海市徐汇区测试路 8 号",
		Status:                    model.ProjectStatusActive,
		BusinessStatus:            model.ProjectBusinessStatusConstructionQuoteConfirmed,
		CurrentPhase:              "待监理协调开工",
		QuoteConfirmedAt:          mustParseTimePointer(t, "2026-04-21T09:30:00Z"),
		PaymentPaused:             true,
		PaymentPausedReason:       "等待支付首付款",
		ConstructionQuote:         4567,
		SelectedQuoteSubmissionID: 7108,
	}
	order := model.Order{Base: model.Base{ID: 7105}, ProjectID: project.ID, OrderType: model.OrderTypeConstruction, OrderNo: "ORD-7105", Status: model.OrderStatusPending}
	planDueAt := mustParseTimePointer(t, "2026-04-25T10:00:00Z")
	paymentPlan := model.PaymentPlan{Base: model.Base{ID: 7106}, OrderID: order.ID, Type: "construction", Seq: 1, Name: "首付款", Amount: 4567, Status: model.PaymentPlanStatusPending, DueAt: planDueAt, Payable: true}
	quoteList := model.QuoteList{
		Base:                   model.Base{ID: 7107},
		ProjectID:              project.ID,
		OwnerUserID:            owner.ID,
		Title:                  "正式施工报价单",
		Status:                 model.QuoteListStatusSubmittedToUser,
		Currency:               "CNY",
		SourceType:             model.QuantitySourceTypeProposal,
		SourceID:               9001,
		PrerequisiteStatus:     model.QuoteTaskPrerequisiteComplete,
		UserConfirmationStatus: model.QuoteUserConfirmationPending,
		ActiveSubmissionID:     7108,
		AwardedProviderID:      provider.ID,
	}
	quoteItem := model.QuoteListItem{Base: model.Base{ID: 7109}, QuoteListID: quoteList.ID, Name: "防水施工", Unit: "㎡", Quantity: 12, SortOrder: 1}
	invitation := model.QuoteInvitation{Base: model.Base{ID: 7110}, QuoteListID: quoteList.ID, ProviderID: provider.ID, Status: model.QuoteInvitationStatusInvited}
	submission := model.QuoteSubmission{
		Base:                   model.Base{ID: 7108},
		QuoteListID:            quoteList.ID,
		ProviderID:             provider.ID,
		ProviderType:           provider.ProviderType,
		Status:                 model.QuoteSubmissionStatusSubmitted,
		TaskStatus:             model.QuoteListStatusSubmittedToUser,
		Currency:               "CNY",
		TotalCent:              456700,
		EstimatedDays:          35,
		TeamSize:               6,
		WorkTypes:              "水电,瓦工",
		ConstructionMethodNote: "先做闭水，再做墙地面找平",
		SiteVisitRequired:      true,
		SubmittedToUser:        true,
		ReviewStatus:           model.QuoteSubmissionReviewStatusPending,
	}
	submissionItem := model.QuoteSubmissionItem{
		Base:                 model.Base{ID: 7111},
		QuoteSubmissionID:    submission.ID,
		QuoteListItemID:      quoteItem.ID,
		UnitPriceCent:        38000,
		QuotedQuantity:       12,
		AmountCent:           456000,
		MissingPriceFlag:     true,
		DeviationFlag:        true,
		PlatformReviewFlag:   true,
		QuantityChangeReason: "现场补量",
	}
	revision := model.QuoteSubmissionRevision{
		Base:              model.Base{ID: 7112},
		QuoteSubmissionID: submission.ID,
		QuoteListID:       quoteList.ID,
		ProviderID:        provider.ID,
		RevisionNo:        3,
		Action:            "submit",
		PreviousStatus:    model.QuoteSubmissionStatusDraft,
		NextStatus:        model.QuoteSubmissionStatusSubmitted,
		PreviousTotalCent: 420000,
		NextTotalCent:     submission.TotalCent,
		ChangeReason:      "调整防水单价并补充现场增量",
	}
	changeOrder := model.ChangeOrder{
		Base:         model.Base{ID: 7113},
		ProjectID:    project.ID,
		Title:        "卫生间包管增项",
		AmountImpact: 1288,
		Status:       model.ChangeOrderStatusAdminSettlementRequired,
	}
	scheduledAt := mustParseTimePointer(t, "2026-04-26T08:00:00Z")
	payoutPaidAt := mustParseTimePointer(t, "2026-04-27T12:00:00Z")
	payout := model.PayoutOrder{
		Base:        model.Base{ID: 7114},
		BizType:     model.PayoutBizTypeSettlementOrder,
		BizID:       7115,
		ProviderID:  provider.ID,
		Amount:      9800,
		Channel:     model.PayoutChannelCustody,
		Status:      model.PayoutStatusProcessing,
		ScheduledAt: scheduledAt,
		PaidAt:      payoutPaidAt,
	}
	settlement := model.SettlementOrder{
		Base:              model.Base{ID: 7115},
		BizType:           model.PayoutBizTypeSettlementOrder,
		BizID:             changeOrder.ID,
		ProjectID:         project.ID,
		ProviderID:        provider.ID,
		GrossAmount:       10800,
		MerchantNetAmount: 9800,
		DueAt:             scheduledAt,
		PayoutOrderID:     payout.ID,
		Status:            model.SettlementStatusScheduled,
	}

	for _, record := range []interface{}{
		&owner,
		&providerUser,
		&provider,
		&project,
		&order,
		&paymentPlan,
		&quoteList,
		&quoteItem,
		&invitation,
		&submission,
		&submissionItem,
		&revision,
		&changeOrder,
		&payout,
		&settlement,
	} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed unified summary fixture: %v", err)
		}
	}

	adminDetail, err := svc.GetAdminQuoteListDetail(quoteList.ID)
	if err != nil {
		t.Fatalf("GetAdminQuoteListDetail: %v", err)
	}
	if adminDetail.QuoteTruthSummary == nil || adminDetail.QuoteTruthSummary.ActiveSubmissionID != submission.ID {
		t.Fatalf("admin detail missing quote truth summary: %+v", adminDetail.QuoteTruthSummary)
	}
	if adminDetail.SubmissionHealth == nil || adminDetail.SubmissionHealth.MissingPriceCount != 1 || adminDetail.SubmissionHealth.LastRevisionNo != 3 {
		t.Fatalf("admin detail missing submission health: %+v", adminDetail.SubmissionHealth)
	}
	if adminDetail.ChangeOrderSummary == nil || adminDetail.ChangeOrderSummary.PendingSettlementCount != 1 {
		t.Fatalf("admin detail missing change-order summary: %+v", adminDetail.ChangeOrderSummary)
	}
	if adminDetail.SettlementSummary == nil || adminDetail.SettlementSummary.LatestSettlementID != settlement.ID {
		t.Fatalf("admin detail missing settlement summary: %+v", adminDetail.SettlementSummary)
	}
	if adminDetail.PayoutSummary == nil || adminDetail.PayoutSummary.LatestPayoutID != payout.ID {
		t.Fatalf("admin detail missing payout summary: %+v", adminDetail.PayoutSummary)
	}

	merchantDetail, err := svc.GetMerchantQuoteListDetail(quoteList.ID, provider.ID)
	if err != nil {
		t.Fatalf("GetMerchantQuoteListDetail: %v", err)
	}
	if merchantDetail.CommercialExplanation == nil || merchantDetail.CommercialExplanation.TeamSize != 6 {
		t.Fatalf("merchant detail missing commercial explanation: %+v", merchantDetail.CommercialExplanation)
	}
	if merchantDetail.QuoteTruthSummary == nil || merchantDetail.QuoteTruthSummary.TotalCent != submission.TotalCent {
		t.Fatalf("merchant detail missing quote truth summary: %+v", merchantDetail.QuoteTruthSummary)
	}
	if merchantDetail.SubmissionHealth == nil || merchantDetail.SubmissionHealth.CanSubmit {
		t.Fatalf("merchant detail should be locked after submit-to-user: %+v", merchantDetail.SubmissionHealth)
	}

	userView, err := svc.GetUserQuoteTask(quoteList.ID, owner.ID)
	if err != nil {
		t.Fatalf("GetUserQuoteTask: %v", err)
	}
	if userView.QuoteTruthSummary == nil || userView.QuoteTruthSummary.QuoteListID != quoteList.ID {
		t.Fatalf("user quote task missing quote truth summary: %+v", userView.QuoteTruthSummary)
	}
	if userView.CommercialExplanation == nil || len(userView.CommercialExplanation.WorkTypes) != 2 {
		t.Fatalf("user quote task missing commercial explanation: %+v", userView.CommercialExplanation)
	}

	projectDetail, err := (&ProjectService{}).GetProjectDetail(project.ID)
	if err != nil {
		t.Fatalf("GetProjectDetail: %v", err)
	}
	if projectDetail.QuoteTruthSummary == nil || projectDetail.QuoteTruthSummary.ActiveSubmissionID != submission.ID {
		t.Fatalf("project detail missing quote truth summary: %+v", projectDetail.QuoteTruthSummary)
	}
	if projectDetail.ChangeOrderSummary == nil || projectDetail.ChangeOrderSummary.TotalCount != 1 {
		t.Fatalf("project detail missing change-order summary: %+v", projectDetail.ChangeOrderSummary)
	}
	if projectDetail.SettlementSummary == nil || projectDetail.SettlementSummary.Status != model.SettlementStatusScheduled {
		t.Fatalf("project detail missing settlement summary: %+v", projectDetail.SettlementSummary)
	}
	if projectDetail.PayoutSummary == nil || projectDetail.PayoutSummary.Status != model.PayoutStatusProcessing {
		t.Fatalf("project detail missing payout summary: %+v", projectDetail.PayoutSummary)
	}
	if projectDetail.FinancialClosureStatus == "" || projectDetail.NextPendingAction == "" {
		t.Fatalf("project detail missing closure status: financial=%q next=%q", projectDetail.FinancialClosureStatus, projectDetail.NextPendingAction)
	}
}

func TestReplaceMerchantConstructionPreparationItems_AllowsDraftSaveWithMissingRequiredItems(t *testing.T) {
	db := setupQuoteServiceDB(t)
	_, designer, booking := seedConfirmedBookingFlow(t, db)

	proposal := &model.Proposal{
		Base:              model.Base{ID: 9981},
		BookingID:         booking.ID,
		DesignerID:        designer.ID,
		Summary:           "施工报价准备草稿",
		Status:            model.ProposalStatusConfirmed,
		SourceType:        model.ProposalSourceBooking,
		Version:           1,
		InternalDraftJSON: `{"rooms":[]}`,
	}
	if err := db.Create(proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	_, libraryItem := seedQuotePreparationTemplate(t, db, "三居", "全屋翻新", model.QuoteLibraryItem{
		Base:         model.Base{ID: 9982},
		StandardCode: "STD-WP-9982",
		ERPItemCode:  "ERP-WP-9982",
		Name:         "墙地面防水",
		Unit:         "㎡",
		CategoryL1:   "泥瓦",
		CategoryL2:   "防水",
	}, true)

	svc := &QuoteService{}
	preparation, err := svc.StartMerchantConstructionPreparation(designer.ID, booking.ID)
	if err != nil {
		t.Fatalf("StartMerchantConstructionPreparation: %v", err)
	}
	if preparation.QuoteListID == 0 {
		t.Fatalf("expected quote list id after start")
	}

	preparation, err = svc.UpdateMerchantConstructionPreparationPrerequisites(designer.ID, preparation.QuoteListID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              booking.Area,
		Layout:            "3室2厅",
		RenovationType:    "全屋翻新",
		ConstructionScope: "防水",
		ServiceAreas:      []string{"测试小区"},
		HouseUsage:        "自住",
		Notes:             "先保存草稿",
	})
	if err != nil {
		t.Fatalf("UpdateMerchantConstructionPreparationPrerequisites: %v", err)
	}

	preparation, err = svc.ReplaceMerchantConstructionPreparationItems(designer.ID, preparation.QuoteListID, []MerchantQuantityItemInput{{
		StandardItemID: libraryItem.ID,
		Quantity:       0,
	}})
	if err != nil {
		t.Fatalf("ReplaceMerchantConstructionPreparationItems should allow incomplete draft, got %v", err)
	}
	if preparation.PrerequisiteStatus != model.QuoteTaskPrerequisiteDraft {
		t.Fatalf("expected prerequisite status draft, got %s", preparation.PrerequisiteStatus)
	}
	if !slices.Contains(preparation.MissingFields, "quantityItems") {
		t.Fatalf("expected missingFields include quantityItems, got %+v", preparation.MissingFields)
	}
	if len(preparation.QuantityItems) != 0 {
		t.Fatalf("expected no persisted quantity items for incomplete draft, got %d", len(preparation.QuantityItems))
	}

	var quoteList model.QuoteList
	if err := db.First(&quoteList, preparation.QuoteListID).Error; err != nil {
		t.Fatalf("reload quote list: %v", err)
	}
	if quoteList.Status != model.QuoteListStatusDraft {
		t.Fatalf("expected quote list remain draft after incomplete save, got %s", quoteList.Status)
	}

	validation, err := svc.ValidateTaskPrerequisites(preparation.QuoteListID)
	if err != nil {
		t.Fatalf("ValidateTaskPrerequisites: %v", err)
	}
	if validation.OK {
		t.Fatalf("expected validation not ok for incomplete construction preparation")
	}
	if !slices.Contains(validation.MissingFields, "quantityItems") {
		t.Fatalf("expected validation missing quantityItems, got %+v", validation.MissingFields)
	}
}

func TestMerchantConstructionPreparation_FiltersTemplateSectionsByConstructionScope(t *testing.T) {
	db := setupQuoteServiceDB(t)
	_, designer, booking := seedConfirmedBookingFlow(t, db)

	proposal := &model.Proposal{
		Base:              model.Base{ID: 9983},
		BookingID:         booking.ID,
		DesignerID:        designer.ID,
		Summary:           "施工范围过滤测试",
		Status:            model.ProposalStatusConfirmed,
		SourceType:        model.ProposalSourceBooking,
		Version:           1,
		InternalDraftJSON: `{"rooms":[]}`,
	}
	if err := db.Create(proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	waterproofItem := model.QuoteLibraryItem{
		Base:                model.Base{ID: 9984},
		StandardCode:        "STD-WP-9984",
		ERPItemCode:         "ERP-WP-9984",
		Name:                "墙地面防水",
		Unit:                "㎡",
		CategoryL1:          "泥瓦",
		CategoryL2:          "防水",
		Status:              model.QuoteLibraryItemStatusEnabled,
		QuantityFormulaJSON: `{"type":"area_multiplier","factor":1.2}`,
	}
	electricItem := model.QuoteLibraryItem{
		Base:                model.Base{ID: 9985},
		StandardCode:        "STD-EL-9985",
		ERPItemCode:         "ERP-EL-9985",
		Name:                "强弱电改造",
		Unit:                "m",
		CategoryL1:          "水电",
		CategoryL2:          "电路",
		Status:              model.QuoteLibraryItemStatusEnabled,
		QuantityFormulaJSON: `{"type":"fixed","factor":20}`,
	}
	for _, item := range []model.QuoteLibraryItem{waterproofItem, electricItem} {
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("create quote library item: %v", err)
		}
	}

	tmpl := model.QuoteTemplate{
		Name:           "三居-全屋翻新-模板",
		RoomType:       "三居",
		RenovationType: "全屋翻新",
		Status:         1,
	}
	if err := db.Create(&tmpl).Error; err != nil {
		t.Fatalf("create quote template: %v", err)
	}
	for idx, libraryItemID := range []uint64{waterproofItem.ID, electricItem.ID} {
		if err := db.Create(&model.QuoteTemplateItem{
			TemplateID:    tmpl.ID,
			LibraryItemID: libraryItemID,
			Required:      true,
			SortOrder:     idx + 1,
		}).Error; err != nil {
			t.Fatalf("create quote template item: %v", err)
		}
	}

	svc := &QuoteService{}
	preparation, err := svc.StartMerchantConstructionPreparation(designer.ID, booking.ID)
	if err != nil {
		t.Fatalf("StartMerchantConstructionPreparation: %v", err)
	}

	preparation, err = svc.UpdateMerchantConstructionPreparationPrerequisites(designer.ID, preparation.QuoteListID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              booking.Area,
		Layout:            "三室两厅",
		RenovationType:    "全屋翻新",
		ConstructionScope: "防水",
		ServiceAreas:      []string{"测试小区"},
		HouseUsage:        "自住",
		Notes:             "仅做防水",
	})
	if err != nil {
		t.Fatalf("UpdateMerchantConstructionPreparationPrerequisites: %v", err)
	}

	if len(preparation.TemplateSections) != 1 {
		t.Fatalf("expected 1 filtered template section, got %d", len(preparation.TemplateSections))
	}
	if len(preparation.TemplateSections[0].Rows) != 1 {
		t.Fatalf("expected 1 filtered template row, got %d", len(preparation.TemplateSections[0].Rows))
	}
	row := preparation.TemplateSections[0].Rows[0]
	if row.StandardItemID != waterproofItem.ID {
		t.Fatalf("expected waterproof item kept by scope, got %d", row.StandardItemID)
	}
	if row.SuggestedQuantity <= 0 {
		t.Fatalf("expected suggested quantity to be returned, got %v", row.SuggestedQuantity)
	}
	if row.InputQuantity != 0 {
		t.Fatalf("expected suggested quantity not auto applied to input, got %v", row.InputQuantity)
	}
	if !slices.Contains(preparation.MissingFields, "quantityItems") {
		t.Fatalf("expected quantityItems missing before fill, got %+v", preparation.MissingFields)
	}

	preparation, err = svc.ReplaceMerchantConstructionPreparationItems(designer.ID, preparation.QuoteListID, []MerchantQuantityItemInput{{
		StandardItemID: waterproofItem.ID,
		Quantity:       118,
	}})
	if err != nil {
		t.Fatalf("ReplaceMerchantConstructionPreparationItems: %v", err)
	}
	if slices.Contains(preparation.MissingFields, "quantityItems") {
		t.Fatalf("expected scoped required items to be complete, got %+v", preparation.MissingFields)
	}
	if preparation.PrerequisiteStatus != model.QuoteTaskPrerequisiteComplete {
		t.Fatalf("expected prerequisite status complete, got %s", preparation.PrerequisiteStatus)
	}
	if len(preparation.QuantityItems) != 1 || preparation.QuantityItems[0].StandardItemID != waterproofItem.ID {
		t.Fatalf("expected only waterproof baseline item persisted, got %+v", preparation.QuantityItems)
	}
}

func TestMerchantConstructionPreparation_ScopeFilteringUsesExactScopes(t *testing.T) {
	db := setupQuoteServiceDB(t)
	_, designer, booking := seedConfirmedBookingFlow(t, db)

	proposal := &model.Proposal{
		Base:              model.Base{ID: 9986},
		BookingID:         booking.ID,
		DesignerID:        designer.ID,
		Summary:           "施工范围精确过滤",
		Status:            model.ProposalStatusConfirmed,
		SourceType:        model.ProposalSourceBooking,
		Version:           1,
		InternalDraftJSON: `{"rooms":[]}`,
	}
	if err := db.Create(proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	items := []model.QuoteLibraryItem{
		{
			Base:         model.Base{ID: 9987},
			StandardCode: "STD-PAI-9987",
			ERPItemCode:  "ERP-PAI-9987",
			Name:         "普通墙面腻子基层处理",
			Unit:         "㎡",
			CategoryL1:   "油工",
			CategoryL2:   "腻子找平",
			Status:       model.QuoteLibraryItemStatusEnabled,
		},
		{
			Base:         model.Base{ID: 9988},
			StandardCode: "STD-CEI-9988",
			ERPItemCode:  "ERP-CEI-9988",
			Name:         "防水石膏板吊平顶",
			Unit:         "㎡",
			CategoryL1:   "木作",
			CategoryL2:   "吊顶",
			Status:       model.QuoteLibraryItemStatusEnabled,
		},
		{
			Base:         model.Base{ID: 9989},
			StandardCode: "STD-WT-9989",
			ERPItemCode:  "ERP-WT-9989",
			Name:         "地砖铺贴",
			Unit:         "㎡",
			CategoryL1:   "泥瓦",
			CategoryL2:   "地砖铺贴",
			Status:       model.QuoteLibraryItemStatusEnabled,
		},
	}
	for _, item := range items {
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("create quote library item: %v", err)
		}
	}

	tmpl := model.QuoteTemplate{
		Name:           "三居-全案设计服务-模板",
		RoomType:       "三居",
		RenovationType: "全案设计服务",
		Status:         1,
	}
	if err := db.Create(&tmpl).Error; err != nil {
		t.Fatalf("create quote template: %v", err)
	}
	for idx, libraryItemID := range []uint64{9987, 9988, 9989} {
		if err := db.Create(&model.QuoteTemplateItem{
			TemplateID:    tmpl.ID,
			LibraryItemID: libraryItemID,
			Required:      true,
			SortOrder:     idx + 1,
		}).Error; err != nil {
			t.Fatalf("create quote template item: %v", err)
		}
	}

	svc := &QuoteService{}
	preparation, err := svc.StartMerchantConstructionPreparation(designer.ID, booking.ID)
	if err != nil {
		t.Fatalf("StartMerchantConstructionPreparation: %v", err)
	}

	preparation, err = svc.UpdateMerchantConstructionPreparationPrerequisites(designer.ID, preparation.QuoteListID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              booking.Area,
		Layout:            "三室两厅",
		RenovationType:    "全案设计服务",
		ConstructionScope: "泥瓦",
		ServiceAreas:      []string{"测试小区"},
		HouseUsage:        "自住",
		Notes:             "只做泥瓦",
	})
	if err != nil {
		t.Fatalf("UpdateMerchantConstructionPreparationPrerequisites: %v", err)
	}

	if len(preparation.TemplateSections) != 1 {
		t.Fatalf("expected only one section for exact mudwork scope, got %d", len(preparation.TemplateSections))
	}
	if len(preparation.TemplateSections[0].Rows) != 1 {
		t.Fatalf("expected only one row for exact mudwork scope, got %d", len(preparation.TemplateSections[0].Rows))
	}
	if preparation.TemplateSections[0].Rows[0].StandardItemID != 9989 {
		t.Fatalf("expected only mudwork item kept, got %+v", preparation.TemplateSections[0].Rows[0])
	}
}

func TestMerchantConstructionPreparation_SuggestsQuantityWithoutFormula(t *testing.T) {
	db := setupQuoteServiceDB(t)
	_, designer, booking := seedConfirmedBookingFlow(t, db)

	proposal := &model.Proposal{
		Base:              model.Base{ID: 9990},
		BookingID:         booking.ID,
		DesignerID:        designer.ID,
		Summary:           "建议量兜底测试",
		Status:            model.ProposalStatusConfirmed,
		SourceType:        model.ProposalSourceBooking,
		Version:           1,
		InternalDraftJSON: `{"rooms":[]}`,
	}
	if err := db.Create(proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	libraryItem := model.QuoteLibraryItem{
		Base:         model.Base{ID: 9991},
		StandardCode: "STD-WAT-9991",
		ERPItemCode:  "ERP-WAT-9991",
		Name:         "墙地面防水",
		Unit:         "㎡",
		CategoryL1:   "防水",
		CategoryL2:   "墙地面防水",
		Status:       model.QuoteLibraryItemStatusEnabled,
	}
	if err := db.Create(&libraryItem).Error; err != nil {
		t.Fatalf("create quote library item: %v", err)
	}

	tmpl := model.QuoteTemplate{
		Name:           "三居-全案设计服务-防水模板",
		RoomType:       "三居",
		RenovationType: "全案设计服务",
		Status:         1,
	}
	if err := db.Create(&tmpl).Error; err != nil {
		t.Fatalf("create quote template: %v", err)
	}
	if err := db.Create(&model.QuoteTemplateItem{
		TemplateID:    tmpl.ID,
		LibraryItemID: libraryItem.ID,
		Required:      true,
		SortOrder:     1,
	}).Error; err != nil {
		t.Fatalf("create quote template item: %v", err)
	}

	svc := &QuoteService{}
	preparation, err := svc.StartMerchantConstructionPreparation(designer.ID, booking.ID)
	if err != nil {
		t.Fatalf("StartMerchantConstructionPreparation: %v", err)
	}

	preparation, err = svc.UpdateMerchantConstructionPreparationPrerequisites(designer.ID, preparation.QuoteListID, &QuoteTaskPrerequisiteUpdateInput{
		Area:              90,
		Layout:            "三室两厅",
		RenovationType:    "全案设计服务",
		ConstructionScope: "防水",
		ServiceAreas:      []string{"测试小区"},
		HouseUsage:        "自住",
		Notes:             "只做防水",
	})
	if err != nil {
		t.Fatalf("UpdateMerchantConstructionPreparationPrerequisites: %v", err)
	}

	if len(preparation.TemplateSections) != 1 || len(preparation.TemplateSections[0].Rows) != 1 {
		t.Fatalf("expected one waterproof row, got %+v", preparation.TemplateSections)
	}
	row := preparation.TemplateSections[0].Rows[0]
	if row.SuggestedQuantity <= 0 {
		t.Fatalf("expected heuristic suggested quantity, got %+v", row)
	}
	if row.SuggestedQuantity != 108 {
		t.Fatalf("expected heuristic suggested quantity 108, got %v", row.SuggestedQuantity)
	}
}

func TestParseRoomTypeSupportsChineseLabels(t *testing.T) {
	cases := map[string]string{
		"三室两厅": "三居",
		"三室":   "三居",
		"二居":   "二居",
		"4室2厅": "四居",
	}

	for input, expected := range cases {
		if actual := parseRoomType(input); actual != expected {
			t.Fatalf("expected parseRoomType(%q)=%q, got %q", input, expected, actual)
		}
	}
}

func TestUserConfirmQuoteSubmissionDoesNotCreateSecondProjectOnRepeatOrInvalidStatus(t *testing.T) {
	t.Run("repeat confirm reuses existing project without creating second one", func(t *testing.T) {
		db := setupQuoteServiceDB(t)
		svc := &QuoteService{}
		fixture := seedQuoteConfirmationFixture(t, db, model.QuoteListStatusSubmittedToUser)

		first, err := svc.UserConfirmQuoteSubmission(fixture.submission.ID, fixture.owner.ID)
		if err != nil {
			t.Fatalf("first UserConfirmQuoteSubmission: %v", err)
		}
		if first.ProjectID == 0 {
			t.Fatalf("expected project created on first confirmation")
		}

		_, err = svc.UserConfirmQuoteSubmission(fixture.submission.ID, fixture.owner.ID)
		if err == nil || !strings.Contains(err.Error(), "当前报价任务状态不允许确认") {
			t.Fatalf("expected invalid status error on repeat confirm, got %v", err)
		}

		var projectCount int64
		if err := db.Model(&model.Project{}).Where("proposal_id = ?", fixture.proposal.ID).Count(&projectCount).Error; err != nil {
			t.Fatalf("count projects after repeat confirm: %v", err)
		}
		if projectCount != 1 {
			t.Fatalf("expected project count remain 1, got %d", projectCount)
		}
	})

	t.Run("invalid initial status does not create project", func(t *testing.T) {
		db := setupQuoteServiceDB(t)
		svc := &QuoteService{}
		fixture := seedQuoteConfirmationFixture(t, db, model.QuoteListStatusDraft)

		_, err := svc.UserConfirmQuoteSubmission(fixture.submission.ID, fixture.owner.ID)
		if err == nil || !strings.Contains(err.Error(), "当前报价任务状态不允许确认") {
			t.Fatalf("expected invalid status error, got %v", err)
		}

		var projectCount int64
		if err := db.Model(&model.Project{}).Where("proposal_id = ?", fixture.proposal.ID).Count(&projectCount).Error; err != nil {
			t.Fatalf("count projects after invalid status confirm: %v", err)
		}
		if projectCount != 0 {
			t.Fatalf("expected no project created for invalid status, got %d", projectCount)
		}
	})
}

func TestUserConfirmQuoteSubmissionRollsBackProjectArtifactsWhenOutboxWriteFails(t *testing.T) {
	db := setupQuoteServiceDBWithoutOutboxEvent(t)
	svc := &QuoteService{}
	fixture := seedQuoteConfirmationFixture(t, db, model.QuoteListStatusSubmittedToUser)

	_, err := svc.UserConfirmQuoteSubmission(fixture.submission.ID, fixture.owner.ID)
	if err == nil {
		t.Fatalf("expected confirmation to fail when outbox_events table is missing")
	}

	var projectCount int64
	if err := db.Model(&model.Project{}).Where("proposal_id = ?", fixture.proposal.ID).Count(&projectCount).Error; err != nil {
		t.Fatalf("count projects after rollback: %v", err)
	}
	if projectCount != 0 {
		t.Fatalf("expected project rollback, got %d projects", projectCount)
	}

	var escrowCount int64
	if err := db.Model(&model.EscrowAccount{}).Count(&escrowCount).Error; err != nil {
		t.Fatalf("count escrow after rollback: %v", err)
	}
	if escrowCount != 0 {
		t.Fatalf("expected escrow rollback, got %d", escrowCount)
	}

	var phaseCount int64
	if err := db.Model(&model.ProjectPhase{}).Count(&phaseCount).Error; err != nil {
		t.Fatalf("count phases after rollback: %v", err)
	}
	if phaseCount != 0 {
		t.Fatalf("expected phase rollback, got %d", phaseCount)
	}

	var milestoneCount int64
	if err := db.Model(&model.Milestone{}).Count(&milestoneCount).Error; err != nil {
		t.Fatalf("count milestones after rollback: %v", err)
	}
	if milestoneCount != 0 {
		t.Fatalf("expected milestone rollback, got %d", milestoneCount)
	}

	var quoteList model.QuoteList
	if err := db.First(&quoteList, fixture.quoteList.ID).Error; err != nil {
		t.Fatalf("reload quote list after rollback: %v", err)
	}
	if quoteList.ProjectID != 0 {
		t.Fatalf("expected quote list project binding rolled back, got %d", quoteList.ProjectID)
	}
	if quoteList.Status != model.QuoteListStatusSubmittedToUser {
		t.Fatalf("expected quote list status rolled back, got %s", quoteList.Status)
	}

	var flow model.BusinessFlow
	if err := db.First(&flow, fixture.flow.ID).Error; err != nil {
		t.Fatalf("reload business flow after rollback: %v", err)
	}
	if flow.ProjectID != 0 {
		t.Fatalf("expected business flow project binding rolled back, got %d", flow.ProjectID)
	}
	if flow.CurrentStage != model.BusinessFlowStageConstructionQuotePending {
		t.Fatalf("expected business flow stage rolled back, got %s", flow.CurrentStage)
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
