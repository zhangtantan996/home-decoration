//go:build ignore
// +build ignore

package main

import (
	"errors"
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type menuSpec struct {
	Key        string
	ParentKey  string
	Title      string
	Type       int8
	Permission string
	Path       string
	Component  string
	Icon       string
	Sort       int
	Visible    bool
	Status     int8
}

func menuDir(key, parentKey, title, path, icon string, sort int, permission string) menuSpec {
	return menuSpec{
		Key:        key,
		ParentKey:  parentKey,
		Title:      title,
		Type:       1,
		Permission: permission,
		Path:       path,
		Icon:       icon,
		Sort:       sort,
		Visible:    true,
		Status:     1,
	}
}

func menuPage(key, parentKey, title, path, component, icon string, sort int, permission string) menuSpec {
	return menuSpec{
		Key:        key,
		ParentKey:  parentKey,
		Title:      title,
		Type:       2,
		Permission: permission,
		Path:       path,
		Component:  component,
		Icon:       icon,
		Sort:       sort,
		Visible:    true,
		Status:     1,
	}
}

func menuHiddenPage(key, parentKey, title, path, component, icon string, sort int, permission string) menuSpec {
	spec := menuPage(key, parentKey, title, path, component, icon, sort, permission)
	spec.Visible = false
	return spec
}

func menuButton(key, parentKey, title, permission string, sort int) menuSpec {
	return menuSpec{
		Key:        key,
		ParentKey:  parentKey,
		Title:      title,
		Type:       3,
		Permission: permission,
		Sort:       sort,
		Visible:    false,
		Status:     1,
	}
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("加载配置失败:", err)
	}

	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	fmt.Println("========================================")
	fmt.Println("开始初始化完整的 RBAC 权限数据...")
	fmt.Println("========================================\n")

	fmt.Println("📋 步骤 1/5: 创建菜单和权限...")
	menus := createMenus()

	fmt.Println("\n👥 步骤 2/5: 创建角色...")
	roles := createRoles()

	fmt.Println("\n🔐 步骤 3/5: 分配角色权限...")
	assignRolePermissions(roles, menus)

	fmt.Println("\n👤 步骤 4/5: 创建测试管理员账号...")
	admins := createAdmins()

	fmt.Println("\n🎭 步骤 5/5: 分配管理员角色...")
	assignAdminRoles(admins, roles)

	fmt.Println("\n========================================")
	fmt.Println("✅ RBAC 权限数据初始化完成!")
	fmt.Println("========================================")
	fmt.Println("\n📝 测试账号信息:")
	fmt.Println("┌─────────────┬──────────────┬───────────────────┐")
	fmt.Println("│   账号      │   密码       │      角色         │")
	fmt.Println("├─────────────┼──────────────┼───────────────────┤")
	fmt.Println("│ admin       │ admin123     │ 超级管理员        │")
	fmt.Println("│ product     │ product123   │ 产品管理          │")
	fmt.Println("│ operations  │ ops123       │ 运营管理          │")
	fmt.Println("│ finance     │ finance123   │ 财务管理          │")
	fmt.Println("│ risk        │ risk123      │ 风控管理          │")
	fmt.Println("│ service     │ service123   │ 客服              │")
	fmt.Println("│ viewer      │ viewer123    │ 只读用户          │")
	fmt.Println("│ supervisor  │ supervisor123│ 监理专员          │")
	fmt.Println("└─────────────┴──────────────┴───────────────────┘")
	fmt.Println("\n🌐 管理后台地址: http://localhost:5175/admin/")
}

func createMenus() map[string]*model.SysMenu {
	specs := menuSpecs()
	menuMap := make(map[string]*model.SysMenu, len(specs))

	for _, spec := range specs {
		parentID := uint64(0)
		if spec.ParentKey != "" {
			parent, ok := menuMap[spec.ParentKey]
			if !ok {
				log.Fatalf("菜单 %s 的父级 %s 未初始化", spec.Key, spec.ParentKey)
			}
			parentID = parent.ID
		}

		menu, err := upsertMenu(spec, parentID)
		if err != nil {
			log.Fatalf("同步菜单 %s 失败: %v", spec.Key, err)
		}
		menuMap[spec.Key] = menu
	}

	fmt.Printf("   ✓ 同步了 %d 个菜单/权限点\n", len(specs))
	fmt.Println("   ✓ 菜单按 path/permission 幂等同步，不再依赖固定菜单 ID")
	return menuMap
}

