package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestMerchantUpdateProposalNormalizesArrayAssetFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.Proposal{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })

	proposal := model.Proposal{
		Base:       model.Base{ID: 92001},
		DesignerID: 31001,
		Status:     model.ProposalStatusPending,
	}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("seed proposal: %v", err)
	}

	payload := map[string]any{
		"summary":         "更新后的方案",
		"designFee":       1000,
		"constructionFee": 2000,
		"materialFee":     3000,
		"estimatedDays":   30,
		"attachments":     `["https://cdn.example.com/uploads/root-attachment.pdf?x=1"]`,
		"internalDraftJson": `{
			"sketchImages":["https://cdn.example.com/uploads/sketch-a.png?token=1"],
			"cadSourceFiles":["https://cdn.example.com/static/cad-a.dwg"]
		}`,
		"previewPackageJson": `{
			"floorPlanImages":["https://cdn.example.com/uploads/floor-a.png?version=2"],
			"effectPreviewImages":["https://cdn.example.com/uploads/effect-a.png"],
			"effectPreviewLinks":["https://example.com/render/preview-1"]
		}`,
		"deliveryPackageJson": `{
			"floorPlanImages":["https://cdn.example.com/uploads/floor-b.png"],
			"effectImages":["https://cdn.example.com/uploads/effect-b.png"],
			"effectLinks":["https://example.com/render/delivery-1"],
			"cadFiles":["https://cdn.example.com/static/cad-b.dwg"],
			"attachments":["https://cdn.example.com/uploads/delivery-attachment.pdf"]
		}`,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: "92001"}}
	c.Request = httptest.NewRequest(http.MethodPut, "/api/v1/merchant/proposals/92001", bytes.NewReader(bodyBytes))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("providerId", proposal.DesignerID)
	c.Set("userId", uint64(41001))

	MerchantUpdateProposal(c)

	resp := decodeResponse(t, w)
	if resp.Code != 0 {
		t.Fatalf("unexpected response: code=%d message=%s", resp.Code, resp.Message)
	}

	var updated model.Proposal
	if err := db.First(&updated, proposal.ID).Error; err != nil {
		t.Fatalf("load proposal: %v", err)
	}

	if updated.Attachments != `["/uploads/root-attachment.pdf"]` {
		t.Fatalf("unexpected attachments: %s", updated.Attachments)
	}
	if updated.InternalDraftJSON != `{"cadSourceFiles":["/static/cad-a.dwg"],"sketchImages":["/uploads/sketch-a.png"]}` {
		t.Fatalf("unexpected internal draft json: %s", updated.InternalDraftJSON)
	}
	if updated.PreviewPackageJSON != `{"effectPreviewImages":["/uploads/effect-a.png"],"effectPreviewLinks":["https://example.com/render/preview-1"],"floorPlanImages":["/uploads/floor-a.png"]}` {
		t.Fatalf("unexpected preview package json: %s", updated.PreviewPackageJSON)
	}
	if updated.DeliveryPackageJSON != `{"attachments":["/uploads/delivery-attachment.pdf"],"cadFiles":["/static/cad-b.dwg"],"effectImages":["/uploads/effect-b.png"],"effectLinks":["https://example.com/render/delivery-1"],"floorPlanImages":["/uploads/floor-b.png"]}` {
		t.Fatalf("unexpected delivery package json: %s", updated.DeliveryPackageJSON)
	}
}
