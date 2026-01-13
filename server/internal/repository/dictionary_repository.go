package repository

import (
	"gorm.io/gorm"
	"home-decoration-server/internal/model"
)

type DictionaryRepository struct {
	db *gorm.DB
}

func NewDictionaryRepository(db *gorm.DB) *DictionaryRepository {
	return &DictionaryRepository{db: db}
}

// ============ 分类相关 ============

// GetAllCategories 获取所有分类
func (r *DictionaryRepository) GetAllCategories() ([]model.DictionaryCategory, error) {
	var categories []model.DictionaryCategory
	err := r.db.Where("enabled = ?", true).
		Order("sort_order ASC, id ASC").
		Find(&categories).Error
	return categories, err
}

// GetCategoryByCode 根据代码获取分类
func (r *DictionaryRepository) GetCategoryByCode(code string) (*model.DictionaryCategory, error) {
	var category model.DictionaryCategory
	err := r.db.Where("code = ? AND enabled = ?", code, true).First(&category).Error
	return &category, err
}

// CreateCategory 创建分类
func (r *DictionaryRepository) CreateCategory(cat *model.DictionaryCategory) error {
	return r.db.Create(cat).Error
}

// UpdateCategory 更新分类
func (r *DictionaryRepository) UpdateCategory(cat *model.DictionaryCategory) error {
	return r.db.Save(cat).Error
}

// DeleteCategory 删除分类（软删除）
func (r *DictionaryRepository) DeleteCategory(code string) error {
	return r.db.Model(&model.DictionaryCategory{}).
		Where("code = ?", code).
		Update("enabled", false).Error
}

// ============ 字典值相关 ============

// GetDictsByCategory 根据分类获取字典值
func (r *DictionaryRepository) GetDictsByCategory(categoryCode string) ([]model.SystemDictionary, error) {
	var dicts []model.SystemDictionary
	err := r.db.Where("category_code = ? AND enabled = ?", categoryCode, true).
		Order("sort_order ASC, id ASC").
		Find(&dicts).Error
	return dicts, err
}

// GetAllDicts 获取所有字典值（分页）
func (r *DictionaryRepository) GetAllDicts(page, pageSize int, categoryCode string) ([]model.SystemDictionary, int64, error) {
	var dicts []model.SystemDictionary
	var total int64

	query := r.db.Model(&model.SystemDictionary{})
	if categoryCode != "" {
		query = query.Where("category_code = ?", categoryCode)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Order("category_code ASC, sort_order ASC, id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&dicts).Error

	return dicts, total, err
}

// GetDictByID 根据ID获取字典值
func (r *DictionaryRepository) GetDictByID(id uint64) (*model.SystemDictionary, error) {
	var dict model.SystemDictionary
	err := r.db.First(&dict, id).Error
	return &dict, err
}

// CreateDict 创建字典值
func (r *DictionaryRepository) CreateDict(dict *model.SystemDictionary) error {
	return r.db.Create(dict).Error
}

// UpdateDict 更新字典值
func (r *DictionaryRepository) UpdateDict(dict *model.SystemDictionary) error {
	return r.db.Save(dict).Error
}

// DeleteDict 删除字典值（硬删除）
func (r *DictionaryRepository) DeleteDict(id uint64) error {
	return r.db.Delete(&model.SystemDictionary{}, id).Error
}

// CheckDictExists 检查字典值是否存在
func (r *DictionaryRepository) CheckDictExists(categoryCode, value string, excludeID uint64) (bool, error) {
	var count int64
	query := r.db.Model(&model.SystemDictionary{}).
		Where("category_code = ? AND value = ?", categoryCode, value)

	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}

	err := query.Count(&count).Error
	return count > 0, err
}

// CheckCategoryExists 检查分类是否存在
func (r *DictionaryRepository) CheckCategoryExists(code string) (bool, error) {
	var count int64
	err := r.db.Model(&model.DictionaryCategory{}).
		Where("code = ? AND enabled = ?", code, true).
		Count(&count).Error
	return count > 0, err
}
