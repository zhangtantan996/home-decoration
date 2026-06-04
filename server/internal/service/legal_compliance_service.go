package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"regexp"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

type LegalDocumentDefinition struct {
	Slug           string
	Title          string
	Category       string
	ConfigKey      string
	DefaultContent func() string
}

type LegalDocumentSnapshot struct {
	Slug           string `json:"slug"`
	Title          string `json:"title"`
	Category       string `json:"category"`
	Content        string `json:"content"`
	CharacterCount int    `json:"characterCount"`
}

type LegalComplianceReleaseView struct {
	ID                 uint64                  `json:"id"`
	Version            string                  `json:"version"`
	EffectiveAt        string                  `json:"effectiveAt"`
	EffectiveDate      string                  `json:"effectiveDate"`
	PublishedAt        string                  `json:"publishedAt,omitempty"`
	PublishedByAdminID uint64                  `json:"publishedByAdminId"`
	Documents          []LegalDocumentSnapshot `json:"documents"`
	ContentHash        string                  `json:"contentHash"`
	ChangeSummary      string                  `json:"changeSummary"`
	Reason             string                  `json:"reason"`
	Status             string                  `json:"status"`
	LegacyImported     bool                    `json:"legacyImported"`
	CreatedAt          string                  `json:"createdAt"`
	UpdatedAt          string                  `json:"updatedAt"`
}

type LegalComplianceDocumentAdminRow struct {
	Slug                 string `json:"slug"`
	Title                string `json:"title"`
	Category             string `json:"category"`
	Description          string `json:"description"`
	OnlineContent        string `json:"onlineContent"`
	DraftContent         string `json:"draftContent"`
	OnlineCharacterCount int    `json:"onlineCharacterCount"`
	DraftCharacterCount  int    `json:"draftCharacterCount"`
	Changed              bool   `json:"changed"`
	Status               string `json:"status"`
}

type LegalComplianceCurrentView struct {
	CurrentRelease *LegalComplianceReleaseView       `json:"currentRelease"`
	PendingRelease *LegalComplianceReleaseView       `json:"pendingRelease"`
	Draft          *LegalComplianceReleaseView       `json:"draft"`
	Documents      []LegalComplianceDocumentAdminRow `json:"documents"`
	NextVersions   map[string]string                 `json:"nextVersions"`
}

type PublishLegalComplianceInput struct {
	VersionBump   string
	EffectiveAt   string
	ChangeSummary string
	Reason        string
	AdminID       uint64
}

type LegalComplianceService struct{}

var legalVersionPattern = regexp.MustCompile(`^v(\d+)\.(\d+)\.(\d+)-\d{8}$`)

func legalDocumentDefinitions() []LegalDocumentDefinition {
	return []LegalDocumentDefinition{
		{"user-agreement", "禾泽云用户服务协议", "公开侧", model.ConfigKeyPublicUserAgreement, defaultPublicUserAgreement},
		{"privacy-policy", "禾泽云隐私政策", "公开侧", model.ConfigKeyPublicPrivacyPolicy, defaultPublicPrivacyPolicy},
		{"personal-info-collection-list", "个人信息收集清单", "公开侧", model.ConfigKeyPublicPersonalInfoCollectionList, defaultPublicPersonalInfoCollectionList},
		{"transaction-rules", "轻预约服务规则", "公开侧", model.ConfigKeyPublicTransactionRules, defaultPublicTransactionRules},
		{"refund-rules", "预约反馈与服务说明", "公开侧", model.ConfigKeyPublicRefundRules, defaultPublicRefundRules},
		{"merchant-rules", "服务商展示规则", "公开侧", model.ConfigKeyPublicMerchantOnboarding, defaultPublicMerchantOnboardingRules},
		{"merchant-onboarding-agreement", "服务商资料授权与展示协议", "服务商侧", model.ConfigKeyPublicMerchantOnboardingAgreement, defaultMerchantOnboardingAgreement},
		{"platform-rules", "服务商展示平台规则", "服务商侧", model.ConfigKeyPublicPlatformRules, defaultMerchantPlatformRules},
		{"privacy-data-processing", "服务商资料与数据处理条款", "服务商侧", model.ConfigKeyPublicPrivacyDataProcessing, defaultMerchantPrivacyDataProcessing},
		{"third-party-sharing", "第三方信息共享清单", "公开侧", model.ConfigKeyPublicThirdPartySharing, defaultPublicThirdPartySharing},
	}
}

