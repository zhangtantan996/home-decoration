package service

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// ==================== Supervisor Token Service ====================
// 复用统一 JWT 签名密钥和 Redis session 基础设施，但使用 supervisor: 前缀做域隔离
// 强化为“设备管理”逻辑：一个设备 ID 对应一个活跃会话。

const (
	supervisorTokenUseAccess  = "access"
	supervisorTokenUseRefresh = "refresh"

	supervisorAccessTokenTTL  = 20 * time.Minute
	supervisorRefreshTokenTTL = 14 * 24 * time.Hour
	MAX_SUPERVISOR_DEVICES    = 5 // 每个账号最大同时在线设备数
)

type supervisorIssuedToken struct {
	Token     string
	JTI       string
	SessionID string
	ExpiresAt time.Time
}

type supervisorTokenPair struct {
	AccessToken      string
	AccessJTI        string
	RefreshToken     string
	RefreshJTI       string
	SessionID        string
	AccessExpiresIn  int64
	RefreshExpiresIn int64
}

type SupervisorSessionMetadata struct {
	SessionID  string `json:"sessionId"`
	IP         string `json:"ip"`
	UserAgent  string `json:"userAgent"`
	DeviceID   string `json:"deviceId"`
	DeviceType string `json:"deviceType"`
	LastUsedAt string `json:"lastUsedAt"`
	CreatedAt  string `json:"createdAt"`
}

// IssueSupervisorTokenPair 为监理签发 access + refresh token pair
func IssueSupervisorTokenPair(accountID uint64, phone string, supervisorProfileID uint64, ip, userAgent, deviceID string) (*supervisorTokenPair, error) {
	return IssueSupervisorTokenPairWithSession(accountID, phone, supervisorProfileID, "", ip, userAgent, deviceID)
}

// IssueSupervisorTokenPairWithSession 签发 token pair；refresh rotation 时复用原 sid。
func IssueSupervisorTokenPairWithSession(accountID uint64, phone string, supervisorProfileID uint64, sessionID string, ip, userAgent, deviceID string) (*supervisorTokenPair, error) {
	if strings.TrimSpace(sessionID) == "" {
		sessionID = generateSupervisorSessionID()
	}

	access, err := generateSupervisorToken(accountID, phone, supervisorProfileID, supervisorTokenUseAccess, supervisorAccessTokenTTL, sessionID)
	if err != nil {
		return nil, fmt.Errorf("生成access token失败: %w", err)
	}

	refresh, err := generateSupervisorToken(accountID, phone, supervisorProfileID, supervisorTokenUseRefresh, supervisorRefreshTokenTTL, access.SessionID)
	if err != nil {
		return nil, fmt.Errorf("生成refresh token失败: %w", err)
	}

	pair := &supervisorTokenPair{
		AccessToken:      access.Token,
		AccessJTI:        access.JTI,
		RefreshToken:     refresh.Token,
		RefreshJTI:       refresh.JTI,
		SessionID:        access.SessionID,
		AccessExpiresIn:  int64(supervisorAccessTokenTTL.Seconds()),
		RefreshExpiresIn: int64(supervisorRefreshTokenTTL.Seconds()),
	}

	if err := registerSupervisorSessionTokenPair(pair); err != nil {
		return nil, err
	}

	// 注册 session index（用于并发控制和全局撤销）
	if err := registerSupervisorSessionIndex(accountID, pair.SessionID, deviceID); err != nil {
		// 非致命
		_ = err
	}

	// 注册 metadata
	if ip != "" || userAgent != "" || deviceID != "" {
		_ = RegisterSupervisorSessionMetadata(pair.SessionID, ip, userAgent, deviceID)
	}

	return pair, nil
}

