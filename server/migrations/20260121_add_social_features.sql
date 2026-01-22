-- ========================================
-- 灵感图库社交功能数据库迁移
-- 创建时间: 2026-01-21
-- 描述: 新增点赞、评论、敏感词表，扩展作品表
-- ========================================

-- 1. 扩展 provider_cases 表：新增展示开关字段
ALTER TABLE provider_cases 
ADD COLUMN IF NOT EXISTS show_in_inspiration BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN provider_cases.show_in_inspiration IS '是否展示在灵感图库';

-- 为已存在的官方作品（provider_id=0）默认开启展示
UPDATE provider_cases SET show_in_inspiration = TRUE WHERE provider_id = 0;

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_provider_cases_inspiration ON provider_cases(show_in_inspiration, created_at DESC) WHERE show_in_inspiration = TRUE;


-- 2. 创建用户点赞表
CREATE TABLE IF NOT EXISTS user_likes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_id BIGINT NOT NULL,
    target_type VARCHAR(50) NOT NULL DEFAULT 'case',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_likes_unique UNIQUE(user_id, target_id, target_type)
);

COMMENT ON TABLE user_likes IS '用户点赞记录表';
COMMENT ON COLUMN user_likes.user_id IS '点赞用户ID';
COMMENT ON COLUMN user_likes.target_id IS '目标ID（案例ID/门店ID等）';
COMMENT ON COLUMN user_likes.target_type IS '目标类型：case/material_shop';