func legalDocumentDescription(slug string) string {
	switch slug {
	case "user-agreement":
		return "账号注册、轻预约、平台联系跟进和平台边界。"
	case "privacy-policy":
		return "个人信息收集、使用、保存、共享和用户权利。"
	case "personal-info-collection-list":
		return "按字段说明手机号、地址、房屋信息、支付和沟通记录等收集目的与必要性。"
	case "transaction-rules":
		return "信息展示、预约提交、平台线下联系跟进和服务边界。"
	case "refund-rules":
		return "预约调整、预约关闭、资料反馈和客服支持边界。"
	case "merchant-rules":
		return "设计师、工长、装修公司、主材商资料展示、审核和持续准入规则。"
	case "merchant-onboarding-agreement":
		return "服务商提交资料、授权展示、资料真实性、分角色要求和争议解决。"
	case "platform-rules":
		return "服务商资料维护、内容展示、预约跟进边界和违规约束。"
	case "privacy-data-processing":
		return "服务商资料收集、展示授权、预约联系和数据处理规则。"
	case "third-party-sharing":
		return "短信、支付、实名核验、OSS、地图、IM 等实际启用服务披露。"
	default:
		return ""
	}
}

func normalizeLegalComplianceContent(value string) string {
	return strings.TrimSpace(value)
}

func countLegalComplianceChars(value string) int {
	return len([]rune(strings.Join(strings.Fields(value), "")))
}

func validateLegalComplianceDocument(def LegalDocumentDefinition, content string) error {
	content = normalizeLegalComplianceContent(content)
	length := countLegalComplianceChars(content)
	if content == "" {
		return fmt.Errorf("请补全%s", def.Title)
	}
	if length < 20 {
		return fmt.Errorf("%s内容过短，请补充完整规则后再保存", def.Title)
	}
	if length > 50000 {
		return fmt.Errorf("%s超过 50000 字，请拆分或精简后再保存", def.Title)
	}
	return nil
}

func buildLegalSnapshotsFromContent(contentBySlug map[string]string) []LegalDocumentSnapshot {
	defs := legalDocumentDefinitions()
	docs := make([]LegalDocumentSnapshot, 0, len(defs))
	for _, def := range defs {
		content := normalizeLegalComplianceContent(contentBySlug[def.Slug])
		if content == "" && def.DefaultContent != nil {
			content = normalizeLegalComplianceContent(def.DefaultContent())
		}
		docs = append(docs, LegalDocumentSnapshot{
			Slug:           def.Slug,
			Title:          def.Title,
			Category:       def.Category,
			Content:        content,
			CharacterCount: countLegalComplianceChars(content),
		})
	}
	return docs
}

func (s *LegalComplianceService) buildLegacySnapshotsFromConfigs() []LegalDocumentSnapshot {
	configSvc := &ConfigService{}
	contentBySlug := make(map[string]string, len(legalDocumentDefinitions()))
	for _, def := range legalDocumentDefinitions() {
		fallback := ""
		if def.DefaultContent != nil {
			fallback = def.DefaultContent()
		}
		contentBySlug[def.Slug] = configSvc.getPublicConfigValue(def.ConfigKey, fallback)
	}
	return buildLegalSnapshotsFromContent(contentBySlug)
}

