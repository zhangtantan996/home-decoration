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

// 完整的 RBAC 权限初始化脚本
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

	fmt.Println("========================================")
	fmt.Println("开始初始化完整的 RBAC 权限数据...")
	fmt.Println("========================================\n")

	// 1. 创建所有菜单权限
	fmt.Println("📋 步骤 1/5: 创建菜单和权限...")
	createMenus()

	// 2. 创建所有角色
	fmt.Println("\n👥 步骤 2/5: 创建角色...")
	roles := createRoles()

	// 3. 分配角色权限
	fmt.Println("\n🔐 步骤 3/5: 分配角色权限...")
	assignRolePermissions(roles)

	// 4. 创建测试管理员账号
	fmt.Println("\n👤 步骤 4/5: 创建测试管理员账号...")
	admins := createAdmins()

	// 5. 分配管理员角色
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
	fmt.Println("└─────────────┴──────────────┴───────────────────┘")
	fmt.Println("\n🌐 管理后台地址: http://localhost:5175/admin/")
}

// 创建所有菜单和权限
func createMenus() {
	menus := []model.SysMenu{
		// 工作台
		{ID: 1, ParentID: 0, Title: "工作台", Type: 2, Path: "/dashboard", Component: "pages/dashboard", Icon: "DashboardOutlined", Sort: 1, Permission: "dashboard:view", Visible: true, Status: 1},

		// 用户管理
		{ID: 10, ParentID: 0, Title: "用户管理", Type: 1, Path: "/users", Icon: "UserOutlined", Sort: 10, Visible: true, Status: 1},
		{ID: 11, ParentID: 10, Title: "用户列表", Type: 2, Path: "/users/list", Component: "pages/users/UserList", Sort: 1, Permission: "system:user:list", Visible: true, Status: 1},
		{ID: 12, ParentID: 10, Title: "查看用户", Type: 3, Permission: "system:user:view", Visible: false, Status: 1},
		{ID: 13, ParentID: 10, Title: "编辑用户", Type: 3, Permission: "system:user:edit", Visible: false, Status: 1},
		{ID: 14, ParentID: 10, Title: "删除用户", Type: 3, Permission: "system:user:delete", Visible: false, Status: 1},
		{ID: 15, ParentID: 10, Title: "导出用户", Type: 3, Permission: "system:user:export", Visible: false, Status: 1},
		{ID: 16, ParentID: 10, Title: "管理员管理", Type: 2, Path: "/users/admins", Component: "pages/admins/AdminList", Sort: 2, Permission: "system:admin:list", Visible: true, Status: 1},
		{ID: 17, ParentID: 10, Title: "创建管理员", Type: 3, Permission: "system:admin:create", Visible: false, Status: 1},
		{ID: 18, ParentID: 10, Title: "编辑管理员", Type: 3, Permission: "system:admin:edit", Visible: false, Status: 1},
		{ID: 19, ParentID: 10, Title: "删除管理员", Type: 3, Permission: "system:admin:delete", Visible: false, Status: 1},

		// 服务商管理
		{ID: 20, ParentID: 0, Title: "服务商管理", Type: 1, Path: "/providers", Icon: "TeamOutlined", Sort: 20, Visible: true, Status: 1},
		{ID: 21, ParentID: 20, Title: "设计师", Type: 2, Path: "/providers/designers", Component: "pages/providers/ProviderList", Sort: 1, Permission: "provider:designer:list", Visible: true, Status: 1},
		{ID: 22, ParentID: 20, Title: "查看设计师", Type: 3, Permission: "provider:designer:view", Visible: false, Status: 1},
		{ID: 23, ParentID: 20, Title: "创建设计师", Type: 3, Permission: "provider:designer:create", Visible: false, Status: 1},
		{ID: 24, ParentID: 20, Title: "编辑设计师", Type: 3, Permission: "provider:designer:edit", Visible: false, Status: 1},
		{ID: 25, ParentID: 20, Title: "删除设计师", Type: 3, Permission: "provider:designer:delete", Visible: false, Status: 1},
		{ID: 26, ParentID: 20, Title: "装修公司", Type: 2, Path: "/providers/companies", Component: "pages/providers/ProviderList", Sort: 2, Permission: "provider:company:list", Visible: true, Status: 1},
		{ID: 27, ParentID: 20, Title: "查看装修公司", Type: 3, Permission: "provider:company:view", Visible: false, Status: 1},
		{ID: 28, ParentID: 20, Title: "创建装修公司", Type: 3, Permission: "provider:company:create", Visible: false, Status: 1},
		{ID: 29, ParentID: 20, Title: "编辑装修公司", Type: 3, Permission: "provider:company:edit", Visible: false, Status: 1},
		{ID: 30, ParentID: 20, Title: "删除装修公司", Type: 3, Permission: "provider:company:delete", Visible: false, Status: 1},
		{ID: 31, ParentID: 20, Title: "工长", Type: 2, Path: "/providers/foremen", Component: "pages/providers/ProviderList", Sort: 3, Permission: "provider:foreman:list", Visible: true, Status: 1},
		{ID: 32, ParentID: 20, Title: "查看工长", Type: 3, Permission: "provider:foreman:view", Visible: false, Status: 1},
		{ID: 33, ParentID: 20, Title: "创建工长", Type: 3, Permission: "provider:foreman:create", Visible: false, Status: 1},
		{ID: 34, ParentID: 20, Title: "编辑工长", Type: 3, Permission: "provider:foreman:edit", Visible: false, Status: 1},
		{ID: 35, ParentID: 20, Title: "删除工长", Type: 3, Permission: "provider:foreman:delete", Visible: false, Status: 1},
		{ID: 36, ParentID: 20, Title: "资质审核", Type: 2, Path: "/providers/audit", Component: "pages/audits/ProviderAudit", Sort: 4, Permission: "provider:audit:list", Visible: true, Status: 1},
		{ID: 37, ParentID: 20, Title: "查看审核", Type: 3, Permission: "provider:audit:view", Visible: false, Status: 1},
		{ID: 38, ParentID: 20, Title: "审核通过", Type: 3, Permission: "provider:audit:approve", Visible: false, Status: 1},
		{ID: 39, ParentID: 20, Title: "审核拒绝", Type: 3, Permission: "provider:audit:reject", Visible: false, Status: 1},

		// 主材门店
		{ID: 40, ParentID: 0, Title: "主材门店", Type: 1, Path: "/materials", Icon: "ShopOutlined", Sort: 30, Visible: true, Status: 1},
		{ID: 41, ParentID: 40, Title: "门店列表", Type: 2, Path: "/materials/list", Component: "pages/materials/MaterialShopList", Sort: 1, Permission: "material:shop:list", Visible: true, Status: 1},
		{ID: 42, ParentID: 40, Title: "查看门店", Type: 3, Permission: "material:shop:view", Visible: false, Status: 1},
		{ID: 43, ParentID: 40, Title: "创建门店", Type: 3, Permission: "material:shop:create", Visible: false, Status: 1},
		{ID: 44, ParentID: 40, Title: "编辑门店", Type: 3, Permission: "material:shop:edit", Visible: false, Status: 1},
		{ID: 45, ParentID: 40, Title: "删除门店", Type: 3, Permission: "material:shop:delete", Visible: false, Status: 1},
		{ID: 46, ParentID: 40, Title: "认证审核", Type: 2, Path: "/materials/audit", Component: "pages/audits/MaterialShopAudit", Sort: 2, Permission: "material:audit:list", Visible: true, Status: 1},
		{ID: 47, ParentID: 40, Title: "查看门店审核", Type: 3, Permission: "material:audit:view", Visible: false, Status: 1},
		{ID: 48, ParentID: 40, Title: "门店审核通过", Type: 3, Permission: "material:audit:approve", Visible: false, Status: 1},
		{ID: 49, ParentID: 40, Title: "门店审核拒绝", Type: 3, Permission: "material:audit:reject", Visible: false, Status: 1},

		// 项目管理
		{ID: 50, ParentID: 0, Title: "项目管理", Type: 1, Path: "/projects", Icon: "ProjectOutlined", Sort: 40, Visible: true, Status: 1},
		{ID: 51, ParentID: 50, Title: "工地列表", Type: 2, Path: "/projects/list", Component: "pages/projects/list", Sort: 1, Permission: "project:list", Visible: true, Status: 1},
		{ID: 52, ParentID: 50, Title: "查看项目", Type: 3, Permission: "project:view", Visible: false, Status: 1},
		{ID: 53, ParentID: 50, Title: "编辑项目", Type: 3, Permission: "project:edit", Visible: false, Status: 1},
		{ID: 54, ParentID: 50, Title: "删除项目", Type: 3, Permission: "project:delete", Visible: false, Status: 1},
		{ID: 55, ParentID: 50, Title: "全景地图", Type: 2, Path: "/projects/map", Component: "pages/projects/ProjectMap", Sort: 2, Permission: "project:map", Visible: true, Status: 1},

		// 需求中心
		{ID: 130, ParentID: 0, Title: "需求中心", Type: 1, Path: "/demands", Icon: "UnorderedListOutlined", Sort: 45, Visible: true, Status: 1},
		{ID: 131, ParentID: 130, Title: "需求管理", Type: 2, Path: "/demands/list", Component: "pages/demands/DemandList", Sort: 1, Permission: "demand:list", Visible: true, Status: 1},
		{ID: 132, ParentID: 130, Title: "审核需求", Type: 3, Permission: "demand:review", Visible: false, Status: 1},
		{ID: 133, ParentID: 130, Title: "分配需求", Type: 3, Permission: "demand:assign", Visible: false, Status: 1},

		// 预约管理
		{ID: 60, ParentID: 0, Title: "预约管理", Type: 2, Path: "/bookings", Component: "pages/bookings/BookingList", Icon: "CalendarOutlined", Sort: 50, Permission: "booking:list", Visible: true, Status: 1},
		{ID: 61, ParentID: 0, Title: "查看预约", Type: 3, Permission: "booking:view", Visible: false, Status: 1},
		{ID: 62, ParentID: 0, Title: "创建预约", Type: 3, Permission: "booking:create", Visible: false, Status: 1},
		{ID: 63, ParentID: 0, Title: "编辑预约", Type: 3, Permission: "booking:edit", Visible: false, Status: 1},
		{ID: 64, ParentID: 0, Title: "取消预约", Type: 3, Permission: "booking:cancel", Visible: false, Status: 1},

		// 资金中心
		{ID: 70, ParentID: 0, Title: "资金中心", Type: 1, Path: "/finance", Icon: "BankOutlined", Sort: 60, Visible: true, Status: 1},
		{ID: 71, ParentID: 70, Title: "托管账户", Type: 2, Path: "/finance/escrow", Component: "pages/finance/EscrowAccountList", Sort: 1, Permission: "finance:escrow:list", Visible: true, Status: 1},
		{ID: 72, ParentID: 70, Title: "查看账户", Type: 3, Permission: "finance:escrow:view", Visible: false, Status: 1},
		{ID: 73, ParentID: 70, Title: "冻结账户", Type: 3, Permission: "finance:escrow:freeze", Visible: false, Status: 1},
		{ID: 74, ParentID: 70, Title: "解冻账户", Type: 3, Permission: "finance:escrow:unfreeze", Visible: false, Status: 1},
		{ID: 75, ParentID: 70, Title: "交易记录", Type: 2, Path: "/finance/transactions", Component: "pages/finance/TransactionList", Sort: 2, Permission: "finance:transaction:list", Visible: true, Status: 1},
		{ID: 76, ParentID: 70, Title: "查看交易", Type: 3, Permission: "finance:transaction:view", Visible: false, Status: 1},
		{ID: 77, ParentID: 70, Title: "导出交易", Type: 3, Permission: "finance:transaction:export", Visible: false, Status: 1},
		{ID: 78, ParentID: 70, Title: "审批交易", Type: 3, Permission: "finance:transaction:approve", Visible: false, Status: 1},

		// 评价管理
		{ID: 80, ParentID: 0, Title: "评价管理", Type: 2, Path: "/reviews", Component: "pages/reviews/ReviewList", Icon: "StarOutlined", Sort: 70, Permission: "review:list", Visible: true, Status: 1},
		{ID: 81, ParentID: 0, Title: "查看评价", Type: 3, Permission: "review:view", Visible: false, Status: 1},
		{ID: 82, ParentID: 0, Title: "删除评价", Type: 3, Permission: "review:delete", Visible: false, Status: 1},
		{ID: 83, ParentID: 0, Title: "隐藏评价", Type: 3, Permission: "review:hide", Visible: false, Status: 1},

		// 风控中心
		{ID: 90, ParentID: 0, Title: "风控中心", Type: 1, Path: "/risk", Icon: "SafetyOutlined", Sort: 80, Visible: true, Status: 1},
		{ID: 91, ParentID: 90, Title: "风险预警", Type: 2, Path: "/risk/warnings", Component: "pages/risk/RiskWarningList", Sort: 1, Permission: "risk:warning:list", Visible: true, Status: 1},
		{ID: 92, ParentID: 90, Title: "查看预警", Type: 3, Permission: "risk:warning:view", Visible: false, Status: 1},
		{ID: 93, ParentID: 90, Title: "处理风险", Type: 3, Permission: "risk:warning:handle", Visible: false, Status: 1},
		{ID: 94, ParentID: 90, Title: "忽略风险", Type: 3, Permission: "risk:warning:ignore", Visible: false, Status: 1},
		{ID: 95, ParentID: 90, Title: "仲裁中心", Type: 2, Path: "/risk/arbitration", Component: "pages/risk/ArbitrationCenter", Sort: 2, Permission: "risk:arbitration:list", Visible: true, Status: 1},
		{ID: 134, ParentID: 90, Title: "投诉处理", Type: 2, Path: "/complaints", Component: "pages/complaints/ComplaintManagement", Sort: 3, Permission: "risk:arbitration:list", Visible: true, Status: 1},
		{ID: 96, ParentID: 90, Title: "查看仲裁", Type: 3, Permission: "risk:arbitration:view", Visible: false, Status: 1},
		{ID: 97, ParentID: 90, Title: "受理仲裁", Type: 3, Permission: "risk:arbitration:accept", Visible: false, Status: 1},
		{ID: 98, ParentID: 90, Title: "驳回仲裁", Type: 3, Permission: "risk:arbitration:reject", Visible: false, Status: 1},
		{ID: 99, ParentID: 90, Title: "裁决仲裁", Type: 3, Permission: "risk:arbitration:judge", Visible: false, Status: 1},

		// 操作日志
		{ID: 100, ParentID: 0, Title: "操作日志", Type: 2, Path: "/logs", Component: "pages/system/LogList", Icon: "FileTextOutlined", Sort: 90, Permission: "system:log:list", Visible: true, Status: 1},
		{ID: 101, ParentID: 0, Title: "查看日志", Type: 3, Permission: "system:log:view", Visible: false, Status: 1},

		// 系统设置
		{ID: 110, ParentID: 0, Title: "系统设置", Type: 2, Path: "/settings", Component: "pages/settings/SystemSettings", Icon: "SettingOutlined", Sort: 100, Permission: "system:setting:list", Visible: true, Status: 1},
		{ID: 111, ParentID: 0, Title: "编辑设置", Type: 3, Permission: "system:setting:edit", Visible: false, Status: 1},

		// 权限管理
		{ID: 120, ParentID: 0, Title: "权限管理", Type: 1, Path: "/permission", Icon: "LockOutlined", Sort: 110, Visible: true, Status: 1},
		{ID: 121, ParentID: 120, Title: "角色管理", Type: 2, Path: "/permission/roles", Component: "pages/permission/RoleList", Sort: 1, Permission: "system:role:list", Visible: true, Status: 1},
		{ID: 122, ParentID: 120, Title: "创建角色", Type: 3, Permission: "system:role:create", Visible: false, Status: 1},
		{ID: 123, ParentID: 120, Title: "编辑角色", Type: 3, Permission: "system:role:edit", Visible: false, Status: 1},
		{ID: 124, ParentID: 120, Title: "删除角色", Type: 3, Permission: "system:role:delete", Visible: false, Status: 1},
		{ID: 125, ParentID: 120, Title: "分配权限", Type: 3, Permission: "system:role:assign", Visible: false, Status: 1},
		{ID: 126, ParentID: 120, Title: "菜单管理", Type: 2, Path: "/permission/menus", Component: "pages/permission/MenuList", Sort: 2, Permission: "system:menu:list", Visible: true, Status: 1},
		{ID: 127, ParentID: 120, Title: "创建菜单", Type: 3, Permission: "system:menu:create", Visible: false, Status: 1},
		{ID: 128, ParentID: 120, Title: "编辑菜单", Type: 3, Permission: "system:menu:edit", Visible: false, Status: 1},
		{ID: 129, ParentID: 120, Title: "删除菜单", Type: 3, Permission: "system:menu:delete", Visible: false, Status: 1},
	}

	for _, menu := range menus {
		repository.DB.FirstOrCreate(&menu, model.SysMenu{ID: menu.ID})
	}
	fmt.Printf("   ✓ 创建了 %d 个菜单和权限点\n", len(menus))
}

