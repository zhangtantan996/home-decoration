ALTER TABLE merchant_applications
    ALTER COLUMN license_no TYPE TEXT;

ALTER TABLE providers
    ALTER COLUMN license_no TYPE TEXT;

ALTER TABLE material_shops
    ALTER COLUMN business_license_no TYPE TEXT;

ALTER TABLE material_shop_applications
    ALTER COLUMN business_license_no TYPE TEXT;
