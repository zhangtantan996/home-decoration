package middleware

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// OptionalJWT parses Authorization header if present.
// It never blocks the request; it only sets user context when token is valid.
func OptionalJWT(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("invalid signing method")
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			c.Next()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.Next()
			return
		}

		if userID, ok := claimToUint64(claims["userId"]); ok {
			c.Set("userId", userID)
			if userPublicID, ok := claims["userPublicId"]; ok {
				c.Set("userPublicId", userPublicID)
			} else if sub, ok := claims["sub"]; ok {
				c.Set("userPublicId", sub)
			}
			if userType, ok := claims["userType"]; ok {
				c.Set("userType", userType)
			}
			if activeRoleRaw, ok := claims["activeRole"]; ok {
				if activeRole, ok := activeRoleRaw.(string); ok && activeRole != "" {
					c.Set("activeRole", activeRole)
				}
			}
			if providerID, ok := claimToUint64(claims["providerId"]); ok {
				c.Set("providerId", providerID)
			}
			if providerSubTypeRaw, ok := claims["providerSubType"]; ok {
				if providerSubType, ok := providerSubTypeRaw.(string); ok && providerSubType != "" {
					c.Set("providerSubType", providerSubType)
				}
			}
		}

		c.Next()
	}
}
