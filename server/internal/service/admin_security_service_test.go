package service

import (
	"testing"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
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
