package model


// DictionaryCategory 字典分类
type DictionaryCategory struct {
	Base
	Code        string `json:"code" gorm:"uniqueIndex;size:50;not null"`
	Name        string `json:"name" gorm:"size:100;not null"`
	Description string `json:"description" gorm:"type:text"`
	SortOrder   int    `json:"sortOrder" gorm:"default:0"`
	Enabled     bool   `json:"enabled" gorm:"default:true"`
	Icon        string `json:"icon" gorm:"size:50"`
}

// TableName 指定表名
func (DictionaryCategory) TableName() string {
	return "dictionary_categories"
}

// SystemDictionary 字典值
type SystemDictionary struct {
	Base
	CategoryCode string                 `json:"categoryCode" gorm:"index;size:50;not null"`
	Value        string                 `json:"value" gorm:"size:100;not null"`
	Label        string                 `json:"label" gorm:"size:100;not null"`
	Description  string                 `json:"description" gorm:"type:text"`
	SortOrder    int                    `json:"sortOrder" gorm:"default:0"`
	Enabled      bool                   `json:"enabled" gorm:"default:true"`
	ExtraData    map[string]interface{} `json:"extraData" gorm:"type:jsonb;serializer:json"`
	ParentValue  string                 `json:"parentValue" gorm:"size:100"`
}

// TableName 指定表名
func (SystemDictionary) TableName() string {
	return "system_dictionaries"
}

// DictDTO 返回给前端的简化结构
type DictDTO struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// CreateDictRequest 创建字典请求
type CreateDictRequest struct {
	CategoryCode string                 `json:"categoryCode" binding:"required,max=50"`
	Value        string                 `json:"value" binding:"required,max=100"`
	Label        string                 `json:"label" binding:"required,max=100"`
	Description  string                 `json:"description" binding:"max=500"`
	SortOrder    int                    `json:"sortOrder" binding:"min=0,max=999"`
	ExtraData    map[string]interface{} `json:"extraData"`
	ParentValue  string                 `json:"parentValue" binding:"max=100"`
}

// UpdateDictRequest 更新字典请求
type UpdateDictRequest struct {
	CategoryCode string                 `json:"categoryCode" binding:"required,max=50"`
	Value        string                 `json:"value" binding:"required,max=100"`
	Label        string                 `json:"label" binding:"required,max=100"`
	Description  string                 `json:"description" binding:"max=500"`
	SortOrder    int                    `json:"sortOrder" binding:"min=0,max=999"`
	Enabled      bool                   `json:"enabled"`
	ExtraData    map[string]interface{} `json:"extraData"`
	ParentValue  string                 `json:"parentValue" binding:"max=100"`
}

// DictListResponse 字典列表响应
type DictListResponse struct {
	List     []SystemDictionary `json:"list"`
	Total    int64              `json:"total"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
}

// CategoryListResponse 分类列表响应
type CategoryListResponse struct {
	List  []DictionaryCategory `json:"list"`
	Total int64                `json:"total"`
}
