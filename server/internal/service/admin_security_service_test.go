package service

import (
	"testing"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestResolveSecurityStatusSkipsSetupInLocalEnv(t *testing.T) {
	t.Setenv("APP_ENV", config.AppEnvLocal)

	cfg := config.GetConfig()
	previousCfg := *cfg
	cfg.AdminAuth.TOTPEnabled = true
	cfg.AdminAuth.RequiredRoleKeys = "*"
	t.Cleanup(func() {
		*cfg = previousCfg
	})

	svc := NewAdminSecurityService()
	admin := &model.SysAdmin{
		Username:          "local-admin",
		MustResetPassword: true,
		TwoFactorEnabled:  false,
		IsSuperAdmin:      true,
	}

	status := svc.ResolveSecurityStatus(admin)

	if status.LoginStage != AdminLoginStageActive {
		t.Fatalf("expected active login stage in local env, got %s", status.LoginStage)
	}
	if status.SecuritySetupRequired {
		t.Fatalf("expected local env to skip setup enforcement")
	}
	if status.TwoFactorRequired {
		t.Fatalf("expected local env to skip two-factor requirement")
	}
	if svc.AdminRequiresTwoFactor(admin) {
		t.Fatalf("expected local env to bypass two-factor enforcement")
	}
}

func TestResolveSecurityStatusKeepsSetupInProductionEnv(t *testing.T) {
	t.Setenv("APP_ENV", config.AppEnvProduction)

	cfg := config.GetConfig()
	previousCfg := *cfg
	cfg.AdminAuth.TOTPEnabled = true
	cfg.AdminAuth.RequiredRoleKeys = "*"
	t.Cleanup(func() {
		*cfg = previousCfg
	})

	svc := NewAdminSecurityService()
	admin := &model.SysAdmin{
		Username:          "prod-admin",
		MustResetPassword: true,
		TwoFactorEnabled:  false,
		IsSuperAdmin:      true,
	}

	status := svc.ResolveSecurityStatus(admin)

	if status.LoginStage != AdminLoginStageSetupRequired {
		t.Fatalf("expected setup_required in production env, got %s", status.LoginStage)
	}
	if !status.SecuritySetupRequired {
		t.Fatalf("expected production env to enforce setup")
	}
	if !status.TwoFactorRequired {
		t.Fatalf("expected production env to require two-factor")
	}
	if !svc.AdminRequiresTwoFactor(admin) {
		t.Fatalf("expected production env to enforce two-factor")
	}
}

func TestEnsureAdminUnifiedIdentityRepairsStaleAdminProfile(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.SysAdmin{},
		&model.AdminProfile{},
		&model.UserIdentity{},
	); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	admin := model.SysAdmin{
		ID:       301,
		Username: "stale-admin",
		Phone:    "13800138001",
		Status:   1,
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("create admin failed: %v", err)
	}

	staleUser := model.User{
		Base:                model.Base{ID: 401},
		Phone:               "13800138001",
		Nickname:            "stale-user",
		UserType:            4,
		Status:              1,
		DefaultIdentityType: "admin",
	}
	if err := db.Create(&staleUser).Error; err != nil {
		t.Fatalf("create stale user failed: %v", err)
	}

	staleProfile := model.AdminProfile{
		Base:       model.Base{ID: 501},
		UserID:     staleUser.ID,
		SysAdminID: admin.ID,
		AdminType:  "regular",
		Status:     1,
	}
	if err := db.Create(&staleProfile).Error; err != nil {
		t.Fatalf("create stale admin profile failed: %v", err)
	}

	if err := db.Delete(&model.User{}, staleUser.ID).Error; err != nil {
		t.Fatalf("delete stale user failed: %v", err)
	}

	svc := NewAdminSecurityService()
	if err := svc.EnsureAdminUnifiedIdentity(&admin); err != nil {
		t.Fatalf("EnsureAdminUnifiedIdentity should repair stale profile, got error: %v", err)
	}

	var profiles []model.AdminProfile
	if err := db.Where("sys_admin_id = ?", admin.ID).Find(&profiles).Error; err != nil {
		t.Fatalf("query admin profiles failed: %v", err)
	}
	if len(profiles) != 1 {
		t.Fatalf("expected exactly one admin profile after repair, got %d", len(profiles))
	}
	if profiles[0].ID != staleProfile.ID {
		t.Fatalf("expected repaired profile id %d, got %d", staleProfile.ID, profiles[0].ID)
	}
	if profiles[0].UserID == staleUser.ID {
		t.Fatalf("expected stale profile user_id to be rebound, still got deleted user_id=%d", staleUser.ID)
	}

	var repairedUser model.User
	if err := db.First(&repairedUser, profiles[0].UserID).Error; err != nil {
		t.Fatalf("repaired linked user should exist: %v", err)
	}
	if repairedUser.DefaultIdentityType != "admin" {
		t.Fatalf("expected repaired user default identity admin, got %s", repairedUser.DefaultIdentityType)
	}

	var identity model.UserIdentity
	if err := db.Where("user_id = ? AND identity_type = 'admin'", repairedUser.ID).First(&identity).Error; err != nil {
		t.Fatalf("expected repaired admin identity record, got error: %v", err)
	}
	if identity.IdentityRefID == nil || *identity.IdentityRefID != profiles[0].ID {
		t.Fatalf("expected identity_ref_id=%d, got %v", profiles[0].ID, identity.IdentityRefID)
	}
}

