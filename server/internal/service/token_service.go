package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"home-decoration-server/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

// TokenService Token 服务
type TokenService struct{}

// RefreshTokensRequest Refresh Token 请求
type RefreshTokensRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

// RefreshTokensResponse Refresh Token 响应
type RefreshTokensResponse struct {
	AccessToken  string `json:"token"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int64  `json:"expiresIn"`
}

// RefreshTokens 刷新 Token（带重放检测）
func (s *TokenService) RefreshTokens(refreshToken string) (*RefreshTokensResponse, error) {
	token, err := jwt.Parse(refreshToken, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("无效的签名方法")
		}
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("刷新令牌无效或已过期")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("刷新令牌格式错误")
	}

	userID, ok := claims["userId"].(float64)
	if !ok {
		return nil, errors.New("刷新令牌格式错误：缺少 userId")
	}

	if tokenUse, _ := claims["token_use"].(string); tokenUse != tokenUseRefresh {
		return nil, errors.New("刷新令牌格式错误：token_use 非 refresh")
	}

	jti, _ := claims["jti"].(string)
	sid, _ := claims["sid"].(string)
	if jti == "" || sid == "" {
		return nil, errors.New("刷新令牌格式错误")
	}

	redisClient := repository.GetRedis()
	if redisClient != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()

		sessionKey := sessionTokenKey(sid, jti)
		exists, existsErr := redisClient.Exists(ctx, sessionKey).Result()
		if existsErr != nil {
			fmt.Printf("[TokenService] Redis error checking session token: %v\n", existsErr)
		} else if exists == 0 {
			return nil, errors.New("会话已失效，请重新登录")
		}

		usedKey := fmt.Sprintf("refresh_token:used:%s", jti)
		usedTTL := ttlFromTokenClaims(claims)
		usedMarked, markErr := redisClient.SetNX(ctx, usedKey, "1", usedTTL).Result()
		if markErr != nil {
			fmt.Printf("[TokenService] Redis error marking jti as used: %v\n", markErr)
		} else if !usedMarked {
			_ = s.revokeSessionWithRedis(ctx, redisClient, sid)
			return nil, errors.New("检测到令牌重放攻击，会话已撤销")
		}

		// 消费掉旧 refresh token 的会话映射（单次可用）。
		_ = redisClient.Del(ctx, sessionKey).Err()
	}

	userService := &UserService{}
	user, err := userService.GetUserByID(uint64(userID))
	if err != nil {
		return nil, errors.New("用户不存在")
	}

	if user.Status != 1 {
		return nil, errors.New("账号已被禁用")
	}

	roleCtx, hasRoleContext := getRoleContextFromClaims(claims)
	if !hasRoleContext {
		resolvedCtx, resolveErr := getUserRoleContext(user)
		if resolveErr != nil {
			return nil, resolveErr
		}
		roleCtx = resolvedCtx
	}

	tokenPair, err := issueTokenPairV2(uint64(userID), user.PublicID, roleCtx, sid)
	if err != nil {
		return nil, err
	}

	return &RefreshTokensResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    2 * 3600, // 2 hours
	}, nil
}

// RevokeSession 撤销会话（撤销该会话的所有 token）
func (s *TokenService) RevokeSession(sid string) error {
	if sid == "" {
		return errors.New("会话ID不能为空")
	}

	redisClient := repository.GetRedis()
	if redisClient == nil {
		return errors.New("Redis 未初始化")
	}

	ctx, cancel := repository.RedisContext()
	defer cancel()

	return s.revokeSessionWithRedis(ctx, redisClient, sid)
}

func (s *TokenService) revokeSessionWithRedis(ctx context.Context, redisClient *redis.Client, sid string) error {
	pattern := fmt.Sprintf("session:%s:*", sid)
	var cursor uint64
	for {
		keys, nextCursor, err := redisClient.Scan(ctx, cursor, pattern, 200).Result()
		if err != nil {
			return fmt.Errorf("查询会话失败: %w", err)
		}
		if len(keys) > 0 {
			if err := redisClient.Del(ctx, keys...).Err(); err != nil {
				return fmt.Errorf("撤销会话失败: %w", err)
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

func ttlFromTokenClaims(claims jwt.MapClaims) time.Duration {
	expRaw, exists := claims["exp"]
	if !exists {
		return 7 * 24 * time.Hour
	}

	var expUnix int64
	switch value := expRaw.(type) {
	case float64:
		expUnix = int64(value)
	case int64:
		expUnix = value
	case int:
		expUnix = int64(value)
	default:
		return 7 * 24 * time.Hour
	}

	ttl := time.Until(time.Unix(expUnix, 0))
	if ttl <= 0 {
		return 5 * time.Minute
	}
	return ttl
}
