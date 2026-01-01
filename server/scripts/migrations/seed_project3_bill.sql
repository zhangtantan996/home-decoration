-- 为项目 ID=3 生成测试账单数据（基于实际费用预估）
-- 运行: Get-Content "scripts\migrations\seed_project3_bill.sql" | docker exec -i home_decoration-postgres-1 psql -U postgres -d home_decoration

-- 先清理可能存在的旧数据
DELETE FROM payment_plans WHERE order_id IN (SELECT id FROM orders WHERE project_id = 3);
DELETE FROM orders WHERE project_id = 3;

-- 1. 创建设计费订单（已支付状态，意向金抵扣99元）
INSERT INTO orders (project_id, booking_id, order_no, order_type, total_amount, paid_amount, discount, status, paid_at, created_at, updated_at)
VALUES (3, 0, 'D1735640103000', 'design', 5000, 4901, 99, 1, NOW(), NOW(), NOW());

-- 2. 创建施工费订单（待支付状态）
INSERT INTO orders (project_id, booking_id, order_no, order_type, total_amount, paid_amount, discount, status, created_at, updated_at)
VALUES (3, 0, 'C1735640103001', 'construction', 50000, 0, 0, 0, NOW(), NOW());

-- 3. 创建主材费订单（待支付状态）
INSERT INTO orders (project_id, booking_id, order_no, order_type, total_amount, paid_amount, discount, status, created_at, updated_at)
VALUES (3, 0, 'M1735640103002', 'material', 200000, 0, 0, 0, NOW(), NOW());

-- 4. 为施工费创建分期支付计划
DO $$
DECLARE
    construction_order_id BIGINT;
BEGIN
    SELECT id INTO construction_order_id FROM orders WHERE order_no = 'C1735640103001';
    
    IF construction_order_id IS NOT NULL THEN
        -- 开工款 30% = 15000
        INSERT INTO payment_plans (order_id, type, seq, name, percentage, amount, status, created_at, updated_at)
        VALUES (construction_order_id, 'milestone', 1, '开工款', 30, 15000, 0, NOW(), NOW());
        
        -- 水电款 35% = 17500
        INSERT INTO payment_plans (order_id, type, seq, name, percentage, amount, status, created_at, updated_at)
        VALUES (construction_order_id, 'milestone', 2, '水电款', 35, 17500, 0, NOW(), NOW());
        
        -- 中期款 30% = 15000
        INSERT INTO payment_plans (order_id, type, seq, name, percentage, amount, status, created_at, updated_at)
        VALUES (construction_order_id, 'milestone', 3, '中期款', 30, 15000, 0, NOW(), NOW());
        
        -- 尾款 5% = 2500
        INSERT INTO payment_plans (order_id, type, seq, name, percentage, amount, status, created_at, updated_at)
        VALUES (construction_order_id, 'milestone', 4, '尾款', 5, 2500, 0, NOW(), NOW());
    END IF;
END $$;

-- 验证插入结果
SELECT '=== 订单 ===' AS info;
SELECT id, order_type, total_amount, discount, 
       CASE status WHEN 0 THEN '待支付' WHEN 1 THEN '已支付' END AS status_text 
FROM orders WHERE project_id = 3;

SELECT '=== 施工费分期 ===' AS info;
SELECT pp.name, pp.percentage || '%' AS rate, pp.amount, 
       CASE pp.status WHEN 0 THEN '待支付' WHEN 1 THEN '已支付' END AS status_text
FROM payment_plans pp JOIN orders o ON pp.order_id = o.id WHERE o.project_id = 3;
