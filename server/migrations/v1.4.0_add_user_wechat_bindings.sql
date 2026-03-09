-- 微信小程序绑定表
CREATE TABLE IF NOT EXISTS user_wechat_bindings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    app_id VARCHAR(64) NOT NULL,
    open_id VARCHAR(128) NOT NULL,
    union_id VARCHAR(128),
    bound_at TIMESTAMP NULL,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_wechat_openid UNIQUE (app_id, open_id),
    CONSTRAINT uq_user_wechat_user UNIQUE (app_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_wechat_unionid ON user_wechat_bindings(union_id);