func upsertMenu(spec menuSpec, parentID uint64) (*model.SysMenu, error) {
	var menu model.SysMenu
	var err error

	switch {
	case spec.Path != "":
		err = repository.DB.Where("path = ?", spec.Path).Order("id ASC").First(&menu).Error
	case spec.Permission != "":
		err = repository.DB.Where("permission = ?", spec.Permission).Order("id ASC").First(&menu).Error
	default:
		return nil, fmt.Errorf("菜单 %s 缺少 path/permission 业务键", spec.Key)
	}

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		menu = model.SysMenu{}
	}

	menu.ParentID = parentID
	menu.Title = spec.Title
	menu.Type = spec.Type
	menu.Permission = spec.Permission
	menu.Path = spec.Path
	menu.Component = spec.Component
	menu.Icon = spec.Icon
	menu.Sort = spec.Sort
	menu.Visible = spec.Visible
	menu.Status = spec.Status

	if menu.ID == 0 {
		if err := repository.DB.Create(&menu).Error; err != nil {
			return nil, err
		}
	} else {
		if err := repository.DB.Model(&model.SysMenu{}).Where("id = ?", menu.ID).Updates(map[string]any{
			"parent_id":  menu.ParentID,
			"title":      menu.Title,
			"type":       menu.Type,
			"permission": menu.Permission,
			"path":       menu.Path,
			"component":  menu.Component,
			"icon":       menu.Icon,
			"sort":       menu.Sort,
			"visible":    menu.Visible,
			"status":     menu.Status,
		}).Error; err != nil {
			return nil, err
		}
	}

	return &menu, nil
}

