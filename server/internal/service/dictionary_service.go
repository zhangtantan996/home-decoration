package service

import (
	"errors"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"
	"strings"
)

type DictionaryService struct {
	repo  *repository.DictionaryRepository
	cache *DictCacheService
}

var ErrDictionaryCategoryReadOnly = errors.New("该字典分类已迁移到行政区划管理，当前只读")

func isRegionOpenServiceCategory(categoryCode string) bool {
	switch strings.TrimSpace(categoryCode) {
	case openServiceProvincesCategory, openServiceCitiesCategory:
		return true
	default:
		return false
	}
}

func NewDictionaryService(repo *repository.DictionaryRepository, cache *DictCacheService) *DictionaryService {
	return &DictionaryService{
		repo:  repo,
		cache: cache,
	}
}

// ============ 公开接口（前端调用） ============

// GetDictOptions 获取字典选项（带缓存）
func (s *DictionaryService) GetDictOptions(categoryCode string) ([]model.DictDTO, error) {
	// 1. 尝试从缓存获取
	if s.cache != nil {
		cached, err := s.cache.GetDictCache(categoryCode)
		if err == nil && cached != nil {
			log.Printf("[Dict] Cache HIT for category: %s", categoryCode)
			return cached, nil
		}
	}

	log.Printf("[Dict] Cache MISS for category: %s, querying database...", categoryCode)

	// 2. 从数据库查询
	dicts, err := s.repo.GetDictsByCategory(categoryCode)
	if err != nil {
		return nil, err
	}

	// 3. 转换为 DTO
	result := make([]model.DictDTO, len(dicts))
	for i, d := range dicts {
		result[i] = model.DictDTO{
			Value:     d.Value,
			Label:     d.Label,
			ExtraData: d.ExtraData,
		}
	}

	// 4. 写入缓存（失败不影响业务）
	if s.cache != nil {
		if err := s.cache.SetDictCache(categoryCode, result); err != nil {
			log.Printf("[Dict] Failed to set cache for category %s: %v", categoryCode, err)
		}
	}

	return result, nil
}

// GetAllCategories 获取所有分类
func (s *DictionaryService) GetAllCategories() ([]model.DictionaryCategory, error) {
	return s.repo.GetAllCategories()
}

// ============ 管理接口（管理员调用） ============

// ListDicts 分页查询字典值
func (s *DictionaryService) ListDicts(page, pageSize int, categoryCode string) ([]model.SystemDictionary, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 10
	}

	return s.repo.GetAllDicts(page, pageSize, categoryCode)
}

// CreateDict 创建字典值
func (s *DictionaryService) CreateDict(req *model.CreateDictRequest) (*model.SystemDictionary, error) {
	if isRegionOpenServiceCategory(req.CategoryCode) {
		return nil, ErrDictionaryCategoryReadOnly
	}

	// 1. 校验分类是否存在
	exists, err := s.repo.CheckCategoryExists(req.CategoryCode)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("分类不存在")
	}

	// 2. 检查值是否重复
	exists, err = s.repo.CheckDictExists(req.CategoryCode, req.Value, 0)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("该字典值已存在")
	}

	// 3. 创建
	dict := &model.SystemDictionary{
		CategoryCode: req.CategoryCode,
		Value:        req.Value,
		Label:        req.Label,
		Description:  req.Description,
		SortOrder:    req.SortOrder,
		Enabled:      true,
		ExtraData:    req.ExtraData,
		ParentValue:  req.ParentValue,
	}

	if err := s.repo.CreateDict(dict); err != nil {
		return nil, err
	}

	// 4. 清除缓存
	if s.cache != nil {
		_ = s.cache.DeleteDictCache(req.CategoryCode)
	}

	return dict, nil
}

// UpdateDict 更新字典值
func (s *DictionaryService) UpdateDict(id uint64, req *model.UpdateDictRequest) (*model.SystemDictionary, error) {
	// 1. 获取原数据
	dict, err := s.repo.GetDictByID(id)
	if err != nil {
		return nil, errors.New("字典值不存在")
	}
	if isRegionOpenServiceCategory(dict.CategoryCode) || isRegionOpenServiceCategory(req.CategoryCode) {
		return nil, ErrDictionaryCategoryReadOnly
	}

	// 2. 检查值是否重复
	if dict.Value != req.Value {
		exists, err := s.repo.CheckDictExists(req.CategoryCode, req.Value, id)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, errors.New("该字典值已存在")
		}
	}

	// 3. 更新字段
	dict.CategoryCode = req.CategoryCode
	dict.Value = req.Value
	dict.Label = req.Label
	dict.Description = req.Description
	dict.SortOrder = req.SortOrder
	dict.Enabled = req.Enabled
	dict.ExtraData = req.ExtraData
	dict.ParentValue = req.ParentValue

	if err := s.repo.UpdateDict(dict); err != nil {
		return nil, err
	}

	// 4. 清除缓存
	if s.cache != nil {
		_ = s.cache.DeleteDictCache(req.CategoryCode)
	}

	return dict, nil
}

// DeleteDict 删除字典值
func (s *DictionaryService) DeleteDict(id uint64) error {
	// 1. 获取字典信息（用于清除缓存）
	dict, err := s.repo.GetDictByID(id)
	if err != nil {
		return errors.New("字典值不存在")
	}
	if isRegionOpenServiceCategory(dict.CategoryCode) {
		return ErrDictionaryCategoryReadOnly
	}

	// 2. TODO: 检查是否被业务数据引用（可选功能）
	// 例如：检查 provider_cases 表中是否有使用该风格值

	// 3. 删除
	if err := s.repo.DeleteDict(id); err != nil {
		return err
	}

	// 4. 清除缓存
	if s.cache != nil {
		_ = s.cache.DeleteDictCache(dict.CategoryCode)
	}

	return nil
}

// ============ 分类管理（可选功能） ============

// CreateCategory 创建分类
func (s *DictionaryService) CreateCategory(cat *model.DictionaryCategory) error {
	if cat != nil && isRegionOpenServiceCategory(cat.Code) {
		return ErrDictionaryCategoryReadOnly
	}
	if err := s.repo.CreateCategory(cat); err != nil {
		return err
	}

	// 清除所有缓存
	if s.cache != nil {
		_ = s.cache.DeleteAllDictCache()
	}

	return nil
}

// UpdateCategory 更新分类
func (s *DictionaryService) UpdateCategory(cat *model.DictionaryCategory) error {
	if cat != nil && isRegionOpenServiceCategory(cat.Code) {
		return ErrDictionaryCategoryReadOnly
	}
	if err := s.repo.UpdateCategory(cat); err != nil {
		return err
	}

	// 清除所有缓存
	if s.cache != nil {
		_ = s.cache.DeleteAllDictCache()
	}

	return nil
}

// DeleteCategory 删除分类
func (s *DictionaryService) DeleteCategory(code string) error {
	if isRegionOpenServiceCategory(code) {
		return ErrDictionaryCategoryReadOnly
	}
	if err := s.repo.DeleteCategory(code); err != nil {
		return err
	}

	// 清除所有缓存
	if s.cache != nil {
		_ = s.cache.DeleteAllDictCache()
	}

	return nil
}