func generateSupervisorToken(accountID uint64, phone string, supervisorProfileID uint64, tokenUse string, ttl time.Duration, sessionID string) (*supervisorIssuedToken, error) {
	if strings.TrimSpace(sessionID) == "" {
		sessionID = generateSupervisorSessionID()
	}

	jti := uuid.New().String()
	expiresAt := time.Now().Add(ttl)

	claims := jwt.MapClaims{
		"aud":          "supervisor",
		"sub":          fmt.Sprintf("supervisor:%d", accountID),
		"accountId":    accountID,
		"supervisorId": supervisorProfileID,
		"phone":        phone,
		"token_type":   "supervisor",
		"token_use":    tokenUse,
		"jti":          jti,
		"sid":          sessionID,
		"exp":          expiresAt.Unix(),
		"iat":          time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(jwtSecret)
	if err != nil {
		return nil, err
	}

	return &supervisorIssuedToken{
		Token:     signedToken,
		JTI:       jti,
		SessionID: sessionID,
		ExpiresAt: expiresAt,
	}, nil
}

func registerSupervisorSessionTokenPair(pair *supervisorTokenPair) error {
	if pair == nil {
		return nil
	}
	if err := registerSupervisorSessionToken(pair.SessionID, pair.AccessJTI, supervisorTokenUseAccess, time.Now().Add(supervisorAccessTokenTTL)); err != nil {
		return err
	}
	if err := registerSupervisorSessionToken(pair.SessionID, pair.RefreshJTI, supervisorTokenUseRefresh, time.Now().Add(supervisorRefreshTokenTTL)); err != nil {
		return err
	}
	return nil
}

func registerSupervisorSessionToken(sessionID, jti, tokenUse string, expiresAt time.Time) error {
	sessionID = strings.TrimSpace(sessionID)
	jti = strings.TrimSpace(jti)
	if sessionID == "" || jti == "" {
		return nil
	}

	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}

	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		ttl = time.Minute
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	key := supervisorSessionTokenKey(sessionID, jti)
	if err := redisClient.Set(ctx, key, tokenUse, ttl).Err(); err != nil {
		return fmt.Errorf("记录监理会话令牌失败: %w", err)
	}
	return nil
}

func supervisorSessionTokenKey(sessionID, jti string) string {
	return fmt.Sprintf("session:supervisor:%s:%s", strings.TrimSpace(sessionID), strings.TrimSpace(jti))
}

func registerSupervisorSessionIndex(accountID uint64, sessionID string, deviceID string) error {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	// 设备管理逻辑：如果该设备已有活跃会话，先撤销旧会话（确保一机一会话）
	if deviceID != "" {
		deviceMappingKey := fmt.Sprintf("session_device:supervisor:%d", accountID)
		oldSessionID, _ := redisClient.HGet(ctx, deviceMappingKey, deviceID).Result()
		if oldSessionID != "" && oldSessionID != sessionID {
			_ = RevokeSupervisorSession(oldSessionID)
			// 从老索引集合中移除
			indexKey := fmt.Sprintf("session_index:supervisor:%d", accountID)
			redisClient.SRem(ctx, indexKey, oldSessionID)
		}
		// 记录设备 ID 与当前会话 ID 的绑定
		redisClient.HSet(ctx, deviceMappingKey, deviceID, sessionID)
	}

	// 2. 限制多端登录数量（如果新设备加入导致超过限制，踢出最早的一个）
	deviceMappingKey := fmt.Sprintf("session_device:supervisor:%d", accountID)
	allDevices, _ := redisClient.HGetAll(ctx, deviceMappingKey).Result()

	activeSIDs := make([]string, 0)
	for _, sid := range allDevices {
		if IsSupervisorSessionActive(sid) {
			activeSIDs = append(activeSIDs, sid)
		}
	}

	if len(activeSIDs) > MAX_SUPERVISOR_DEVICES {
		// 精细化踢出：按最后活跃时间排序，踢出最久未使用的
		type sidWithTime struct {
			sid string
			t   time.Time
		}
		list := make([]sidWithTime, 0, len(activeSIDs))
		for _, sid := range activeSIDs {
			m, _ := GetSupervisorSessionMetadata(sid)
			t := time.Time{}
			if m != nil && m.LastUsedAt != "" {
				t, _ = time.Parse(time.RFC3339, m.LastUsedAt)
			}
			list = append(list, sidWithTime{sid, t})
		}

		sort.Slice(list, func(i, j int) bool {
			return list[i].t.Before(list[j].t)
		})

		oldestSID := list[0].sid
		_ = RevokeSupervisorSession(oldestSID)

		// 从索引中移除
		indexKey := fmt.Sprintf("session_index:supervisor:%d", accountID)
		redisClient.SRem(ctx, indexKey, oldestSID)
	}

	key := fmt.Sprintf("session_index:supervisor:%d", accountID)
	if err := redisClient.SAdd(ctx, key, sessionID).Err(); err != nil {
		return fmt.Errorf("记录监理会话索引失败: %w", err)
	}
	return nil
}

