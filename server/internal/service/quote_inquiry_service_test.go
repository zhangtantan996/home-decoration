package service

import (
	"encoding/base64"
	"testing"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupQuoteInquiryServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.QuoteInquiry{}); err != nil {
		t.Fatalf("auto migrate quote inquiry: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	return db
}

func setQuoteInquiryJWTSecret(t *testing.T, secret string) {
	t.Helper()
	cfg := config.GetConfig()
	previous := cfg.JWT.Secret
	cfg.JWT.Secret = secret
	t.Cleanup(func() {
		cfg.JWT.Secret = previous
	})
}

func TestQuoteInquiryService_Calculate(t *testing.T) {
	service := &QuoteInquiryService{}

	tests := []struct {
		name    string
		req     *CreateInquiryRequest
		wantErr bool
	}{
		{
			name: "标准户型-现代简约-二线城市",
			req: &CreateInquiryRequest{
				Address:        "杭州市西湖区文一路",
				CityCode:       "330100",
				Area:           100,
				HouseLayout:    "3室2厅2卫",
				RenovationType: "新房装修",
				Style:          "现代简约",
			},
		},
		{
			name: "小户型-北欧-一线城市",
			req: &CreateInquiryRequest{
				Address:        "北京市朝阳区",
				CityCode:       "110100",
				Area:           50,
				HouseLayout:    "1室1厅1卫",
				RenovationType: "新房装修",
				Style:          "北欧",
			},
		},
		{
			name: "英文枚举自动归一化",
			req: &CreateInquiryRequest{
				Address:        "成都市高新区",
				Area:           90,
				HouseLayout:    "2室2厅1卫",
				RenovationType: "old",
				Style:          "modern",
			},
		},
		{
			name: "面积超上限",
			req: &CreateInquiryRequest{
				Address:        "上海市徐汇区漕溪北路",
				Area:           2001,
				HouseLayout:    "5室2厅3卫",
				RenovationType: "新房装修",
				Style:          "现代简约",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.Calculate(tt.req)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Calculate() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if result.TotalMin <= 0 || result.TotalMax <= 0 {
				t.Fatalf("invalid quote range: min=%v max=%v", result.TotalMin, result.TotalMax)
			}
			if result.TotalMin > result.TotalMax {
				t.Fatalf("invalid quote order: min=%v max=%v", result.TotalMin, result.TotalMax)
			}
			if result.EstimatedDuration < 30 || result.EstimatedDuration > 180 {
				t.Fatalf("invalid duration: %d", result.EstimatedDuration)
			}
			if len(result.Breakdown) != 3 {
				t.Fatalf("expected 3 breakdown items, got %d", len(result.Breakdown))
			}
		})
	}
}

func TestQuoteInquiryService_CreateInquiry_NormalizesAndEncrypts(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	db := setupQuoteInquiryServiceTestDB(t)
	svc := &QuoteInquiryService{}

	var zero uint64
	inquiry, result, err := svc.CreateInquiry(&CreateInquiryRequest{
		UserID:         &zero,
		Address:        "杭州市西湖区文一路 88 号",
		Area:           98,
		HouseLayout:    "3室2厅2卫",
		RenovationType: "new",
		Style:          "modern",
		BudgetRange:    "10-20万",
		Phone:          "13800138000",
	})
	if err != nil {
		t.Fatalf("CreateInquiry: %v", err)
	}
	if inquiry.UserID != nil {
		t.Fatalf("expected nil user id for anonymous request, got %+v", inquiry.UserID)
	}
	if inquiry.RenovationType != "新房装修" {
		t.Fatalf("expected normalized renovation type, got %q", inquiry.RenovationType)
	}
	if inquiry.Style != "现代简约" {
		t.Fatalf("expected normalized style, got %q", inquiry.Style)
	}
	if inquiry.CityCode != "330100" {
		t.Fatalf("expected inferred city code 330100, got %q", inquiry.CityCode)
	}
	if result == nil || len(result.Tips) == 0 {
		t.Fatalf("expected quote result with tips")
	}

	var raw struct {
		UserID           *uint64
		Phone            string
		PhoneEncrypted   string
		Address          string
		AddressEncrypted string
	}
	if err := db.Table("quote_inquiries").
		Select("user_id, phone, phone_encrypted, address, address_encrypted").
		Where("id = ?", inquiry.ID).
		Scan(&raw).Error; err != nil {
		t.Fatalf("scan raw inquiry: %v", err)
	}
	if raw.UserID != nil {
		t.Fatalf("expected raw user_id to stay nil, got %+v", raw.UserID)
	}
	if raw.PhoneEncrypted == "" || raw.AddressEncrypted == "" {
		t.Fatalf("expected encrypted columns, got %+v", raw)
	}
	if raw.Phone == "13800138000" || raw.Address == "杭州市西湖区文一路 88 号" {
		t.Fatalf("expected masked raw fields, got %+v", raw)
	}

	stored, err := svc.getInquiryByID(inquiry.ID)
	if err != nil {
		t.Fatalf("getInquiryByID: %v", err)
	}
	if stored.Phone != "13800138000" {
		t.Fatalf("expected decrypted phone, got %q", stored.Phone)
	}
	if stored.Address != "杭州市西湖区文一路 88 号" {
		t.Fatalf("expected decrypted address, got %q", stored.Address)
	}
}

func TestQuoteInquiryService_IssueAndVerifyAccessToken(t *testing.T) {
	setQuoteInquiryJWTSecret(t, "quote-inquiry-test-secret")
	svc := &QuoteInquiryService{}

	token, err := svc.IssueAccessToken(88)
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}
	if err := svc.VerifyAccessToken(token, 88); err != nil {
		t.Fatalf("VerifyAccessToken: %v", err)
	}
	if err := svc.VerifyAccessToken(token, 89); err == nil {
		t.Fatalf("expected token verification to fail for mismatched inquiry id")
	}
}

