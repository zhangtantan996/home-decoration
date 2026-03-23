ALTER TABLE material_shop_applications
    ADD COLUMN IF NOT EXISTS brand_logo VARCHAR(500) DEFAULT '';
