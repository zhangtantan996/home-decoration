package service

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupLegalComplianceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.SystemConfig{}, &model.LegalComplianceRelease{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })
	return db
}

func seedLegalSystemConfigs(t *testing.T, db *gorm.DB) {
	t.Helper()
	items := []model.SystemConfig{
		{Key: model.ConfigKeyPublicLegalVersion, Value: "v1.3.1-20260530", Editable: true},
		{Key: model.ConfigKeyPublicLegalEffectiveDate, Value: "2026-05-30", Editable: true},
	}
	for _, def := range legalDocumentDefinitions() {
		items = append(items, model.SystemConfig{
			Key:      def.ConfigKey,
			Value:    def.DefaultContent(),
			Editable: true,
		})
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("seed legal configs: %v", err)
	}
	(&ConfigService{}).ClearCache()
}

func TestLegalComplianceLegacyImportIsIdempotent(t *testing.T) {
	db := setupLegalComplianceTestDB(t)
	seedLegalSystemConfigs(t, db)
	svc := &LegalComplianceService{}

	if err := svc.EnsureLegacyReleaseImported(); err != nil {
		t.Fatalf("first import: %v", err)
	}
	if err := svc.EnsureLegacyReleaseImported(); err != nil {
		t.Fatalf("second import: %v", err)
	}

	var count int64
	if err := db.Model(&model.LegalComplianceRelease{}).Count(&count).Error; err != nil {
		t.Fatalf("count releases: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one imported release, got %d", count)
	}
	var release model.LegalComplianceRelease
	if err := db.First(&release).Error; err != nil {
		t.Fatalf("load release: %v", err)
	}
	if !release.LegacyImported || release.Version != "v1.3.1-20260530" {
		t.Fatalf("unexpected imported release: %+v", release)
	}
	var docs []LegalDocumentSnapshot
	if err := json.Unmarshal([]byte(release.DocumentsJSON), &docs); err != nil {
		t.Fatalf("decode documents: %v", err)
	}
	if len(docs) != len(legalDocumentDefinitions()) {
		t.Fatalf("expected %d docs, got %d", len(legalDocumentDefinitions()), len(docs))
	}
}

func TestPublicSiteConfigPrefersActiveLegalComplianceRelease(t *testing.T) {
	db := setupLegalComplianceTestDB(t)
	seedLegalSystemConfigs(t, db)
	svc := &LegalComplianceService{}
	if err := svc.EnsureLegacyReleaseImported(); err != nil {
		t.Fatalf("import legacy: %v", err)
	}
	docs := svc.buildLegacySnapshotsFromConfigs()
	for index := range docs {
		if docs[index].Slug == "transaction-rules" {
			docs[index].Content = "这是新版轻预约服务规则，已经通过统一协议包发布，公开读取必须优先使用该内容。"
		}
	}
	docJSON, err := encodeLegalDocumentsJSON(docs)
	if err != nil {
		t.Fatalf("encode docs: %v", err)
	}
	effectiveAt := time.Now().Add(-time.Hour)
	publishedAt := time.Now()
	if err := db.Create(&model.LegalComplianceRelease{
		Version:        "v1.3.2-20260604",
		EffectiveAt:    &effectiveAt,
		PublishedAt:    &publishedAt,
		DocumentsJSON:  docJSON,
		ContentHash:    hashLegalDocuments(docs),
		ChangeSummary:  "测试发布",
		Reason:         "测试公开读取",
		Status:         model.LegalComplianceReleaseStatusPublished,
		LegacyImported: false,
	}).Error; err != nil {
		t.Fatalf("create release: %v", err)
	}

	config := (&ConfigService{}).GetPublicSiteConfig()
	if config.LegalVersion != "v1.3.2-20260604" {
		t.Fatalf("expected active release version, got %q", config.LegalVersion)
	}
	if !strings.Contains(config.TransactionRules, "新版轻预约服务规则") {
		t.Fatalf("expected transaction rules from release, got %q", config.TransactionRules)
	}
	if len(config.LegalDocuments) != len(legalDocumentDefinitions()) {
		t.Fatalf("expected legal documents from release")
	}
	if config.LegalDocuments[0].ReleaseID == 0 || config.LegalDocuments[0].PublishedAt == "" {
		t.Fatalf("expected release metadata on public legal documents: %+v", config.LegalDocuments[0])
	}
}

