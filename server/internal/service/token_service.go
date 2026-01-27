package service

import (
	"errors"
	"fmt"
	"time"

	"home-decoration-server/internal/repository"

	"github.com/golang-jwt/jwt/v5"
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
	// 1. 解析 refresh token
	token, err := jwt.Parse(refreshToken, func(token *jwt.Token) (interface{}, error) {
		// 验证签名方法
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

	// 2. 提取 token 信息
	userID, ok := claims["userId"].(float64)
	if !ok {
		return nil, errors.New("刷新令牌格式错误：缺少 userId")
	}

	// 获取 jti 和 sid（用于重放检测和会话管理）
	jti, _ := claims["jti"].(string)
	sid, _ := claims["sid"].(string)

	if jti == "" {
		return nil, errors.New("刷新令牌格式错误：缺少 jti")
	}

	// 3. Redis 重放检测：检查 jti 是否已使用
	redisClient := repository.GetRedis()
	if redisClient != nil {
		key := fmt.Sprintf("refresh_token:%s", jti)
		exists, err := redisClient.Exists(repository.Ctx, key).Result()
		if err != nil {
			// Redis 错误不应阻止 token 刷新，但应记录日志
			fmt.Printf("[TokenService] Redis error checking jti: %v\n", err)
		} else if exists > 0 {
			// 检测到重放攻击！撤销整个会话
			if sid != "" {
				sessionKey := fmt.Sprintf("session:%s:*", sid)
				// 删除该会话的所有 token
				keys, _ := redisClient.Keys(repository.Ctx, sessionKey).Result()
				if len(keys) > 0 {
					redisClient.Del(repository.Ctx, keys...)
				}
			}
			return nil, errors.New("检测到令牌重放攻击，会话已撤销")
		}

		// 4. 标记当前 jti 为已使用（7 天过期）
		err = redisClient.Set(repository.Ctx, key, "used", 7*24*time.Hour).Err()
		if err != nil {
			fmt.Printf("[TokenService] Redis error marking jti as used: %v\n", err)
		}
	}

	// 5. 获取用户信息以生成新 token
	userService := &UserService{}
	user, err := userService.GetUserByID(uint64(userID))
	if err != nil {
		return nil, errors.New("用户不存在")
	}

	if user.Status != 1 {
		return nil, errors.New("账号已被禁用")
	}

	// 6. 获取用户的 activeRole 和 refID
	activeRole, refID, err := getUserActiveRoleAndRefID(user)
	if err != nil {
		return nil, err
	}

	// 7. 生成新的 access token 和 refresh token
	newAccessToken, err := generateTokenV2(uint64(userID), activeRole, refID)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := generateTokenV2(uint64(userID), activeRole, refID)
	if err != nil {
		return nil, err
	}

	return &RefreshTokensResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
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

	sessionKey := fmt.Sprintf("session:%s:*", sid)
	keys, err := redisClient.Keys(repository.Ctx, sessionKey).Result()
	if err != nil {
		return fmt.Errorf("查询会话失败: %w", err)
	}

	if len(keys) > 0 {
		if err := redisClient.Del(repository.Ctx, keys...).Err(); err != nil {
			return fmt.Errorf("撤销会话失败: %w", err)
		}
	}

	return nil
}
