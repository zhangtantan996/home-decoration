-- 清理脏数据脚本
-- 执行前请确保已备份数据库
-- 运行方式: psql -U postgres -d home_decoration -f cleanup_dirty_data.sql

-- ======================================================
-- 1. 服务商资质审核 - 删除待审核的2条脏数据
-- ======================================================
DELETE FROM provider_audits WHERE status = 0;
-- 如果需要删除所有记录，取消下面注释：
-- TRUNCATE TABLE provider_audits RESTART IDENTITY;

-- ======================================================
-- 2. 资产中心 (托管账户 + 交易记录) - 清空所有数据
-- ======================================================
-- 托管账户表
TRUNCATE TABLE escrow_accounts RESTART IDENTITY CASCADE;

-- 交易记录表
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;

-- ======================================================
-- 3. 风险预警 - 删除全部3条脏数据
-- ======================================================
TRUNCATE TABLE risk_warnings RESTART IDENTITY;

-- ======================================================
-- 4. 仲裁中心 - 删除全部2条脏数据
-- ======================================================
TRUNCATE TABLE arbitrations RESTART IDENTITY;

-- ======================================================
-- 5. 操作日志 - 删除ID 61、62、63 三条记录
-- ======================================================
DELETE FROM admin_logs WHERE id IN (61, 62, 63);

-- 如果admin_logs表还有其他乱码数据，可以删除所有action字段为乱码的记录：
-- DELETE FROM admin_logs WHERE action ~ '^[?]+$' OR action LIKE '%?%';

-- 验证清理结果
SELECT 'provider_audits (status=0)' AS table_name, COUNT(*) AS remaining FROM provider_audits WHERE status = 0
UNION ALL
SELECT 'escrow_accounts', COUNT(*) FROM escrow_accounts
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'risk_warnings', COUNT(*) FROM risk_warnings
UNION ALL
SELECT 'arbitrations', COUNT(*) FROM arbitrations
UNION ALL
SELECT 'admin_logs (61,62,63)', COUNT(*) FROM admin_logs WHERE id IN (61, 62, 63);

-- 完成提示
SELECT '脏数据清理完成！' AS message;
