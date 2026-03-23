-- 单项目深挖
-- 用法：
--   psql ... -v project_id=99001 -f 03_project_detail.sql

\if :{?project_id}
\else
\set project_id 0
\endif

\echo ==== projects ====
SELECT *
FROM projects
WHERE id = CAST(:'project_id' AS bigint);

\echo ==== business_flows ====
SELECT *
FROM business_flows
WHERE project_id = CAST(:'project_id' AS bigint)
ORDER BY id;

\echo ==== project_phases ====
SELECT *
FROM project_phases
WHERE project_id = CAST(:'project_id' AS bigint)
ORDER BY seq, id;

\echo ==== milestones ====
SELECT *
FROM milestones
WHERE project_id = CAST(:'project_id' AS bigint)
ORDER BY seq, id;

\echo ==== escrow_accounts ====
SELECT *
FROM escrow_accounts
WHERE project_id = CAST(:'project_id' AS bigint)
ORDER BY id;

\echo ==== provider_snapshot ====
SELECT
  pr.id AS project_id,
  pr.provider_id,
  pr.construction_provider_id,
  pr.foreman_id,
  p.provider_type,
  p.company_name,
  u.nickname,
  u.phone,
  u.avatar
FROM projects pr
LEFT JOIN providers p ON p.id = pr.provider_id
LEFT JOIN users u ON u.id = p.user_id
WHERE pr.id = CAST(:'project_id' AS bigint);