func SupervisorSessionBelongsToAccount(accountID uint64, sessionID string) bool {
	accountID = uint64(accountID)
	sessionID = strings.TrimSpace(sessionID)
	if accountID == 0 || sessionID == "" {
		return false
	}

	redisClient := repository.GetRedis()
	if redisClient == nil {
		return false
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	indexKey := fmt.Sprintf("session_index:supervisor:%d", accountID)
	belongs, err := redisClient.SIsMember(ctx, indexKey, sessionID).Result()
	return err == nil && belongs
}

// RevokeSupervisorSession 撤销单个 session
func RevokeSupervisorSession(sessionID string) error {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	pattern := supervisorSessionTokenKey(sessionID, "*")
	keys, err := redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		if err := redisClient.Del(ctx, keys...).Err(); err != nil {
			return err
		}
	}
	return nil
}

func RevokeSupervisorSessionForAccount(accountID uint64, sessionID string) error {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil
	}
	if !SupervisorSessionBelongsToAccount(accountID, sessionID) {
		return fmt.Errorf("会话不属于当前账号")
	}
	return RevokeSupervisorSession(sessionID)
}

// RevokeAllSupervisorSessions 撤销监理所有 session（禁用账号时调用）
func RevokeAllSupervisorSessions(accountID uint64) error {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	indexKey := fmt.Sprintf("session_index:supervisor:%d", accountID)
	sessionIDs, err := redisClient.SMembers(ctx, indexKey).Result()
	if err != nil {
		return err
	}

	for _, sid := range sessionIDs {
		_ = RevokeSupervisorSession(sid)
	}

	redisClient.Del(ctx, indexKey)
	return nil
}

func CountSupervisorActiveSessions(accountID uint64) int {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return 0
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	indexKey := fmt.Sprintf("session_index:supervisor:%d", accountID)
	sessionIDs, err := redisClient.SMembers(ctx, indexKey).Result()
	if err != nil {
		return 0
	}

	total := 0
	for _, sid := range sessionIDs {
		if IsSupervisorSessionActive(sid) {
			total++
		}
	}
	return total
}