func TestEnsureAdminUnifiedIdentityKeepsLinkedUserDefaultOwner(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.SysAdmin{},
		&model.AdminProfile{},
		&model.UserIdentity{},
	); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	admin := model.SysAdmin{
		ID:       701,
		Username: "normalize-admin",
		Phone:    "13800139001",
		Status:   1,
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("create admin failed: %v", err)
	}

	linkedUser := model.User{
		Base:                model.Base{ID: 702},
		Phone:               admin.Phone,
		Nickname:            "legacy-owner-user",
		UserType:            1,
		Status:              1,
		DefaultIdentityType: "owner",
	}
	if err := db.Create(&linkedUser).Error; err != nil {
		t.Fatalf("create linked user failed: %v", err)
	}

	profile := model.AdminProfile{
		Base:       model.Base{ID: 703},
		UserID:     linkedUser.ID,
		SysAdminID: admin.ID,
		AdminType:  "regular",
		Status:     1,
	}
	if err := db.Create(&profile).Error; err != nil {
		t.Fatalf("create admin profile failed: %v", err)
	}

	svc := NewAdminSecurityService()
	if err := svc.EnsureAdminUnifiedIdentity(&admin); err != nil {
		t.Fatalf("EnsureAdminUnifiedIdentity should keep existing linked user fields, got error: %v", err)
	}

	var normalizedUser model.User
	if err := db.First(&normalizedUser, linkedUser.ID).Error; err != nil {
		t.Fatalf("query normalized user failed: %v", err)
	}
	if normalizedUser.UserType != 1 {
		t.Fatalf("expected user_type to remain owner=1, got %d", normalizedUser.UserType)
	}
	if normalizedUser.DefaultIdentityType != "owner" {
		t.Fatalf("expected default identity to remain owner, got %s", normalizedUser.DefaultIdentityType)
	}

	var identity model.UserIdentity
	if err := db.Where("user_id = ? AND identity_type = 'admin'", linkedUser.ID).First(&identity).Error; err != nil {
		t.Fatalf("expected admin identity link, got error: %v", err)
	}
}

func TestEnsureAdminUnifiedIdentityFallsBackToDedicatedUserWhenPhoneUserReserved(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.SysAdmin{},
		&model.AdminProfile{},
		&model.UserIdentity{},
	); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	targetAdmin := model.SysAdmin{
		ID:       8801,
		Username: "target-admin",
		Phone:    "13800138888",
		Status:   1,
	}
	otherAdmin := model.SysAdmin{
		ID:       8802,
		Username: "other-admin",
		Phone:    "13800139999",
		Status:   1,
	}
	if err := db.Create(&targetAdmin).Error; err != nil {
		t.Fatalf("create target admin failed: %v", err)
	}
	if err := db.Create(&otherAdmin).Error; err != nil {
		t.Fatalf("create other admin failed: %v", err)
	}

	sharedUser := model.User{
		Base:                model.Base{ID: 9801},
		Phone:               targetAdmin.Phone,
		Nickname:            "shared-user",
		UserType:            1,
		Status:              1,
		DefaultIdentityType: "owner",
	}
	if err := db.Create(&sharedUser).Error; err != nil {
		t.Fatalf("create shared user failed: %v", err)
	}
	otherProfile := model.AdminProfile{
		Base:       model.Base{ID: 9802},
		UserID:     sharedUser.ID,
		SysAdminID: otherAdmin.ID,
		AdminType:  "regular",
		Status:     1,
	}
	if err := db.Create(&otherProfile).Error; err != nil {
		t.Fatalf("create other admin profile failed: %v", err)
	}

	svc := NewAdminSecurityService()
	if err := svc.EnsureAdminUnifiedIdentity(&targetAdmin); err != nil {
		t.Fatalf("EnsureAdminUnifiedIdentity failed: %v", err)
	}

	var targetProfile model.AdminProfile
	if err := db.Where("sys_admin_id = ?", targetAdmin.ID).First(&targetProfile).Error; err != nil {
		t.Fatalf("query target admin profile failed: %v", err)
	}
	if targetProfile.UserID == sharedUser.ID {
		t.Fatalf("expected target admin profile not reuse reserved shared user")
	}

	var dedicatedUser model.User
	if err := db.First(&dedicatedUser, targetProfile.UserID).Error; err != nil {
		t.Fatalf("query dedicated user failed: %v", err)
	}
	if dedicatedUser.Phone != "admin_8801" {
		t.Fatalf("expected dedicated phone admin_8801, got %s", dedicatedUser.Phone)
	}
	if dedicatedUser.DefaultIdentityType != "admin" {
		t.Fatalf("expected dedicated default identity admin, got %s", dedicatedUser.DefaultIdentityType)
	}

	var identity model.UserIdentity
	if err := db.Where("user_id = ? AND identity_type = 'admin' AND identity_ref_id = ?", targetProfile.UserID, targetProfile.ID).First(&identity).Error; err != nil {
		t.Fatalf("expected precise admin identity mapping, got error: %v", err)
	}
}

