package handler

import (
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ==================== 管理员认证 ====================

// AdminLoginRequest 管理员登录请求
type AdminLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// AdminLogin 管理员登录
func AdminLogin(c *gin.Context) {
	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// ✅ 检查失败次数
	failKey := fmt.Sprintf("admin_login_fail:%s", req.Username)
	failCount := 0
	rdb := repository.GetRedis()
	if rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()

		failCountStr, _ := rdb.Get(ctx, failKey).Result()
		if failCountStr != "" {
			fmt.Sscanf(failCountStr, "%d", &failCount)
		}
	}

	if failCount >= 5 {
		response.Forbidden(c, "登录失败次数过多，请30分钟后重试")
		return
	}

	// 查询管理员
	var admin model.SysAdmin
	if err := repository.DB.Where("username = ?", req.Username).First(&admin).Error; err != nil {
		// ✅ 记录失败
		if rdb != nil {
			ctx, cancel := repository.RedisContext()
			defer cancel()

			rdb.Incr(ctx, failKey)
			rdb.Expire(ctx, failKey, 30*time.Minute)
		}

		response.Unauthorized(c, "用户名或密码错误")
		return
	}

	// 验证状态
	if admin.Status != 1 {
		response.Forbidden(c, "账号已被禁用")
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.Password)); err != nil {
		// ✅ 记录失败
		if rdb != nil {
			ctx, cancel := repository.RedisContext()
			defer cancel()

			rdb.Incr(ctx, failKey)
			rdb.Expire(ctx, failKey, 30*time.Minute)
		}

		response.Unauthorized(c, "用户名或密码错误")
		return
	}

	// ✅ 登录成功，清除失败记录
	if rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()

		rdb.Del(ctx, failKey)
	}

	// 更新登录信息
	now := time.Now()
	repository.DB.Model(&admin).Updates(map[string]interface{}{
		"last_login_at": now,
		"last_login_ip": c.ClientIP(),
	})

	// 加载管理员角色
	repository.DB.Preload("Roles").First(&admin, admin.ID)

	// 获取角色标识列表
	roleKeys := getRoleKeys(admin.Roles)

	// 获取权限列表
	permissions := getAdminPermissions(&admin)

	// 获取菜单树
	menus := getAdminMenuTree(&admin)

	// 生成 Token（管理员 Token 有效期 60 分钟）
	cfg := config.GetConfig()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"admin_id":   admin.ID,
		"username":   admin.Username,
		"is_super":   admin.IsSuperAdmin,
		"exp":        time.Now().Add(60 * time.Minute).Unix(), // 管理员 60 分钟过期
		"token_type": "admin",
	})

	tokenString, err := token.SignedString([]byte(cfg.JWT.Secret))
	if err != nil {
		response.ServerError(c, "生成Token失败")
		return
	}

	response.Success(c, gin.H{
		"token": tokenString,
		"admin": gin.H{
			"id":           admin.ID,
			"username":     admin.Username,
			"nickname":     admin.Nickname,
			"avatar":       imgutil.GetFullImageURL(admin.Avatar),
			"isSuperAdmin": admin.IsSuperAdmin,
			"roles":        roleKeys,
		},
		"permissions": permissions,
		"menus":       menus,
	})
}

// AdminGetInfo 获取当前管理员信息及权限
func AdminGetInfo(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	if adminID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	// 获取管理员及角色
	var admin model.SysAdmin
	if err := repository.DB.Preload("Roles").First(&admin, adminID).Error; err != nil {
		response.NotFound(c, "管理员不存在")
		return
	}

	// 获取权限列表
	permissions := getAdminPermissions(&admin)

	// 获取菜单树
	menuTree := getAdminMenuTree(&admin)

	response.Success(c, gin.H{
		"admin": gin.H{
			"id":           admin.ID,
			"username":     admin.Username,
			"nickname":     admin.Nickname,
			"avatar":       imgutil.GetFullImageURL(admin.Avatar),
			"isSuperAdmin": admin.IsSuperAdmin,
			"roles":        getRoleKeys(admin.Roles),
		},
		"permissions": permissions,
		"menus":       menuTree,
	})
}