func menuSpecs() []menuSpec {
	return []menuSpec{
		menuPage("dashboard", "", "工作台", "/dashboard", "pages/dashboard", "DashboardOutlined", 1, "dashboard:view"),

		menuDir("users_root", "", "用户管理", "/users", "UserOutlined", 10, ""),
		menuPage("users_list", "users_root", "用户列表", "/users/list", "pages/users/UserList", "", 1, "system:user:list"),
		menuButton("user_view", "users_root", "查看用户", "system:user:view", 1),
		menuButton("user_edit", "users_root", "编辑用户", "system:user:edit", 2),
		menuButton("user_delete", "users_root", "删除用户", "system:user:delete", 3),
		menuButton("user_export", "users_root", "导出用户", "system:user:export", 4),
		menuPage("admins_list", "users_root", "管理员管理", "/users/admins", "pages/admins/AdminList", "", 2, "system:admin:list"),
		menuButton("admin_create", "users_root", "创建管理员", "system:admin:create", 5),
		menuButton("admin_edit", "users_root", "编辑管理员", "system:admin:edit", 6),
		menuButton("admin_delete", "users_root", "删除管理员", "system:admin:delete", 7),

		menuDir("providers_root", "", "服务商管理", "/providers", "TeamOutlined", 20, ""),
		menuPage("provider_designers", "providers_root", "设计师", "/providers/designers", "pages/providers/ProviderList", "", 1, "provider:designer:list"),
		menuButton("provider_designer_view", "providers_root", "查看设计师", "provider:designer:view", 1),
		menuButton("provider_designer_create", "providers_root", "创建设计师", "provider:designer:create", 2),
		menuButton("provider_designer_edit", "providers_root", "编辑设计师", "provider:designer:edit", 3),
		menuButton("provider_designer_delete", "providers_root", "删除设计师", "provider:designer:delete", 4),
		menuPage("provider_companies", "providers_root", "装修公司", "/providers/companies", "pages/providers/ProviderList", "", 2, "provider:company:list"),
		menuButton("provider_company_view", "providers_root", "查看装修公司", "provider:company:view", 5),
		menuButton("provider_company_create", "providers_root", "创建装修公司", "provider:company:create", 6),
		menuButton("provider_company_edit", "providers_root", "编辑装修公司", "provider:company:edit", 7),
		menuButton("provider_company_delete", "providers_root", "删除装修公司", "provider:company:delete", 8),
		menuPage("provider_foremen", "providers_root", "工长", "/providers/foremen", "pages/providers/ProviderList", "", 3, "provider:foreman:list"),
		menuButton("provider_foreman_view", "providers_root", "查看工长", "provider:foreman:view", 9),
		menuButton("provider_foreman_create", "providers_root", "创建工长", "provider:foreman:create", 10),
		menuButton("provider_foreman_edit", "providers_root", "编辑工长", "provider:foreman:edit", 11),
		menuButton("provider_foreman_delete", "providers_root", "删除工长", "provider:foreman:delete", 12),
		menuPage("provider_audit", "providers_root", "资质审核", "/providers/audit", "pages/audits/ProviderAudit", "", 4, "provider:audit:list"),
		menuButton("provider_audit_view", "providers_root", "查看审核", "provider:audit:view", 13),
		menuButton("provider_audit_approve", "providers_root", "审核通过", "provider:audit:approve", 14),
		menuButton("provider_audit_reject", "providers_root", "审核拒绝", "provider:audit:reject", 15),

		menuDir("materials_root", "", "主材门店", "/materials", "ShopOutlined", 30, ""),
		menuPage("materials_list", "materials_root", "门店列表", "/materials/list", "pages/materials/MaterialShopList", "", 1, "material:shop:list"),
		menuButton("material_shop_view", "materials_root", "查看门店", "material:shop:view", 1),
		menuButton("material_shop_create", "materials_root", "创建门店", "material:shop:create", 2),
		menuButton("material_shop_edit", "materials_root", "编辑门店", "material:shop:edit", 3),
		menuButton("material_shop_delete", "materials_root", "删除门店", "material:shop:delete", 4),
		menuPage("materials_audit", "materials_root", "认证审核", "/materials/audit", "pages/audits/MaterialShopAudit", "", 2, "material:audit:list"),
		menuButton("material_audit_view", "materials_root", "查看门店审核", "material:audit:view", 5),
		menuButton("material_audit_approve", "materials_root", "门店审核通过", "material:audit:approve", 6),
		menuButton("material_audit_reject", "materials_root", "门店审核拒绝", "material:audit:reject", 7),

		menuDir("projects_root", "", "项目管理", "/projects", "ProjectOutlined", 40, ""),
		menuPage("projects_list", "projects_root", "工地列表", "/projects/list", "pages/projects/list", "", 1, "project:list"),
		menuButton("project_view", "projects_root", "查看项目", "project:view", 1),
		menuButton("project_edit", "projects_root", "编辑项目", "project:edit", 2),
		menuButton("project_delete", "projects_root", "删除项目", "project:delete", 3),
		menuPage("projects_map", "projects_root", "全景地图", "/projects/map", "pages/projects/ProjectMap", "", 2, "project:map"),
		// 报价 ERP 属于报价经营治理域，不与项目管理 / 监理工作台混挂。
		menuDir("quote_erp_root", "", "报价ERP", "/projects/quotes", "FileTextOutlined", 44, ""),
		menuPage("project_quote_library", "quote_erp_root", "标准项库", "/projects/quotes/library", "pages/quotes/QuoteLibraryManagement", "", 1, "project:list"),
		menuPage("project_quote_templates", "quote_erp_root", "报价模板", "/projects/quotes/templates", "pages/quotes/QuoteTemplateManagement", "", 2, "project:list"),
		menuPage("project_quote_lists", "quote_erp_root", "施工报价单", "/projects/quotes/lists", "pages/quotes/QuoteListManagement", "", 3, "project:edit"),
		menuPage("project_quote_price_books", "quote_erp_root", "施工主体价格库巡检", "/projects/quotes/price-books", "pages/quotes/ProviderPriceBookInspection", "", 4, "provider:list"),
		menuPage("order_center", "quote_erp_root", "变更与结算", "/orders", "pages/orders/OrderList", "", 5, "order:center:list"),
		menuHiddenPage("project_quote_compare", "quote_erp_root", "报价对比", "/projects/quotes/compare/:id", "pages/quotes/QuoteComparison", "", 6, "project:view"),
		menuButton("order_center_view", "order_center", "查看变更与结算", "order:center:view", 1),
		menuButton("proposal_review", "order_center", "审核方案", "proposal:review", 2),

		menuDir("demands_root", "", "需求中心", "/demands", "UnorderedListOutlined", 46, "demand:center"),
		menuPage("demands_list", "demands_root", "需求管理", "/demands/list", "pages/demands/DemandList", "UnorderedListOutlined", 1, "demand:list"),
		menuButton("demand_review", "demands_root", "审核需求", "demand:review", 2),
		menuButton("demand_assign", "demands_root", "分配需求", "demand:assign", 3),

		menuDir("bookings_root", "", "预约管理", "/bookings", "CalendarOutlined", 50, "booking:list"),
		menuPage("bookings_list", "bookings_root", "预约列表", "/bookings/list", "pages/bookings/BookingList", "CalendarOutlined", 1, "booking:list"),
		menuButton("booking_view", "bookings_list", "查看预约", "booking:view", 1),
		menuButton("booking_create", "bookings_list", "创建预约", "booking:create", 2),
		menuButton("booking_edit", "bookings_list", "编辑预约", "booking:edit", 3),
		menuButton("booking_cancel", "bookings_list", "取消预约", "booking:cancel", 4),
		menuPage("bookings_disputed", "bookings_root", "争议预约", "/bookings/disputed", "pages/bookings/DisputedBookings", "WarningOutlined", 2, "booking:dispute:list"),
		menuButton("booking_dispute_detail", "bookings_disputed", "查看详情", "booking:dispute:detail", 1),
		menuButton("booking_dispute_resolve", "bookings_disputed", "处理争议", "booking:dispute:resolve", 2),

		menuDir("cases_root", "", "作品管理", "/cases", "FileImageOutlined", 55, "system:case:list"),
		menuPage("cases_manage", "cases_root", "作品列表", "/cases/manage", "pages/cases/CaseManagement", "UnorderedListOutlined", 1, "system:case:view"),
		menuButton("case_audit_view", "cases_manage", "查看审核", "case:audit:view", 1),
		menuButton("case_audit_approve", "cases_manage", "审核通过", "case:audit:approve", 2),
		menuButton("case_audit_reject", "cases_manage", "审核拒绝", "case:audit:reject", 3),

		// 监理工作台属于履约执行域，只承接项目巡检和监理动作。
		menuDir("supervision_root", "", "监理工作台", "/supervision", "ProjectOutlined", 58, ""),
		menuPage("supervision_projects", "supervision_root", "项目巡检", "/supervision/projects", "pages/supervision/WorkbenchList", "", 1, "supervision:workspace:view"),
		menuButton("supervision_workspace_edit", "supervision_root", "编辑监理工作台", "supervision:workspace:edit", 1),
		menuButton("supervision_risk_create", "supervision_root", "上报监理风险", "supervision:risk:create", 2),

		menuDir("finance_root", "", "资金中心", "/finance", "BankOutlined", 60, ""),
		menuPage("finance_overview", "finance_root", "资金概览", "/finance/overview", "pages/finance/FinanceOverview", "AccountBookOutlined", 0, "finance:escrow:list"),
		menuPage("finance_payment_orders", "finance_root", "支付单", "/finance/payment-orders", "pages/finance/PaymentOrderList", "", 1, "finance:transaction:list"),
		menuPage("finance_escrow", "finance_root", "托管账户", "/finance/escrow", "pages/finance/EscrowAccountList", "", 2, "finance:escrow:list"),
		menuButton("finance_escrow_view", "finance_root", "查看账户", "finance:escrow:view", 1),
		menuButton("finance_escrow_freeze", "finance_root", "冻结账户", "finance:escrow:freeze", 2),
		menuButton("finance_escrow_unfreeze", "finance_root", "解冻账户", "finance:escrow:unfreeze", 3),
		menuPage("finance_transactions", "finance_root", "交易记录", "/finance/transactions", "pages/finance/TransactionList", "", 3, "finance:transaction:list"),
		menuButton("finance_transaction_view", "finance_root", "查看交易", "finance:transaction:view", 4),
		menuButton("finance_transaction_export", "finance_root", "导出交易", "finance:transaction:export", 5),
		menuButton("finance_transaction_approve", "finance_root", "审批交易", "finance:transaction:approve", 6),
		menuPage("finance_payouts", "finance_root", "自动出款", "/finance/payouts", "pages/finance/PayoutList", "", 4, "finance:transaction:list"),
		menuPage("finance_settlements", "finance_root", "结算管理", "/finance/settlements", "pages/finance/SettlementList", "", 5, "finance:transaction:list"),
		menuPage("refunds", "finance_root", "退款审核", "/refunds", "pages/refunds/RefundList", "AccountBookOutlined", 6, "finance:transaction:list"),

		menuDir("reviews_root", "", "评价管理", "/reviews", "StarOutlined", 70, "review:list"),
		menuPage("reviews_list", "reviews_root", "评价列表", "/reviews/list", "pages/reviews/ReviewList", "StarOutlined", 0, "review:list"),
		menuButton("review_view", "reviews_list", "查看评价", "review:view", 1),
		menuButton("review_delete", "reviews_list", "删除评价", "review:delete", 2),
		menuButton("review_hide", "reviews_list", "隐藏评价", "review:hide", 3),

		menuDir("risk_root", "", "风控中心", "/risk", "SafetyOutlined", 80, ""),
		menuPage("risk_warnings", "risk_root", "风险预警", "/risk/warnings", "pages/risk/RiskWarningList", "", 1, "risk:warning:list"),
		menuButton("risk_warning_view", "risk_root", "查看预警", "risk:warning:view", 1),
		menuButton("risk_warning_handle", "risk_root", "处理风险", "risk:warning:handle", 2),
		menuButton("risk_warning_ignore", "risk_root", "忽略风险", "risk:warning:ignore", 3),
		menuPage("risk_arbitration", "risk_root", "仲裁中心", "/risk/arbitration", "pages/risk/ArbitrationCenter", "", 2, "risk:arbitration:list"),
		menuButton("risk_arbitration_view", "risk_root", "查看仲裁", "risk:arbitration:view", 4),
		menuButton("risk_arbitration_accept", "risk_root", "受理仲裁", "risk:arbitration:accept", 5),
		menuButton("risk_arbitration_reject", "risk_root", "驳回仲裁", "risk:arbitration:reject", 6),
		menuButton("risk_arbitration_judge", "risk_root", "裁决仲裁", "risk:arbitration:judge", 7),
		menuPage("complaints", "risk_root", "投诉处理", "/complaints", "pages/complaints/ComplaintManagement", "WarningOutlined", 3, "risk:arbitration:list"),
		menuPage("project_audits", "risk_root", "项目审计", "/project-audits", "pages/projectAudits/ProjectAuditList", "AuditOutlined", 4, "risk:arbitration:list"),

		menuDir("logs_root", "", "操作日志", "/logs", "FileTextOutlined", 90, "system:log:list"),
		menuPage("logs_list", "logs_root", "日志列表", "/logs/list", "pages/logs/LogList", "FileTextOutlined", 0, "system:log:list"),
		menuButton("log_view", "logs_list", "查看日志", "system:log:view", 1),
		menuPage("audit_logs", "", "业务审计日志", "/audit-logs", "pages/system/AuditLogList", "FileTextOutlined", 91, "system:log:list"),

		menuDir("settings_root", "", "系统设置", "/settings", "SettingOutlined", 100, "system:setting:list"),
		menuPage("settings_config", "settings_root", "系统配置", "/settings/config", "pages/settings/SystemSettings", "SettingOutlined", 0, "system:setting:list"),
		menuButton("setting_edit", "settings_config", "编辑设置", "system:setting:edit", 1),
		menuPage("settings_regions", "settings_root", "行政区划管理", "/settings/regions", "pages/settings/RegionManagement", "EnvironmentOutlined", 10, ""),
		menuPage("dictionary", "settings_root", "字典管理", "/system/dictionary", "pages/settings/DictionaryManagement", "UnorderedListOutlined", 11, ""),
		menuButton("dictionary_view", "dictionary", "查看字典", "dict:view", 1),
		menuButton("dictionary_create", "dictionary", "创建字典", "dict:create", 2),
		menuButton("dictionary_update", "dictionary", "编辑字典", "dict:update", 3),
		menuButton("dictionary_delete", "dictionary", "删除字典", "dict:delete", 4),

		menuDir("permission_root", "", "权限管理", "/permission", "LockOutlined", 110, ""),
		menuPage("roles_list", "permission_root", "角色管理", "/permission/roles", "pages/permission/RoleList", "", 1, "system:role:list"),
		menuButton("role_create", "permission_root", "创建角色", "system:role:create", 1),
		menuButton("role_edit", "permission_root", "编辑角色", "system:role:edit", 2),
		menuButton("role_delete", "permission_root", "删除角色", "system:role:delete", 3),
		menuButton("role_assign", "permission_root", "分配权限", "system:role:assign", 4),
		menuPage("menus_list", "permission_root", "菜单管理", "/permission/menus", "pages/permission/MenuList", "", 2, "system:menu:list"),
		menuButton("menu_create", "permission_root", "创建菜单", "system:menu:create", 5),
		menuButton("menu_edit", "permission_root", "编辑菜单", "system:menu:edit", 6),
		menuButton("menu_delete", "permission_root", "删除菜单", "system:menu:delete", 7),
	}
}

