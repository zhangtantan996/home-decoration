package assetaudit

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"gorm.io/gorm"

	imgutil "home-decoration-server/internal/utils/image"
)

type FieldMode string

const (
	FieldModeString FieldMode = "string"
	FieldModeJSON   FieldMode = "json"
)

type FieldSpec struct {
	Column string
	Mode   FieldMode
	Paths  []string
}

type TableSpec struct {
	Table  string
	PK     string
	Fields []FieldSpec
}

type RunOptions struct {
	Apply       bool
	SampleLimit int
}

type ChangeSample struct {
	Table    string `json:"table"`
	Column   string `json:"column"`
	RecordID string `json:"recordId"`
	Before   string `json:"before,omitempty"`
	After    string `json:"after,omitempty"`
	Note     string `json:"note"`
}

type TableSummary struct {
	Table           string `json:"table"`
	Records         int    `json:"records"`
	MatchedFields   int    `json:"matchedFields"`
	RepairedFields  int    `json:"repairedFields"`
	ExternalSkipped int    `json:"externalSkipped"`
	Errors          int    `json:"errors"`
}

type RunSummary struct {
	Tables          []TableSummary `json:"tables"`
	TotalRecords    int            `json:"totalRecords"`
	MatchedFields   int            `json:"matchedFields"`
	RepairedFields  int            `json:"repairedFields"`
	ExternalSkipped int            `json:"externalSkipped"`
	Errors          int            `json:"errors"`
	Samples         []ChangeSample `json:"samples"`
}

type columnMeta struct {
	Exists bool
	IsJSON bool
}

type Runner struct {
	db          *gorm.DB
	sampleLimit int
	columnCache map[string]columnMeta
}

func NewRunner(db *gorm.DB, sampleLimit int) *Runner {
	if sampleLimit <= 0 {
		sampleLimit = 20
	}
	return &Runner{
		db:          db,
		sampleLimit: sampleLimit,
		columnCache: make(map[string]columnMeta),
	}
}

func (r *Runner) Run(specs []TableSpec, opts RunOptions) (RunSummary, error) {
	summary := RunSummary{Tables: make([]TableSummary, 0, len(specs))}
	for _, spec := range specs {
		tableSummary, samples, err := r.runTable(spec, opts)
		if err != nil {
			return summary, fmt.Errorf("run table %s: %w", spec.Table, err)
		}
		summary.Tables = append(summary.Tables, tableSummary)
		summary.TotalRecords += tableSummary.Records
		summary.MatchedFields += tableSummary.MatchedFields
		summary.RepairedFields += tableSummary.RepairedFields
		summary.ExternalSkipped += tableSummary.ExternalSkipped
		summary.Errors += tableSummary.Errors
		for _, sample := range samples {
			if len(summary.Samples) >= r.sampleLimit {
				break
			}
			summary.Samples = append(summary.Samples, sample)
		}
	}
	return summary, nil
}

