package rbacsync

var presetRoleOrder = []string{
	"product_manager",
	"operations",
	"finance",
	"risk",
	"customer_service",
	"viewer",
	"system_admin",
}

var presetRoleDisplayNames = map[string]string{
	"product_manager":    "产品管理",
	"operations":         "运营管理",
	"finance":            "财务管理",
	"risk":               "风控管理",
	"customer_service":   "客服",
	"viewer":             "只读用户",
	"system_admin":       "系统管理员 Ops 工作台",
}

var presetRoleMenuKeyTemplates = map[string][]string{
	"product_manager": {
		"dashboard",
		"users_root", "users_list", "user_view", "user_export",
		"providers_root", "provider_designers", "provider_designer_view", "provider_designer_create", "provider_designer_edit", "provider_designer_delete",
		"provider_companies", "provider_company_view", "provider_company_create", "provider_company_edit", "provider_company_delete",
		"provider_foremen", "provider_foreman_view", "provider_foreman_create", "provider_foreman_edit", "provider_foreman_delete",
		"materials_root", "materials_list", "material_shop_view", "material_shop_create", "material_shop_edit", "material_shop_delete",
		"projects_root", "projects_list", "project_view", "project_edit", "projects_map",
		"supervision_root", "supervision_projects", "supervision_workspace_edit", "supervision_risk_create",
		"supervisors_root", "supervisors_list", "supervisors_whitelist", "supervisors_applications", "supervisors_assignments",
		"supervisors_edit", "supervisors_assignment_manage",
		"quote_erp_root", "project_quote_library", "project_quote_templates", "project_quote_lists", "project_quote_price_books", "project_quote_compare",
		"orders_root", "order_center", "order_center_view", "proposal_review",
		"demands_root", "demands_list", "demand_assign",
		"bookings_root", "bookings_list", "booking_view", "booking_edit",
		"cases_root", "cases_manage",
		"logs_root", "logs_list", "log_view", "audit_logs",
		"reviews_root", "reviews_list", "review_view",
	},
	"operations": {
		"dashboard",
		"users_root", "users_list", "user_view",
		"providers_root", "provider_designers", "provider_designer_view", "provider_designer_create", "provider_designer_edit",
		"provider_companies", "provider_company_view", "provider_company_create", "provider_company_edit",
		"provider_foremen", "provider_foreman_view", "provider_foreman_create", "provider_foreman_edit",
		"provider_audit", "provider_audit_view", "provider_audit_approve", "provider_audit_reject",
		"materials_root", "materials_list", "material_shop_view", "material_shop_create", "material_shop_edit",
		"materials_audit", "material_audit_view", "material_audit_approve", "material_audit_reject",
		"projects_root", "projects_list", "project_view", "project_edit",
		"supervision_root", "supervision_projects", "supervision_workspace_edit", "supervision_risk_create",
		"orders_root",
		"order_center", "order_center_view", "proposal_review",
		"demands_root", "demands_list", "demand_review", "demand_assign",
		"bookings_root", "bookings_list", "booking_view", "booking_create", "booking_edit", "booking_cancel", "bookings_disputed", "booking_dispute_detail", "booking_dispute_resolve",
		"supervisors_root", "supervisors_list", "supervisors_whitelist", "supervisors_applications", "supervisors_assignments",
		"supervisors_edit", "supervisors_assignment_manage",
		"cases_root", "cases_manage",
		"logs_root", "logs_list", "log_view", "audit_logs",
		"reviews_root", "reviews_list", "review_view", "review_delete", "review_hide",
	},
	"finance": {
		"dashboard",
		"users_root", "users_list", "user_view",
		"projects_root", "projects_list", "project_view",
		"orders_root",
		"order_center", "order_center_view",
		"finance_root", "finance_overview", "finance_payment_orders", "finance_escrow", "finance_escrow_view", "finance_escrow_freeze", "finance_escrow_unfreeze",
		"finance_transactions", "finance_transaction_view", "finance_transaction_export", "finance_transaction_approve",
		"finance_payouts", "finance_settlements", "refunds",
	},
	"risk": {
		"dashboard",
		"users_root", "users_list", "user_view",
		"projects_root", "projects_list", "project_view",
		"orders_root",
		"order_center", "order_center_view",
		"risk_root", "risk_warnings", "risk_warning_view", "risk_warning_handle", "risk_warning_ignore",
		"risk_arbitration", "risk_arbitration_view", "risk_arbitration_accept", "risk_arbitration_reject", "risk_arbitration_judge",
		"complaints", "project_audits",
	},
	"customer_service": {
		"dashboard",
		"users_root", "users_list", "user_view", "user_edit",
		"providers_root", "provider_designers", "provider_designer_view", "provider_companies", "provider_company_view", "provider_foremen", "provider_foreman_view",
		"orders_root",
		"order_center", "order_center_view", "proposal_review",
		"demands_root", "demands_list", "demand_review",
		"bookings_root", "bookings_list", "booking_view", "booking_create", "booking_edit", "booking_cancel", "bookings_disputed", "booking_dispute_detail",
		"supervisors_root", "supervisors_list", "supervisors_whitelist", "supervisors_applications",
		"reviews_root", "reviews_list", "review_view",
	},
	"viewer": {
		"dashboard",
		"users_root", "users_list", "user_view", "user_export",
		"providers_root", "provider_designers", "provider_designer_view", "provider_companies", "provider_company_view", "provider_foremen", "provider_foreman_view",
		"materials_root", "materials_list", "material_shop_view",
		"projects_root", "projects_list", "project_view", "projects_map",
		"orders_root",
		"order_center", "order_center_view",
		"demands_root", "demands_list",
		"bookings_root", "bookings_list", "booking_view",
		"supervisors_root", "supervisors_list", "supervisors_whitelist", "supervisors_applications",
		"finance_root", "finance_overview", "finance_payment_orders", "finance_escrow", "finance_escrow_view", "finance_transactions", "finance_transaction_view",
		"finance_payouts", "finance_settlements",
		"reviews_root", "reviews_list", "review_view",
		"risk_root", "risk_warnings", "risk_warning_view", "risk_arbitration", "risk_arbitration_view",
		"logs_root", "logs_list", "log_view", "audit_logs", "settings_root", "settings_outbox_events",
	},
	"system_admin": {
		"dashboard",
		"providers_root", "provider_designers", "provider_designer_view", "provider_designer_create", "provider_designer_edit",
		"provider_companies", "provider_company_view", "provider_company_create", "provider_company_edit",
		"provider_foremen", "provider_foreman_view", "provider_foreman_create", "provider_foreman_edit",
		"materials_root", "materials_list", "material_shop_view", "material_shop_create", "material_shop_edit",
		"projects_root", "projects_list", "project_view", "project_edit",
		"supervision_root", "supervision_projects", "supervision_workspace_edit", "supervision_risk_create",
		"bookings_root", "bookings_list", "booking_view", "booking_edit",
		"supervisors_root", "supervisors_list", "supervisors_whitelist", "supervisors_applications", "supervisors_assignments", "supervisors_assignment_manage",
		"cases_root", "cases_manage",
		"logs_root", "logs_list", "log_view", "audit_logs",
	},
}

