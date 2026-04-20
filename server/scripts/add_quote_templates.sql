-- 创建智能报价估算模板表
CREATE TABLE IF NOT EXISTS quote_estimate_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    style VARCHAR(50) NOT NULL,
    region VARCHAR(50) NOT NULL,
    min_area DECIMAL(10,2) NOT NULL,
    max_area DECIMAL(10,2) NOT NULL,
    half_pack_min DECIMAL(10,2) NOT NULL,
    half_pack_max DECIMAL(10,2) NOT NULL,
    full_pack_min DECIMAL(10,2) NOT NULL,
    full_pack_max DECIMAL(10,2) NOT NULL,
    duration INT NOT NULL,
    materials TEXT,
    risk_items TEXT,
    status SMALLINT DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_quote_estimate_templates_style ON quote_estimate_templates(style);
CREATE INDEX IF NOT EXISTS idx_quote_estimate_templates_region ON quote_estimate_templates(region);
CREATE INDEX IF NOT EXISTS idx_quote_estimate_templates_status ON quote_estimate_templates(status);

-- 插入默认报价模板数据

-- 现代简约风格
INSERT INTO quote_estimate_templates (name, style, region, min_area, max_area, half_pack_min, half_pack_max, full_pack_min, full_pack_max, duration, materials, risk_items) VALUES
('现代简约-一线城市-中户型', '现代简约', '一线城市', 80, 120, 800, 1200, 1500, 2000, 90,
'[{"category":"水电材料","budget":15000},{"category":"瓦工材料","budget":20000},{"category":"木工材料","budget":25000},{"category":"油漆材料","budget":10000},{"category":"主材费用","budget":50000}]',
'[{"item":"老房拆改","description":"如果是老房需要拆改，费用另计，约5000-15000元"},{"item":"水电改造","description":"水电改造费用根据实际情况调整，约80-120元/平米"},{"item":"个性化定制","description":"定制家具、特殊造型等费用需单独计算"}]'),

('现代简约-一线城市-小户型', '现代简约', '一线城市', 40, 79, 900, 1300, 1600, 2100, 60,
'[{"category":"水电材料","budget":8000},{"category":"瓦工材料","budget":12000},{"category":"木工材料","budget":15000},{"category":"油漆材料","budget":6000},{"category":"主材费用","budget":30000}]',
'[{"item":"老房拆改","description":"如果是老房需要拆改，费用另计，约3000-8000元"},{"item":"水电改造","description":"水电改造费用根据实际情况调整，约80-120元/平米"},{"item":"空间利用","description":"小户型需要更多收纳设计，可能增加定制费用"}]'),

('现代简约-一线城市-大户型', '现代简约', '一线城市', 121, 200, 750, 1100, 1400, 1900, 120,
'[{"category":"水电材料","budget":25000},{"category":"瓦工材料","budget":35000},{"category":"木工材料","budget":40000},{"category":"油漆材料","budget":18000},{"category":"主材费用","budget":80000}]',
'[{"item":"老房拆改","description":"如果是老房需要拆改，费用另计，约10000-25000元"},{"item":"水电改造","description":"水电改造费用根据实际情况调整，约80-120元/平米"},{"item":"中央空调","description":"大户型建议安装中央空调，费用约3-5万元"}]'),

('现代简约-二线城市-中户型', '现代简约', '二线城市', 80, 120, 600, 1000, 1200, 1700, 90,
'[{"category":"水电材料","budget":12000},{"category":"瓦工材料","budget":16000},{"category":"木工材料","budget":20000},{"category":"油漆材料","budget":8000},{"category":"主材费用","budget":40000}]',
'[{"item":"老房拆改","description":"如果是老房需要拆改，费用另计，约4000-12000元"},{"item":"水电改造","description":"水电改造费用根据实际情况调整，约60-100元/平米"}]');

