package repository

import (
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	SMSAuditLogTableName             = "sms_audit_logs"
	SMSAuditMigrationPath            = CanonicalSchemaReconcileMigrationPath
	SMSAuditHealthStatusOK           = "ok"
	SMSAuditHealthStatusDegraded     = "degraded"
	UserAuthHealthComponent          = "user_auth_schema"
	MerchantOnboardingComponent      = "merchant_onboarding_schema"
	BookingP0HealthComponent         = "booking_p0_schema"
	ProjectRiskHealthComponent       = "project_risk_schema"
	AuditLogHealthComponent          = "audit_log_schema"
	CommerceRuntimeHealthComponent   = "commerce_runtime_schema"
	BookingP0MigrationPath           = "server/migrations/v1.13.5_align_booking_budget_bridge_schema.sql"
	ProjectRiskMigrationPath         = "server/migrations/v1.10.8_add_project_risk_and_refund.sql"
	AuditLogMigrationPath            = "server/migrations/v1.11.0_add_p2_finance_and_audit_log_support.sql"
	CommerceRuntimeBaseMigrationPath = "server/migrations/v1.12.2_reconcile_commerce_runtime_schema.sql"
	QuoteRuntimeMigrationPath        = "server/migrations/v1.13.6_reconcile_quote_runtime_schema.sql"
	CommerceRuntimeMigrationPath     = CommerceRuntimeBaseMigrationPath + "," + QuoteRuntimeMigrationPath
)

var claimedCompletionSchemaFields = map[string]struct{}{
	"merchant_applications.application_scene":      {},
	"material_shop_applications.application_scene": {},
	"providers.needs_onboarding_completion":        {},
	"material_shops.needs_onboarding_completion":   {},
}

var quoteRuntimeTables = map[string]struct{}{
	"quantity_bases":             {},
	"quantity_base_items":        {},
	"quote_categories":           {},
	"quote_library_items":        {},
	"quote_price_books":          {},
	"quote_price_book_items":     {},
	"quote_price_tiers":          {},
	"quote_category_rules":       {},
	"quote_templates":            {},
	"quote_template_items":       {},
	"quote_lists":                {},
	"quote_list_items":           {},
	"quote_invitations":          {},
	"quote_submissions":          {},
	"quote_submission_items":     {},
	"quote_submission_revisions": {},
}

// SMSAuditLogHealthSnapshot describes runtime health for SMS audit persistence.
type SMSAuditLogHealthSnapshot struct {
	Status            string    `json:"status"`
	Table             string    `json:"table"`
	TableExists       bool      `json:"tableExists"`
	MigrationRequired bool      `json:"migrationRequired"`
	RequiredMigration string    `json:"requiredMigration"`
	LastCheckedAt     time.Time `json:"lastCheckedAt"`
	LastError         string    `json:"lastError,omitempty"`
	LastErrorType     string    `json:"lastErrorType,omitempty"`
	LastRequestID     string    `json:"lastRequestId,omitempty"`
	LastProvider      string    `json:"lastProvider,omitempty"`
	LastSendStatus    string    `json:"lastSendStatus,omitempty"`
}

