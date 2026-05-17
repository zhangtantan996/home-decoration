package service

import (
	_ "embed"
	"encoding/json"
	"strings"
	"sync"
)

//go:embed legal_site_config_fallback.json
var embeddedPublicSiteConfigJSON []byte

var (
	embeddedPublicSiteConfigOnce sync.Once
	embeddedPublicSiteConfig     PublicSiteConfig
)

func loadEmbeddedPublicSiteConfig() PublicSiteConfig {
	embeddedPublicSiteConfigOnce.Do(func() {
		cfg := PublicSiteConfig{}
		if err := json.Unmarshal(embeddedPublicSiteConfigJSON, &cfg); err == nil {
			embeddedPublicSiteConfig = cfg
		}
	})
	return embeddedPublicSiteConfig
}

func embeddedPublicLegalVersion() string {
	cfg := loadEmbeddedPublicSiteConfig()
	if strings.TrimSpace(cfg.LegalVersion) == "" {
		return "v1.2.0-20260514"
	}
	return cfg.LegalVersion
}

func embeddedPublicLegalEffectiveDate() string {
	cfg := loadEmbeddedPublicSiteConfig()
	if strings.TrimSpace(cfg.LegalEffectiveDate) == "" {
		return "2026-05-14"
	}
	return cfg.LegalEffectiveDate
}

func embeddedPublicDocumentContent(slug, fallback string) string {
	cfg := loadEmbeddedPublicSiteConfig()
	for _, doc := range cfg.LegalDocuments {
		if doc.Slug == slug && strings.TrimSpace(doc.Content) != "" {
			return doc.Content
		}
	}
	return fallback
}