func encodeLegalDocumentsJSON(docs []LegalDocumentSnapshot) (string, error) {
	encoded, err := json.Marshal(docs)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func decodeLegalDocumentsJSON(raw string) ([]LegalDocumentSnapshot, error) {
	var docs []LegalDocumentSnapshot
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	if err := json.Unmarshal([]byte(raw), &docs); err != nil {
		return nil, err
	}
	bySlug := make(map[string]LegalDocumentSnapshot, len(docs))
	for _, doc := range docs {
		doc.Content = normalizeLegalComplianceContent(doc.Content)
		doc.CharacterCount = countLegalComplianceChars(doc.Content)
		bySlug[doc.Slug] = doc
	}
	ordered := make([]LegalDocumentSnapshot, 0, len(legalDocumentDefinitions()))
	for _, def := range legalDocumentDefinitions() {
		doc, ok := bySlug[def.Slug]
		if !ok {
			content := ""
			if def.DefaultContent != nil {
				content = def.DefaultContent()
			}
			doc = LegalDocumentSnapshot{
				Slug:     def.Slug,
				Title:    def.Title,
				Category: def.Category,
				Content:  content,
			}
		}
		doc.Title = def.Title
		doc.Category = def.Category
		doc.CharacterCount = countLegalComplianceChars(doc.Content)
		ordered = append(ordered, doc)
	}
	return ordered, nil
}

func hashLegalDocuments(docs []LegalDocumentSnapshot) string {
	normalized := make([]LegalDocumentSnapshot, 0, len(docs))
	for _, doc := range docs {
		normalized = append(normalized, LegalDocumentSnapshot{
			Slug:     doc.Slug,
			Title:    doc.Title,
			Category: doc.Category,
			Content:  normalizeLegalComplianceContent(doc.Content),
		})
	}
	sort.SliceStable(normalized, func(i, j int) bool {
		return normalized[i].Slug < normalized[j].Slug
	})
	encoded, _ := json.Marshal(normalized)
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:])
}

func legalReleaseToView(release *model.LegalComplianceRelease) (*LegalComplianceReleaseView, error) {
	if release == nil || release.ID == 0 {
		return nil, nil
	}
	docs, err := decodeLegalDocumentsJSON(release.DocumentsJSON)
	if err != nil {
		return nil, err
	}
	view := &LegalComplianceReleaseView{
		ID:                 release.ID,
		Version:            release.Version,
		PublishedByAdminID: release.PublishedByAdminID,
		Documents:          docs,
		ContentHash:        release.ContentHash,
		ChangeSummary:      release.ChangeSummary,
		Reason:             release.Reason,
		Status:             release.Status,
		LegacyImported:     release.LegacyImported,
		CreatedAt:          release.CreatedAt.Format(time.RFC3339),
		UpdatedAt:          release.UpdatedAt.Format(time.RFC3339),
	}
	if release.EffectiveAt != nil {
		view.EffectiveAt = release.EffectiveAt.Format(time.RFC3339)
		view.EffectiveDate = release.EffectiveAt.Format("2006-01-02")
	}
	if release.PublishedAt != nil {
		view.PublishedAt = release.PublishedAt.Format(time.RFC3339)
	}
	return view, nil
}

func (s *LegalComplianceService) EnsureLegacyReleaseImported() error {
	if repository.DB == nil {
		return nil
	}
	return s.ensureLegacyReleaseImportedTx(repository.DB)
}