-- 北欧风格
INSERT INTO quote_estimate_templates (name, style, region, min_area, max_area, half_pack_min, half_pack_max, full_pack_min, full_pack_max, duration, materials, risk_items) VALUES
('北欧风格-一线城市-中户型', '北欧', '一线城市', 80, 120, 850, 1250, 1550, 2050, 90,
'[{"category":"水电材料","budget":15000},{"category":"瓦工材料","budget":22000},{"category":"木工材料","budget":28000},{"category":"油漆材料","budget":12000},{"category":"主材费用","budget":55000}]',
'[{"item":"进口材料","description":"北欧风格常用进口材料，价格较高"},{"item":"木地板","description":"建议使用实木复合地板，约200-400元/平米"},{"item":"灯具选择","description":"北欧风格灯具设计感强，预算需适当提高"}]'),

('北欧风格-二线城市-中户型', '北欧', '二线城市', 80, 120, 650, 1050, 1250, 1750, 90,
'[{"category":"水电材料","budget":12000},{"category":"瓦工材料","budget":18000},{"category":"木工材料","budget":22000},{"category":"油漆材料","budget":9000},{"category":"主材费用","budget":45000}]',
'[{"item":"进口材料","description":"北欧风格常用进口材料，价格较高"},{"item":"木地板","description":"建议使用实木复合地板，约150-300元/平米"}]');

-- 中式风格
INSERT INTO quote_estimate_templates (name, style, region, min_area, max_area, half_pack_min, half_pack_max, full_pack_min, full_pack_max, duration, materials, risk_items) VALUES
('中式风格-一线城市-中户型', '中式', '一线城市', 80, 120, 1000, 1500, 1800, 2500, 100,
'[{"category":"水电材料","budget":15000},{"category":"瓦工材料","budget":25000},{"category":"木工材料","budget":35000},{"category":"油漆材料","budget":15000},{"category":"主材费用","budget":70000}]',
'[{"item":"实木材料","description":"中式风格大量使用实木，成本较高"},{"item":"雕花工艺","description":"传统雕花工艺费用较高，约5000-20000元"},{"item":"定制家具","description":"中式家具多为定制，周期长、费用高"}]'),

('中式风格-二线城市-中户型', '中式', '二线城市', 80, 120, 800, 1300, 1500, 2200, 100,
'[{"category":"水电材料","budget":12000},{"category":"瓦工材料","budget":20000},{"category":"木工材料","budget":28000},{"category":"油漆材料","budget":12000},{"category":"主材费用","budget":60000}]',
'[{"item":"实木材料","description":"中式风格大量使用实木，成本较高"},{"item":"雕花工艺","description":"传统雕花工艺费用较高，约3000-15000元"}]');

-- 轻奢风格
INSERT INTO quote_estimate_templates (name, style, region, min_area, max_area, half_pack_min, half_pack_max, full_pack_min, full_pack_max, duration, materials, risk_items) VALUES
('轻奢风格-一线城市-中户型', '轻奢', '一线城市', 80, 120, 950, 1400, 1700, 2300, 95,
'[{"category":"水电材料","budget":16000},{"category":"瓦工材料","budget":28000},{"category":"木工材料","budget":30000},{"category":"油漆材料","budget":13000},{"category":"主材费用","budget":65000}]',
'[{"item":"高端材料","description":"轻奢风格注重质感，材料成本较高"},{"item":"金属元素","description":"金属装饰件、灯具等费用较高"},{"item":"大理石","description":"天然大理石约600-1500元/平米"}]'),

('轻奢风格-二线城市-中户型', '轻奢', '二线城市', 80, 120, 750, 1200, 1400, 2000, 95,
'[{"category":"水电材料","budget":13000},{"category":"瓦工材料","budget":22000},{"category":"木工材料","budget":25000},{"category":"油漆材料","budget":10000},{"category":"主材费用","budget":55000}]',
'[{"item":"高端材料","description":"轻奢风格注重质感，材料成本较高"},{"item":"金属元素","description":"金属装饰件、灯具等费用较高"}]');