func TestQuoteInquiryService_GetInquiryDetailForPublic_AccessControl(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	setupQuoteInquiryServiceTestDB(t)
	setQuoteInquiryJWTSecret(t, "quote-inquiry-test-secret")

	svc := &QuoteInquiryService{}
	userID := uint64(101)
	inquiry, _, err := svc.CreateInquiry(&CreateInquiryRequest{
		UserID:         &userID,
		Address:        "北京市朝阳区酒仙桥路 1 号",
		Area:           120,
		HouseLayout:    "3室2厅2卫",
		RenovationType: "新房装修",
		Style:          "北欧",
		Phone:          "13800138101",
	})
	if err != nil {
		t.Fatalf("CreateInquiry: %v", err)
	}

	token, err := svc.IssueAccessToken(inquiry.ID)
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}

	if _, err := svc.GetInquiryDetailForPublic(inquiry.ID, userID, ""); err != nil {
		t.Fatalf("expected owner access to succeed: %v", err)
	}
	if _, err := svc.GetInquiryDetailForPublic(inquiry.ID, 0, token); err != nil {
		t.Fatalf("expected anonymous access with token to succeed: %v", err)
	}
	if _, err := svc.GetInquiryDetailForPublic(inquiry.ID, userID+1, token); err == nil {
		t.Fatalf("expected different logged-in user to be rejected")
	}
	if _, err := svc.GetInquiryDetailForPublic(inquiry.ID, 0, ""); err == nil {
		t.Fatalf("expected anonymous access without token to be rejected")
	}
}