func createRoles() map[string]*model.SysRole {
	roles := []model.SysRole{
		{Name: "超级管理员", Key: "super_admin", Remark: "系统超级管理员，拥有所有权限", Sort: 0, Status: 1},
		{Name: "产品管理", Key: "product_manager", Remark: "负责产品数据维护、服务商/门店管理", Sort: 10, Status: 1},
		{Name: "运营管理", Key: "operations", Remark: "负责审核、内容管理、用户管理", Sort: 20, Status: 1},
		{Name: "财务管理", Key: "finance", Remark: "负责资金管理、交易审核", Sort: 30, Status: 1},
		{Name: "风控管理", Key: "risk", Remark: "负责风险预警、纠纷仲裁", Sort: 40, Status: 1},
		{Name: "客服", Key: "customer_service", Remark: "处理用户咨询、预约管理", Sort: 50, Status: 1},
		{Name: "只读用户", Key: "viewer", Remark: "数据分析、报表查看", Sort: 60, Status: 1},
		{Name: "监理专员", Key: "project_supervisor", Remark: "负责项目阶段推进、施工日志录入与风险上报", Sort: 65, Status: 1},
		{Name: "系统管理员", Key: "system_admin", Remark: "三员分立保留角色：负责系统配置与账号体系，必须独立分配", Sort: 70, Status: 1},
		{Name: "安全管理员", Key: "security_admin", Remark: "三员分立保留角色：负责安全策略与安全事件处置，必须独立分配", Sort: 71, Status: 1},
		{Name: "安全审计员", Key: "security_auditor", Remark: "三员分立保留角色：默认只读审计角色，必须独立分配", Sort: 72, Status: 1},
	}

	roleMap := make(map[string]*model.SysRole, len(roles))
	for i := range roles {
		repository.DB.FirstOrCreate(&roles[i], model.SysRole{Key: roles[i].Key})
		roleMap[roles[i].Key] = &roles[i]
		fmt.Printf("   ✓ 创建角色: %s (%s)\n", roles[i].Name, roles[i].Key)
	}

	return roleMap
}

