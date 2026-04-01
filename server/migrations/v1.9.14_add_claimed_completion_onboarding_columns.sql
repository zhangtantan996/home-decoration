-- v1.9.14: 认领补全闭环关键字段补齐（幂等）
-- 目的：
-- 1) 补齐装修公司/主材门店“认领后补全正式入驻资料”所需的门禁字段
-- 2) 补齐申请表的 application_scene，区分新入驻与认领补全
-- 3) 为本地、测试、预发、生产提供统一修复入口

BEGIN;

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS needs_onboarding_completion BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN providers.needs_onboarding_completion IS '后台认领后是否仍需补全正式入驻资料';

ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS needs_onboarding_completion BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN material_shops.needs_onboarding_completion IS '后台认领后是否仍需补全正式入驻资料';

ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS application_scene VARCHAR(40) NOT NULL DEFAULT 'new_onboarding';

COMMENT ON COLUMN merchant_applications.application_scene IS '申请场景：new_onboarding=新入驻，claimed_completion=认领后补全';

ALTER TABLE material_shop_applications
    ADD COLUMN IF NOT EXISTS application_scene VARCHAR(40) NOT NULL DEFAULT 'new_onboarding';

COMMENT ON COLUMN material_shop_applications.application_scene IS '申请场景：new_onboarding=新入驻，claimed_completion=认领后补全';

COMMIT;
