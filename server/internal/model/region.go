package model

// Region 行政区划
type Region struct {
	Base
	Code           string `json:"code" gorm:"uniqueIndex;size:6;not null"` // 行政区划代码
	Name           string `json:"name" gorm:"size:50;not null"`            // 名称
	Level          int    `json:"level" gorm:"not null"`                   // 1:省, 2:市, 3:区/县
	ParentCode     string `json:"parentCode" gorm:"index;size:6"`          // 父级代码
	Enabled        bool   `json:"enabled" gorm:"default:true"`             // 是否启用
	ServiceEnabled bool   `json:"serviceEnabled" gorm:"default:false"`     // 是否开放服务（仅市级生效）
	SortOrder      int    `json:"sortOrder" gorm:"default:0"`              // 排序
}

// TableName 指定表名
func (Region) TableName() string {
	return "regions"
}