func assignRolePermissions(roles map[string]*model.SysRole, menus map[string]*model.SysMenu) {
	assignAllMenusToSuperAdmin(roles["super_admin"].ID)

	assignPermissionsByKeys(roles["product_manager"].ID, []string{
		"dashboard",
		"users_root", "users_list", "user_view", "user_export",
		"providers_root", "provider_designers", "provider_designer_view", "provider_designer_create", "provider_designer_edit", "provider_designer_delete",
		"provider_companies", "provider_company_view", "provider_company_create", "provider_company_edit", "provider_company_delete",
		"provider_foremen", "provider_foreman_view", "provider_foreman_create", "provider_foreman_edit", "provider_foreman_delete",
		"materials_root", "materials_list", "material_shop_view", "material_shop_create", "material_shop_edit", "material_shop_delete",
		"projects_root", "projects_list", "project_view", "project_edit", "projects_map",
		"quote_erp_root", "project_quote_library", "project_quote_templates", "project_quote_lists", "project_quote_price_books", "project_quote_compare",
		"order_center", "order_center_view", "proposal_review",
		"demands_root", "demands_list", "demand_assign",
		"reviews_root", "reviews_list", "review_view",
	}, "产品管理", menus)

	assignPermissionsByKeys(roles["operations"].ID, []string{
		"dashboard",
		"users_root", "users_list", "user_view",
		"providers_root", "provider_designers", "provider_designer_view", "provider_companies", "provider_company_view", "provider_foremen", "provider_foreman_view",
		"provider_audit", "provider_audit_view", "provider_audit_approve", "provider_audit_reject",
		"materials_root", "materials_audit", "material_audit_view", "material_audit_approve", "material_audit_reject",
		"quote_erp_root",
		"order_center", "order_center_view", "proposal_review",
		"demands_root", "demands_list", "demand_review", "demand_assign",
		"bookings_root", "bookings_list", "booking_view", "booking_create", "booking_edit", "booking_cancel", "bookings_disputed", "booking_dispute_detail", "booking_dispute_resolve",
		"reviews_root", "reviews_list", "review_view", "review_delete", "review_hide",
	}, "运营管理", menus)

	assignPermissionsByKeys(roles["finance"].ID, []string{
		"dashboard",
		"users_root", "users_list", "user_view",
		"projects_root", "projects_list", "project_view",
		"quote_erp_root",
		"order_center", "order_center_view",
		"finance_root", "finance_overview", "finance_payment_orders", "finance_escrow", "finance_escrow_view", "finance_escrow_freeze", "finance_escrow_unfreeze",
		"finance_transactions", "finance_transaction_view", "finance_transaction_export", "finance_transaction_approve",
		"finance_payouts", "finance_settlements", "refunds",
	}, "财务管理", menus)

	assignPermissionsByKeys(roles["risk"].ID, []string{
		"dashboard",
		"users_root", "users_list", "user_view",
		"projects_root", "projects_list", "project_view",
		"quote_erp_root",
		"order_center", "order_center_view",
		"risk_root", "risk_warnings", "risk_warning_view", "risk_warning_handle", "risk_warning_ignore",
		"risk_arbitration", "risk_arbitration_view", "risk_arbitration_accept", "risk_arbitration_reject", "risk_arbitration_judge",
		"complaints", "project_audits",
	}, "风控管理", menus)

	assignPermissionsByKeys(roles["customer_service"].ID, []string{
		"dashboard",
		"users_root", "users_list", "user_view", "user_edit",
		"providers_root", "provider_designers", "provider_designer_view", "provider_companies", "provider_company_view", "provider_foremen", "provider_foreman_view",
		"quote_erp_root",
		"order_center", "order_center_view", "proposal_review",
		"demands_root", "demands_list", "demand_review",
		"bookings_root", "bookings_list", "booking_view", "booking_create", "booking_edit", "booking_cancel", "bookings_disputed", "booking_dispute_detail",
		"reviews_root", "reviews_list", "review_view",
	}, "客服", menus)

	assignPermissionsByKeys(roles["viewer"].ID, []string{
		"dashboard",
		"users_root", "users_list", "user_view", "user_export",
		"providers_root", "provider_designers", "provider_designer_view", "provider_companies", "provider_company_view", "provider_foremen", "provider_foreman_view",
		"materials_root", "materials_list", "material_shop_view",
		"projects_root", "projects_list", "project_view", "projects_map",
		"quote_erp_root",
		"order_center", "order_center_view",
		"demands_root", "demands_list",
		"bookings_root", "bookings_list", "booking_view",
		"finance_root", "finance_overview", "finance_payment_orders", "finance_escrow", "finance_escrow_view", "finance_transactions", "finance_transaction_view", "finance_transaction_export",
		"finance_payouts", "finance_settlements",
		"reviews_root", "reviews_list", "review_view",
		"risk_root", "risk_warnings", "risk_warning_view", "risk_arbitration", "risk_arbitration_view",
		"logs_root", "logs_list", "log_view", "audit_logs",
	}, "只读用户", menus)

	assignPermissionsByKeys(roles["project_supervisor"].ID, []string{
		"supervision_root", "supervision_projects", "supervision_workspace_edit", "supervision_risk_create",
	}, "监理专员", menus)

	fmt.Println("   ✓ 三员分立保留角色: 默认不自动分配菜单，需按制度单独授权")
}

