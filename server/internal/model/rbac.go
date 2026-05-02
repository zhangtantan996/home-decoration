package model

import (
	"time"
)

// ==================== RBAC 权限管理模型 ====================

// SysAdmin 管理员账号
type SysAdmin struct {
	ID                uint64     `json:"id" gorm:"primaryKey"`
	Username          string     `json:"username" gorm:"uniqueIndex;size:50;not null"`
	Password          string     `json:"-" gorm:"size:255;not null"`
	Nickname          string     `json:"nickname" gorm:"size:50"`
	Avatar            string     `json:"avatar" gorm:"size:500"`
	Phone             string     `json:"phone" gorm:"size:20"`
	Email             string     `json:"email" gorm:"size:100"`
	Status            int8       `json:"status" gorm:"default:1"`           // 1启用 0禁用
	IsSuperAdmin      bool       `json:"isSuperAdmin" gorm:"default:false"` // 超级管理员标记
	MustResetPassword bool       `json:"mustResetPassword" gorm:"default:false"`
	PasswordChangedAt *time.Time `json:"passwordChangedAt"`
	TwoFactorEnabled  bool       `json:"twoFactorEnabled" gorm:"default:false"`
	TwoFactorSecret   string     `json:"-" gorm:"type:text"`
	TwoFactorBoundAt  *time.Time `json:"twoFactorBoundAt"`
	DisabledReason    string     `json:"disabledReason" gorm:"type:text"`
	LastLoginAt       *time.Time `json:"lastLoginAt"`
	LastLoginIP       string     `json:"lastLoginIp" gorm:"size:50"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`

	// 关联
	Roles []SysRole `json:"roles" gorm:"many2many:sys_admin_roles;foreignKey:ID;joinForeignKey:AdminID;References:ID;joinReferences:RoleID"`
}

func (SysAdmin) TableName() string {
	return "sys_admins"
}

// SysRole 角色
type SysRole struct {
	ID        uint64    `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:50;not null"`            // 角色名称
	Key       string    `json:"key" gorm:"uniqueIndex;size:50;not null"` // 角色标识 (admin, editor, finance)
	Remark    string    `json:"remark" gorm:"size:200"`                  // 备注
	Sort      int       `json:"sort" gorm:"default:0"`                   // 排序
	Status    int8      `json:"status" gorm:"default:1"`                 // 1启用 0禁用
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// 关联
	Menus []SysMenu `json:"menus" gorm:"many2many:sys_role_menus;foreignKey:ID;joinForeignKey:RoleID;References:ID;joinReferences:MenuID"`
}

func (SysRole) TableName() string {
	return "sys_roles"
}

// SysMenu 菜单/权限
type SysMenu struct {
	ID         uint64    `json:"id" gorm:"primaryKey"`
	ParentID   uint64    `json:"parentId" gorm:"default:0;index"`  // 父菜单ID
	Title      string    `json:"title" gorm:"size:50;not null"`    // 菜单标题
	Type       int8      `json:"type" gorm:"default:1"`            // 1目录 2菜单 3按钮
	Permission string    `json:"permission" gorm:"size:100;index"` // 权限标识 (system:user:list)
	Path       string    `json:"path" gorm:"size:200"`             // 前端路由路径
	Component  string    `json:"component" gorm:"size:200"`        // 前端组件路径
	Icon       string    `json:"icon" gorm:"size:100"`             // 图标
	Sort       int       `json:"sort" gorm:"default:0"`            // 排序
	Visible    bool      `json:"visible" gorm:"default:true"`      // 是否显示
	Status     int8      `json:"status" gorm:"default:1"`          // 1启用 0禁用
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`

	// 非数据库字段，用于构建树形结构
	Children []*SysMenu `json:"children" gorm:"-"`
}

func (SysMenu) TableName() string {
	return "sys_menus"
}

// SysAdminRole 管理员-角色关联表
type SysAdminRole struct {
	AdminID uint64 `gorm:"primaryKey"`
	RoleID  uint64 `gorm:"primaryKey"`
}

func (SysAdminRole) TableName() string {
	return "sys_admin_roles"
}

// SysRoleMenu 角色-菜单关联表
type SysRoleMenu struct {
	RoleID uint64 `gorm:"primaryKey"`
	MenuID uint64 `gorm:"primaryKey"`
}

func (SysRoleMenu) TableName() string {
	return "sys_role_menus"
}

// SysOperationLog 操作日志
type SysOperationLog struct {
	ID        uint64    `json:"id" gorm:"primaryKey"`
	AdminID   uint64    `json:"adminId" gorm:"index"`
	AdminName string    `json:"adminName" gorm:"size:50"`
	Module    string    `json:"module" gorm:"size:50"`     // 模块 (user, provider, etc.)
	Action    string    `json:"action" gorm:"size:50"`     // 操作 (create, update, delete)
	Method    string    `json:"method" gorm:"size:10"`     // HTTP方法
	Path      string    `json:"path" gorm:"size:200"`      // 请求路径
	IP        string    `json:"ip" gorm:"size:50"`         // IP地址
	UserAgent string    `json:"userAgent" gorm:"size:500"` // 浏览器UA
	Params    string    `json:"params" gorm:"type:text"`   // 请求参数
	Result    string    `json:"result" gorm:"type:text"`   // 返回结果
	Status    int       `json:"status"`                    // HTTP状态码
	Duration  int64     `json:"duration"`                  // 耗时(ms)
	CreatedAt time.Time `json:"createdAt"`
}

func (SysOperationLog) TableName() string {
	return "sys_operation_logs"
}
