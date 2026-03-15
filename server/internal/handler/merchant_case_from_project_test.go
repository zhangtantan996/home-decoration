package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupMerchantCaseProjectTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.Project{}, &model.Proposal{}, &model.WorkLog{}, &model.CaseAudit{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})
	return db
}

func TestMerchantCaseCreateFromProject(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupMerchantCaseProjectTestDB(t)

	project := model.Project{Base: model.Base{ID: 101}, ProviderID: 22, ProposalID: 201, Name: "浦东三居室", Address: "浦东新区测试路 88 号", Area: 89, Budget: 188000}
	proposal := model.Proposal{Base: model.Base{ID: 201}, DesignerID: 22, Summary: "现代简约全屋方案", DesignFee: 8000, ConstructionFee: 120000, MaterialFee: 60000, Attachments: `["/uploads/proposal/a.jpg"]`}
	workLog := model.WorkLog{Base: model.Base{ID: 301}, ProjectID: 101, Photos: `["/uploads/worklog/1.jpg","/uploads/worklog/2.jpg"]`}
	for _, record := range []interface{}{&project, &proposal, &workLog} {
		if err := db.Create(record).Error; err != nil {
			t.Fatalf("seed data: %v", err)
		}
	}

	body, _ := json.Marshal(map[string]any{"style": "奶油风"})
	req := httptest.NewRequest(http.MethodPost, "/merchant/projects/101/cases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "projectId", Value: "101"}}
	c.Set("providerId", uint64(22))

	MerchantCaseCreateFromProject(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", w.Code, w.Body.String())
	}

	var count int64
	if err := db.Model(&model.CaseAudit{}).Count(&count).Error; err != nil {
		t.Fatalf("count audits: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 audit, got %d", count)
	}

	var audit model.CaseAudit
	if err := db.First(&audit).Error; err != nil {
		t.Fatalf("query audit: %v", err)
	}
	if audit.ProviderID != 22 || audit.ActionType != "create" || audit.Status != 0 {
		t.Fatalf("unexpected audit: %+v", audit)
	}
	if audit.Title == "" || audit.CoverImage == "" || audit.QuoteTotalCent <= 0 {
		t.Fatalf("expected generated title/cover/quote, got %+v", audit)
	}
}
