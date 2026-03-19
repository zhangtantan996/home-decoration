//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"

	"golang.org/x/crypto/bcrypt"
)

// 初始化 RBAC 数据：超级管理员 + 基础菜单
func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("加载配置失败:", err)
	}

	// 初始化数据库
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	fmt.Println("开始初始化 RBAC 数据...")

	// 1. 创建超级管理员角色
	superRole := model.SysRole{
		Name:   "超级管理员",
		Key:    "super_admin",
		Remark: "系统超级管理员，拥有所有权限",
		Sort:   0,
		Status: 1,
	}
	repository.DB.FirstOrCreate(&superRole, model.SysRole{Key: "super_admin"})
	fmt.Println("✓ 超级管理员角色创建完成")

	// 2. 创建默认管理员账号 (admin / admin123)
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	superAdmin := model.SysAdmin{
		Username:     "admin",
		Password:     string(hashedPassword),
		Nickname:     "超级管理员",
		Status:       1,
		IsSuperAdmin: true,
	}
	repository.DB.FirstOrCreate(&superAdmin, model.SysAdmin{Username: "admin"})
	fmt.Println("✓ 超级管理员账号创建完成 (用户名: admin, 密码: admin123)")

	// 3. 创建基础菜单
	menus := []model.SysMenu{
		// 一级菜单
		{ID: 1, ParentID: 0, Title: "工作台", Type: 2, Path: "/dashboard", Component: "pages/dashboard", Icon: "DashboardOutlined", Sort: 1, Permission: "dashboard:view"},

		// 用户管理
		{ID: 10, ParentID: 0, Title: "用户管理", Type: 1, Path: "/users", Icon: "UserOutlined", Sort: 10},
		{ID: 11, ParentID: 10, Title: "用户列表", Type: 2, Path: "/users/list", Component: "pages/users/UserList", Sort: 1, Permission: "system:user:list"},
		{ID: 12, ParentID: 10, Title: "管理员管理", Type: 2, Path: "/users/admins", Component: "pages/admins/AdminList", Sort: 2, Permission: "system:admin:list"},

		// 服务商管理
		{ID: 20, ParentID: 0, Title: "服务商管理", Type: 1, Path: "/providers", Icon: "TeamOutlined", Sort: 20},
		{ID: 21, ParentID: 20, Title: "设计师", Type: 2, Path: "/providers/designers", Component: "pages/providers/ProviderList", Sort: 1, Permission: "provider:designer:list"},
		{ID: 22, ParentID: 20, Title: "装修公司", Type: 2, Path: "/providers/companies", Component: "pages/providers/ProviderList", Sort: 2, Permission: "provider:company:list"},
		{ID: 23, ParentID: 20, Title: "工长", Type: 2, Path: "/providers/foremen", Component: "pages/providers/ProviderList", Sort: 3, Permission: "provider:foreman:list"},
		{ID: 24, ParentID: 20, Title: "资质审核", Type: 2, Path: "/providers/audit", Component: "pages/audits/ProviderAudit", Sort: 4, Permission: "provider:audit:list"},

		// 主材门店
		{ID: 30, ParentID: 0, Title: "主材门店", Type: 1, Path: "/materials", Icon: "ShopOutlined", Sort: 30},
		{ID: 31, ParentID: 30, Title: "门店列表", Type: 2, Path: "/materials/list", Component: "pages/materials/MaterialShopList", Sort: 1, Permission: "material:shop:list"},
		{ID: 32, ParentID: 30, Title: "认证审核", Type: 2, Path: "/materials/audit", Component: "pages/audits/MaterialShopAudit", Sort: 2, Permission: "material:audit:list"},

		// 项目管理
		{ID: 40, ParentID: 0, Title: "项目管理", Type: 1, Path: "/projects", Icon: "ProjectOutlined", Sort: 40},
		{ID: 41, ParentID: 40, Title: "工地列表", Type: 2, Path: "/projects/list", Component: "pages/projects/list", Sort: 1, Permission: "project:list"},
		{ID: 42, ParentID: 40, Title: "全景地图", Type: 2, Path: "/projects/map", Component: "pages/projects/ProjectMap", Sort: 2, Permission: "project:map"},

		// 预约管理
		{ID: 50, ParentID: 0, Title: "预约管理", Type: 2, Path: "/bookings", Component: "pages/bookings/BookingList", Icon: "CalendarOutlined", Sort: 50, Permission: "booking:list"},

		// 资金中心
		{ID: 60, ParentID: 0, Title: "资金中心", Type: 1, Path: "/finance", Icon: "BankOutlined", Sort: 60},
		{ID: 61, ParentID: 60, Title: "资金概览", Type: 2, Path: "/finance/overview", Component: "pages/finance/FinanceOverview", Sort: 0, Permission: "finance:escrow:list"},
		{ID: 62, ParentID: 60, Title: "托管账户", Type: 2, Path: "/finance/escrow", Component: "pages/finance/EscrowAccountList", Sort: 1, Permission: "finance:escrow:list"},
		{ID: 63, ParentID: 60, Title: "交易记录", Type: 2, Path: "/finance/transactions", Component: "pages/finance/TransactionList", Sort: 2, Permission: "finance:transaction:list"},

		// 评价管理
		{ID: 70, ParentID: 0, Title: "评价管理", Type: 2, Path: "/reviews", Component: "pages/reviews/ReviewList", Icon: "StarOutlined", Sort: 70, Permission: "review:list"},

		// 风控中心
		{ID: 80, ParentID: 0, Title: "风控中心", Type: 1, Path: "/risk", Icon: "SafetyOutlined", Sort: 80},
		{ID: 81, ParentID: 80, Title: "风险预警", Type: 2, Path: "/risk/warnings", Component: "pages/risk/RiskWarningList", Sort: 1, Permission: "risk:warning:list"},
		{ID: 82, ParentID: 80, Title: "仲裁中心", Type: 2, Path: "/risk/arbitration", Component: "pages/risk/ArbitrationCenter", Sort: 2, Permission: "risk:arbitration:list"},

		// 操作日志
		{ID: 90, ParentID: 0, Title: "操作日志", Type: 2, Path: "/logs", Component: "pages/system/LogList", Icon: "FileTextOutlined", Sort: 90, Permission: "system:log:list"},
		{ID: 91, ParentID: 0, Title: "业务审计日志", Type: 2, Path: "/audit-logs", Component: "pages/system/AuditLogList", Icon: "FileTextOutlined", Sort: 91, Permission: "system:log:list"},

		// 系统设置
		{ID: 100, ParentID: 0, Title: "系统设置", Type: 2, Path: "/settings", Component: "pages/settings/SystemSettings", Icon: "SettingOutlined", Sort: 100, Permission: "system:setting:list"},
	}

	for _, menu := range menus {
		menu.Visible = true
		menu.Status = 1
		repository.DB.FirstOrCreate(&menu, model.SysMenu{ID: menu.ID})
	}
	fmt.Println("✓ 基础菜单创建完成")

	// 4. 给超级管理员角色分配所有菜单权限
	for _, menu := range menus {
		roleMenu := model.SysRoleMenu{
			RoleID: superRole.ID,
			MenuID: menu.ID,
		}
		repository.DB.FirstOrCreate(&roleMenu, roleMenu)
	}
	fmt.Println("✓ 超级管理员角色权限分配完成")

	// 5. 给管理员账号分配超级管理员角色
	adminRole := model.SysAdminRole{
		AdminID: superAdmin.ID,
		RoleID:  superRole.ID,
	}
	repository.DB.FirstOrCreate(&adminRole, adminRole)
	fmt.Println("✓ 管理员角色绑定完成")

	fmt.Println("\n========================================")
	fmt.Println("RBAC 数据初始化完成！")
	fmt.Println("管理员账号: admin")
	fmt.Println("管理员密码: admin123")
	fmt.Println("========================================")
}
