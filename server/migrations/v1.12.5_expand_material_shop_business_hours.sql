-- v1.12.5: 扩容主材商营业时间文本，避免审批创建正式主体时长度溢出

BEGIN;

ALTER TABLE material_shops
    ALTER COLUMN open_time TYPE TEXT;

ALTER TABLE material_shop_applications
    ALTER COLUMN business_hours TYPE TEXT;

COMMIT;