func assignAllMenusToSuperAdmin(roleID uint64) {
	var allMenus []model.SysMenu
	repository.DB.Find(&allMenus)
	for _, menu := range allMenus {
		roleMenu := model.SysRoleMenu{RoleID: roleID, MenuID: menu.ID}
		repository.DB.FirstOrCreate(&roleMenu, roleMenu)
	}
	fmt.Printf("   ✓ 超级管理员: 分配了 %d 个权限\n", len(allMenus))
}

func assignPermissionsByKeys(roleID uint64, menuKeys []string, roleName string, menus map[string]*model.SysMenu) {
	for _, key := range menuKeys {
		menu, ok := menus[key]
		if !ok {
			log.Fatalf("角色 %s 依赖的菜单 key 不存在: %s", roleName, key)
		}
		roleMenu := model.SysRoleMenu{RoleID: roleID, MenuID: menu.ID}
		repository.DB.FirstOrCreate(&roleMenu, roleMenu)
	}
	fmt.Printf("   ✓ %s: 分配了 %d 个权限\n", roleName, len(menuKeys))
}

func createAdmins() map[string]*model.SysAdmin {
	admins := []struct {
		Username     string
		Password     string
		Nickname     string
		IsSuperAdmin bool
	}{
		{"admin", "admin123", "超级管理员", true},
		{"product", "product123", "产品经理", false},
		{"operations", "ops123", "运营专员", false},
		{"finance", "finance123", "财务专员", false},
		{"risk", "risk123", "风控专员", false},
		{"service", "service123", "客服专员", false},
		{"viewer", "viewer123", "数据分析师", false},
		{"supervisor", "supervisor123", "监理专员", false},
	}

	adminMap := make(map[string]*model.SysAdmin, len(admins))
	for _, a := range admins {
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(a.Password), bcrypt.DefaultCost)
		admin := model.SysAdmin{
			Username:     a.Username,
			Password:     string(hashedPassword),
			Nickname:     a.Nickname,
			Status:       1,
			IsSuperAdmin: a.IsSuperAdmin,
		}
		repository.DB.FirstOrCreate(&admin, model.SysAdmin{Username: a.Username})
		adminMap[a.Username] = &admin
		fmt.Printf("   ✓ 创建账号: %s / %s (%s)\n", a.Username, a.Password, a.Nickname)
	}

	return adminMap
}

func assignAdminRoles(admins map[string]*model.SysAdmin, roles map[string]*model.SysRole) {
	assignments := map[string]string{
		"admin":      "super_admin",
		"product":    "product_manager",
		"operations": "operations",
		"finance":    "finance",
		"risk":       "risk",
		"service":    "customer_service",
		"viewer":     "viewer",
		"supervisor": "project_supervisor",
	}

	for adminKey, roleKey := range assignments {
		adminRole := model.SysAdminRole{AdminID: admins[adminKey].ID, RoleID: roles[roleKey].ID}
		repository.DB.FirstOrCreate(&adminRole, adminRole)
		fmt.Printf("   ✓ %s -> %s\n", admins[adminKey].Nickname, roles[roleKey].Name)
	}
}
