package config

import "testing"

func TestValidateDatabaseSafety_LocalAllowsLocalTargets(t *testing.T) {
	if err := validateDatabaseSafety(AppEnvLocal, "localhost", "home_decoration", "http://localhost:8080"); err != nil {
		t.Fatalf("expected local target to pass, got %v", err)
	}
}

func TestValidateDatabaseSafety_LocalRejectsSuspiciousProdHost(t *testing.T) {
	if err := validateDatabaseSafety(AppEnvLocal, "prod-db.example.com", "home_decoration", "http://localhost:8080"); err == nil {
		t.Fatalf("expected local env to reject suspicious production host")
	}
}

func TestValidateDatabaseSafety_TestRequiresTaggedTarget(t *testing.T) {
	if err := validateDatabaseSafety(AppEnvTest, "db.internal", "home_decoration", "http://127.0.0.1:8080"); err == nil {
		t.Fatalf("expected test env to require test-tagged target")
	}

	if err := validateDatabaseSafety(AppEnvTest, "test-db.internal", "home_decoration_test", "http://127.0.0.1:8080"); err != nil {
		t.Fatalf("expected test env target to pass, got %v", err)
	}
}

func TestValidateDatabaseSafety_StagingRequiresTaggedTarget(t *testing.T) {
	if err := validateDatabaseSafety(AppEnvStaging, "db.internal", "home_decoration", "https://admin-staging.example.com"); err == nil {
		t.Fatalf("expected staging env to require staging-tagged target")
	}

	if err := validateDatabaseSafety(AppEnvStaging, "staging-db.internal", "home_decoration_staging", "https://admin-staging.example.com"); err != nil {
		t.Fatalf("expected staging env target to pass, got %v", err)
	}
}

func TestValidateDatabaseSafety_ProductionRejectsTaggedTargets(t *testing.T) {
	if err := validateDatabaseSafety(AppEnvProduction, "prod-db.internal", "home_decoration_test", "https://api.example.com"); err == nil {
		t.Fatalf("expected production env to reject test database")
	}

	if err := validateDatabaseSafety(AppEnvProduction, "prod-db.internal", "home_decoration", "https://api.example.com"); err != nil {
		t.Fatalf("expected production env target to pass, got %v", err)
	}
}