func (s *LegalComplianceService) ensureLegacyReleaseImportedTx(tx *gorm.DB) error {
	var count int64
	if err := tx.Model(&model.LegalComplianceRelease{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	configSvc := &ConfigService{}
	version := configSvc.getPublicConfigValue(model.ConfigKeyPublicLegalVersion, embeddedPublicLegalVersion())
	effectiveRaw := configSvc.getPublicConfigValue(model.ConfigKeyPublicLegalEffectiveDate, embeddedPublicLegalEffectiveDate())
	effectiveAt, err := parseLegalEffectiveAt(effectiveRaw)
	if err != nil {
		effectiveAt = time.Now()
	}
	publishedAt := effectiveAt
	docs := s.buildLegacySnapshotsFromConfigs()
	docJSON, err := encodeLegalDocumentsJSON(docs)
	if err != nil {
		return err
	}
	return tx.Create(&model.LegalComplianceRelease{
		Version:        strings.TrimSpace(version),
		EffectiveAt:    &effectiveAt,
		PublishedAt:    &publishedAt,
		DocumentsJSON:  docJSON,
		ContentHash:    hashLegalDocuments(docs),
		ChangeSummary:  "从历史系统配置回填",
		Reason:         "legacy import",
		Status:         model.LegalComplianceReleaseStatusPublished,
		LegacyImported: true,
	}).Error
}

func (s *LegalComplianceService) getLatestPublishedRelease(tx *gorm.DB) (*model.LegalComplianceRelease, error) {
	var release model.LegalComplianceRelease
	err := tx.Where("status = ?", model.LegalComplianceReleaseStatusPublished).
		Order("published_at DESC, id DESC").
		First(&release).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &release, nil
}

func (s *LegalComplianceService) getActivePublishedRelease(tx *gorm.DB, now time.Time) (*model.LegalComplianceRelease, error) {
	var release model.LegalComplianceRelease
	err := tx.Where("status = ? AND effective_at IS NOT NULL AND effective_at <= ?", model.LegalComplianceReleaseStatusPublished, now).
		Order("effective_at DESC, published_at DESC, id DESC").
		First(&release).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &release, nil
}

func (s *LegalComplianceService) getPendingPublishedRelease(tx *gorm.DB, now time.Time) (*model.LegalComplianceRelease, error) {
	var release model.LegalComplianceRelease
	err := tx.Where("status = ? AND effective_at IS NOT NULL AND effective_at > ?", model.LegalComplianceReleaseStatusPublished, now).
		Order("effective_at ASC, id DESC").
		First(&release).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &release, nil
}

func (s *LegalComplianceService) getDraftRelease(tx *gorm.DB) (*model.LegalComplianceRelease, error) {
	var release model.LegalComplianceRelease
	err := tx.Where("status = ?", model.LegalComplianceReleaseStatusDraft).
		Order("updated_at DESC, id DESC").
		First(&release).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &release, nil
}

func (s *LegalComplianceService) fallbackPublishedView() (*LegalComplianceReleaseView, error) {
	configSvc := &ConfigService{}
	version := configSvc.getPublicConfigValue(model.ConfigKeyPublicLegalVersion, embeddedPublicLegalVersion())
	effectiveRaw := configSvc.getPublicConfigValue(model.ConfigKeyPublicLegalEffectiveDate, embeddedPublicLegalEffectiveDate())
	docs := s.buildLegacySnapshotsFromConfigs()
	effectiveAt := effectiveRaw
	if parsed, err := parseLegalEffectiveAt(effectiveRaw); err == nil {
		effectiveAt = parsed.Format(time.RFC3339)
	}
	return &LegalComplianceReleaseView{
		Version:        version,
		EffectiveAt:    effectiveAt,
		EffectiveDate:  effectiveRaw,
		Documents:      docs,
		ContentHash:    hashLegalDocuments(docs),
		Status:         model.LegalComplianceReleaseStatusPublished,
		LegacyImported: true,
	}, nil
}

func (s *LegalComplianceService) ActivePublicRelease() (*LegalComplianceReleaseView, error) {
	if repository.DB == nil {
		return s.fallbackPublishedView()
	}
	_ = s.EnsureLegacyReleaseImported()
	release, err := s.getActivePublishedRelease(repository.DB, time.Now())
	if err != nil {
		return s.fallbackPublishedView()
	}
	if release == nil {
		return s.fallbackPublishedView()
	}
	return legalReleaseToView(release)
}

func (s *LegalComplianceService) CurrentView() (*LegalComplianceCurrentView, error) {
	if err := s.EnsureLegacyReleaseImported(); err != nil {
		currentView, fallbackErr := s.fallbackPublishedView()
		if fallbackErr != nil {
			return nil, err
		}
		rows := buildLegalComplianceRows(currentView.Documents, currentView.Documents)
		nextVersions := map[string]string{
			"patch": generateNextLegalVersion(currentView.Version, "patch", time.Now()),
			"minor": generateNextLegalVersion(currentView.Version, "minor", time.Now()),
			"major": generateNextLegalVersion(currentView.Version, "major", time.Now()),
		}
		return &LegalComplianceCurrentView{
			CurrentRelease: currentView,
			Documents:      rows,
			NextVersions:   nextVersions,
		}, nil
	}
	now := time.Now()
	current, err := s.getActivePublishedRelease(repository.DB, now)
	if err != nil {
		return nil, err
	}
	pending, err := s.getPendingPublishedRelease(repository.DB, now)
	if err != nil {
		return nil, err
	}
	draft, err := s.getDraftRelease(repository.DB)
	if err != nil {
		return nil, err
	}
	currentView, err := legalReleaseToView(current)
	if err != nil {
		return nil, err
	}
	pendingView, err := legalReleaseToView(pending)
	if err != nil {
		return nil, err
	}
	draftView, err := legalReleaseToView(draft)
	if err != nil {
		return nil, err
	}
	if currentView == nil {
		currentView, _ = s.fallbackPublishedView()
	}
	baseDocs := currentView.Documents
	draftDocs := baseDocs
	if draftView != nil {
		draftDocs = draftView.Documents
	} else if pendingView != nil {
		draftDocs = pendingView.Documents
	}
	rows := buildLegalComplianceRows(baseDocs, draftDocs)
	if draftView == nil && pendingView != nil {
		for index := range rows {
			if rows[index].Changed {
				rows[index].Status = "pending_effective"
			}
		}
	}
	latest, _ := s.getLatestPublishedRelease(repository.DB)
	latestVersion := currentView.Version
	if latest != nil && strings.TrimSpace(latest.Version) != "" {
		latestVersion = latest.Version
	}
	nextVersions := map[string]string{
		"patch": generateNextLegalVersion(latestVersion, "patch", time.Now()),
		"minor": generateNextLegalVersion(latestVersion, "minor", time.Now()),
		"major": generateNextLegalVersion(latestVersion, "major", time.Now()),
	}
	return &LegalComplianceCurrentView{
		CurrentRelease: currentView,
		PendingRelease: pendingView,
		Draft:          draftView,
		Documents:      rows,
		NextVersions:   nextVersions,
	}, nil
}

func buildLegalComplianceRows(onlineDocs, draftDocs []LegalDocumentSnapshot) []LegalComplianceDocumentAdminRow {
	onlineBySlug := make(map[string]LegalDocumentSnapshot, len(onlineDocs))
	draftBySlug := make(map[string]LegalDocumentSnapshot, len(draftDocs))
	for _, doc := range onlineDocs {
		onlineBySlug[doc.Slug] = doc
	}
	for _, doc := range draftDocs {
		draftBySlug[doc.Slug] = doc
	}
	rows := make([]LegalComplianceDocumentAdminRow, 0, len(legalDocumentDefinitions()))
	for _, def := range legalDocumentDefinitions() {
		online := onlineBySlug[def.Slug]
		draft := draftBySlug[def.Slug]
		if strings.TrimSpace(draft.Content) == "" {
			draft = online
		}
		changed := normalizeLegalComplianceContent(online.Content) != normalizeLegalComplianceContent(draft.Content)
		status := "synced"
		if changed {
			status = "draft_changed"
		} else if countLegalComplianceChars(online.Content) < 20 {
			status = "incomplete"
		}
		rows = append(rows, LegalComplianceDocumentAdminRow{
			Slug:                 def.Slug,
			Title:                def.Title,
			Category:             def.Category,
			Description:          legalDocumentDescription(def.Slug),
			OnlineContent:        online.Content,
			DraftContent:         draft.Content,
			OnlineCharacterCount: countLegalComplianceChars(online.Content),
			DraftCharacterCount:  countLegalComplianceChars(draft.Content),
			Changed:              changed,
			Status:               status,
		})
	}
	return rows
}

func (s *LegalComplianceService) DraftView() (*LegalComplianceReleaseView, error) {
	view, err := s.CurrentView()
	if err != nil {
		return nil, err
	}
	if view.Draft != nil {
		return view.Draft, nil
	}
	return &LegalComplianceReleaseView{
		Status: model.LegalComplianceReleaseStatusDraft,
		Documents: buildLegalSnapshotsFromContent(func() map[string]string {
			content := make(map[string]string, len(view.Documents))
			for _, row := range view.Documents {
				content[row.Slug] = row.DraftContent
			}
			return content
		}()),
	}, nil
}

func (s *LegalComplianceService) SaveDraftDocument(slug, content string) (*LegalComplianceReleaseView, error) {
	def, ok := findLegalDocumentDefinition(slug)
	if !ok {
		return nil, fmt.Errorf("未知协议文档: %s", slug)
	}
	content = normalizeLegalComplianceContent(content)
	if err := validateLegalComplianceDocument(def, content); err != nil {
		return nil, err
	}
	var saved model.LegalComplianceRelease
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := s.ensureLegacyReleaseImportedTx(tx); err != nil {
			return err
		}
		draft, err := s.getDraftRelease(tx)
		if err != nil {
			return err
		}
		var docs []LegalDocumentSnapshot
		if draft != nil {
			docs, err = decodeLegalDocumentsJSON(draft.DocumentsJSON)
			if err != nil {
				return err
			}
		} else {
			current, err := s.getLatestPublishedRelease(tx)
			if err != nil {
				return err
			}
			if current != nil {
				docs, err = decodeLegalDocumentsJSON(current.DocumentsJSON)
				if err != nil {
					return err
				}
			} else {
				docs = s.buildLegacySnapshotsFromConfigs()
			}
		}
		for index := range docs {
			if docs[index].Slug == slug {
				docs[index].Content = content
				docs[index].CharacterCount = countLegalComplianceChars(content)
				break
			}
		}
		docJSON, err := encodeLegalDocumentsJSON(docs)
		if err != nil {
			return err
		}
		if draft == nil {
			draft = &model.LegalComplianceRelease{
				Status:        model.LegalComplianceReleaseStatusDraft,
				DocumentsJSON: docJSON,
				ContentHash:   hashLegalDocuments(docs),
			}
			if err := tx.Create(draft).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(draft).Updates(map[string]interface{}{
				"documents_json": docJSON,
				"content_hash":   hashLegalDocuments(docs),
			}).Error; err != nil {
				return err
			}
		}
		return tx.Where("id = ?", draft.ID).First(&saved).Error
	})
	if err != nil {
		return nil, err
	}
	return legalReleaseToView(&saved)
}

