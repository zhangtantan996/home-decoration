-- ============================================================
-- 数据字典系统 - 初始化数据脚本
-- 项目：装修设计一体化平台
-- 版本：v1.0
-- 创建日期：2026-01-05
-- 说明：插入12类字典分类和初始字典值
-- ============================================================

-- ============ Step 1: 插入分类数据 ============

INSERT INTO dictionary_categories (code, name, description, sort_order, enabled) VALUES
('style', '装修风格', '设计作品的装修风格分类', 1, true),
('layout', '户型', '房屋户型分类', 2, true),
('budget_range', '预算区间', '装修预算范围', 3, true),
('renovation_type', '装修类型', '全包、半包、局部改造等', 4, true),
('work_type', '工种类型', '工长的专业工种', 5, true),
('provider_sub_type', '商家类型', '个人、工作室、公司', 6, true),
('service_area', '服务区域', '服务商的服务区域', 7, true),
('phase_type', '施工阶段', '项目施工阶段', 8, true),
('material_category', '材料分类', '主材门店分类', 9, true),
('review_tag', '评价标签', '商家评价标签', 10, true),
('certification_type', '资质类型', '商家资质认证类型', 11, true),
('after_sales_type', '售后类型', '售后申请类型', 12, true)
ON CONFLICT (code) DO NOTHING;

-- ============ Step 2: 插入字典值 ============

