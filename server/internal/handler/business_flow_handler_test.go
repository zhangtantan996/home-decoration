package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestGetProposalSanitizesSensitivePackagesBeforeUnlock(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Proposal{}, &model.Order{}, &model.SystemConfig{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		configSvc.ClearCache()
	})
	configSvc.ClearCache()

	proposal := model.Proposal{
		Base:                model.Base{ID: 901},
		Summary:             "测试方案",
		InternalDraftJSON:   `{"communicationNotes":"仅平台可见"}`,
		PreviewPackageJSON:  `{"summary":"用户可见摘要"}`,
		DeliveryPackageJSON: `{"cadFiles":["https://example.com/a.dwg"]}`,
		Attachments:         `["https://example.com/a.pdf"]`,
		Status:              model.ProposalStatusPending,
	}
	order := model.Order{
		Base:       model.Base{ID: 902},
		ProposalID: proposal.ID,
		OrderType:  model.OrderTypeDesign,
		Status:     model.OrderStatusPending,
	}
	for _, value := range []interface{}{&proposal, &order} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: "901"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/proposals/901", nil)

	GetProposal(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		Proposal struct {
			InternalDraftJSON   string `json:"internalDraftJson"`
			PreviewPackageJSON  string `json:"previewPackageJson"`
			DeliveryPackageJSON string `json:"deliveryPackageJson"`
			Attachments         string `json:"attachments"`
		} `json:"proposal"`
		DeliveryUnlocked bool `json:"deliveryUnlocked"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}
	if data.DeliveryUnlocked {
		t.Fatalf("expected locked delivery")
	}
	if data.Proposal.InternalDraftJSON != "{}" {
		t.Fatalf("expected internal draft hidden, got %s", data.Proposal.InternalDraftJSON)
	}
	if data.Proposal.DeliveryPackageJSON == "{}" || data.Proposal.DeliveryPackageJSON == "" {
		t.Fatalf("expected delivery package preserved for proposal review, got %s", data.Proposal.DeliveryPackageJSON)
	}
	if data.Proposal.Attachments != "[]" {
		t.Fatalf("expected legacy attachments hidden, got %s", data.Proposal.Attachments)
	}
	if data.Proposal.PreviewPackageJSON == "{}" || data.Proposal.PreviewPackageJSON == "" {
		t.Fatalf("expected preview package preserved, got %s", data.Proposal.PreviewPackageJSON)
	}
}

func TestGetProposalRespectsDesignFeeUnlockConfig(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Proposal{}, &model.Order{}, &model.SystemConfig{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
		configSvc.ClearCache()
	})

	if err := db.Create(&model.SystemConfig{
		Key:      model.ConfigKeyDesignFeeUnlockDownload,
		Value:    "false",
		Editable: true,
	}).Error; err != nil {
		t.Fatalf("seed unlock config: %v", err)
	}
	configSvc.ClearCache()

	proposal := model.Proposal{
		Base:                model.Base{ID: 911},
		Summary:             "已支付方案",
		InternalDraftJSON:   `{"communicationNotes":"隐藏"}`,
		DeliveryPackageJSON: `{"cadFiles":["https://example.com/paid.dwg"]}`,
		Status:              model.ProposalStatusConfirmed,
	}
	order := model.Order{
		Base:       model.Base{ID: 912},
		ProposalID: proposal.ID,
		OrderType:  model.OrderTypeDesign,
		Status:     model.OrderStatusPaid,
	}
	for _, value := range []interface{}{&proposal, &order} {
		if err := db.Create(value).Error; err != nil {
			t.Fatalf("seed fixture: %v", err)
		}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: "911"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/proposals/911", nil)

	GetProposal(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected code: %d message=%s", resp.Code, resp.Message)
	}

	var data struct {
		Proposal struct {
			DeliveryPackageJSON string `json:"deliveryPackageJson"`
		} `json:"proposal"`
		DeliveryUnlocked bool `json:"deliveryUnlocked"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("decode response data: %v", err)
	}
	if data.DeliveryUnlocked {
		t.Fatalf("expected delivery to remain locked when config=false")
	}
	if data.Proposal.DeliveryPackageJSON == "{}" || data.Proposal.DeliveryPackageJSON == "" {
		t.Fatalf("expected delivery package preserved even when download remains locked, got %s", data.Proposal.DeliveryPackageJSON)
	}
}
