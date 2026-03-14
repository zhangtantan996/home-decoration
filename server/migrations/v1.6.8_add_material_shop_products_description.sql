ALTER TABLE material_shop_products
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