func TestLegalComplianceDraftDoesNotAffectPublicUntilPublished(t *testing.T) {
	db := setupLegalComplianceTestDB(t)
	seedLegalSystemConfigs(t, db)
	svc := &LegalComplianceService{}
	if err := svc.EnsureLegacyReleaseImported(); err != nil {
		t.Fatalf("import legacy: %v", err)
	}
	before := (&ConfigService{}).GetPublicSiteConfig()

	draft, err := svc.SaveDraftDocument("user-agreement", "这是保存中的用户服务协议草稿，尚未发布前不能影响公开端展示内容。")
	if err != nil {
		t.Fatalf("save draft: %v", err)
	}
	if draft == nil || draft.ID == 0 {
		t.Fatalf("expected persisted draft, got %+v", draft)
	}
	afterDraft := (&ConfigService{}).GetPublicSiteConfig()
	if afterDraft.LegalVersion != before.LegalVersion || afterDraft.LegalDocuments[0].Content == draft.Documents[0].Content {
		t.Fatalf("draft should not affect public config before publish")
	}

	effectiveAt := time.Now().Add(-time.Hour)
	release, err := svc.PublishDraft(PublishLegalComplianceInput{
		VersionBump:   "patch",
		EffectiveAt:   effectiveAt.Format(time.RFC3339),
		ChangeSummary: "发布用户协议草稿",
		Reason:        "测试发布",
		AdminID:       7,
	})
	if err != nil {
		t.Fatalf("publish draft: %v", err)
	}
	if release.Version != "v1.3.2-"+effectiveAt.Format("20060102") {
		t.Fatalf("unexpected generated version: %s", release.Version)
	}
	var draftCount int64
	if err := db.Model(&model.LegalComplianceRelease{}).
		Where("status = ?", model.LegalComplianceReleaseStatusDraft).
		Count(&draftCount).Error; err != nil {
		t.Fatalf("count drafts: %v", err)
	}
	if draftCount != 0 {
		t.Fatalf("expected draft to be cleared after publish, got %d", draftCount)
	}
	afterPublish := (&ConfigService{}).GetPublicSiteConfig()
	if afterPublish.LegalVersion != release.Version {
		t.Fatalf("expected public version %s after publish, got %s", release.Version, afterPublish.LegalVersion)
	}
	if !strings.Contains(afterPublish.LegalDocuments[0].Content, "保存中的用户服务协议草稿") {
		t.Fatalf("expected published draft content to become public")
	}
}

func TestLegalComplianceDraftStartsFromPendingRelease(t *testing.T) {
	db := setupLegalComplianceTestDB(t)
	seedLegalSystemConfigs(t, db)
	svc := &LegalComplianceService{}
	if err := svc.EnsureLegacyReleaseImported(); err != nil {
		t.Fatalf("import legacy: %v", err)
	}

	docs := svc.buildLegacySnapshotsFromConfigs()
	for index := range docs {
		if docs[index].Slug == "privacy-policy" {
			docs[index].Content = "这是未来生效的隐私政策改动，后续新建草稿时不能因为仍未生效而被覆盖。"
		}
	}
	docJSON, err := encodeLegalDocumentsJSON(docs)
	if err != nil {
		t.Fatalf("encode docs: %v", err)
	}
	effectiveAt := time.Now().Add(24 * time.Hour)
	publishedAt := time.Now()
	if err := db.Create(&model.LegalComplianceRelease{
		Version:       "v1.3.2-" + effectiveAt.Format("20060102"),
		EffectiveAt:   &effectiveAt,
		PublishedAt:   &publishedAt,
		DocumentsJSON: docJSON,
		ContentHash:   hashLegalDocuments(docs),
		ChangeSummary: "测试未来生效版本",
		Reason:        "测试待生效草稿基线",
		Status:        model.LegalComplianceReleaseStatusPublished,
	}).Error; err != nil {
		t.Fatalf("create pending release: %v", err)
	}

	current, err := svc.CurrentView()
	if err != nil {
		t.Fatalf("current view: %v", err)
	}
	var pendingRow *LegalComplianceDocumentAdminRow
	for index := range current.Documents {
		if current.Documents[index].Slug == "privacy-policy" {
			pendingRow = &current.Documents[index]
			break
		}
	}
	if pendingRow == nil || pendingRow.Status != "pending_effective" {
		t.Fatalf("expected pending_effective row, got %+v", pendingRow)
	}

	draft, err := svc.SaveDraftDocument("user-agreement", "这是基于待生效协议包继续编辑的用户服务协议草稿，不能丢失其他待生效文档。")
	if err != nil {
		t.Fatalf("save draft from pending: %v", err)
	}
	var preserved bool
	for _, doc := range draft.Documents {
		if doc.Slug == "privacy-policy" && strings.Contains(doc.Content, "未来生效的隐私政策改动") {
			preserved = true
			break
		}
	}
	if !preserved {
		t.Fatalf("expected draft to preserve pending privacy policy content")
	}
}
