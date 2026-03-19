-- v1.10.2 统一报价类目为「一级工种 + 二级工序」
-- 目标：
-- 1. 保留现有 quote_categories 表结构，仅复用 parent_id 构建树形类目
-- 2. 将现有 quote_library_items 归并到标准一级/二级类目
-- 3. 隐藏历史平铺类目，避免后台同时出现新旧两套结构

BEGIN;

-- 一级工种
INSERT INTO quote_categories (code, name, parent_id, sort_order, status)
VALUES
  ('DEMOLITION', '拆除', 0, 1, 1),
  ('PLUMBING_ELECTRIC', '水电', 0, 2, 1),
  ('MASONRY', '泥瓦', 0, 3, 1),
  ('CARPENTRY', '木作', 0, 4, 1),
  ('PAINTING', '油工', 0, 5, 1),
  ('INSTALLATION', '安装', 0, 6, 1),
  ('CLEANING', '清运保洁', 0, 7, 1),
  ('MISC', '其他', 0, 8, 1)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 二级工序
INSERT INTO quote_categories (code, name, parent_id, sort_order, status)
SELECT child.code, child.name, parent.id, child.sort_order, 1
FROM (
  VALUES
    ('DEMOLITION', 'DEMOLITION_WALL', '墙体拆除', 1),
    ('DEMOLITION', 'DEMOLITION_CEILING', '吊顶拆除', 2),
    ('DEMOLITION', 'DEMOLITION_WHOLE', '全屋拆旧', 3),
    ('DEMOLITION', 'DEMOLITION_INSULATION', '保温墙拆除', 4),
    ('DEMOLITION', 'DEMOLITION_GENERAL', '拆旧', 5),

    ('PLUMBING_ELECTRIC', 'PLUMBING_WATER_ROUTE', '水路', 1),
    ('PLUMBING_ELECTRIC', 'PLUMBING_CIRCUIT', '电路', 2),

    ('MASONRY', 'MASONRY_WATERPROOF', '防水', 1),
    ('MASONRY', 'MASONRY_WALL_TILE', '墙砖铺贴', 2),
    ('MASONRY', 'MASONRY_FLOOR_TILE', '地砖铺贴', 3),
    ('MASONRY', 'MASONRY_BRICKWORK', '砌筑抹灰', 4),
    ('MASONRY', 'MASONRY_FLOOR_LEVELING', '地面找平', 5),
    ('MASONRY', 'MASONRY_PIPE_WRAP', '包管', 6),
    ('MASONRY', 'MASONRY_STONE_FINISH', '石材收边', 7),
    ('MASONRY', 'MASONRY_MESH_REPAIR', '挂网修补', 8),
    ('MASONRY', 'MASONRY_DOOR_WINDOW_REPAIR', '门窗洞修补', 9),

    ('CARPENTRY', 'CARPENTRY_CEILING', '吊顶', 1),
    ('CARPENTRY', 'CARPENTRY_PARTITION', '隔墙隔断', 2),
    ('CARPENTRY', 'CARPENTRY_CURTAIN_TRIM', '窗帘盒/线条', 3),
    ('CARPENTRY', 'CARPENTRY_BASE_BOARD', '基层板', 4),

    ('PAINTING', 'PAINTING_PUTTY_LEVELING', '腻子找平', 1),
    ('PAINTING', 'PAINTING_COAT', '底漆面漆', 2),
    ('PAINTING', 'PAINTING_PATCH_REPAIR', '修补找补', 3),
    ('PAINTING', 'PAINTING_CLOTH_WALLPAPER', '贴布/壁纸基层', 4),

    ('INSTALLATION', 'INSTALL_SANITARY', '洁具浴缸', 1),
    ('INSTALLATION', 'INSTALL_HARDWARE', '五金安装', 2),
    ('INSTALLATION', 'INSTALL_LIGHT_PANEL', '灯具面板', 3),
    ('INSTALLATION', 'INSTALL_LAYOUT', '施工放样', 4),
    ('INSTALLATION', 'INSTALL_FINISHING', '收口处理', 5),
    ('INSTALLATION', 'INSTALL_HVAC_OPENING', '空调洞口', 6),

    ('CLEANING', 'CLEANING_WASTE_REMOVAL', '垃圾清运', 1),
    ('CLEANING', 'CLEANING_FINAL_CLEAN', '完工清扫', 2),

    ('MISC', 'MISC_TEMPORARY', '临时补充项', 1)
) AS child(parent_code, code, name, sort_order)
JOIN quote_categories parent ON parent.code = child.parent_code
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updated_at = NOW();

