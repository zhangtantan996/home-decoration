-- 验收清单表
CREATE TABLE IF NOT EXISTS inspection_checklists (
    id BIGSERIAL PRIMARY KEY,
    milestone_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    category VARCHAR(50) NOT NULL,
    items JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'pending',
    submitted_by BIGINT,
    submitted_at TIMESTAMP,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inspection_checklists_milestone_id ON inspection_checklists(milestone_id);
CREATE INDEX idx_inspection_checklists_project_id ON inspection_checklists(project_id);
CREATE INDEX idx_inspection_checklists_submitted_by ON inspection_checklists(submitted_by);

-- 验收清单模板表
CREATE TABLE IF NOT EXISTS inspection_templates (
    id BIGSERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    items JSONB DEFAULT '[]',
    is_default BOOLEAN DEFAULT FALSE,
    status SMALLINT DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认验收清单模板
INSERT INTO inspection_templates (category, name, description, items, is_default, status) VALUES
('水电', '水电验收清单', '水电阶段验收标准', '[
    {"name": "电线布线规范", "description": "电线布线横平竖直，无交叉", "required": true, "passed": false, "note": ""},
    {"name": "水管安装牢固", "description": "水管固定牢固，无渗漏", "required": true, "passed": false, "note": ""},
    {"name": "开关插座位置", "description": "开关插座位置符合设计要求", "required": true, "passed": false, "note": ""},
    {"name": "防水测试", "description": "卫生间、厨房防水测试通过", "required": true, "passed": false, "note": ""}
]'::jsonb, true, 1),
('瓦工', '瓦工验收清单', '瓦工阶段验收标准', '[
    {"name": "墙砖铺贴平整", "description": "墙砖铺贴平整，无空鼓", "required": true, "passed": false, "note": ""},
    {"name": "地砖铺贴规范", "description": "地砖铺贴规范，缝隙均匀", "required": true, "passed": false, "note": ""},
    {"name": "防水层完整", "description": "防水层完整，无破损", "required": true, "passed": false, "note": ""}
]'::jsonb, true, 1),
('木工', '木工验收清单', '木工阶段验收标准', '[
    {"name": "吊顶安装牢固", "description": "吊顶安装牢固，无松动", "required": true, "passed": false, "note": ""},
    {"name": "柜体制作规范", "description": "柜体制作规范，尺寸准确", "required": true, "passed": false, "note": ""},
    {"name": "门窗安装到位", "description": "门窗安装到位，开关顺畅", "required": true, "passed": false, "note": ""}
]'::jsonb, true, 1),
('油漆', '油漆验收清单', '油漆阶段验收标准', '[
    {"name": "墙面平整光滑", "description": "墙面平整光滑，无裂纹", "required": true, "passed": false, "note": ""},
    {"name": "涂料颜色均匀", "description": "涂料颜色均匀，无色差", "required": true, "passed": false, "note": ""},
    {"name": "边角处理细致", "description": "边角处理细致，无污染", "required": true, "passed": false, "note": ""}
]'::jsonb, true, 1)
ON CONFLICT (category) DO NOTHING;