-- 点赞表索引
CREATE INDEX IF NOT EXISTS idx_user_likes_target ON user_likes(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_user_likes_user ON user_likes(user_id, created_at DESC);


-- 3. 创建案例评论表
CREATE TABLE IF NOT EXISTS case_comments (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'approved',
    reject_reason VARCHAR(200),
    moderated_by BIGINT,
    moderated_at TIMESTAMP,
    report_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_comment_content_length CHECK (char_length(content) BETWEEN 1 AND 500)
);

COMMENT ON TABLE case_comments IS '案例评论表';
COMMENT ON COLUMN case_comments.case_id IS '所属案例ID';
COMMENT ON COLUMN case_comments.user_id IS '评论用户ID';
COMMENT ON COLUMN case_comments.content IS '评论内容（1-500字符）';
COMMENT ON COLUMN case_comments.status IS '状态：approved/pending_review/hidden/deleted';
COMMENT ON COLUMN case_comments.reject_reason IS '隐藏/删除原因';
COMMENT ON COLUMN case_comments.moderated_by IS '审核人ID（管理员）';
COMMENT ON COLUMN case_comments.moderated_at IS '审核时间';
COMMENT ON COLUMN case_comments.report_count IS '被举报次数';

-- 评论表索引
CREATE INDEX IF NOT EXISTS idx_case_comments_case_status ON case_comments(case_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_comments_user ON case_comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_comments_status ON case_comments(status) WHERE status IN ('pending_review', 'hidden');
CREATE INDEX IF NOT EXISTS idx_case_comments_report ON case_comments(report_count DESC) WHERE report_count > 0;


-- 4. 创建敏感词表
CREATE TABLE IF NOT EXISTS sensitive_words (
    id BIGSERIAL PRIMARY KEY,
    word VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(20),
    level VARCHAR(20) DEFAULT 'normal',
    action VARCHAR(20) DEFAULT 'block',
    is_regex BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE sensitive_words IS '敏感词库表';
COMMENT ON COLUMN sensitive_words.word IS '敏感词（支持正则表达式）';
COMMENT ON COLUMN sensitive_words.category IS '分类：politics/porn/abuse/ad/spam/competitor';
COMMENT ON COLUMN sensitive_words.level IS '严重程度：severe/normal/mild';
COMMENT ON COLUMN sensitive_words.action IS '处理动作：block/review/replace';
COMMENT ON COLUMN sensitive_words.is_regex IS '是否正则表达式';

-- 敏感词表索引
CREATE INDEX IF NOT EXISTS idx_sensitive_words_word ON sensitive_words(word);
CREATE INDEX IF NOT EXISTS idx_sensitive_words_category ON sensitive_words(category);
CREATE INDEX IF NOT EXISTS idx_sensitive_words_level ON sensitive_words(level);


-- 5. 扩展 user_favorites 表（确保支持多类型收藏）
-- 检查表是否已有 target_type 字段，如无则添加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='user_favorites' AND column_name='target_type'
    ) THEN
        ALTER TABLE user_favorites ADD COLUMN target_type VARCHAR(50) DEFAULT 'provider';
        
        -- 为已存在的数据设置默认类型
        UPDATE user_favorites SET target_type = 'provider' WHERE target_type IS NULL;
        
        -- 添加复合唯一索引
        CREATE UNIQUE INDEX uk_user_favorites_unique ON user_favorites(user_id, target_id, target_type);
    END IF;
END $$;

COMMENT ON COLUMN user_favorites.target_type IS '收藏类型：provider/case/material_shop';


-- 6. 插入初始敏感词数据（示例，实际应导入完整词库）
INSERT INTO sensitive_words (word, category, level, action) VALUES
-- 严重违规词（直接拦截）
('fuck', 'abuse', 'severe', 'block'),
('shit', 'abuse', 'severe', 'block'),
('傻逼', 'abuse', 'severe', 'block'),
('草泥马', 'abuse', 'severe', 'block'),

-- 广告类（待审核）
('微信', 'ad', 'normal', 'review'),
('加微信', 'ad', 'normal', 'review'),
('扫码', 'ad', 'normal', 'review'),
('优惠', 'ad', 'mild', 'review'),
('咨询', 'ad', 'mild', 'review'),

-- 竞品类（待审核）
('土巴兔', 'competitor', 'normal', 'review'),
('齐家网', 'competitor', 'normal', 'review'),
('好好住', 'competitor', 'normal', 'review'),

-- 正则表达式示例（匹配手机号/微信号）
('[0-9]{11}', 'ad', 'normal', 'review', TRUE),
('微信.*[0-9]{5,}', 'ad', 'normal', 'review', TRUE),
('VX.*[0-9]{5,}', 'ad', 'normal', 'review', TRUE)

ON CONFLICT (word) DO NOTHING;


-- 7. 创建统计视图（可选，方便后台查询）
CREATE OR REPLACE VIEW v_case_stats AS
SELECT 
    pc.id AS case_id,
    pc.title,
    pc.provider_id,
    pc.show_in_inspiration,
    COUNT(DISTINCT ul.id) AS like_count,
    COUNT(DISTINCT cc.id) FILTER (WHERE cc.status = 'approved') AS comment_count,
    pc.created_at
FROM provider_cases pc
LEFT JOIN user_likes ul ON ul.target_id = pc.id AND ul.target_type = 'case'
LEFT JOIN case_comments cc ON cc.case_id = pc.id
GROUP BY pc.id;

COMMENT ON VIEW v_case_stats IS '案例统计视图（点赞数、评论数）';


-- ========================================
-- 迁移完成提示
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '✅ 数据库迁移完成！';
    RAISE NOTICE '  - 已扩展 provider_cases 表，新增 show_in_inspiration 字段';
    RAISE NOTICE '  - 已创建 user_likes 表（点赞）';
    RAISE NOTICE '  - 已创建 case_comments 表（评论）';
    RAISE NOTICE '  - 已创建 sensitive_words 表（敏感词）';
    RAISE NOTICE '  - 已扩展 user_favorites 表（多类型收藏）';
    RAISE NOTICE '  - 已插入示例敏感词数据';
    RAISE NOTICE '  - 已创建统计视图 v_case_stats';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  下一步：';
    RAISE NOTICE '  1. 导入完整敏感词库（参考 server/scripts/import_sensitive_words.go）';
    RAISE NOTICE '  2. 重启服务使 GORM AutoMigrate 生效';
END $$;
