-- Keep only the Xi'an service area chain enabled for now:
-- province: Shaanxi (610000)
-- city: Xi'an (610100)
-- districts under Xi'an

UPDATE regions
SET enabled = false;

UPDATE regions
SET enabled = true
WHERE code IN ('610000', '610100')
   OR parent_code = '610100';
