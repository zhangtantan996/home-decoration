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
	SMSAuditLogTableName         = "sms_audit_logs"
	SMSAuditMigrationPath        = CanonicalSchemaReconcileMigrationPath
	SMSAuditHealthStatusOK       = "ok"
	SMSAuditHealthStatusDegraded = "degraded"
	UserAuthHealthComponent      = "user_auth_schema"
	MerchantOnboardingComponent  = "merchant_onboarding_schema"
)

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
		RequiredMigration: CanonicalSchemaReconcileMigrationPath,
	},
}

var userAuthRequirements = map[string][]string{
	"users": {"public_id", "last_login_at", "last_login_ip"},
}

var merchantOnboardingRequirements = map[string][]string{
	"merchant_applications":                 {"role", "entity_type", "avatar", "legal_person_name", "legal_person_id_card_no", "legal_person_id_card_front", "legal_person_id_card_back", "years_experience", "work_types", "highlight_tags", "pricing_json", "graduate_school", "design_philosophy", "legal_acceptance_json", "legal_accepted_at", "legal_accept_source"},
	"providers":                             {"entity_type", "work_types", "highlight_tags", "pricing_json", "graduate_school", "design_philosophy", "avatar", "source_application_id"},
	"material_shops":                        {"user_id", "company_name", "description", "business_license_no", "business_license", "legal_person_name", "legal_person_id_card_no", "legal_person_id_card_front", "legal_person_id_card_back", "contact_phone", "contact_name", "source_application_id"},
	"material_shop_applications":            {"user_id", "phone", "entity_type", "shop_name", "shop_description", "company_name", "business_license_no", "business_license", "legal_person_name", "legal_person_id_card_no", "legal_person_id_card_front", "legal_person_id_card_back", "business_hours", "contact_phone", "contact_name", "address", "legal_acceptance_json", "legal_accepted_at", "legal_accept_source", "status", "reject_reason", "audited_by", "audited_at", "shop_id"},
	"material_shop_application_products":    {"application_id", "name", "params_json", "price", "images_json", "sort_order"},
	"material_shop_products":                {"shop_id", "name", "params_json", "price", "images_json", "cover_image", "status", "sort_order"},
	"merchant_identity_change_applications": {"user_id", "phone", "current_role", "target_role", "target_entity", "application_data", "status", "reject_reason", "reviewed_by", "reviewed_at"},
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
}, component string, missing []string, err error) {
	store.Lock()
	defer store.Unlock()

	missing = append([]string(nil), missing...)
	sort.Strings(missing)
	store.snapshot.Component = component
	store.snapshot.MigrationRequired = len(missing) > 0
	store.snapshot.RequiredMigration = CanonicalSchemaReconcileMigrationPath
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
	for _, column := range columns {
		if !DB.Migrator().HasColumn(table, column) {
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
	recordCriticalSchemaCheck(&userAuthHealthStore, UserAuthHealthComponent, missing, err)
	return snapshotCriticalSchemaHealth(&userAuthHealthStore)
}

func RefreshMerchantOnboardingSchemaHealth() CriticalSchemaHealthSnapshot {
	missing, err := checkSchemaRequirements(merchantOnboardingRequirements)
	recordCriticalSchemaCheck(&merchantOnboardingHealthStore, MerchantOnboardingComponent, missing, err)
	return snapshotCriticalSchemaHealth(&merchantOnboardingHealthStore)
}

// CurrentOperationalAlerts returns structured alerts for operational consumers.
func CurrentOperationalAlerts() []OpsAlert {
	alerts := make([]OpsAlert, 0, 3)

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

	if !strings.EqualFold(strings.TrimSpace(mode), "release") {
		logCriticalSchemaHealth(userAuthSnapshot, merchantSnapshot)
		if smsSnapshot.Status != SMSAuditHealthStatusOK {
			logSMSAuditSchemaHealthAtStartup()
		}
		return nil
	}

	problems := make([]string, 0, 3)
	if smsSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, smsSnapshot.Table)
	}
	if userAuthSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, userAuthSnapshot.Missing...)
	}
	if merchantSnapshot.Status != SMSAuditHealthStatusOK {
		problems = append(problems, merchantSnapshot.Missing...)
	}
	if len(problems) == 0 {
		return nil
	}
	sort.Strings(problems)
	return fmt.Errorf("critical schema preflight failed: missing=%s requiredMigration=%s", strings.Join(problems, ","), CanonicalSchemaReconcileMigrationPath)
}

func logCriticalSchemaHealth(userAuthSnapshot, merchantSnapshot CriticalSchemaHealthSnapshot) {
	if userAuthSnapshot.Status != SMSAuditHealthStatusOK {
		log.Printf("[AUTH-SCHEMA] degraded: missing=%s migration=%s errorType=%s error=%s",
			strings.Join(userAuthSnapshot.Missing, ","),
			userAuthSnapshot.RequiredMigration,
			userAuthSnapshot.LastErrorType,
			userAuthSnapshot.LastError,
		)
	}
	if merchantSnapshot.Status != SMSAuditHealthStatusOK {
		log.Printf("[MERCHANT-SCHEMA] degraded: missing=%s migration=%s errorType=%s error=%s",
			strings.Join(merchantSnapshot.Missing, ","),
			merchantSnapshot.RequiredMigration,
			merchantSnapshot.LastErrorType,
			merchantSnapshot.LastError,
		)
	}
}
