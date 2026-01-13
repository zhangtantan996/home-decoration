-- ============================================================
-- 数据字典系统 - 数据校验脚本
-- 项目：装修设计一体化平台
-- 版本：v1.0
-- 创建日期：2026-01-05
-- 说明：验证数据迁移是否成功
-- ============================================================

\echo '========================================='
\echo '开始验证数据字典迁移...'
\echo '========================================='

-- ============ 检查1: 表是否存在 ============

\echo '\n【检查1】验证表是否创建成功...'

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dictionary_categories')
        THEN '✅ dictionary_categories 表存在'
        ELSE '❌ dictionary_categories 表不存在'
    END AS category_table_status;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_dictionaries')
        THEN '✅ system_dictionaries 表存在'
        ELSE '❌ system_dictionaries 表不存在'
    END AS dict_table_status;

-- ============ 检查2: 分类数量 ============

\echo '\n【检查2】验证分类数量...'

SELECT
    COUNT(*) as total_categories,
    CASE
        WHEN COUNT(*) = 12 THEN '✅ 分类数量正确'
        ELSE '❌ 分类数量异常，预期12个，实际' || COUNT(*) || '个'
    END AS validation_status
FROM dictionary_categories
WHERE enabled = true;

-- ============ 检查3: 每个分类的字典值数量 ============

\echo '\n【检查3】验证每个分类的字典值数量...'

SELECT
    c.code AS 分类代码,
    c.name AS 分类名称,
    COUNT(d.id) AS 字典值数量,
    c.sort_order AS 排序
FROM dictionary_categories c
LEFT JOIN system_dictionaries d ON c.code = d.category_code AND d.enabled = true
WHERE c.enabled = true
GROUP BY c.code, c.name, c.sort_order
ORDER BY c.sort_order;

-- ============ 检查4: 是否有重复值 ============

\echo '\n【检查4】检查是否有重复的字典值...'

SELECT
    category_code AS 分类,
    value AS 重复的值,
    COUNT(*) AS 重复次数
FROM system_dictionaries
GROUP BY category_code, value
HAVING COUNT(*) > 1;

\echo '（如果上面没有结果，说明没有重复值 ✅）'

-- ============ 检查5: 外键完整性 ============

\echo '\n【检查5】检查外键完整性...'

SELECT
    d.category_code AS 孤儿分类代码,
    COUNT(*) AS 字典值数量
FROM system_dictionaries d
LEFT JOIN dictionary_categories c ON d.category_code = c.code
WHERE c.code IS NULL
GROUP BY d.category_code;

\echo '（如果上面没有结果，说明外键完整性正常 ✅）'

-- ============ 检查6: 索引是否创建 ============

\echo '\n【检查6】验证索引是否创建...'

SELECT
    schemaname,
    tablename AS 表名,
    indexname AS 索引名
FROM pg_indexes
WHERE tablename IN ('dictionary_categories', 'system_dictionaries')
ORDER BY tablename, indexname;

-- ============ 检查7: 约束是否创建 ============

\echo '\n【检查7】验证约束是否创建...'

SELECT
    conname AS 约束名称,
    contype AS 约束类型,
    CASE contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'c' THEN 'CHECK'
        ELSE contype::text
    END AS 约束类型说明
FROM pg_constraint
WHERE conrelid IN (
    'dictionary_categories'::regclass,
    'system_dictionaries'::regclass
)
ORDER BY conrelid, conname;

-- ============ 检查8: 业务数据兼容性检查 ============

\echo '\n【检查8】检查现有业务数据是否兼容...'

-- 检查 provider_cases 表中的 style 字段
\echo '\n8.1 检查作品表中的风格字段...'

SELECT
    DISTINCT pc.style AS 作品中的风格值,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM system_dictionaries
            WHERE category_code = 'style' AND value = pc.style
        ) THEN '✅ 已匹配'
        ELSE '⚠️ 未匹配'
    END AS 匹配状态
FROM provider_cases pc
WHERE pc.style IS NOT NULL AND pc.style != ''
ORDER BY 匹配状态 DESC, pc.style;

-- 检查 provider_cases 表中的 layout 字段
\echo '\n8.2 检查作品表中的户型字段...'

SELECT
    DISTINCT pc.layout AS 作品中的户型值,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM system_dictionaries
            WHERE category_code = 'layout' AND value = pc.layout
        ) THEN '✅ 已匹配'
        ELSE '⚠️ 未匹配'
    END AS 匹配状态
FROM provider_cases pc
WHERE pc.layout IS NOT NULL AND pc.layout != ''
ORDER BY 匹配状态 DESC, pc.layout;

-- 检查 bookings 表中的 budget_range 字段
\echo '\n8.3 检查预约表中的预算区间字段...'

SELECT
    DISTINCT b.budget_range AS 预约中的预算区间值,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM system_dictionaries
            WHERE category_code = 'budget_range' AND value = b.budget_range
        ) THEN '✅ 已匹配'
        ELSE '⚠️ 未匹配'
    END AS 匹配状态
FROM bookings b
WHERE b.budget_range IS NOT NULL AND b.budget_range != ''
ORDER BY 匹配状态 DESC, b.budget_range;

-- ============ 检查9: 总体统计 ============

\echo '\n【检查9】总体数据统计...'

SELECT
    (SELECT COUNT(*) FROM dictionary_categories WHERE enabled = true) AS 启用的分类数,
    (SELECT COUNT(*) FROM system_dictionaries WHERE enabled = true) AS 启用的字典值数,
    (SELECT COUNT(*) FROM dictionary_categories WHERE enabled = false) AS 禁用的分类数,
    (SELECT COUNT(*) FROM system_dictionaries WHERE enabled = false) AS 禁用的字典值数;

-- ============ 完成 ============

\echo '\n========================================='
\echo '✅ 数据字典验证完成！'
\echo '========================================='
\echo '\n💡 注意事项：'
\echo '1. 如果【检查8】中出现"未匹配"的数据，需要手动处理'
\echo '2. 可以选择：(a) 在字典中添加对应值，或 (b) 修正业务数据'
\echo '3. 建议在生产环境部署前完成数据兼容性处理'
\echo ''