// 创建所有角色
func createRoles() map[string]*model.SysRole {
	roles := []model.SysRole{
		{
			ID:     1,
			Name:   "超级管理员",
			Key:    "super_admin",
			Remark: "系统超级管理员，拥有所有权限",
			Sort:   0,
			Status: 1,
		},
		{
			ID:     2,
			Name:   "产品管理",
			Key:    "product_manager",
			Remark: "负责产品数据维护、服务商/门店管理",
			Sort:   10,
			Status: 1,
		},
		{
			ID:     3,
			Name:   "运营管理",
			Key:    "operations",
			Remark: "负责审核、内容管理、用户管理",
			Sort:   20,
			Status: 1,
		},
		{
			ID:     4,
			Name:   "财务管理",
			Key:    "finance",
			Remark: "负责资金管理、交易审核",
			Sort:   30,
			Status: 1,
		},
		{
			ID:     5,
			Name:   "风控管理",
			Key:    "risk",
			Remark: "负责风险预警、纠纷仲裁",
			Sort:   40,
			Status: 1,
		},
		{
			ID:     6,
			Name:   "客服",
			Key:    "customer_service",
			Remark: "处理用户咨询、预约管理",
			Sort:   50,
			Status: 1,
		},
		{
			ID:     7,
			Name:   "只读用户",
			Key:    "viewer",
			Remark: "数据分析、报表查看",
			Sort:   60,
			Status: 1,
		},
	}

	roleMap := make(map[string]*model.SysRole)
	for i := range roles {
		repository.DB.FirstOrCreate(&roles[i], model.SysRole{Key: roles[i].Key})
		roleMap[roles[i].Key] = &roles[i]
		fmt.Printf("   ✓ 创建角色: %s (%s)\n", roles[i].Name, roles[i].Key)
	}

	return roleMap
}