// getAdminPermissions 获取管理员权限列表
func getAdminPermissions(admin *model.SysAdmin) []string {
	if admin.IsSuperAdmin {
		return []string{"*:*:*"} // 超级管理员拥有所有权限
	}

	var permissions []string
	roleIDs := make([]uint64, len(admin.Roles))
	for i, role := range admin.Roles {
		roleIDs[i] = role.ID
	}

	if len(roleIDs) == 0 {
		return permissions
	}

	// 查询角色拥有的菜单权限
	var menus []model.SysMenu
	repository.DB.
		Joins("JOIN sys_role_menus ON sys_role_menus.menu_id = sys_menus.id").
		Where("sys_role_menus.role_id IN ? AND sys_menus.permission != '' AND sys_menus.status = 1", roleIDs).
		Find(&menus)

	permSet := make(map[string]bool)
	for _, menu := range menus {
		if menu.Permission != "" {
			permSet[menu.Permission] = true
		}
	}

	for perm := range permSet {
		permissions = append(permissions, perm)
	}
	return permissions
}

// getAdminMenuTree 获取管理员菜单树
func getAdminMenuTree(admin *model.SysAdmin) []*model.SysMenu {
	var menus []model.SysMenu

	if admin.IsSuperAdmin {
		// 超级管理员获取所有菜单
		repository.DB.Where("type IN (1, 2) AND status = 1 AND visible = true").
			Order("sort ASC, id ASC").Find(&menus)
	} else {
		// 普通管理员根据角色获取菜单
		roleIDs := make([]uint64, len(admin.Roles))
		for i, role := range admin.Roles {
			roleIDs[i] = role.ID
		}

		if len(roleIDs) == 0 {
			return nil
		}

		repository.DB.
			Joins("JOIN sys_role_menus ON sys_role_menus.menu_id = sys_menus.id").
			Where("sys_role_menus.role_id IN ? AND sys_menus.type IN (1, 2) AND sys_menus.status = 1 AND sys_menus.visible = true", roleIDs).
			Order("sys_menus.sort ASC, sys_menus.id ASC").
			Find(&menus)
	}

	// 去重（保持顺序）
	menuMap := make(map[uint64]bool)
	var uniqueMenus []*model.SysMenu
	for i := range menus {
		if !menuMap[menus[i].ID] {
			menuMap[menus[i].ID] = true
			uniqueMenus = append(uniqueMenus, &menus[i])
		}
	}

	// 构建树
	return buildMenuTree(uniqueMenus, 0)
}

// buildMenuTree 构建菜单树
func buildMenuTree(menus []*model.SysMenu, parentID uint64) []*model.SysMenu {
	var tree []*model.SysMenu
	for _, menu := range menus {
		if menu.ParentID == parentID {
			menu.Children = buildMenuTree(menus, menu.ID)
			tree = append(tree, menu)
		}
	}
	// 按 Sort 排序
	sort.Slice(tree, func(i, j int) bool {
		return tree[i].Sort < tree[j].Sort
	})
	return tree
}

// getRoleKeys 获取角色标识列表
func getRoleKeys(roles []model.SysRole) []string {
	keys := make([]string, len(roles))
	for i, role := range roles {
		keys[i] = role.Key
	}
	return keys
}

// ==================== 角色管理 ====================

// AdminListRoles 获取角色列表
func AdminListRoles(c *gin.Context) {
	var roles []model.SysRole
	repository.DB.Order("sort ASC, id ASC").Find(&roles)
	response.Success(c, gin.H{"list": roles})
}

// AdminCreateRole 创建角色
func AdminCreateRole(c *gin.Context) {
	var role model.SysRole
	if err := c.ShouldBindJSON(&role); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Create(&role).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	response.Success(c, role)
}

