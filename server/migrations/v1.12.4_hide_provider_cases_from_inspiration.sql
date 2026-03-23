-- 商家入驻后的案例仅用于商家详情页展示，不作为灵感图库数据源。
-- 该脚本是幂等的，可重复执行。

UPDATE provider_cases
SET show_in_inspiration = FALSE
WHERE provider_id <> 0
  AND show_in_inspiration = TRUE;