WITH classified AS (
  SELECT
    item.id,
    CASE
      WHEN item.name ILIKE '%拆除%' THEN '拆除'
      WHEN item.name ILIKE '%铲除%' THEN '拆除'
      WHEN item.name ILIKE '%水路%' THEN '水电'
      WHEN item.name ILIKE '%电路%' THEN '水电'
      WHEN item.name ILIKE '%隔墙%' OR item.name ILIKE '%隔断%' THEN '木作'
      WHEN item.name ILIKE '%吊顶%' OR item.name ILIKE '%吊平顶%' OR item.name ILIKE '%石膏线%' OR item.name ILIKE '%PU线%' OR item.name ILIKE '%窗帘盒%' OR item.name ILIKE '%扣板%' THEN '木作'
      WHEN item.name ILIKE '%九厘板%' OR item.name ILIKE '%OSB%' THEN '木作'
      WHEN item.name ILIKE '%防水%' THEN '泥瓦'
      WHEN item.name ILIKE '%墙砖%' OR item.name ILIKE '%贴墙%' OR item.name ILIKE '%腰线%' OR item.name ILIKE '%马赛克%' OR item.name ILIKE '%玻璃砖%' THEN '泥瓦'
      WHEN item.name ILIKE '%地砖%' OR item.name ILIKE '%铺地%' OR item.name ILIKE '%过门石%' OR item.name ILIKE '%踢脚%' OR item.name ILIKE '%波达线%' OR item.name ILIKE '%边线%' OR item.name ILIKE '%角花%' OR item.name ILIKE '%大理石%' THEN '泥瓦'
      WHEN item.name ILIKE '%砌%' AND item.name ILIKE '%墙%' THEN '泥瓦'
      WHEN item.name ILIKE '%门洞%' OR item.name ILIKE '%门窗洞%' THEN '泥瓦'
      WHEN item.name ILIKE '%钢丝网%' THEN '泥瓦'
      WHEN item.name ILIKE '%找平%' THEN '泥瓦'
      WHEN item.name ILIKE '%包%' AND (item.name ILIKE '%立管%' OR item.name ILIKE '%下水管%') THEN '泥瓦'
      WHEN item.name ILIKE '%墙漆%' OR item.name ILIKE '%顶墙面漆%' OR item.name ILIKE '%底漆%' OR item.name ILIKE '%防水漆%' OR item.name ILIKE '%腻子%' OR item.name ILIKE '%规方%' OR item.name ILIKE '%贴布%' OR item.name ILIKE '%贴石膏%' OR item.name ILIKE '%壁纸%' OR item.name ILIKE '%墙面纸%' OR item.name ILIKE '%拉毛%' OR item.name ILIKE '%素灰%' OR item.name ILIKE '%补烂%' OR item.name ILIKE '%刷漆%' OR item.name ILIKE '%的确良布%' THEN '油工'
      WHEN item.name ILIKE '%灯具%' OR item.name ILIKE '%面板安装%' OR item.name ILIKE '%五金%' OR item.name ILIKE '%浴缸%' OR item.name ILIKE '%阳角条%' OR item.name ILIKE '%倒角%' OR item.name ILIKE '%空调%' OR item.name ILIKE '%放样%' THEN '安装'
      WHEN item.name ILIKE '%垃圾%' OR item.name ILIKE '%清扫%' THEN '清运保洁'
      ELSE '其他'
    END AS root_name,
    CASE
      WHEN item.name ILIKE '%拆除%' AND (item.name ILIKE '%墙体%' OR item.name ILIKE '%砖墙%') THEN '墙体拆除'
      WHEN item.name ILIKE '%拆除%' AND item.name ILIKE '%吊顶%' THEN '吊顶拆除'
      WHEN item.name ILIKE '%拆除%' AND item.name ILIKE '%全屋%' THEN '全屋拆旧'
      WHEN item.name ILIKE '%拆除%' AND item.name ILIKE '%保温%' THEN '保温墙拆除'
      WHEN item.name ILIKE '%拆除%' OR item.name ILIKE '%铲除%' THEN '拆旧'

      WHEN item.name ILIKE '%水路%' THEN '水路'
      WHEN item.name ILIKE '%电路%' THEN '电路'

      WHEN item.name ILIKE '%隔墙%' OR item.name ILIKE '%隔断%' THEN '隔墙隔断'
      WHEN item.name ILIKE '%石膏线%' OR item.name ILIKE '%PU线%' OR item.name ILIKE '%窗帘盒%' THEN '窗帘盒/线条'
      WHEN item.name ILIKE '%九厘板%' OR item.name ILIKE '%OSB%' THEN '基层板'
      WHEN item.name ILIKE '%吊顶%' OR item.name ILIKE '%吊平顶%' OR item.name ILIKE '%扣板%' THEN '吊顶'

      WHEN item.name ILIKE '%防水%' THEN '防水'
      WHEN item.name ILIKE '%墙砖%' OR item.name ILIKE '%贴墙%' OR item.name ILIKE '%腰线%' OR item.name ILIKE '%马赛克%' OR item.name ILIKE '%玻璃砖%' THEN '墙砖铺贴'
      WHEN item.name ILIKE '%地砖%' OR item.name ILIKE '%铺地%' THEN '地砖铺贴'
      WHEN item.name ILIKE '%过门石%' OR item.name ILIKE '%踢脚%' OR item.name ILIKE '%波达线%' OR item.name ILIKE '%边线%' OR item.name ILIKE '%角花%' OR item.name ILIKE '%大理石%' THEN '石材收边'
      WHEN item.name ILIKE '%砌%' AND item.name ILIKE '%墙%' THEN '砌筑抹灰'
      WHEN item.name ILIKE '%门洞%' OR item.name ILIKE '%门窗洞%' THEN '门窗洞修补'
      WHEN item.name ILIKE '%钢丝网%' THEN '挂网修补'
      WHEN item.name ILIKE '%找平%' THEN '地面找平'
      WHEN item.name ILIKE '%包%' AND (item.name ILIKE '%立管%' OR item.name ILIKE '%下水管%') THEN '包管'

      WHEN item.name ILIKE '%墙漆%' OR item.name ILIKE '%顶墙面漆%' OR item.name ILIKE '%底漆%' OR item.name ILIKE '%防水漆%' OR item.name ILIKE '%刷漆%' THEN '底漆面漆'
      WHEN item.name ILIKE '%腻子%' OR item.name ILIKE '%规方%' THEN '腻子找平'
      WHEN item.name ILIKE '%贴布%' OR item.name ILIKE '%贴石膏%' OR item.name ILIKE '%壁纸%' OR item.name ILIKE '%墙面纸%' OR item.name ILIKE '%的确良布%' THEN '贴布/壁纸基层'
      WHEN item.name ILIKE '%拉毛%' OR item.name ILIKE '%素灰%' OR item.name ILIKE '%补烂%' THEN '修补找补'

      WHEN item.name ILIKE '%浴缸%' THEN '洁具浴缸'
      WHEN item.name ILIKE '%五金%' THEN '五金安装'
      WHEN item.name ILIKE '%灯具%' OR item.name ILIKE '%面板安装%' THEN '灯具面板'
      WHEN item.name ILIKE '%放样%' THEN '施工放样'
      WHEN item.name ILIKE '%阳角条%' OR item.name ILIKE '%倒角%' THEN '收口处理'
      WHEN item.name ILIKE '%空调%' THEN '空调洞口'

      WHEN item.name ILIKE '%垃圾%' OR item.name ILIKE '%清扫%' THEN '垃圾清运'
      ELSE '临时补充项'
    END AS child_name
  FROM quote_library_items item
),
target_category AS (
  SELECT
    classified.id AS item_id,
    classified.root_name,
    classified.child_name,
    leaf.id AS category_id
  FROM classified
  JOIN quote_categories root
    ON root.name = classified.root_name
   AND root.parent_id = 0
   AND root.status = 1
  JOIN quote_categories leaf
    ON leaf.name = classified.child_name
   AND leaf.parent_id = root.id
   AND leaf.status = 1
)
UPDATE quote_library_items item
SET
  category_l1 = target_category.root_name,
  category_l2 = target_category.child_name,
  category_id = target_category.category_id,
  updated_at = NOW()
FROM target_category
WHERE item.id = target_category.item_id;

-- 隐藏历史平铺类目，避免后台重复展示
UPDATE quote_categories
SET status = 0, updated_at = NOW()
WHERE code IN (
  'PARTITION',
  'WALL_TILE',
  'FLOOR_TILE',
  'WATERPROOF',
  'GROUND',
  'PIPE_WRAP',
  'BASE_CONSTRUCTION',
  'CEILING'
);

-- 旧类目规则不再适用，避免误分类
DO $$
BEGIN
  IF to_regclass('public.quote_category_rules') IS NOT NULL THEN
    DELETE FROM quote_category_rules
    WHERE category_id IN (
      SELECT id
      FROM quote_categories
      WHERE code IN (
        'PARTITION',
        'WALL_TILE',
        'FLOOR_TILE',
        'WATERPROOF',
        'GROUND',
        'PIPE_WRAP',
        'BASE_CONSTRUCTION',
        'CEILING'
      )
    );
  END IF;
END $$;

COMMIT;
