package service

import (
	"encoding/base64"
	"testing"

	"home-decoration-server/internal/model"
)

func TestSensitiveFieldsStoredEncryptedForBookingAndProject(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))

	db := setupProjectServiceTestDB(t)

	user := model.User{Base: model.Base{ID: 4001}, Phone: "13800138401", Status: 1}
	provider := model.Provider{Base: model.Base{ID: 4002}, ProviderType: 2, CompanyName: "加密施工方"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}

	bookingSvc := &BookingService{}
	booking, err := bookingSvc.Create(user.ID, &CreateBookingRequest{
		ProviderID:     provider.ID,
		ProviderType:   "company",
		Address:        "西安市高新区科技路 88 号",
		Area:           120,
		PreferredDate:  "2026-03-25",
		Phone:          "13800138401",
		Notes:          "门禁密码 9527",
		RenovationType: "全屋翻新",
	})
	if err != nil {
		t.Fatalf("Create booking: %v", err)
	}

	var rawBooking struct {
		Address          string
		AddressEncrypted string
		Phone            string
		PhoneEncrypted   string
		Notes            string
		NotesEncrypted   string
	}
	if err := db.Table("bookings").
		Select("address, address_encrypted, phone, phone_encrypted, notes, notes_encrypted").
		Where("id = ?", booking.ID).
		Scan(&rawBooking).Error; err != nil {
		t.Fatalf("scan raw booking: %v", err)
	}
	if rawBooking.AddressEncrypted == "" || rawBooking.PhoneEncrypted == "" || rawBooking.NotesEncrypted == "" {
		t.Fatalf("expected encrypted booking columns, got %+v", rawBooking)
	}
	if rawBooking.Address == "西安市高新区科技路 88 号" || rawBooking.Phone == "13800138401" || rawBooking.Notes == "门禁密码 9527" {
		t.Fatalf("expected raw booking fields not to remain plaintext, got %+v", rawBooking)
	}

	projectSvc := &ProjectService{}
	project, err := projectSvc.CreateProject(&CreateProjectRequest{
		OwnerID:    user.ID,
		ProviderID: provider.ID,
		Name:       "加密项目",
		Address:    "西安市雁塔区丈八一路 66 号",
		Latitude:   34.22345,
		Longitude:  108.91234,
		Area:       98,
		Budget:     200000,
	})
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	var rawProject struct {
		Address            string
		AddressEncrypted   string
		Latitude           float64
		LatitudeEncrypted  string
		Longitude          float64
		LongitudeEncrypted string
	}
	if err := db.Table("projects").
		Select("address, address_encrypted, latitude, latitude_encrypted, longitude, longitude_encrypted").
		Where("id = ?", project.ID).
		Scan(&rawProject).Error; err != nil {
		t.Fatalf("scan raw project: %v", err)
	}
	if rawProject.AddressEncrypted == "" || rawProject.LatitudeEncrypted == "" || rawProject.LongitudeEncrypted == "" {
		t.Fatalf("expected encrypted project columns, got %+v", rawProject)
	}
	if rawProject.Address == "西安市雁塔区丈八一路 66 号" || rawProject.Latitude != 0 || rawProject.Longitude != 0 {
		t.Fatalf("expected raw project sensitive fields not to remain plaintext, got %+v", rawProject)
	}

	detail, err := projectSvc.GetProjectDetailForOwner(project.ID, user.ID)
	if err != nil {
		t.Fatalf("GetProjectDetailForOwner: %v", err)
	}
	if detail.Address != "西安市雁塔区丈八一路 66 号" || detail.Latitude != 34.22345 || detail.Longitude != 108.91234 {
		t.Fatalf("expected decrypted project detail, got %+v", detail.Project)
	}
}
