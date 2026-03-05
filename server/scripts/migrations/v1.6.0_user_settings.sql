-- v1.6.0_user_settings.sql
-- 用户设置、实名认证、登录设备、用户反馈

-- 1. 用户偏好设置表
CREATE TABLE IF NOT EXISTS user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- 隐私设置
    personalized_recommend BOOLEAN DEFAULT true,
    location_tracking BOOLEAN DEFAULT false,
    phone_visible BOOLEAN DEFAULT false,
    -- 通知设置
    notify_system BOOLEAN DEFAULT true,
    notify_project BOOLEAN DEFAULT true,
    notify_payment BOOLEAN DEFAULT true,
    notify_promo BOOLEAN DEFAULT false,
    notify_sound BOOLEAN DEFAULT true,
    notify_vibrate BOOLEAN DEFAULT true,
    -- 通用设置
    dark_mode BOOLEAN DEFAULT false,
    font_size VARCHAR(10) DEFAULT 'medium',
    language VARCHAR(5) DEFAULT 'zh',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 实名认证表
CREATE TABLE IF NOT EXISTS user_verifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    real_name VARCHAR(50) NOT NULL,
    id_card VARCHAR(20) NOT NULL,
    id_front_image VARCHAR(500),
    id_back_image VARCHAR(500),
    status SMALLINT DEFAULT 0, -- 0=待审核 1=已通过 2=已拒绝
    reject_reason VARCHAR(200),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_verifications_user_id ON user_verifications(user_id);

-- 4. 登录设备记录表
CREATE TABLE IF NOT EXISTS user_login_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(100),
    device_type VARCHAR(20), -- ios, android, web
    device_id VARCHAR(200),
    ip_address VARCHAR(50),
    location VARCHAR(100),
    last_login_at TIMESTAMP DEFAULT NOW(),
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_login_devices_user_id ON user_login_devices(user_id);

-- 5. 用户反馈表
CREATE TABLE IF NOT EXISTS user_feedbacks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,  -- bug, feature, ui, other
    content TEXT NOT NULL,
    contact VARCHAR(100),
    images TEXT,  -- JSON array of image URLs
    status SMALLINT DEFAULT 0,  -- 0=待处理 1=处理中 2=已处理
    admin_reply TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_feedbacks_user_id ON user_feedbacks(user_id);
