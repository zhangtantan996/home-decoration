-- =============================================================================
-- 清理测试数据脚本 (Cleanup Test Data)
-- 删除所有带 [TEST] 标记的数据
-- =============================================================================

-- 注意：按照外键依赖顺序删除

-- 1. 删除相关的交易记录（如有）
DELETE FROM transactions WHERE escrow_id IN (
    SELECT id FROM escrow_accounts WHERE project_id IN (
        SELECT id FROM projects WHERE owner_id IN (
            SELECT id FROM users WHERE nickname LIKE '%[TEST]%'
        )
    )
);

-- 2. 删除托管账户（如有）
DELETE FROM escrow_accounts WHERE project_id IN (
    SELECT id FROM projects WHERE owner_id IN (
        SELECT id FROM users WHERE nickname LIKE '%[TEST]%'
    )
);

-- 3. 删除施工日志（如有）
DELETE FROM work_logs WHERE project_id IN (
    SELECT id FROM projects WHERE owner_id IN (
        SELECT id FROM users WHERE nickname LIKE '%[TEST]%'
    )
);

-- 4. 删除里程碑（如有）
DELETE FROM milestones WHERE project_id IN (
    SELECT id FROM projects WHERE owner_id IN (
        SELECT id FROM users WHERE nickname LIKE '%[TEST]%'
    )
);

-- 5. 删除项目（如有）
DELETE FROM projects WHERE owner_id IN (
    SELECT id FROM users WHERE nickname LIKE '%[TEST]%'
);

-- 6. 删除服务商
DELETE FROM providers WHERE company_name LIKE '%[TEST]%';

-- 7. 删除工人（如有）
DELETE FROM workers WHERE user_id IN (
    SELECT id FROM users WHERE nickname LIKE '%[TEST]%'
);

-- 8. 最后删除用户
DELETE FROM users WHERE nickname LIKE '%[TEST]%';

-- =============================================================================
-- 验证清理结果
-- =============================================================================
SELECT 'Remaining test users:' AS check_item, COUNT(*) AS count FROM users WHERE nickname LIKE '%[TEST]%'
UNION ALL
SELECT 'Remaining test providers:', COUNT(*) FROM providers WHERE company_name LIKE '%[TEST]%';

-- 完成提示
-- SELECT '✅ 测试数据清理完成！' AS message;