func TestEnsureAdminUnifiedIdentityIgnoresDisabledPhoneUser(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.SysAdmin{},
		&model.AdminProfile{},
		&model.UserIdentity{},
	); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	admin := model.SysAdmin{
		ID:       9901,
		Username: "disabled-phone-admin",
		Phone:    "13800139901",
		Status:   1,
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("create admin failed: %v", err)
	}

	disabledUser := model.User{
		Base:                model.Base{ID: 9911},
		Phone:               admin.Phone,
		Nickname:            "disabled-user",
		UserType:            1,
		Status:              0,
		DefaultIdentityType: "owner",
	}
	if err := db.Create(&disabledUser).Error; err != nil {
		t.Fatalf("create disabled user failed: %v", err)
	}
	if err := db.Model(&model.User{}).Where("id = ?", disabledUser.ID).Update("status", 0).Error; err != nil {
		t.Fatalf("force disabled user status failed: %v", err)
	}

	svc := NewAdminSecurityService()
	if err := svc.EnsureAdminUnifiedIdentity(&admin); err != nil {
		t.Fatalf("EnsureAdminUnifiedIdentity failed: %v", err)
	}

	var profile model.AdminProfile
	if err := db.Where("sys_admin_id = ?", admin.ID).First(&profile).Error; err != nil {
		t.Fatalf("query admin profile failed: %v", err)
	}
	if profile.UserID == disabledUser.ID {
		t.Fatalf("expected disabled phone user not to be reused")
	}

	var user model.User
	if err := db.First(&user, profile.UserID).Error; err != nil {
		t.Fatalf("query linked user failed: %v", err)
	}
	if user.Phone != "admin_9901" {
		t.Fatalf("expected dedicated user phone admin_9901, got %s", user.Phone)
	}
	if user.Status != 1 {
		t.Fatalf("expected dedicated user status=1, got %d", user.Status)
	}
}

func TestEnsureAdminUnifiedIdentityConvergesDuplicateAdminIdentities(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.SysAdmin{},
		&model.AdminProfile{},
		&model.UserIdentity{},
	); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}

	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = previousDB
	})

	admin := model.SysAdmin{
		ID:       99101,
		Username: "dedupe-admin",
		Phone:    "13800136666",
		Status:   1,
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("create admin failed: %v", err)
	}

	user := model.User{
		Base:                model.Base{ID: 99102},
		Phone:               admin.Phone,
		Nickname:            "dedupe-user",
		UserType:            1,
		Status:              1,
		DefaultIdentityType: "owner",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user failed: %v", err)
	}

	profile := model.AdminProfile{
		Base:       model.Base{ID: 99103},
		UserID:     user.ID,
		SysAdminID: admin.ID,
		AdminType:  "regular",
		Status:     1,
	}
	if err := db.Create(&profile).Error; err != nil {
		t.Fatalf("create profile failed: %v", err)
	}

	oldRef := uint64(88001)
	legacyIdentity := model.UserIdentity{
		Base:          model.Base{ID: 99110},
		UserID:        user.ID,
		IdentityType:  "admin",
		IdentityRefID: &oldRef,
		Status:        1,
		Verified:      true,
	}
	if err := db.Create(&legacyIdentity).Error; err != nil {
		t.Fatalf("create legacy identity failed: %v", err)
	}

	nullableIdentity := model.UserIdentity{
		Base:         model.Base{ID: 99111},
		UserID:       user.ID,
		IdentityType: "admin",
		Status:       1,
		Verified:     true,
	}
	if err := db.Create(&nullableIdentity).Error; err != nil {
		t.Fatalf("create nullable identity failed: %v", err)
	}

	svc := NewAdminSecurityService()
	if err := svc.EnsureAdminUnifiedIdentity(&admin); err != nil {
		t.Fatalf("EnsureAdminUnifiedIdentity failed: %v", err)
	}

	var identities []model.UserIdentity
	if err := db.Where("user_id = ? AND identity_type = ?", user.ID, "admin").Order("id ASC").Find(&identities).Error; err != nil {
		t.Fatalf("query identities failed: %v", err)
	}
	if len(identities) != 2 {
		t.Fatalf("expected 2 identities, got %d", len(identities))
	}

	activeCount := 0
	for _, identity := range identities {
		if identity.Status == 1 {
			activeCount += 1
			if identity.IdentityRefID == nil || *identity.IdentityRefID != profile.ID {
				t.Fatalf("active identity should point to current profile %d, got %v", profile.ID, identity.IdentityRefID)
			}
		}
	}
	if activeCount != 1 {
		t.Fatalf("expected exactly one active admin identity, got %d", activeCount)
	}

	for _, identity := range identities {
		if identity.Status != 1 && identity.Status != 3 {
			t.Fatalf("expected non-active identity to be suspended(status=3), got status=%d", identity.Status)
		}
	}
}