func (r *Runner) runTable(spec TableSpec, opts RunOptions) (TableSummary, []ChangeSample, error) {
	tableSummary := TableSummary{Table: spec.Table}
	if !r.db.Migrator().HasTable(spec.Table) {
		return tableSummary, []ChangeSample{{
			Table: spec.Table,
			Note:  "skip: table missing",
		}}, nil
	}

	existingFields := make([]FieldSpec, 0, len(spec.Fields))
	selectColumns := []string{spec.PK}
	for _, field := range spec.Fields {
		meta, err := r.lookupColumnMeta(spec.Table, field.Column)
		if err != nil {
			return tableSummary, nil, err
		}
		if !meta.Exists {
			continue
		}
		existingFields = append(existingFields, field)
		selectColumns = append(selectColumns, field.Column)
	}
	if len(existingFields) == 0 {
		return tableSummary, []ChangeSample{{
			Table: spec.Table,
			Note:  "skip: no target columns",
		}}, nil
	}

	rows, err := r.db.Table(spec.Table).Select(selectColumns).Rows()
	if err != nil {
		return tableSummary, nil, err
	}
	defer rows.Close()

	samples := make([]ChangeSample, 0, r.sampleLimit)
	for rows.Next() {
		tableSummary.Records++
		rowMap, err := scanRow(rows, selectColumns)
		if err != nil {
			tableSummary.Errors++
			r.appendSample(&samples, ChangeSample{
				Table: spec.Table,
				Note:  fmt.Sprintf("scan row failed: %v", err),
			})
			continue
		}

		recordID := stringifyValue(rowMap[spec.PK])
		for _, field := range existingFields {
			raw := stringifyValue(rowMap[field.Column])
			if strings.TrimSpace(raw) == "" {
				continue
			}

			updated, matched, externalSkipped, err := r.normalizeField(raw, field)
			tableSummary.MatchedFields += matched
			tableSummary.ExternalSkipped += externalSkipped
			if err != nil {
				tableSummary.Errors++
				r.appendSample(&samples, ChangeSample{
					Table:    spec.Table,
					Column:   field.Column,
					RecordID: recordID,
					Before:   shorten(raw),
					Note:     err.Error(),
				})
				continue
			}

			if updated == raw {
				continue
			}

			if opts.Apply {
				if err := r.updateField(spec.Table, spec.PK, rowMap[spec.PK], field.Column, updated); err != nil {
					tableSummary.Errors++
					r.appendSample(&samples, ChangeSample{
						Table:    spec.Table,
						Column:   field.Column,
						RecordID: recordID,
						Before:   shorten(raw),
						After:    shorten(updated),
						Note:     fmt.Sprintf("update failed: %v", err),
					})
					continue
				}
			}

			tableSummary.RepairedFields++
			r.appendSample(&samples, ChangeSample{
				Table:    spec.Table,
				Column:   field.Column,
				RecordID: recordID,
				Before:   shorten(raw),
				After:    shorten(updated),
				Note:     actionLabel(opts.Apply),
			})
		}
	}

	return tableSummary, samples, rows.Err()
}

func (r *Runner) normalizeField(raw string, field FieldSpec) (string, int, int, error) {
	switch field.Mode {
	case FieldModeString:
		updated, matched, external := normalizeString(raw)
		return updated, matched, external, nil
	case FieldModeJSON:
		return normalizeJSON(raw, field.Paths...)
	default:
		return raw, 0, 0, fmt.Errorf("unsupported field mode %q", field.Mode)
	}
}

func (r *Runner) updateField(table, pk string, pkValue interface{}, column, value string) error {
	meta, err := r.lookupColumnMeta(table, column)
	if err != nil {
		return err
	}

	query := r.db.Table(table).Where(map[string]interface{}{pk: pkValue})
	if meta.IsJSON {
		return query.Update(column, gorm.Expr("?::jsonb", value)).Error
	}
	return query.Update(column, value).Error
}

func (r *Runner) lookupColumnMeta(table, column string) (columnMeta, error) {
	key := table + "." + column
	if cached, ok := r.columnCache[key]; ok {
		return cached, nil
	}

	type columnInfo struct {
		Count   int64  `gorm:"column:count"`
		UDTName string `gorm:"column:udt_name"`
	}
	var info columnInfo
	err := r.db.Raw(`
SELECT COUNT(*) AS count, COALESCE(MAX(udt_name), '') AS udt_name
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = ?
  AND column_name = ?
`, table, column).Scan(&info).Error
	if err != nil {
		return columnMeta{}, err
	}

	meta := columnMeta{
		Exists: info.Count > 0,
		IsJSON: info.UDTName == "jsonb" || info.UDTName == "json",
	}
	r.columnCache[key] = meta
	return meta, nil
}

func normalizeString(raw string) (string, int, int) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return raw, 0, 0
	}
	normalized := imgutil.NormalizeStoredImagePath(trimmed)
	if normalized != trimmed {
		return normalized, 1, 0
	}
	if isExternalURL(trimmed) {
		return raw, 0, 1
	}
	return raw, 0, 0
}

