package handler

import "testing"

func TestNormalizeStoredAssetJSONMapNormalizesStringArrays(t *testing.T) {
	raw := `{
		"summary":"预览摘要",
		"floorPlanImages":["https://cdn.example.com/uploads/a.png?x=1","/uploads/b.png",""],
		"effectPreviewImages":["https://cdn.example.com/uploads/c.png"],
		"effectLinks":["https://example.com/render/1"],
		"attachments":["https://cdn.example.com/static/file.pdf"]
	}`

	normalized := normalizeStoredAssetJSONMap(
		raw,
		"floorPlanImages",
		"effectPreviewImages",
		"effectLinks",
		"attachments",
	)

	expected := `{"attachments":["/static/file.pdf"],"effectLinks":["https://example.com/render/1"],"effectPreviewImages":["/uploads/c.png"],"floorPlanImages":["/uploads/a.png","/uploads/b.png"],"summary":"预览摘要"}`
	if normalized != expected {
		t.Fatalf("unexpected normalized json:\nwant: %s\ngot:  %s", expected, normalized)
	}
}