func findLegalDocumentDefinition(slug string) (LegalDocumentDefinition, bool) {
	for _, def := range legalDocumentDefinitions() {
		if def.Slug == slug {
			return def, true
		}
	}
	return LegalDocumentDefinition{}, false
}

func (s *LegalComplianceService) PublishDraft(input PublishLegalComplianceInput) (*LegalComplianceReleaseView, error) {
	input.VersionBump = strings.TrimSpace(input.VersionBump)
	if input.VersionBump == "" {
		input.VersionBump = "patch"
	}
	if input.VersionBump != "patch" && input.VersionBump != "minor" && input.VersionBump != "major" {
		return nil, errors.New("版本递增类型必须是 patch、minor 或 major")
	}
	if strings.TrimSpace(input.Reason) == "" {
		return nil, errors.New("请填写发布原因")
	}
	if strings.TrimSpace(input.ChangeSummary) == "" {
		return nil, errors.New("请填写本次协议包变更说明")
	}
	effectiveAt, err := parseLegalEffectiveAt(input.EffectiveAt)
	if err != nil {
		return nil, err
	}
	var published model.LegalComplianceRelease
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := s.ensureLegacyReleaseImportedTx(tx); err != nil {
			return err
		}
		draft, err := s.getDraftRelease(tx)
		if err != nil {
			return err
		}
		if draft == nil {
			return errors.New("当前没有可发布的协议草稿")
		}
		docs, err := decodeLegalDocumentsJSON(draft.DocumentsJSON)
		if err != nil {
			return err
		}
		defs := legalDocumentDefinitions()
		for _, def := range defs {
			var content string
			for _, doc := range docs {
				if doc.Slug == def.Slug {
					content = doc.Content
					break
				}
			}
			if err := validateLegalComplianceDocument(def, content); err != nil {
				return err
			}
		}
		latest, err := s.getLatestPublishedRelease(tx)
		if err != nil {
			return err
		}
		previousVersion := embeddedPublicLegalVersion()
		if latest != nil && strings.TrimSpace(latest.Version) != "" {
			previousVersion = latest.Version
		}
		version := generateNextLegalVersion(previousVersion, input.VersionBump, effectiveAt)
		var duplicate int64
		if err := tx.Model(&model.LegalComplianceRelease{}).
			Where("status = ? AND version = ?", model.LegalComplianceReleaseStatusPublished, version).
			Count(&duplicate).Error; err != nil {
			return err
		}
		if duplicate > 0 {
			return fmt.Errorf("协议版本 %s 已存在，请重新发布", version)
		}
		now := time.Now()
		docJSON, err := encodeLegalDocumentsJSON(docs)
		if err != nil {
			return err
		}
		next := &model.LegalComplianceRelease{
			Version:            version,
			EffectiveAt:        &effectiveAt,
			PublishedAt:        &now,
			PublishedByAdminID: input.AdminID,
			DocumentsJSON:      docJSON,
			ContentHash:        hashLegalDocuments(docs),
			ChangeSummary:      strings.TrimSpace(input.ChangeSummary),
			Reason:             strings.TrimSpace(input.Reason),
			Status:             model.LegalComplianceReleaseStatusPublished,
		}
		if err := tx.Create(next).Error; err != nil {
			return err
		}
		if err := tx.Where("status = ?", model.LegalComplianceReleaseStatusDraft).
			Delete(&model.LegalComplianceRelease{}).Error; err != nil {
			return err
		}
		published = *next
		return nil
	})
	if err != nil {
		return nil, err
	}
	return legalReleaseToView(&published)
}