// IsSupervisorSessionValid 校验监理 session 是否存活
func IsSupervisorSessionValid(sessionID, jti string, tokenUse string) bool {
	sessionID = strings.TrimSpace(sessionID)
	jti = strings.TrimSpace(jti)
	tokenUse = strings.TrimSpace(tokenUse)
	if sessionID == "" || jti == "" || tokenUse == "" {
		return false
	}

	redisClient := repository.GetRedis()
	if redisClient == nil {
		return allowSupervisorSessionWithoutRedis()
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	key := supervisorSessionTokenKey(sessionID, jti)
	val, err := redisClient.Get(ctx, key).Result()
	if err != nil || val == "" {
		return false
	}
	return val == tokenUse
}

// IsSupervisorSessionActive 检查 sid 下是否仍有任一有效 token，用于会话列表展示。
func IsSupervisorSessionActive(sessionID string) bool {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return false
	}

	redisClient := repository.GetRedis()
	if redisClient == nil {
		return allowSupervisorSessionWithoutRedis()
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	keys, err := redisClient.Keys(ctx, supervisorSessionTokenKey(sessionID, "*")).Result()
	return err == nil && len(keys) > 0
}

// ConsumeSupervisorRefreshToken 消费 refresh token（rotation: 旧 refresh 二次使用 → 撤销整个 session）
func ConsumeSupervisorRefreshToken(sessionID, jti string) (bool, error) {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		if allowSupervisorSessionWithoutRedis() {
			return true, nil
		}
		return false, fmt.Errorf("会话服务不可用")
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	key := supervisorSessionTokenKey(sessionID, jti)
	val, err := redisClient.Get(ctx, key).Result()
	if err != nil || val == "" {
		// token 不存在 = 可能已被使用过 → 撤销整条 session（replay 保护）
		_ = RevokeSupervisorSession(sessionID)
		return false, fmt.Errorf("refresh token 无效或已被使用")
	}

	if val != supervisorTokenUseRefresh {
		_ = RevokeSupervisorSession(sessionID)
		return false, fmt.Errorf("refresh token 已被使用")
	}

	// 删除旧 refresh token
	redisClient.Del(ctx, key)
	return true, nil
}

func generateSupervisorSessionID() string {
	return uuid.New().String()
}

func allowSupervisorSessionWithoutRedis() bool {
	cfg := config.GetConfig()
	return cfg == nil || !strings.EqualFold(strings.TrimSpace(cfg.Server.Mode), "release") || config.IsLocalLikeAppEnv()
}

func RegisterSupervisorSessionMetadata(sessionID, ip, userAgent, deviceID string) error {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	// 1. 存储会话相关的元数据（随会话销毁）
	sessionKey := fmt.Sprintf("session:supervisor:%s:metadata", sessionID)
	sessionData := map[string]interface{}{
		"ip":           ip,
		"user_agent":   userAgent,
		"device_id":    deviceID,
		"last_used_at": time.Now().Format(time.RFC3339),
	}
	_ = redisClient.HMSet(ctx, sessionKey, sessionData).Err()

	// 2. 存储设备级别的持久元数据（用于长期识别设备）
	if deviceID != "" {
		// 这里由于无法直接获取 accountID，我们通过传入的 sessionID 的上下文来推断或在调用处处理。
		// 实际上，我们可以在 RegisterSupervisorSessionMetadata 中增加 accountID 参数。
	}

	return nil
}

// RegisterSupervisorDeviceMetadata 存储持久设备信息
func RegisterSupervisorDeviceMetadata(accountID uint64, deviceID, ip, userAgent string) error {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()

	key := fmt.Sprintf("device_metadata:supervisor:%d:%s", accountID, deviceID)
	data := map[string]interface{}{
		"ip":           ip,
		"user_agent":   userAgent,
		"last_used_at": time.Now().Format(time.RFC3339),
	}
	// 记录首次发现时间
	exists, _ := redisClient.Exists(ctx, key).Result()
	if exists == 0 {
		data["created_at"] = time.Now().Format(time.RFC3339)
	}
	return redisClient.HMSet(ctx, key, data).Err()
}

func GetSupervisorDeviceMetadata(accountID uint64, deviceID string) (map[string]string, error) {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil, nil
	}
	ctx, cancel := repository.RedisContext()
	defer cancel()
	key := fmt.Sprintf("device_metadata:supervisor:%d:%s", accountID, deviceID)
	return redisClient.HGetAll(ctx, key).Result()
}

func GetSupervisorSessionMetadata(sessionID string) (*SupervisorSessionMetadata, error) {
	redisClient := repository.GetRedis()
	if redisClient == nil {
		return nil, fmt.Errorf("redis not available")
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	key := fmt.Sprintf("session:supervisor:%s:metadata", sessionID)
	val, err := redisClient.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(val) == 0 {
		return nil, nil
	}

	return &SupervisorSessionMetadata{
		SessionID:  sessionID,
		IP:         val["ip"],
		UserAgent:  val["user_agent"],
		DeviceID:   val["device_id"],
		LastUsedAt: val["last_used_at"],
		CreatedAt:  val["created_at"],
	}, nil
}