-- 日式风格
INSERT INTO quote_estimate_templates (name, style, region, min_area, max_area, half_pack_min, half_pack_max, full_pack_min, full_pack_max, duration, materials, risk_items) VALUES
('日式风格-一线城市-中户型', '日式', '一线城市', 80, 120, 850, 1250, 1550, 2050, 90,
'[{"category":"水电材料","budget":15000},{"category":"瓦工材料","budget":20000},{"category":"木工材料","budget":30000},{"category":"油漆材料","budget":10000},{"category":"主材费用","budget":55000}]',
'[{"item":"原木材料","description":"日式风格大量使用原木，成本较高"},{"item":"榻榻米","description":"定制榻榻米约800-1500元/平米"},{"item":"收纳设计","description":"日式收纳设计复杂，木工费用较高"}]'),

('日式风格-二线城市-中户型', '日式', '二线城市', 80, 120, 650, 1050, 1250, 1750, 90,
'[{"category":"水电材料","budget":12000},{"category":"瓦工材料","budget":16000},{"category":"木工材料","budget":24000},{"category":"油漆材料","budget":8000},{"category":"主材费用","budget":45000}]',
'[{"item":"原木材料","description":"日式风格大量使用原木，成本较高"},{"item":"榻榻米","description":"定制榻榻米约600-1200元/平米"}]');

-- 美式风格
INSERT INTO quote_estimate_templates (name, style, region, min_area, max_area, half_pack_min, half_pack_max, full_pack_min, full_pack_max, duration, materials, risk_items) VALUES
('美式风格-一线城市-大户型', '美式', '一线城市', 121, 200, 900, 1350, 1650, 2250, 120,
'[{"category":"水电材料","budget":25000},{"category":"瓦工材料","budget":30000},{"category":"木工材料","budget":45000},{"category":"油漆材料","budget":20000},{"category":"主材费用","budget":90000}]',
'[{"item":"护墙板","description":"美式风格常用护墙板，约300-800元/平米"},{"item":"壁炉","description":"装饰壁炉约5000-20000元"},{"item":"吊顶造型","description":"美式吊顶造型复杂，费用较高"}]'),

('美式风格-二线城市-大户型', '美式', '二线城市', 121, 200, 700, 1150, 1350, 1950, 120,
'[{"category":"水电材料","budget":20000},{"category":"瓦工材料","budget":25000},{"category":"木工材料","budget":38000},{"category":"油漆材料","budget":16000},{"category":"主材费用","budget":75000}]',
'[{"item":"护墙板","description":"美式风格常用护墙板，约200-600元/平米"},{"item":"壁炉","description":"装饰壁炉约3000-15000元"}]');

COMMENT ON TABLE quote_estimate_templates IS '智能报价估算模板表';
COMMENT ON COLUMN quote_estimate_templates.name IS '模板名称';
COMMENT ON COLUMN quote_estimate_templates.style IS '装修风格';
COMMENT ON COLUMN quote_estimate_templates.region IS '区域';
COMMENT ON COLUMN quote_estimate_templates.min_area IS '最小面积（平米）';
COMMENT ON COLUMN quote_estimate_templates.max_area IS '最大面积（平米）';
COMMENT ON COLUMN quote_estimate_templates.half_pack_min IS '半包最低价（元/平米）';
COMMENT ON COLUMN quote_estimate_templates.half_pack_max IS '半包最高价（元/平米）';
COMMENT ON COLUMN quote_estimate_templates.full_pack_min IS '全包最低价（元/平米）';
COMMENT ON COLUMN quote_estimate_templates.full_pack_max IS '全包最高价（元/平米）';
COMMENT ON COLUMN quote_estimate_templates.duration IS '工期（天）';
COMMENT ON COLUMN quote_estimate_templates.materials IS '材料预算明细（JSON）';
COMMENT ON COLUMN quote_estimate_templates.risk_items IS '风险项提醒（JSON）';
COMMENT ON COLUMN quote_estimate_templates.status IS '状态（1=启用，0=禁用）';
