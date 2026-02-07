package dto

import "home-decoration-server/internal/model"

// UserIdentity is a stable API DTO for external user identifiers.
type UserIdentity struct {
	UserID       uint64 `json:"userId"`
	UserPublicID string `json:"userPublicId,omitempty"`
}

func NewUserIdentity(user *model.User) UserIdentity {
	if user == nil {
		return UserIdentity{}
	}
	return UserIdentity{
		UserID:       user.ID,
		UserPublicID: user.PublicID,
	}
}

func NewUserIdentityFromRaw(userID uint64, userPublicID string) UserIdentity {
	return UserIdentity{
		UserID:       userID,
		UserPublicID: userPublicID,
	}
}