// 分配角色权限
func assignRolePermissions(roles map[string]*model.SysRole) {
	// 超级管理员 - 所有权限
	assignPermissions(roles["super_admin"].ID, []uint64{
		// 获取所有菜单ID (1-129)
	}, "全部权限")

	// 为超级管理员分配所有菜单
	var allMenus []model.SysMenu
	repository.DB.Find(&allMenus)
	for _, menu := range allMenus {
		roleMenu := model.SysRoleMenu{
			RoleID: roles["super_admin"].ID,
			MenuID: menu.ID,
		}
		repository.DB.FirstOrCreate(&roleMenu, roleMenu)
	}

	// 产品管理
	assignPermissions(roles["product_manager"].ID, []uint64{
		1, // 工作台
		10, 11, 12, 15, // 用户管理(只读+导出)
		20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, // 服务商管理(完整权限)
		40, 41, 42, 43, 44, 45, // 主材门店管理(完整权限)
		50, 51, 52, 53, 55, // 项目管理(查看+编辑+地图)
		130, 131, 133, // 需求中心（查看+分配）
		80, 81, // 评价管理(只读)
	}, "产品管理")

	// 运营管理
	assignPermissions(roles["operations"].ID, []uint64{
		1, // 工作台
		10, 11, 12, // 用户管理(只读)
		20, 21, 22, 26, 27, 31, 32, 36, 37, 38, 39, // 服务商管理(只读+审核)
		40, 46, 47, 48, 49, // 主材门店审核
		130, 131, 132, 133, // 需求中心
		60, 61, 62, 63, 64, // 预约管理(完整权限)
		80, 81, 82, 83, // 评价管理(完整权限)
	}, "运营管理")

	// 财务管理
	assignPermissions(roles["finance"].ID, []uint64{
		1, // 工作台
		10, 11, 12, // 用户管理(只读)
		50, 51, 52, // 项目管理(只读)
		70, 71, 72, 73, 74, 75, 76, 77, 78, // 资金中心(完整权限)
	}, "财务管理")

	// 风控管理
	assignPermissions(roles["risk"].ID, []uint64{
		1, // 工作台
		10, 11, 12, // 用户管理(只读)
		50, 51, 52, // 项目管理(只读)
		90, 91, 92, 93, 94, 95, 96, 97, 98, 99, // 风控中心(完整权限)
	}, "风控管理")

	// 客服
	assignPermissions(roles["customer_service"].ID, []uint64{
		1, // 工作台
		10, 11, 12, 13, // 用户管理(查看+基础编辑)
		20, 21, 22, 26, 27, 31, 32, // 服务商管理(只读)
		130, 131, 132, // 需求中心（查看+审核）
		60, 61, 62, 63, 64, // 预约管理(完整权限)
		80, 81, // 评价管理(只读)
	}, "客服")

	// 只读用户
	assignPermissions(roles["viewer"].ID, []uint64{
		1, // 工作台
		10, 11, 12, 15, // 用户管理(只读+导出)
		20, 21, 22, 26, 27, 31, 32, // 服务商管理(只读)
		40, 41, 42, // 主材门店(只读)
		50, 51, 52, 55, // 项目管理(只读+地图)
		130, 131, // 需求中心（只读）
		60, 61, // 预约管理(只读)
		70, 71, 72, 75, 76, 77, // 资金中心(只读+导出)
		80, 81, // 评价管理(只读)
		90, 91, 92, 95, 96, // 风控中心(只读)
		100, 101, // 操作日志
	}, "只读用户")
}

