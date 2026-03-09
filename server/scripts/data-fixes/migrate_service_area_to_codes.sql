-- ================================================
-- 服务区域数据迁移脚本
-- 将 Provider 和 MerchantApplication 表中的服务区域从名称转换为代码
-- ================================================

-- 1. 备份当前数据（可选，但强烈推荐）
-- CREATE TABLE providers_backup_20260106 AS SELECT * FROM providers;
-- CREATE TABLE merchant_applications_backup_20260106 AS SELECT * FROM merchant_applications;

-- 2. 更新 providers 表的 service_area 字段
-- 示例：将 ["雁塔区", "碑林区"] 转换为 ["610113", "610103"]

-- 陕西省西安市各区代码映射（示例）
-- 610102: 新城区
-- 610103: 碑林区
-- 610104: 莲湖区
-- 610111: 灞桥区
-- 610112: 未央区
-- 610113: 雁塔区
-- 610114: 阎良区
-- 610115: 临潼区
-- 610116: 长安区
-- 610117: 高陵区
-- 610118: 鄠邑区
-- 610122: 蓝田县
-- 610124: 周至县

-- 更新 providers 表
UPDATE providers
SET service_area = CASE
    -- 西安市区域转换
    WHEN service_area LIKE '%雁塔区%' AND service_area LIKE '%碑林区%' THEN '["610113","610103"]'
    WHEN service_area LIKE '%雁塔区%' THEN '["610113"]'
    WHEN service_area LIKE '%碑林区%' THEN '["610103"]'
    WHEN service_area LIKE '%莲湖区%' THEN '["610104"]'
    WHEN service_area LIKE '%新城区%' THEN '["610102"]'
    WHEN service_area LIKE '%未央区%' THEN '["610112"]'
    WHEN service_area LIKE '%灞桥区%' THEN '["610111"]'
    WHEN service_area LIKE '%长安区%' THEN '["610116"]'
    WHEN service_area LIKE '%临潼区%' THEN '["610115"]'
    WHEN service_area LIKE '%阎良区%' THEN '["610114"]'
    WHEN service_area LIKE '%高陵区%' THEN '["610117"]'
    WHEN service_area LIKE '%鄠邑区%' THEN '["610118"]'
    WHEN service_area LIKE '%蓝田县%' THEN '["610122"]'
    WHEN service_area LIKE '%周至县%' THEN '["610124"]'

    -- 如果 service_area 为空或 null，设置为空数组
    WHEN service_area IS NULL OR service_area = '' THEN '[]'

    -- 其他情况保持原样（但会在应用层报错，需要人工处理）
    ELSE service_area
END
WHERE service_area IS NOT NULL AND service_area != '[]';

-- 3. 更新 merchant_applications 表的 service_area 字段
UPDATE merchant_applications
SET service_area = CASE
    -- 西安市区域转换
    WHEN service_area LIKE '%雁塔区%' AND service_area LIKE '%碑林区%' THEN '["610113","610103"]'
    WHEN service_area LIKE '%雁塔区%' THEN '["610113"]'
    WHEN service_area LIKE '%碑林区%' THEN '["610103"]'
    WHEN service_area LIKE '%莲湖区%' THEN '["610104"]'
    WHEN service_area LIKE '%新城区%' THEN '["610102"]'
    WHEN service_area LIKE '%未央区%' THEN '["610112"]'
    WHEN service_area LIKE '%灞桥区%' THEN '["610111"]'
    WHEN service_area LIKE '%长安区%' THEN '["610116"]'
    WHEN service_area LIKE '%临潼区%' THEN '["610115"]'
    WHEN service_area LIKE '%阎良区%' THEN '["610114"]'
    WHEN service_area LIKE '%高陵区%' THEN '["610117"]'
    WHEN service_area LIKE '%鄠邑区%' THEN '["610118"]'
    WHEN service_area LIKE '%蓝田县%' THEN '["610122"]'
    WHEN service_area LIKE '%周至县%' THEN '["610124"]'

    -- 如果 service_area 为空或 null，设置为空数组
    WHEN service_area IS NULL OR service_area = '' THEN '[]'

    -- 其他情况保持原样
    ELSE service_area
END
WHERE service_area IS NOT NULL;

-- 4. 验证迁移结果
-- 查看 providers 表中的 service_area 分布
SELECT service_area, COUNT(*) as count
FROM providers
GROUP BY service_area
ORDER BY count DESC;

-- 查看 merchant_applications 表中的 service_area 分布
SELECT service_area, COUNT(*) as count
FROM merchant_applications
GROUP BY service_area
ORDER BY count DESC;

-- 5. 检查是否有未转换的数据（包含中文的记录）
SELECT id, service_area
FROM providers
WHERE service_area LIKE '%区%' OR service_area LIKE '%县%' OR service_area LIKE '%市%';

SELECT id, service_area
FROM merchant_applications
WHERE service_area LIKE '%区%' OR service_area LIKE '%县%' OR service_area LIKE '%市%';

-- 注意事项：
-- 1. 执行前请先备份数据库
-- 2. 本脚本仅处理西安市的区域，如果有其他城市的数据，需要补充对应的 CASE 分支
-- 3. 如果有多个区域的组合，需要根据实际情况调整 CASE 逻辑
-- 4. 执行后请检查验证查询的结果，确保所有数据都已正确转换