// AdminUpdateRole 更新角色
func AdminUpdateRole(c *gin.Context) {
	id := c.Param("id")
	var role model.SysRole
	if err := repository.DB.First(&role, id).Error; err != nil {
		response.NotFound(c, "角色不存在")
		return
	}

	// ✅ 使用结构体，只允许更新指定字段
	var req struct {
		Name   string `json:"name"`
		Key    string `json:"key"`
		Sort   int    `json:"sort"`
		Status int8   `json:"status"`
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// ✅ 显式更新字段
	role.Name = req.Name
	role.Key = req.Key
	role.Sort = req.Sort
	role.Status = req.Status
	role.Remark = req.Remark

	if err := repository.DB.Save(&role).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.Success(c, role)
}

// AdminDeleteRole 删除角色
func AdminDeleteRole(c *gin.Context) {
	id := c.Param("id")

	// 检查是否有管理员使用此角色
	var count int64
	repository.DB.Model(&model.SysAdminRole{}).Where("role_id = ?", id).Count(&count)
	if count > 0 {
		response.BadRequest(c, "该角色下存在管理员，无法删除")
		return
	}

	// 删除角色及其菜单关联
	tx := repository.DB.Begin()
	tx.Where("role_id = ?", id).Delete(&model.SysRoleMenu{})
	tx.Delete(&model.SysRole{}, id)
	tx.Commit()

	response.Success(c, nil)
}

// AdminGetRoleMenus 获取角色已分配的菜单权限
func AdminGetRoleMenus(c *gin.Context) {
	roleID := c.Param("id")

	var roleMenus []model.SysRoleMenu
	repository.DB.Where("role_id = ?", roleID).Find(&roleMenus)

	menuIds := make([]uint64, len(roleMenus))
	for i, rm := range roleMenus {
		menuIds[i] = rm.MenuID
	}

	response.Success(c, gin.H{"menuIds": menuIds})
}

// AdminAssignRoleMenus 给角色分配菜单权限
func AdminAssignRoleMenus(c *gin.Context) {
	roleID := c.Param("id")

	var req struct {
		MenuIDs []uint64 `json:"menuIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	tx := repository.DB.Begin()

	// 删除原有关联
	tx.Where("role_id = ?", roleID).Delete(&model.SysRoleMenu{})

	// 创建新关联
	for _, menuID := range req.MenuIDs {
		tx.Create(&model.SysRoleMenu{
			RoleID: parseUint64(roleID),
			MenuID: menuID,
		})
	}

	tx.Commit()
	response.Success(c, nil)
}

// ==================== 菜单管理 ====================

// AdminListMenus 获取菜单列表（树形）
func AdminListMenus(c *gin.Context) {
	var menus []model.SysMenu
	repository.DB.Order("sort ASC, id ASC").Find(&menus)

	// 转换为指针切片
	menuPtrs := make([]*model.SysMenu, len(menus))
	for i := range menus {
		menuPtrs[i] = &menus[i]
	}

	tree := buildMenuTree(menuPtrs, 0)
	response.Success(c, gin.H{"list": tree})
}

// AdminCreateMenu 创建菜单
func AdminCreateMenu(c *gin.Context) {
	var menu model.SysMenu
	if err := c.ShouldBindJSON(&menu); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	if err := repository.DB.Create(&menu).Error; err != nil {
		response.ServerError(c, "创建失败")
		return
	}

	response.Success(c, menu)
}

// AdminUpdateMenu 更新菜单
func AdminUpdateMenu(c *gin.Context) {
	id := c.Param("id")
	var menu model.SysMenu
	if err := repository.DB.First(&menu, id).Error; err != nil {
		response.NotFound(c, "菜单不存在")
		return
	}

	// ✅ 使用结构体，只允许更新指定字段
	var req struct {
		ParentID   uint64 `json:"parentId"`
		Title      string `json:"title"`
		Type       int8   `json:"type"`
		Permission string `json:"permission"`
		Path       string `json:"path"`
		Component  string `json:"component"`
		Icon       string `json:"icon"`
		Sort       int    `json:"sort"`
		Status     int8   `json:"status"`
		Visible    bool   `json:"visible"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// ✅ 显式更新字段
	menu.ParentID = req.ParentID
	menu.Title = req.Title
	menu.Type = req.Type
	menu.Permission = req.Permission
	menu.Path = req.Path
	menu.Component = req.Component
	menu.Icon = req.Icon
	menu.Sort = req.Sort
	menu.Status = req.Status
	menu.Visible = req.Visible

	if err := repository.DB.Save(&menu).Error; err != nil {
		response.ServerError(c, "更新失败")
		return
	}

	response.Success(c, menu)
}

// AdminDeleteMenu 删除菜单
func AdminDeleteMenu(c *gin.Context) {
	id := c.Param("id")

	// 检查是否有子菜单
	var count int64
	repository.DB.Model(&model.SysMenu{}).Where("parent_id = ?", id).Count(&count)
	if count > 0 {
		response.BadRequest(c, "存在子菜单，无法删除")
		return
	}

	// 删除菜单及其角色关联
	tx := repository.DB.Begin()
	tx.Where("menu_id = ?", id).Delete(&model.SysRoleMenu{})
	tx.Delete(&model.SysMenu{}, id)
	tx.Commit()

	response.Success(c, nil)
}