func TestQuoteInquiryService_AdminListInquiries_Filters(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	db := setupQuoteInquiryServiceTestDB(t)
	svc := &QuoteInquiryService{}

	first, _, err := svc.CreateInquiry(&CreateInquiryRequest{
		Address:        "杭州市拱墅区湖墅南路 10 号",
		Area:           88,
		HouseLayout:    "2室2厅1卫",
		RenovationType: "new",
		Style:          "modern",
		Phone:          "13800138111",
		Source:         "mini_program",
	})
	if err != nil {
		t.Fatalf("CreateInquiry first: %v", err)
	}
	second, _, err := svc.CreateInquiry(&CreateInquiryRequest{
		Address:        "北京市朝阳区建国路 88 号",
		Area:           140,
		HouseLayout:    "4室2厅2卫",
		RenovationType: "old",
		Style:          "nordic",
		Source:         "mini_program",
	})
	if err != nil {
		t.Fatalf("CreateInquiry second: %v", err)
	}
	third, _, err := svc.CreateInquiry(&CreateInquiryRequest{
		Address:        "成都市高新区天府大道 99 号",
		Area:           105,
		HouseLayout:    "3室2厅2卫",
		RenovationType: "partial",
		Style:          "cream",
		Phone:          "13800138123",
		Source:         "wechat_mp",
	})
	if err != nil {
		t.Fatalf("CreateInquiry third: %v", err)
	}

	oldTime := time.Date(2026, 4, 1, 10, 0, 0, 0, time.Local)
	midTime := time.Date(2026, 4, 10, 10, 0, 0, 0, time.Local)
	newTime := time.Date(2026, 4, 18, 10, 0, 0, 0, time.Local)

	if err := db.Model(&model.QuoteInquiry{}).Where("id = ?", first.ID).Updates(map[string]any{
		"created_at":         oldTime,
		"updated_at":         oldTime,
		"conversion_status":  "pending",
	}).Error; err != nil {
		t.Fatalf("update first inquiry: %v", err)
	}
	if err := db.Model(&model.QuoteInquiry{}).Where("id = ?", second.ID).Updates(map[string]any{
		"created_at":         midTime,
		"updated_at":         midTime,
		"conversion_status":  "converted",
	}).Error; err != nil {
		t.Fatalf("update second inquiry: %v", err)
	}
	if err := db.Model(&model.QuoteInquiry{}).Where("id = ?", third.ID).Updates(map[string]any{
		"created_at":         newTime,
		"updated_at":         newTime,
		"conversion_status":  "pending",
	}).Error; err != nil {
		t.Fatalf("update third inquiry: %v", err)
	}

	cityItems, total, err := svc.AdminListInquiries(AdminQuoteInquiryListFilter{
		Page:     1,
		PageSize: 10,
		City:     "杭州",
	})
	if err != nil {
		t.Fatalf("AdminListInquiries city filter: %v", err)
	}
	if total != 1 || len(cityItems) != 1 || cityItems[0].ID != first.ID {
		t.Fatalf("unexpected city filter result: total=%d items=%+v", total, cityItems)
	}

	hasPhone := true
	phoneItems, total, err := svc.AdminListInquiries(AdminQuoteInquiryListFilter{
		Page:     1,
		PageSize: 10,
		HasPhone: &hasPhone,
	})
	if err != nil {
		t.Fatalf("AdminListInquiries hasPhone=true: %v", err)
	}
	if total != 2 || len(phoneItems) != 2 {
		t.Fatalf("unexpected hasPhone filter result: total=%d len=%d", total, len(phoneItems))
	}

	noPhone := false
	noPhoneItems, total, err := svc.AdminListInquiries(AdminQuoteInquiryListFilter{
		Page:     1,
		PageSize: 10,
		HasPhone: &noPhone,
	})
	if err != nil {
		t.Fatalf("AdminListInquiries hasPhone=false: %v", err)
	}
	if total != 1 || len(noPhoneItems) != 1 || noPhoneItems[0].ID != second.ID {
		t.Fatalf("unexpected no-phone filter result: total=%d items=%+v", total, noPhoneItems)
	}

	keywordItems, total, err := svc.AdminListInquiries(AdminQuoteInquiryListFilter{
		Page:     1,
		PageSize: 10,
		Keyword:  "北欧",
	})
	if err != nil {
		t.Fatalf("AdminListInquiries keyword: %v", err)
	}
	if total != 1 || len(keywordItems) != 1 || keywordItems[0].ID != second.ID {
		t.Fatalf("unexpected keyword filter result: total=%d items=%+v", total, keywordItems)
	}

	dateItems, total, err := svc.AdminListInquiries(AdminQuoteInquiryListFilter{
		Page:      1,
		PageSize:  10,
		StartDate: "2026-04-15",
		EndDate:   "2026-04-19",
	})
	if err != nil {
		t.Fatalf("AdminListInquiries date range: %v", err)
	}
	if total != 1 || len(dateItems) != 1 || dateItems[0].ID != third.ID {
		t.Fatalf("unexpected date filter result: total=%d items=%+v", total, dateItems)
	}
}