-- 2.1 装修风格 (style)
INSERT INTO system_dictionaries (category_code, value, label, description, sort_order, enabled) VALUES
('style', '现代简约', '现代简约', '简洁明快的现代设计风格', 1, true),
('style', '北欧风格', '北欧风格', '北欧简约自然风格', 2, true),
('style', '新中式', '新中式', '现代与中式结合的风格', 3, true),
('style', '轻奢风格', '轻奢风格', '低调奢华的设计风格', 4, true),
('style', '美式风格', '美式风格', '美式休闲舒适风格', 5, true),
('style', '欧式风格', '欧式风格', '欧式古典奢华风格', 6, true),
('style', '日式风格', '日式风格', '日式简约禅意风格', 7, true),
('style', '工业风格', '工业风格', '工业复古风格', 8, true),
('style', '法式风格', '法式风格', '法式浪漫优雅风格', 9, true),
('style', '地中海风格', '地中海风格', '地中海蓝白清新风格', 10, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.2 户型 (layout)
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('layout', '一室', '一室', 1, true),
('layout', '一室一厅', '一室一厅', 2, true),
('layout', '两室一厅', '两室一厅', 3, true),
('layout', '两室两厅', '两室两厅', 4, true),
('layout', '三室一厅', '三室一厅', 5, true),
('layout', '三室两厅', '三室两厅', 6, true),
('layout', '四室及以上', '四室及以上', 7, true),
('layout', '复式', '复式', 8, true),
('layout', '别墅', '别墅', 9, true),
('layout', '其他', '其他', 99, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.3 预算区间 (budget_range)
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('budget_range', '5万以下', '5万以下', 1, true),
('budget_range', '5-10万', '5-10万', 2, true),
('budget_range', '10-15万', '10-15万', 3, true),
('budget_range', '15-20万', '15-20万', 4, true),
('budget_range', '20-30万', '20-30万', 5, true),
('budget_range', '30万以上', '30万以上', 6, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.4 装修类型 (renovation_type)
INSERT INTO system_dictionaries (category_code, value, label, description, sort_order, enabled) VALUES
('renovation_type', '全包', '全包', '包工包料，全部交给装修公司', 1, true),
('renovation_type', '半包', '半包', '装修公司负责施工和辅料，业主自购主材', 2, true),
('renovation_type', '局部改造', '局部改造', '仅改造部分空间', 3, true),
('renovation_type', '软装设计', '软装设计', '仅提供软装设计服务', 4, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.5 工种类型 (work_type)
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('work_type', 'mason', '瓦工', 1, true),
('work_type', 'electrician', '电工', 2, true),
('work_type', 'carpenter', '木工', 3, true),
('work_type', 'painter', '油漆工', 4, true),
('work_type', 'plumber', '水电工', 5, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.6 商家类型 (provider_sub_type)
INSERT INTO system_dictionaries (category_code, value, label, description, sort_order, enabled) VALUES
('provider_sub_type', 'personal', '个人设计师', '独立设计师', 1, true),
('provider_sub_type', 'studio', '工作室', '设计工作室', 2, true),
('provider_sub_type', 'company', '装修公司', '正规装修公司', 3, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.7 服务区域 (service_area) - 以上海为例
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('service_area', '浦东新区', '浦东新区', 1, true),
('service_area', '黄浦区', '黄浦区', 2, true),
('service_area', '徐汇区', '徐汇区', 3, true),
('service_area', '长宁区', '长宁区', 4, true),
('service_area', '静安区', '静安区', 5, true),
('service_area', '普陀区', '普陀区', 6, true),
('service_area', '虹口区', '虹口区', 7, true),
('service_area', '杨浦区', '杨浦区', 8, true),
('service_area', '闵行区', '闵行区', 9, true),
('service_area', '宝山区', '宝山区', 10, true),
('service_area', '嘉定区', '嘉定区', 11, true),
('service_area', '金山区', '金山区', 12, true),
('service_area', '松江区', '松江区', 13, true),
('service_area', '青浦区', '青浦区', 14, true),
('service_area', '奉贤区', '奉贤区', 15, true),
('service_area', '崇明区', '崇明区', 16, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.8 施工阶段 (phase_type)
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('phase_type', 'preparation', '准备阶段', 1, true),
('phase_type', 'demolition', '拆除阶段', 2, true),
('phase_type', 'electrical', '水电阶段', 3, true),
('phase_type', 'masonry', '瓦工阶段', 4, true),
('phase_type', 'painting', '油漆阶段', 5, true),
('phase_type', 'installation', '安装阶段', 6, true),
('phase_type', 'inspection', '验收阶段', 7, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.9 材料分类 (material_category)
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('material_category', '瓷砖', '瓷砖', 1, true),
('material_category', '地板', '地板', 2, true),
('material_category', '卫浴', '卫浴', 3, true),
('material_category', '橱柜', '橱柜', 4, true),
('material_category', '门窗', '门窗', 5, true),
('material_category', '灯具', '灯具', 6, true),
('material_category', '五金', '五金', 7, true),
('material_category', '涂料', '涂料', 8, true),
('material_category', '壁纸', '壁纸', 9, true),
('material_category', '家具', '家具', 10, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.10 评价标签 (review_tag)
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('review_tag', '专业', '专业', 1, true),
('review_tag', '守时', '守时', 2, true),
('review_tag', '沟通好', '沟通好', 3, true),
('review_tag', '价格合理', '价格合理', 4, true),
('review_tag', '质量好', '质量好', 5, true),
('review_tag', '服务态度好', '服务态度好', 6, true),
('review_tag', '设计感强', '设计感强', 7, true),
('review_tag', '施工规范', '施工规范', 8, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.11 资质类型 (certification_type)
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('certification_type', '一级资质', '一级资质', 1, true),
('certification_type', '二级资质', '二级资质', 2, true),
('certification_type', '三级资质', '三级资质', 3, true),
('certification_type', '设计甲级', '设计甲级', 4, true),
('certification_type', '设计乙级', '设计乙级', 5, true),
('certification_type', 'ISO认证', 'ISO认证', 6, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- 2.12 售后类型 (after_sales_type)
INSERT INTO system_dictionaries (category_code, value, label, sort_order, enabled) VALUES
('after_sales_type', 'refund', '退款', 1, true),
('after_sales_type', 'complaint', '投诉', 2, true),
('after_sales_type', 'repair', '返修', 3, true)
ON CONFLICT (category_code, value) DO NOTHING;

-- ============ Step 3: 验证数据 ============

-- 查询统计
SELECT
    c.code,
    c.name,
    COUNT(d.id) as dict_count
FROM dictionary_categories c
LEFT JOIN system_dictionaries d ON c.code = d.category_code AND d.enabled = true
WHERE c.enabled = true
GROUP BY c.code, c.name, c.sort_order
ORDER BY c.sort_order;

-- ============ 完成 ============

\echo '✅ 数据字典初始化完成！'
\echo '已插入 12 个分类，共计 80+ 个字典值'