// OpsAlert describes a structured operational alert exposed via health endpoints.
type OpsAlert struct {
	Code      string            `json:"code"`
	Severity  string            `json:"severity"`
	Component string            `json:"component"`
	Summary   string            `json:"summary"`
	Action    string            `json:"action"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// CriticalSchemaHealthSnapshot describes required auth/onboarding schema health.
type CriticalSchemaHealthSnapshot struct {
	Status            string    `json:"status"`
	Component         string    `json:"component"`
	MigrationRequired bool      `json:"migrationRequired"`
	RequiredMigration string    `json:"requiredMigration"`
	Missing           []string  `json:"missing"`
	LastCheckedAt     time.Time `json:"lastCheckedAt"`
	LastError         string    `json:"lastError,omitempty"`
	LastErrorType     string    `json:"lastErrorType,omitempty"`
}

var smsAuditHealthStore = struct {
	sync.Mutex
	snapshot SMSAuditLogHealthSnapshot
}{
	snapshot: SMSAuditLogHealthSnapshot{
		Status:            SMSAuditHealthStatusDegraded,
		Table:             SMSAuditLogTableName,
		MigrationRequired: true,
		RequiredMigration: SMSAuditMigrationPath,
	},
}

var userAuthHealthStore = struct {
	sync.Mutex
	snapshot CriticalSchemaHealthSnapshot
}{
	snapshot: CriticalSchemaHealthSnapshot{
		Status:            SMSAuditHealthStatusDegraded,
		Component:         UserAuthHealthComponent,
		MigrationRequired: true,
		RequiredMigration: CanonicalSchemaReconcileMigrationPath,
		Missing:           []string{"users.public_id", "users.last_login_at", "users.last_login_ip"},
	},
}

var merchantOnboardingHealthStore = struct {
	sync.Mutex
	snapshot CriticalSchemaHealthSnapshot
}{
	snapshot: CriticalSchemaHealthSnapshot{
		Status:            SMSAuditHealthStatusDegraded,
		Component:         MerchantOnboardingComponent,
		MigrationRequired: true,
		RequiredMigration: CanonicalSchemaReconcileMigrationPath + "," + SchemaGuardMigrationPath,
	},
}

var bookingP0HealthStore = struct {
	sync.Mutex
	snapshot CriticalSchemaHealthSnapshot
}{
	snapshot: CriticalSchemaHealthSnapshot{
		Status:            SMSAuditHealthStatusDegraded,
		Component:         BookingP0HealthComponent,
		MigrationRequired: true,
		RequiredMigration: BookingP0MigrationPath,
		Missing:           []string{"site_surveys", "budget_confirmations"},
	},
}

var projectRiskHealthStore = struct {
	sync.Mutex
	snapshot CriticalSchemaHealthSnapshot
}{
	snapshot: CriticalSchemaHealthSnapshot{
		Status:            SMSAuditHealthStatusDegraded,
		Component:         ProjectRiskHealthComponent,
		MigrationRequired: true,
		RequiredMigration: ProjectRiskMigrationPath,
		Missing:           []string{"projects.paused_at", "refund_applications", "project_audits"},
	},
}

var auditLogHealthStore = struct {
	sync.Mutex
	snapshot CriticalSchemaHealthSnapshot
}{
	snapshot: CriticalSchemaHealthSnapshot{
		Status:            SMSAuditHealthStatusDegraded,
		Component:         AuditLogHealthComponent,
		MigrationRequired: true,
		RequiredMigration: AuditLogMigrationPath,
		Missing:           []string{"audit_logs.record_kind", "audit_logs.operation_type", "audit_logs.resource_type"},
	},
}

var commerceRuntimeHealthStore = struct {
	sync.Mutex
	snapshot CriticalSchemaHealthSnapshot
}{
	snapshot: CriticalSchemaHealthSnapshot{
		Status:            SMSAuditHealthStatusDegraded,
		Component:         CommerceRuntimeHealthComponent,
		MigrationRequired: true,
		RequiredMigration: CommerceRuntimeMigrationPath,
		Missing:           []string{"providers.is_settled", "material_shops.is_settled", "bookings.survey_deposit_source", "quote_lists.quantity_base_id"},
	},
}

var userAuthRequirements = map[string][]string{
	"users": {"public_id", "last_login_at", "last_login_ip"},
}

var merchantOnboardingRequirements = map[string][]string{
	"merchant_applications":                 {"role", "entity_type", "avatar", "legal_person_name", "legal_person_id_card_no", "legal_person_id_card_front", "legal_person_id_card_back", "years_experience", "work_types", "highlight_tags", "pricing_json", "graduate_school", "design_philosophy", "legal_acceptance_json", "legal_accepted_at", "legal_accept_source", "application_scene"},
	"providers":                             {"display_name", "entity_type", "work_types", "highlight_tags", "pricing_json", "graduate_school", "design_philosophy", "avatar", "source_application_id", "needs_onboarding_completion"},
	"material_shops":                        {"user_id", "company_name", "description", "business_license_no", "business_license", "legal_person_name", "legal_person_id_card_no", "legal_person_id_card_front", "legal_person_id_card_back", "contact_phone", "contact_name", "source_application_id", "needs_onboarding_completion"},
	"material_shop_applications":            {"user_id", "phone", "application_scene", "entity_type", "shop_name", "shop_description", "brand_logo", "company_name", "business_license_no", "business_license", "legal_person_name", "legal_person_id_card_no", "legal_person_id_card_front", "legal_person_id_card_back", "business_hours", "business_hours_json", "contact_phone", "contact_name", "address", "legal_acceptance_json", "legal_accepted_at", "legal_accept_source", "status", "reject_reason", "audited_by", "audited_at", "shop_id"},
	"material_shop_application_products":    {"application_id", "name", "unit", "params_json", "price", "images_json", "sort_order"},
	"material_shop_products":                {"shop_id", "name", "params_json", "price", "images_json", "cover_image", "status", "sort_order"},
	"merchant_identity_change_applications": {"user_id", "phone", "current_role", "target_role", "target_entity", "application_data", "status", "reject_reason", "reviewed_by", "reviewed_at"},
}

var bookingP0Requirements = map[string][]string{
	"site_surveys":         {"booking_id", "provider_id", "photos", "dimensions", "status", "submitted_at", "confirmed_at", "revision_requested_at", "revision_request_reason"},
	"budget_confirmations": {"booking_id", "provider_id", "budget_min", "budget_max", "includes", "design_intent", "style_direction", "space_requirements", "expected_duration_days", "special_requirements", "status", "reject_count", "reject_limit", "submitted_at", "accepted_at", "rejected_at", "last_rejected_at", "rejection_reason"},
}

var projectRiskRequirements = map[string][]string{
	"projects":            {"paused_at", "resumed_at", "pause_reason", "pause_initiator", "disputed_at", "dispute_reason", "dispute_evidence"},
	"refund_applications": {"booking_id", "project_id", "refund_type", "requested_amount", "approved_amount", "status", "admin_id", "admin_notes", "approved_at", "completed_at"},
	"project_audits":      {"project_id", "audit_type", "status", "complaint_id", "refund_application_id", "audit_notes", "conclusion", "conclusion_reason", "execution_plan", "admin_id", "completed_at"},
}

var auditLogRequirements = map[string][]string{
	"audit_logs": {"record_kind", "operation_type", "resource_type", "resource_id", "reason", "result", "before_state", "after_state", "metadata"},
}

var commerceRuntimeRequirements = map[string][]string{
	"providers":                  {"survey_deposit_price", "is_settled", "collected_source"},
	"material_shops":             {"service_area", "main_brands", "main_categories", "delivery_capability", "installation_capability", "after_sales_policy", "invoice_capability", "is_settled", "collected_source", "status"},
	"bookings":                   {"survey_deposit_source", "survey_refund_notice", "survey_deposit", "survey_deposit_paid", "survey_deposit_paid_at", "survey_deposit_converted", "survey_deposit_refunded", "survey_deposit_refund_amt", "survey_deposit_refund_at"},
	"proposals":                  {"internal_draft_json", "preview_package_json", "delivery_package_json"},
	"milestones":                 {"release_scheduled_at", "released_at"},
	"projects":                   {"construction_payment_mode", "payment_paused", "payment_paused_at", "payment_paused_reason"},
	"merchant_service_settings":  {"survey_deposit_amount", "design_payment_mode"},
	"payment_plans":              {"milestone_id"},
	"design_working_docs":        {"booking_id", "provider_id", "doc_type", "title", "description", "files", "submitted_at"},
	"design_fee_quotes":          {"booking_id", "provider_id", "total_fee", "deposit_deduction", "net_amount", "payment_mode", "stages_json", "status", "expire_at", "confirmed_at", "rejected_at", "rejection_reason", "order_id"},
	"design_deliverables":        {"booking_id", "project_id", "order_id", "provider_id", "color_floor_plan", "renderings", "rendering_link", "text_description", "cad_drawings", "attachments", "status", "submitted_at", "accepted_at", "rejected_at", "rejection_reason"},
	"quantity_bases":             {"proposal_id", "proposal_version", "designer_provider_id", "source_type", "source_id", "status", "version", "title", "snapshot_json"},
	"quantity_base_items":        {"quantity_base_id", "source_item_name", "unit", "quantity", "category_l1", "category_l2", "sort_order"},
	"quote_categories":           {"code", "name", "parent_id", "sort_order", "status"},
	"quote_library_items":        {"category_id", "standard_code", "name", "unit", "category_l1", "category_l2", "category_l3", "erp_seq_no", "reference_price_cent", "status", "keywords_json", "erp_mapping_json", "quantity_formula_json"},
	"quote_price_books":          {"provider_id", "status", "version"},
	"quote_price_book_items":     {"price_book_id", "standard_item_id", "price_tier_id", "unit", "unit_price_cent", "min_charge_cent", "status"},
	"quote_price_tiers":          {"library_item_id", "tier_key", "condition_json", "sort_order"},
	"quote_category_rules":       {"category_id", "keywords", "priority"},
	"quote_templates":            {"name", "room_type", "renovation_type", "status"},
	"quote_template_items":       {"template_id", "library_item_id", "default_quantity", "sort_order", "required"},
	"quote_lists":                {"proposal_id", "proposal_version", "quantity_base_id", "quantity_base_version", "source_type", "source_id", "designer_provider_id", "status", "pricing_mode", "material_included", "payment_plan_generated_flag", "prerequisite_status", "user_confirmation_status", "active_submission_id"},
	"quote_list_items":           {"quote_list_id", "standard_item_id", "matched_standard_item_id", "quantity_base_item_id", "selected_tier_id", "source_type", "source_stage", "name", "unit", "quantity", "quantity_adjustable_flag", "category_l1", "category_l2", "missing_mapping_flag"},
	"quote_invitations":          {"quote_list_id", "provider_id", "status", "invited_by_user_id"},
	"quote_submissions":          {"quote_list_id", "provider_id", "status", "task_status", "generation_status", "generated_from_price_book_id", "submitted_to_user", "review_status", "reviewed_by", "superseded_by"},
	"quote_submission_items":     {"quote_submission_id", "quote_list_item_id", "price_tier_id", "generated_unit_price_cent", "unit_price_cent", "quoted_quantity", "adjusted_flag", "missing_price_flag", "quantity_change_reason", "requires_user_confirmation", "platform_review_flag"},
	"quote_submission_revisions": {"quote_submission_id", "quote_list_id", "provider_id", "revision_no", "action", "previous_items_json", "next_items_json", "change_reason"},
}

func recordSMSAuditSchemaCheck(tableExists bool, err error) {
	smsAuditHealthStore.Lock()
	defer smsAuditHealthStore.Unlock()

	smsAuditHealthStore.snapshot.Table = SMSAuditLogTableName
	smsAuditHealthStore.snapshot.TableExists = tableExists
	smsAuditHealthStore.snapshot.MigrationRequired = !tableExists
	smsAuditHealthStore.snapshot.RequiredMigration = SMSAuditMigrationPath
	smsAuditHealthStore.snapshot.LastCheckedAt = time.Now()
	if tableExists && err == nil {
		smsAuditHealthStore.snapshot.Status = SMSAuditHealthStatusOK
		smsAuditHealthStore.snapshot.LastError = ""
		smsAuditHealthStore.snapshot.LastErrorType = ""
		return
	}

	smsAuditHealthStore.snapshot.Status = SMSAuditHealthStatusDegraded
	if err != nil {
		smsAuditHealthStore.snapshot.LastError = strings.TrimSpace(err.Error())
		smsAuditHealthStore.snapshot.LastErrorType = fmt.Sprintf("%T", err)
		return
	}
	if !tableExists {
		smsAuditHealthStore.snapshot.LastError = "sms audit log table missing"
		smsAuditHealthStore.snapshot.LastErrorType = "missing_table"
	}
}

func snapshotSMSAuditLogHealth() SMSAuditLogHealthSnapshot {
	smsAuditHealthStore.Lock()
	defer smsAuditHealthStore.Unlock()
	return smsAuditHealthStore.snapshot
}

func recordCriticalSchemaCheck(store *struct {
	sync.Mutex
	snapshot CriticalSchemaHealthSnapshot
}, component, requiredMigration string, missing []string, err error) {
	store.Lock()
	defer store.Unlock()

	missing = append([]string(nil), missing...)
	sort.Strings(missing)
	store.snapshot.Component = component
	store.snapshot.MigrationRequired = len(missing) > 0
	store.snapshot.RequiredMigration = requiredMigration
	store.snapshot.LastCheckedAt = time.Now()
	store.snapshot.Missing = missing
	if len(missing) == 0 && err == nil {
		store.snapshot.Status = SMSAuditHealthStatusOK
		store.snapshot.LastError = ""
		store.snapshot.LastErrorType = ""
		return
	}

	store.snapshot.Status = SMSAuditHealthStatusDegraded
	if err != nil {
		store.snapshot.LastError = strings.TrimSpace(err.Error())
		store.snapshot.LastErrorType = fmt.Sprintf("%T", err)
		return
	}
	store.snapshot.LastError = "required schema objects missing"
	store.snapshot.LastErrorType = "missing_schema"
}

func snapshotCriticalSchemaHealth(store *struct {
	sync.Mutex
	snapshot CriticalSchemaHealthSnapshot
}) CriticalSchemaHealthSnapshot {
	store.Lock()
	defer store.Unlock()
	return store.snapshot
}

func findMissingColumns(table string, columns []string) ([]string, error) {
	if DB == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	missing := make([]string, 0, len(columns)+1)
	if !DB.Migrator().HasTable(table) {
		return append(missing, table), nil
	}

	rows, err := DB.Table(table).Select("*").Limit(1).Rows()
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	existingColumns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	columnSet := make(map[string]struct{}, len(existingColumns))
	for _, column := range existingColumns {
		columnSet[column] = struct{}{}
	}

	for _, column := range columns {
		if _, ok := columnSet[column]; !ok {
			missing = append(missing, fmt.Sprintf("%s.%s", table, column))
		}
	}
	return missing, nil
}

func checkSchemaRequirements(requirements map[string][]string) ([]string, error) {
	missing := make([]string, 0)
	for table, columns := range requirements {
		tableMissing, err := findMissingColumns(table, columns)
		if err != nil {
			return nil, err
		}
		missing = append(missing, tableMissing...)
	}
	return missing, nil
}

// CheckSMSAuditLogTable reports whether the sms_audit_logs table exists in the current schema.
func CheckSMSAuditLogTable() (bool, error) {
	if DB == nil {
		return false, fmt.Errorf("database not initialized")
	}

	return DB.Migrator().HasTable(SMSAuditLogTableName), nil
}

// RefreshSMSAuditLogHealth updates and returns the latest sms_audit_logs schema health snapshot.
func RefreshSMSAuditLogHealth() SMSAuditLogHealthSnapshot {
	exists, err := CheckSMSAuditLogTable()
	recordSMSAuditSchemaCheck(exists, err)
	return snapshotSMSAuditLogHealth()
}

func RefreshUserAuthSchemaHealth() CriticalSchemaHealthSnapshot {
	missing, err := checkSchemaRequirements(userAuthRequirements)
	recordCriticalSchemaCheck(&userAuthHealthStore, UserAuthHealthComponent, CanonicalSchemaReconcileMigrationPath, missing, err)
	return snapshotCriticalSchemaHealth(&userAuthHealthStore)
}

func RefreshMerchantOnboardingSchemaHealth() CriticalSchemaHealthSnapshot {
	missing, err := checkSchemaRequirements(merchantOnboardingRequirements)
	recordCriticalSchemaCheck(&merchantOnboardingHealthStore, MerchantOnboardingComponent, resolveMerchantOnboardingMigrationPath(missing), missing, err)
	return snapshotCriticalSchemaHealth(&merchantOnboardingHealthStore)
}

func resolveMerchantOnboardingMigrationPath(missing []string) string {
	if len(missing) == 0 {
		return CanonicalSchemaReconcileMigrationPath
	}

	hasBaseSchemaGap := false
	hasClaimedCompletionGap := false
	for _, item := range missing {
		if _, ok := claimedCompletionSchemaFields[item]; ok {
			hasClaimedCompletionGap = true
			continue
		}
		hasBaseSchemaGap = true
	}

	switch {
	case hasBaseSchemaGap && hasClaimedCompletionGap:
		return CanonicalSchemaReconcileMigrationPath + "," + SchemaGuardMigrationPath
	case hasClaimedCompletionGap:
		return SchemaGuardMigrationPath
	default:
		return CanonicalSchemaReconcileMigrationPath
	}
}

func RefreshBookingP0SchemaHealth() CriticalSchemaHealthSnapshot {
	missing, err := checkSchemaRequirements(bookingP0Requirements)
	recordCriticalSchemaCheck(&bookingP0HealthStore, BookingP0HealthComponent, BookingP0MigrationPath, missing, err)
	return snapshotCriticalSchemaHealth(&bookingP0HealthStore)
}

func RefreshProjectRiskSchemaHealth() CriticalSchemaHealthSnapshot {
	missing, err := checkSchemaRequirements(projectRiskRequirements)
	recordCriticalSchemaCheck(&projectRiskHealthStore, ProjectRiskHealthComponent, ProjectRiskMigrationPath, missing, err)
	return snapshotCriticalSchemaHealth(&projectRiskHealthStore)
}

func RefreshAuditLogSchemaHealth() CriticalSchemaHealthSnapshot {
	missing, err := checkSchemaRequirements(auditLogRequirements)
	recordCriticalSchemaCheck(&auditLogHealthStore, AuditLogHealthComponent, AuditLogMigrationPath, missing, err)
	return snapshotCriticalSchemaHealth(&auditLogHealthStore)
}

func RefreshCommerceRuntimeSchemaHealth() CriticalSchemaHealthSnapshot {
	missing, err := checkSchemaRequirements(commerceRuntimeRequirements)
	recordCriticalSchemaCheck(&commerceRuntimeHealthStore, CommerceRuntimeHealthComponent, resolveCommerceRuntimeMigrationPath(missing), missing, err)
	return snapshotCriticalSchemaHealth(&commerceRuntimeHealthStore)
}

func resolveCommerceRuntimeMigrationPath(missing []string) string {
	if len(missing) == 0 {
		return CommerceRuntimeMigrationPath
	}

	hasBaseRuntimeGap := false
	hasQuoteRuntimeGap := false
	for _, item := range missing {
		table := strings.TrimSpace(item)
		if idx := strings.Index(table, "."); idx >= 0 {
			table = table[:idx]
		}
		if _, ok := quoteRuntimeTables[table]; ok {
			hasQuoteRuntimeGap = true
			continue
		}
		hasBaseRuntimeGap = true
	}

	switch {
	case hasBaseRuntimeGap && hasQuoteRuntimeGap:
		return CommerceRuntimeBaseMigrationPath + "," + QuoteRuntimeMigrationPath
	case hasQuoteRuntimeGap:
		return QuoteRuntimeMigrationPath
	default:
		return CommerceRuntimeBaseMigrationPath
	}
}

// CurrentOperationalAlerts returns structured alerts for operational consumers.
func CurrentOperationalAlerts() []OpsAlert {
	alerts := make([]OpsAlert, 0, 7)

	smsSnapshot := RefreshSMSAuditLogHealth()
	if smsSnapshot.Status != SMSAuditHealthStatusOK {
		code := "sms_audit_log_degraded"
		summary := "短信审计日志能力降级"
		if !smsSnapshot.TableExists {
			code = "sms_audit_log_table_missing"
			summary = "sms_audit_logs 表缺失，短信审计无法落库"
		}

		metadata := map[string]string{
			"table":             smsSnapshot.Table,
			"requiredMigration": smsSnapshot.RequiredMigration,
		}
		if smsSnapshot.LastErrorType != "" {
			metadata["errorType"] = smsSnapshot.LastErrorType
		}
		if smsSnapshot.LastProvider != "" {
			metadata["provider"] = smsSnapshot.LastProvider
		}
		if smsSnapshot.LastSendStatus != "" {
			metadata["sendStatus"] = smsSnapshot.LastSendStatus
		}
		if smsSnapshot.LastRequestID != "" {
			metadata["requestId"] = smsSnapshot.LastRequestID
		}

		alerts = append(alerts, OpsAlert{
			Code:      code,
			Severity:  "warning",
			Component: "sms_audit_log",
			Summary:   summary,
			Action:    fmt.Sprintf("执行迁移 %s，并确认健康检查恢复为 ok", smsSnapshot.RequiredMigration),
			Metadata:  metadata,
		})
	}

	userAuthSnapshot := RefreshUserAuthSchemaHealth()
	if userAuthSnapshot.Status != SMSAuditHealthStatusOK {
		alerts = append(alerts, newCriticalSchemaAlert(userAuthSnapshot, "user_auth_schema_missing", "认证关键表结构缺失，登录/注册链路不可用"))
	}

	merchantSnapshot := RefreshMerchantOnboardingSchemaHealth()
	if merchantSnapshot.Status != SMSAuditHealthStatusOK {
		alerts = append(alerts, newCriticalSchemaAlert(merchantSnapshot, "merchant_onboarding_schema_missing", "商家入驻关键表结构缺失，提交/审核链路不可用"))
	}

	bookingP0Snapshot := RefreshBookingP0SchemaHealth()
	if bookingP0Snapshot.Status != SMSAuditHealthStatusOK {
		alerts = append(alerts, newCriticalSchemaAlert(bookingP0Snapshot, "booking_p0_schema_missing", "预约量房/预算关键表结构缺失，P0 页面与接口不可用"))
	}

	projectRiskSnapshot := RefreshProjectRiskSchemaHealth()
	if projectRiskSnapshot.Status != SMSAuditHealthStatusOK {
		alerts = append(alerts, newCriticalSchemaAlert(projectRiskSnapshot, "project_risk_schema_missing", "项目争议/退款/审计关键表结构缺失，仲裁与退款链路不可用"))
	}

	auditLogSnapshot := RefreshAuditLogSchemaHealth()
	if auditLogSnapshot.Status != SMSAuditHealthStatusOK {
		alerts = append(alerts, newCriticalSchemaAlert(auditLogSnapshot, "audit_log_schema_missing", "审计留痕关键字段缺失，后台审计日志与资金追踪不可用"))
	}

	commerceRuntimeSnapshot := RefreshCommerceRuntimeSchemaHealth()
	if commerceRuntimeSnapshot.Status != SMSAuditHealthStatusOK {
		alerts = append(alerts, newCriticalSchemaAlert(commerceRuntimeSnapshot, "commerce_runtime_schema_missing", "公开列表/设计支付运行时结构缺失，用户侧列表、退款与托管链路可能异常"))
	}

	return alerts
}

func newCriticalSchemaAlert(snapshot CriticalSchemaHealthSnapshot, code, summary string) OpsAlert {
	metadata := map[string]string{
		"component":         snapshot.Component,
		"requiredMigration": snapshot.RequiredMigration,
	}
	if len(snapshot.Missing) > 0 {
		metadata["missing"] = strings.Join(snapshot.Missing, ",")
	}
	if snapshot.LastErrorType != "" {
		metadata["errorType"] = snapshot.LastErrorType
	}

	return OpsAlert{
		Code:      code,
		Severity:  "critical",
		Component: snapshot.Component,
		Summary:   summary,
		Action:    fmt.Sprintf("执行迁移 %s，并确认健康检查恢复为 ok", snapshot.RequiredMigration),
		Metadata:  metadata,
	}
}

// RecordSMSAuditPersistFailure updates runtime health after a failed sms audit persistence attempt.
func RecordSMSAuditPersistFailure(requestID, provider, sendStatus, errType string, tableMissing bool, err error) {
	smsAuditHealthStore.Lock()
	defer smsAuditHealthStore.Unlock()

	smsAuditHealthStore.snapshot.Status = SMSAuditHealthStatusDegraded
	smsAuditHealthStore.snapshot.Table = SMSAuditLogTableName
	smsAuditHealthStore.snapshot.TableExists = !tableMissing
	smsAuditHealthStore.snapshot.MigrationRequired = tableMissing
	smsAuditHealthStore.snapshot.RequiredMigration = SMSAuditMigrationPath
	smsAuditHealthStore.snapshot.LastCheckedAt = time.Now()
	smsAuditHealthStore.snapshot.LastRequestID = strings.TrimSpace(requestID)
	smsAuditHealthStore.snapshot.LastProvider = strings.TrimSpace(provider)
	smsAuditHealthStore.snapshot.LastSendStatus = strings.TrimSpace(sendStatus)
	smsAuditHealthStore.snapshot.LastErrorType = strings.TrimSpace(errType)
	if err != nil {
		smsAuditHealthStore.snapshot.LastError = strings.TrimSpace(err.Error())
	}
}

// RecordSMSAuditPersistSuccess marks sms audit persistence as healthy after a successful write.
func RecordSMSAuditPersistSuccess() {
	recordSMSAuditSchemaCheck(true, nil)
}

func logSMSAuditSchemaHealthAtStartup() {
	snapshot := RefreshSMSAuditLogHealth()
	if snapshot.Status == SMSAuditHealthStatusOK {
		return
	}

	log.Printf(
		"[SMS-AUDIT] schema degraded: table=%s tableExists=%t migration=%s errorType=%s error=%s",
		snapshot.Table,
		snapshot.TableExists,
		snapshot.RequiredMigration,
		snapshot.LastErrorType,
		snapshot.LastError,
	)
}

func EnsureCriticalSchema(mode string) error {
	smsSnapshot := RefreshSMSAuditLogHealth()
	userAuthSnapshot := RefreshUserAuthSchemaHealth()
	merchantSnapshot := RefreshMerchantOnboardingSchemaHealth()
	bookingP0Snapshot := RefreshBookingP0SchemaHealth()
	projectRiskSnapshot := RefreshProjectRiskSchemaHealth()
	auditLogSnapshot := RefreshAuditLogSchemaHealth()
	commerceRuntimeSnapshot := RefreshCommerceRuntimeSchemaHealth()

	if !strings.EqualFold(strings.TrimSpace(mode), "release") {
		logCriticalSchemaHealth(userAuthSnapshot, merchantSnapshot, bookingP0Snapshot, projectRiskSnapshot, auditLogSnapshot, commerceRuntimeSnapshot)
		if smsSnapshot.Status != SMSAuditHealthStatusOK {
			logSMSAuditSchemaHealthAtStartup()
		}
		return nil
	}

	problems := make([]string, 0, 3)
	requiredMigrations := make([]string, 0, 6)
	if smsSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, smsSnapshot.Table)
		requiredMigrations = append(requiredMigrations, smsSnapshot.RequiredMigration)
	}
	if userAuthSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, userAuthSnapshot.Missing...)
		requiredMigrations = append(requiredMigrations, userAuthSnapshot.RequiredMigration)
	}
	if merchantSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, merchantSnapshot.Missing...)
		requiredMigrations = append(requiredMigrations, merchantSnapshot.RequiredMigration)
	}
	if bookingP0Snapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, bookingP0Snapshot.Missing...)
		requiredMigrations = append(requiredMigrations, bookingP0Snapshot.RequiredMigration)
	}
	if projectRiskSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, projectRiskSnapshot.Missing...)
		requiredMigrations = append(requiredMigrations, projectRiskSnapshot.RequiredMigration)
	}
	if auditLogSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, auditLogSnapshot.Missing...)
		requiredMigrations = append(requiredMigrations, auditLogSnapshot.RequiredMigration)
	}
	if commerceRuntimeSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, commerceRuntimeSnapshot.Missing...)
		requiredMigrations = append(requiredMigrations, commerceRuntimeSnapshot.RequiredMigration)
	}
	if len(problems) == 0 {
		return nil
	}
	sort.Strings(problems)
	sort.Strings(requiredMigrations)
	requiredMigrations = uniqueStrings(requiredMigrations)
	return fmt.Errorf("critical schema preflight failed: missing=%s requiredMigrations=%s", strings.Join(problems, ","), strings.Join(requiredMigrations, ","))
}

func logCriticalSchemaHealth(snapshots ...CriticalSchemaHealthSnapshot) {
	for _, snapshot := range snapshots {
		if snapshot.Status == SMSAuditHealthStatusOK {
			continue
		}
		label := strings.ToUpper(strings.ReplaceAll(snapshot.Component, "_", "-"))
		log.Printf("[%s] degraded: missing=%s migration=%s errorType=%s error=%s",
			label,
			strings.Join(snapshot.Missing, ","),
			snapshot.RequiredMigration,
			snapshot.LastErrorType,
			snapshot.LastError,
		)
	}
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return values
	}
	result := make([]string, 0, len(values))
	var previous string
	for _, value := range values {
		if strings.TrimSpace(value) == "" {
			continue
		}
		if value == previous {
			continue
		}
		result = append(result, value)
		previous = value
	}
	return result
}
