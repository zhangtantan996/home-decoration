-- up
ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

UPDATE providers AS p
SET display_name = CASE
    WHEN p.provider_type = 2 THEN COALESCE(NULLIF(BTRIM(p.company_name), ''), NULLIF(BTRIM(u.nickname), ''))
    ELSE COALESCE(NULLIF(BTRIM(u.nickname), ''), NULLIF(BTRIM(p.company_name), ''))
END
FROM users AS u
WHERE p.user_id = u.id
  AND COALESCE(BTRIM(p.display_name), '') = '';

UPDATE providers
SET display_name = NULLIF(BTRIM(company_name), '')
WHERE COALESCE(BTRIM(display_name), '') = ''
  AND COALESCE(BTRIM(company_name), '') <> '';

-- down
ALTER TABLE providers
    DROP COLUMN IF EXISTS display_name;
