package handler

import (
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func TestFindLegacyProviderLoginCandidateSkipsDanglingIdentityRef(t *testing.T) {
	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	user := model.User{
		Base:                model.Base{ID: 6101},
		Phone:               "13800136101",
		Nickname:            "provider-user",
		UserType:            1,
		Status:              1,
		DefaultIdentityType: "owner",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	provider := model.Provider{
		Base:         model.Base{ID: 6201},
		UserID:       user.ID,
		ProviderType: 3,
		SubType:      "foreman",
		Status:       merchantProviderStatusActive,
		Verified:     true,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider failed: %v", err)
	}

	validRef := provider.ID
	danglingRef := uint64(999999)
	identities := []model.UserIdentity{
		{
			Base:          model.Base{ID: 6301},
			UserID:        user.ID,
			IdentityType:  merchantIdentityTypeProvider,
			IdentityRefID: &validRef,
			Status:        merchantIdentityStatusActive,
			Verified:      true,
		},
		{
			Base:          model.Base{ID: 6302},
			UserID:        user.ID,
			IdentityType:  merchantIdentityTypeProvider,
			IdentityRefID: &danglingRef,
			Status:        merchantIdentityStatusActive,
			Verified:      true,
		},
	}
	if err := db.Create(&identities).Error; err != nil {
		t.Fatalf("create identities failed: %v", err)
	}

	candidate, err := findLegacyProviderLoginCandidate(db, user)
	if err != nil {
		t.Fatalf("find legacy provider candidate failed: %v", err)
	}
	if candidate == nil {
		t.Fatalf("expected candidate from fallback identity")
	}
	if candidate.ID != provider.ID {
		t.Fatalf("expected provider id=%d, got=%d", provider.ID, candidate.ID)
	}
}

func TestFindLegacyMaterialShopLoginCandidateSkipsDanglingIdentityRef(t *testing.T) {
	db := setupSQLiteDB(t)
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	user := model.User{
		Base:                model.Base{ID: 7101},
		Phone:               "13800137101",
		Nickname:            "shop-user",
		UserType:            1,
		Status:              1,
		DefaultIdentityType: "owner",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	shop := model.MaterialShop{
		Base:       model.Base{ID: 7201},
		UserID:     user.ID,
		Name:       "材料店A",
		IsVerified: true,
	}
	if err := db.Create(&shop).Error; err != nil {
		t.Fatalf("create material shop failed: %v", err)
	}

	validRef := shop.ID
	danglingRef := uint64(999998)
	identities := []model.UserIdentity{
		{
			Base:          model.Base{ID: 7301},
			UserID:        user.ID,
			IdentityType:  merchantIdentityTypeMaterial,
			IdentityRefID: &validRef,
			Status:        merchantIdentityStatusActive,
			Verified:      true,
		},
		{
			Base:          model.Base{ID: 7302},
			UserID:        user.ID,
			IdentityType:  merchantIdentityTypeMaterial,
			IdentityRefID: &danglingRef,
			Status:        merchantIdentityStatusActive,
			Verified:      true,
		},
	}
	if err := db.Create(&identities).Error; err != nil {
		t.Fatalf("create identities failed: %v", err)
	}

	candidate, err := findLegacyMaterialShopLoginCandidate(db, user)
	if err != nil {
		t.Fatalf("find legacy material-shop candidate failed: %v", err)
	}
	if candidate == nil {
		t.Fatalf("expected material-shop candidate from fallback identity")
	}
	if candidate.ID != shop.ID {
		t.Fatalf("expected shop id=%d, got=%d", shop.ID, candidate.ID)
	}
}