var superAdminOnlyMenuKeys = map[string]struct{}{
	"admins_list":        {},
	"admin_create":       {},
	"admin_edit":         {},
	"admin_delete":       {},
	"user_phone_view":    {},
	"user_delete":        {},
	"roles_list":         {},
	"role_create":        {},
	"role_edit":          {},
	"role_delete":        {},
	"role_assign":        {},
	"menus_list":         {},
	"menu_create":        {},
	"menu_edit":          {},
	"menu_delete":        {},
	"settings_config":    {},
	"setting_edit":       {},
	"settings_regions":   {},
	"dictionary":         {},
	"dictionary_view":    {},
	"dictionary_create":  {},
	"dictionary_update":  {},
	"dictionary_delete":  {},
	"permission_root":    {},
	"project_delete":     {},
	"case_audit_view":    {},
	"case_audit_approve": {},
	"case_audit_reject":  {},
}

func PresetRoleKeys() []string {
	keys := make([]string, len(presetRoleOrder))
	copy(keys, presetRoleOrder)
	return keys
}

func PresetRoleDisplayName(roleKey string) string {
	if name, ok := presetRoleDisplayNames[roleKey]; ok {
		return name
	}
	return roleKey
}

func IsPresetRole(roleKey string) bool {
	_, ok := presetRoleMenuKeyTemplates[roleKey]
	return ok
}

func PresetRoleMenuKeyTemplates() map[string][]string {
	result := make(map[string][]string, len(presetRoleMenuKeyTemplates))
	for roleKey, menuKeys := range presetRoleMenuKeyTemplates {
		copied := make([]string, len(menuKeys))
		copy(copied, menuKeys)
		result[roleKey] = copied
	}
	return result
}

func MustPresetRoleMenuKeys(roleKey string) []string {
	menuKeys, ok := presetRoleMenuKeyTemplates[roleKey]
	if !ok {
		return nil
	}
	copied := make([]string, len(menuKeys))
	copy(copied, menuKeys)
	return copied
}

func SuperAdminOnlyMenuKeys() map[string]struct{} {
	result := make(map[string]struct{}, len(superAdminOnlyMenuKeys))
	for key := range superAdminOnlyMenuKeys {
		result[key] = struct{}{}
	}
	return result
}