func normalizeJSON(raw string, paths ...string) (string, int, int, error) {
	if strings.TrimSpace(raw) == "" {
		return raw, 0, 0, nil
	}

	var node interface{}
	if err := json.Unmarshal([]byte(raw), &node); err != nil {
		return raw, 0, 0, fmt.Errorf("invalid json: %w", err)
	}

	matched := 0
	externalSkipped := 0
	for _, path := range paths {
		localCount, externalCount := normalizeJSONPath(&node, parsePath(path))
		matched += localCount
		externalSkipped += externalCount
	}
	if matched == 0 {
		return raw, 0, externalSkipped, nil
	}

	encoded, err := json.Marshal(node)
	if err != nil {
		return raw, 0, externalSkipped, fmt.Errorf("marshal json: %w", err)
	}
	return string(encoded), matched, externalSkipped, nil
}

func normalizeJSONPath(node *interface{}, segments []string) (int, int) {
	switch current := (*node).(type) {
	case string:
		if len(segments) > 0 {
			return 0, 0
		}
		updated, matched, external := normalizeString(current)
		if matched > 0 {
			*node = updated
		}
		return matched, external
	case []interface{}:
		if len(segments) == 0 {
			return normalizeJSONArray(node, current)
		}
		localTotal := 0
		externalTotal := 0
		nextItems := make([]interface{}, len(current))
		for index, item := range current {
			itemCopy := item
			localCount, externalCount := normalizeJSONPath(&itemCopy, segments)
			nextItems[index] = itemCopy
			localTotal += localCount
			externalTotal += externalCount
		}
		*node = nextItems
		return localTotal, externalTotal
	case map[string]interface{}:
		if len(segments) == 0 {
			return 0, 0
		}
		child, ok := current[segments[0]]
		if !ok {
			return 0, 0
		}
		localCount, externalCount := normalizeJSONPath(&child, segments[1:])
		current[segments[0]] = child
		*node = current
		return localCount, externalCount
	default:
		return 0, 0
	}
}

func normalizeJSONArray(node *interface{}, values []interface{}) (int, int) {
	localTotal := 0
	externalTotal := 0
	nextItems := make([]interface{}, 0, len(values))
	for _, item := range values {
		stringValue, ok := item.(string)
		if !ok {
			nextItems = append(nextItems, item)
			continue
		}
		updated, matched, external := normalizeString(stringValue)
		localTotal += matched
		externalTotal += external
		nextItems = append(nextItems, updated)
	}
	*node = nextItems
	return localTotal, externalTotal
}

func parsePath(path string) []string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" || trimmed == "." {
		return nil
	}
	return strings.Split(trimmed, ".")
}

func scanRow(rows *sql.Rows, columns []string) (map[string]interface{}, error) {
	values := make([]interface{}, len(columns))
	scanArgs := make([]interface{}, len(columns))
	for index := range values {
		scanArgs[index] = &values[index]
	}
	if err := rows.Scan(scanArgs...); err != nil {
		return nil, err
	}

	rowMap := make(map[string]interface{}, len(columns))
	for index, column := range columns {
		rowMap[column] = values[index]
	}
	return rowMap, nil
}

func (r *Runner) appendSample(samples *[]ChangeSample, sample ChangeSample) {
	if len(*samples) >= r.sampleLimit {
		return
	}
	*samples = append(*samples, sample)
}

func actionLabel(apply bool) string {
	if apply {
		return "repaired"
	}
	return "matched"
}

func shorten(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= 180 {
		return trimmed
	}
	return trimmed[:180] + "..."
}

func stringifyValue(value interface{}) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case []byte:
		return string(typed)
	case string:
		return typed
	default:
		return fmt.Sprint(typed)
	}
}

func isExternalURL(value string) bool {
	if !strings.HasPrefix(value, "http://") && !strings.HasPrefix(value, "https://") {
		return false
	}
	for _, prefix := range []string{"/uploads/", "/static/"} {
		if strings.Contains(value, prefix) {
			return false
		}
	}
	return true
}
