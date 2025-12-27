package model

import "time"

// Admin 管理员
type Admin struct {
	Base
	Username    string     `json:"username" gorm:"uniqueIndex;size:50"`
	Phone       string     `json:"phone" gorm:"uniqueIndex;size:20"`
	Email       string     `json:"email" gorm:"size:100"`
	Password    string     `json:"-" gorm:"size:255"` // 密码，不返回给前端
	Role        string     `json:"role" gorm:"size:20;default:'admin'"` // super, admin, operator
	Status      int8       `json:"status" gorm:"default:1"` // 1:启用 0:禁用
	LastLoginAt *time.Time `json:"lastLoginAt"`
	LastLoginIP string     `json:"lastLoginIp" gorm:"size:50"`
}

// TableName 指定表名
func (Admin) TableName() string {
	return "admins"
}

// ProviderAudit 服务商资质审核
type ProviderAudit struct {
	Base
	ProviderID     uint64     `json:"providerId" gorm:"index"`
	ProviderType   int8       `json:"providerType"` // 1设计师 2公司 3工长
	CompanyName    string     `json:"companyName" gorm:"size:100"`
	ContactPerson  string     `json:"contactPerson" gorm:"size:50"`
	ContactPhone   string     `json:"contactPhone" gorm:"size:20"`
	BusinessLicense string    `json:"businessLicense" gorm:"size:500"` // 营业执照图片
	Certificates   string     `json:"certificates" gorm:"type:text"`   // 资质证书图片 JSON数组
	Status         int8       `json:"status" gorm:"default:0"` // 0:待审核 1:已通过 2:已拒绝
	SubmitTime     time.Time  `json:"submitTime"`
	AuditTime      *time.Time `json:"auditTime"`
	AuditAdminID   *uint64    `json:"auditAdminId"` // 审核管理员ID
	RejectReason   string     `json:"rejectReason" gorm:"type:text"`
}

// TableName 指定表名
func (ProviderAudit) TableName() string {
	return "provider_audits"
}

// MaterialShopAudit 门店认证审核
type MaterialShopAudit struct {
	Base
	ShopID          uint64     `json:"shopId" gorm:"index"`
	ShopName        string     `json:"shopName" gorm:"size:100"`
	Type            string     `json:"type" gorm:"size:20"` // showroom | brand
	BrandName       string     `json:"brandName" gorm:"size:100"`
	Address         string     `json:"address" gorm:"size:300"`
	ContactPerson   string     `json:"contactPerson" gorm:"size:50"`
	ContactPhone    string     `json:"contactPhone" gorm:"size:20"`
	BusinessLicense string     `json:"businessLicense" gorm:"size:500"` // 营业执照
	StoreFront      string     `json:"storeFront" gorm:"type:text"`     // 门店照片 JSON数组
	Status          int8       `json:"status" gorm:"default:0"` // 0:待审核 1:已通过 2:已拒绝
	SubmitTime      time.Time  `json:"submitTime"`
	AuditTime       *time.Time `json:"auditTime"`
	AuditAdminID    *uint64    `json:"auditAdminId"`
	RejectReason    string     `json:"rejectReason" gorm:"type:text"`
}

// TableName 指定表名
func (MaterialShopAudit) TableName() string {
	return "material_shop_audits"
}

// RiskWarning 风险预警
type RiskWarning struct {
	Base
	ProjectID    uint64     `json:"projectId" gorm:"index"`
	ProjectName  string     `json:"projectName" gorm:"size:100"`
	Type         string     `json:"type" gorm:"size:50"`   // 风险类型：delay, quality, payment, dispute
	Level        string     `json:"level" gorm:"size:20"`  // 风险等级：low, medium, high, critical
	Description  string     `json:"description" gorm:"type:text"`
	Status       int8       `json:"status" gorm:"default:0"` // 0:待处理 1:处理中 2:已处理 3:已忽略
	HandledAt    *time.Time `json:"handledAt"`
	HandledBy    *uint64    `json:"handledBy"` // 处理人ID
	HandleResult string     `json:"handleResult" gorm:"type:text"`
}

// TableName 指定表名
func (RiskWarning) TableName() string {
	return "risk_warnings"
}

// Arbitration 仲裁
type Arbitration struct {
	Base
	ProjectID   uint64     `json:"projectId" gorm:"index"`
	ProjectName string     `json:"projectName" gorm:"size:100"`
	Applicant   string     `json:"applicant" gorm:"size:50"`   // 申请人
	Respondent  string     `json:"respondent" gorm:"size:50"`  // 被申请人
	Reason      string     `json:"reason" gorm:"type:text"`    // 仲裁原因
	Evidence    string     `json:"evidence" gorm:"type:text"`  // 证据材料 JSON数组
	Status      int8       `json:"status" gorm:"default:0"`    // 0:待受理 1:审理中 2:已裁决 3:已驳回
	Result      string     `json:"result" gorm:"type:text"`    // 裁决结果
	Attachments string     `json:"attachments" gorm:"type:text"` // 裁决文件 JSON数组
	UpdatedBy   *uint64    `json:"updatedBy"` // 处理人ID
}

// TableName 指定表名
func (Arbitration) TableName() string {
	return "arbitrations"
}

// SystemSettings 系统设置
type SystemSettings struct {
	Base
	Key         string `json:"key" gorm:"uniqueIndex;size:100"`
	Value       string `json:"value" gorm:"type:text"`
	Description string `json:"description" gorm:"size:200"`
	Category    string `json:"category" gorm:"size:50"` // basic, security, payment, sms
}

// TableName 指定表名
func (SystemSettings) TableName() string {
	return "system_settings"
}

// AdminLog 操作日志
type AdminLog struct {
	Base
	AdminID    uint64 `json:"adminId" gorm:"index"`
	AdminName  string `json:"adminName" gorm:"size:50"`
	Action     string `json:"action" gorm:"size:100"`     // 操作类型
	Resource   string `json:"resource" gorm:"size:100"`   // 操作资源
	ResourceID uint64 `json:"resourceId"`                 // 资源ID
	Method     string `json:"method" gorm:"size:10"`      // HTTP方法
	Path       string `json:"path" gorm:"size:200"`       // 请求路径
	IP         string `json:"ip" gorm:"size:50"`          // IP地址
	UserAgent  string `json:"userAgent" gorm:"size:500"`  // 用户代理
	RequestData string `json:"requestData" gorm:"type:text"` // 请求数据
	Status     int    `json:"status"`                     // 响应状态码
}

// TableName 指定表名
func (AdminLog) TableName() string {
	return "admin_logs"
}
