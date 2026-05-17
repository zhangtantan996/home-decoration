package rbacsync

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Snapshot struct {
	SchemaVersion          int                       `json:"schemaVersion"`
	LastReconcileMigration string                    `json:"lastReconcileMigration"`
	GeneratedAtUTC         string                    `json:"generatedAtUTC"`
	MenuCatalogHash        string                    `json:"menuCatalogHash"`
	TemplateHash           string                    `json:"templateHash"`
	MenuCatalogRows        []string                  `json:"menuCatalogRows"`
	TemplateRows           []string                  `json:"templateRows"`
	SelectorsByRole        map[string][]MenuSelector `json:"selectorsByRole"`
	PreviousTemplateRows   []string                  `json:"previousTemplateRows,omitempty"`
}

func LoadSnapshot(path string) (*Snapshot, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var snapshot Snapshot
	if err := json.Unmarshal(content, &snapshot); err != nil {
		return nil, fmt.Errorf("parse snapshot: %w", err)
	}
	return &snapshot, nil
}

func SaveSnapshot(path string, snapshot *Snapshot) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir snapshot dir: %w", err)
	}
	content, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal snapshot: %w", err)
	}
	content = append(content, '\n')
	if err := os.WriteFile(path, content, 0o644); err != nil {
		return fmt.Errorf("write snapshot: %w", err)
	}
	return nil
}