func parseLegalEffectiveAt(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, errors.New("请选择协议生效时间")
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02"} {
		if parsed, err := time.ParseInLocation(layout, raw, time.Local); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, errors.New("协议生效时间格式不正确")
}

func generateNextLegalVersion(previous, bump string, effectiveAt time.Time) string {
	major, minor, patch := 1, 0, 0
	matches := legalVersionPattern.FindStringSubmatch(strings.TrimSpace(previous))
	if len(matches) == 4 {
		_, _ = fmt.Sscanf(matches[1], "%d", &major)
		_, _ = fmt.Sscanf(matches[2], "%d", &minor)
		_, _ = fmt.Sscanf(matches[3], "%d", &patch)
	}
	switch bump {
	case "major":
		major++
		minor = 0
		patch = 0
	case "minor":
		minor++
		patch = 0
	default:
		patch++
	}
	return fmt.Sprintf("v%d.%d.%d-%s", major, minor, patch, effectiveAt.Format("20060102"))
}

func (s *LegalComplianceService) ListReleases(page, pageSize int) ([]LegalComplianceReleaseView, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	if err := s.EnsureLegacyReleaseImported(); err != nil {
		return nil, 0, err
	}
	query := repository.DB.Model(&model.LegalComplianceRelease{}).
		Where("status = ?", model.LegalComplianceReleaseStatusPublished)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var releases []model.LegalComplianceRelease
	if err := query.Order("effective_at DESC, published_at DESC, id DESC").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&releases).Error; err != nil {
		return nil, 0, err
	}
	views := make([]LegalComplianceReleaseView, 0, len(releases))
	for index := range releases {
		view, err := legalReleaseToView(&releases[index])
		if err != nil {
			return nil, 0, err
		}
		if view != nil {
			views = append(views, *view)
		}
	}
	return views, total, nil
}

func (s *LegalComplianceService) GetRelease(id uint64) (*LegalComplianceReleaseView, error) {
	if err := s.EnsureLegacyReleaseImported(); err != nil {
		return nil, err
	}
	var release model.LegalComplianceRelease
	err := repository.DB.Where("id = ?", id).First(&release).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return legalReleaseToView(&release)
}