// 辅助函数：分配权限
func assignPermissions(roleID uint64, menuIDs []uint64, roleName string) {
	for _, menuID := range menuIDs {
		roleMenu := model.SysRoleMenu{
			RoleID: roleID,
			MenuID: menuID,
		}
		repository.DB.FirstOrCreate(&roleMenu, roleMenu)
	}
	fmt.Printf("   ✓ %s: 分配了 %d 个权限\n", roleName, len(menuIDs))
}

// 创建测试管理员账号
func createAdmins() map[string]*model.SysAdmin {
	admins := []struct {
		Username string
		Password string
		Nickname string
		IsSuperAdmin bool
	}{
		{"admin", "admin123", "超级管理员", true},
		{"product", "product123", "产品经理", false},
		{"operations", "ops123", "运营专员", false},
		{"finance", "finance123", "财务专员", false},
		{"risk", "risk123", "风控专员", false},
		{"service", "service123", "客服专员", false},
		{"viewer", "viewer123", "数据分析师", false},
	}

	adminMap := make(map[string]*model.SysAdmin)
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

// 分配管理员角色
func assignAdminRoles(admins map[string]*model.SysAdmin, roles map[string]*model.SysRole) {
	assignments := map[string]string{
		"admin":      "super_admin",
		"product":    "product_manager",
		"operations": "operations",
		"finance":    "finance",
		"risk":       "risk",
		"service":    "customer_service",
		"viewer":     "viewer",
	}

	for adminKey, roleKey := range assignments {
		adminRole := model.SysAdminRole{
			AdminID: admins[adminKey].ID,
			RoleID:  roles[roleKey].ID,
		}
		repository.DB.FirstOrCreate(&adminRole, adminRole)
		fmt.Printf("   ✓ %s -> %s\n", admins[adminKey].Nickname, roles[roleKey].Name)
	}
}
