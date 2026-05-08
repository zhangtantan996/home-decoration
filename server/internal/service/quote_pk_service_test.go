package service

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupQuotePKServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Provider{},
		&model.Booking{},
		&model.Notification{},
		&model.UserSettings{},
		&model.QuoteTask{},
		&model.QuotePKSubmission{},
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

func seedQuotePKProvider(t *testing.T, db *gorm.DB, providerID, userID uint64, displayName string, rating float32) model.Provider {
	t.Helper()

	user := model.User{
		Base:     model.Base{ID: userID},
		Phone:    fmt.Sprintf("138%08d", userID%100000000),
		Nickname: displayName,
		Status:   1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create provider user: %v", err)
	}

	provider := model.Provider{
		Base:            model.Base{ID: providerID},
		UserID:          userID,
		ProviderType:    3,
		DisplayName:     displayName,
		Verified:        true,
		Status:          1,
		Rating:          rating,
		CompletedCnt:    int(providerID),
		ServiceArea:     "[\"610100\"]",
		WorkTypes:       "water,electric",
		Specialty:       "全工种施工",
		PriceUnit:       model.ProviderPriceUnitPerSquareMeter,
		IsSettled:       true,
		ReviewCount:     3,
		YearsExperience: 8,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	return provider
}

func TestQuotePKServiceCreateQuoteTask_NotifiesMatchedProviders(t *testing.T) {
	db := setupQuotePKServiceTestDB(t)
	svc := &QuotePKService{}

	owner := model.User{Base: model.Base{ID: 1001}, Phone: "13800138001", Nickname: "业主", Status: 1}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	booking := model.Booking{
		Base:         model.Base{ID: 2001},
		UserID:       owner.ID,
		ProviderType: "foreman",
		Address:      "西安测试小区",
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}

	seedQuotePKProvider(t, db, 3001, 4001, "工长甲", 4.8)
	seedQuotePKProvider(t, db, 3002, 4002, "工长乙", 4.6)
	seedQuotePKProvider(t, db, 3003, 4003, "工长丙", 4.5)

	task, err := svc.CreateQuoteTask(owner.ID, CreateQuoteTaskRequest{
		BookingID:   booking.ID,
		Area:        88,
		Style:       "现代",
		Region:      "610100",
		Budget:      250000,
		Description: "老房翻新",
	})
	if err != nil {
		t.Fatalf("CreateQuoteTask: %v", err)
	}
	if task.Status != "in_progress" {
		t.Fatalf("expected task in_progress, got %s", task.Status)
	}

	var notifications []model.Notification
	if err := db.Where("user_type = ? AND related_type = ?", "provider", "quote_task").Order("user_id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifications) != 3 {
		t.Fatalf("expected 3 provider notifications, got %d", len(notifications))
	}
	for _, notification := range notifications {
		if notification.Type != "quote.submitted" {
			t.Fatalf("expected legacy provider notification type quote.submitted, got %s", notification.Type)
		}
		if notification.RelatedID != task.ID {
			t.Fatalf("expected notification related id=%d, got %d", task.ID, notification.RelatedID)
		}
		if notification.ActionURL != fmt.Sprintf("/quote-pk/tasks?quoteTaskId=%d", task.ID) {
			t.Fatalf("expected provider action url to target legacy crew task list, got %s", notification.ActionURL)
		}
	}
}

func TestQuotePKServiceSubmitQuote_NotifiesTaskOwner(t *testing.T) {
	db := setupQuotePKServiceTestDB(t)
	svc := &QuotePKService{}

	owner := model.User{Base: model.Base{ID: 1001}, Phone: "13800138011", Nickname: "业主", Status: 1}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	provider := seedQuotePKProvider(t, db, 3001, 4001, "工长甲", 4.8)

	expiredAt := time.Now().Add(24 * time.Hour)
	task := model.QuoteTask{
		Base:      model.Base{ID: 2001},
		BookingID: 5001,
		UserID:    owner.ID,
		Status:    "in_progress",
		ExpiredAt: &expiredAt,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}

	submission, err := svc.SubmitQuote(provider.ID, task.ID, SubmitQuoteRequest{
		TotalPrice:  98000,
		Duration:    45,
		Materials:   "主材甲供",
		Description: "含水电改造",
	})
	if err != nil {
		t.Fatalf("SubmitQuote: %v", err)
	}
	if submission.Status != "pending" {
		t.Fatalf("expected submission pending, got %s", submission.Status)
	}

	var notification model.Notification
	if err := db.Where("user_id = ? AND user_type = ?", owner.ID, "user").First(&notification).Error; err != nil {
		t.Fatalf("load owner notification: %v", err)
	}
	if notification.Type != "quote.submitted" {
		t.Fatalf("expected quote.submitted, got %s", notification.Type)
	}
	if notification.RelatedType != "quote_task" || notification.RelatedID != task.ID {
		t.Fatalf("expected related quote_task #%d, got %s #%d", task.ID, notification.RelatedType, notification.RelatedID)
	}
	if notification.ActionURL != fmt.Sprintf("/quote-pk/tasks/%d", task.ID) {
		t.Fatalf("expected legacy quote task action url, got %s", notification.ActionURL)
	}
}

func TestQuotePKServiceSelectQuote_NotifiesSelectedAndRejectedProviders(t *testing.T) {
	db := setupQuotePKServiceTestDB(t)
	svc := &QuotePKService{}

	owner := model.User{Base: model.Base{ID: 1001}, Phone: "13800138021", Nickname: "业主", Status: 1}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	selectedProvider := seedQuotePKProvider(t, db, 3001, 4001, "工长甲", 4.8)
	rejectedProvider := seedQuotePKProvider(t, db, 3002, 4002, "工长乙", 4.6)

	task := model.QuoteTask{
		Base:      model.Base{ID: 2001},
		BookingID: 5001,
		UserID:    owner.ID,
		Status:    "in_progress",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}
	now := time.Now()
	selectedSubmission := model.QuotePKSubmission{
		Base:        model.Base{ID: 6001},
		QuoteTaskID: task.ID,
		ProviderID:  selectedProvider.ID,
		TotalPrice:  100000,
		Duration:    45,
		Status:      "pending",
		SubmittedAt: &now,
	}
	rejectedSubmission := model.QuotePKSubmission{
		Base:        model.Base{ID: 6002},
		QuoteTaskID: task.ID,
		ProviderID:  rejectedProvider.ID,
		TotalPrice:  120000,
		Duration:    50,
		Status:      "pending",
		SubmittedAt: &now,
	}
	if err := db.Create(&selectedSubmission).Error; err != nil {
		t.Fatalf("create selected submission: %v", err)
	}
	if err := db.Create(&rejectedSubmission).Error; err != nil {
		t.Fatalf("create rejected submission: %v", err)
	}

	if err := svc.SelectQuote(owner.ID, task.ID, selectedSubmission.ID); err != nil {
		t.Fatalf("SelectQuote: %v", err)
	}

	var notifications []model.Notification
	if err := db.Where("related_type = ? AND related_id = ?", "quote_task", task.ID).Order("user_id ASC, id ASC").Find(&notifications).Error; err != nil {
		t.Fatalf("load provider notifications: %v", err)
	}
	if len(notifications) != 2 {
		t.Fatalf("expected 2 provider notifications, got %d", len(notifications))
	}
	if notifications[0].Type != "quote.awarded" {
		t.Fatalf("expected selected provider awarded notification, got %s", notifications[0].Type)
	}
	if notifications[1].Type != "quote.rejected" {
		t.Fatalf("expected rejected provider rejected notification, got %s", notifications[1].Type)
	}
}

func TestBuildMerchantQuoteTaskLookupQuery_UsesDistinctSubqueryInsteadOfGroupedSelect(t *testing.T) {
	db := setupQuotePKServiceTestDB(t).Session(&gorm.Session{DryRun: true})

	var tasks []model.QuoteTask
	sql := buildMerchantQuoteTaskLookupQuery(db, 3001, 4001).Find(&tasks).Statement.SQL.String()
	if sql == "" {
		t.Fatalf("expected generated SQL")
	}
	if strings.Contains(strings.ToLower(sql), "group by") {
		t.Fatalf("expected merchant quote task lookup to avoid grouped select, got %s", sql)
	}
	if !strings.Contains(strings.ToLower(sql), "distinct") {
		t.Fatalf("expected merchant quote task lookup to use distinct task ids, got %s", sql)
	}
}

func TestQuotePKServiceGetMerchantQuoteTasks_ReturnsParticipatedTasks(t *testing.T) {
	db := setupQuotePKServiceTestDB(t)
	svc := &QuotePKService{}

	provider := seedQuotePKProvider(t, db, 3001, 4001, "工长甲", 4.8)

	firstTask := model.QuoteTask{
		Base:        model.Base{ID: 2001},
		BookingID:   5001,
		UserID:      1001,
		Area:        88,
		Style:       "现代",
		Region:      "610100",
		Budget:      250000,
		Description: "老房翻新",
		Status:      "in_progress",
	}
	secondTask := model.QuoteTask{
		Base:        model.Base{ID: 2002},
		BookingID:   5002,
		UserID:      1002,
		Area:        128,
		Style:       "原木",
		Region:      "610100",
		Budget:      350000,
		Description: "新房精装",
		Status:      "completed",
	}
	if err := db.Create(&firstTask).Error; err != nil {
		t.Fatalf("create first task: %v", err)
	}
	if err := db.Create(&secondTask).Error; err != nil {
		t.Fatalf("create second task: %v", err)
	}
	if err := db.Create(&model.QuotePKSubmission{
		Base:        model.Base{ID: 6001},
		QuoteTaskID: firstTask.ID,
		ProviderID:  provider.ID,
		TotalPrice:  98000,
		Duration:    45,
		Status:      "pending",
	}).Error; err != nil {
		t.Fatalf("create submission: %v", err)
	}

	tasks, err := svc.GetMerchantQuoteTasks(provider.ID)
	if err != nil {
		t.Fatalf("GetMerchantQuoteTasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 participated task, got %d", len(tasks))
	}
	if tasks[0].ID != firstTask.ID {
		t.Fatalf("expected task id=%d, got %d", firstTask.ID, tasks[0].ID)
	}
}

func TestQuotePKServiceGetMerchantQuoteTasks_ReturnsNotifiedTasksWithoutSubmission(t *testing.T) {
	db := setupQuotePKServiceTestDB(t)
	svc := &QuotePKService{}

	provider := seedQuotePKProvider(t, db, 3001, 4001, "工长甲", 4.8)

	task := model.QuoteTask{
		Base:        model.Base{ID: 2001},
		BookingID:   5001,
		UserID:      1001,
		Area:        88,
		Style:       "现代",
		Region:      "610100",
		Budget:      250000,
		Description: "老房翻新",
		Status:      "in_progress",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}
	if err := db.Create(&model.Notification{
		Base:        model.Base{ID: 7001},
		UserID:      provider.UserID,
		UserType:    "provider",
		Title:       "新的报价任务待处理",
		Content:     "测试通知",
		Type:        "quote.submitted",
		RelatedID:   task.ID,
		RelatedType: "quote_task",
		ActionURL:   fmt.Sprintf("/quote-pk/tasks?quoteTaskId=%d", task.ID),
	}).Error; err != nil {
		t.Fatalf("create notification: %v", err)
	}

	tasks, err := svc.GetMerchantQuoteTasks(provider.ID)
	if err != nil {
		t.Fatalf("GetMerchantQuoteTasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 notified task, got %d", len(tasks))
	}
	if tasks[0].ID != task.ID {
		t.Fatalf("expected task id=%d, got %d", task.ID, tasks[0].ID)
	}
}
