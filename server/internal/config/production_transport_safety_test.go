package config

import "testing"

func TestValidateProductionTransportSafety_RequiresHTTPSForRelease(t *testing.T) {
	t.Setenv("APP_ENV", AppEnvLocal)

	cfg := &Config{
		Server: ServerConfig{
			Mode:      "release",
			PublicURL: "http://api.example.com",
		},
	}

	if err := ValidateProductionTransportSafety(cfg); err == nil {
		t.Fatalf("expected release mode to require https public url")
	}
}

func TestValidateProductionTransportSafety_ProductionAllowsPrivateInfra(t *testing.T) {
	t.Setenv("APP_ENV", AppEnvProduction)
	t.Setenv("TINODE_DATABASE_DSN", "postgres://tinode:secret@tinode-db.internal:5432/tinode?sslmode=disable")

	cfg := &Config{
		Server: ServerConfig{
			Mode:      "release",
			PublicURL: "https://api.example.com",
		},
		Database: DatabaseConfig{
			Host:    "10.0.0.8",
			SSLMode: "disable",
		},
		Redis: RedisConfig{
			Host: "redis.internal",
		},
	}

	if err := ValidateProductionTransportSafety(cfg); err != nil {
		t.Fatalf("expected private infra target to pass, got %v", err)
	}
}

func TestValidateProductionTransportSafety_ProductionRejectsPublicRedis(t *testing.T) {
	t.Setenv("APP_ENV", AppEnvProduction)

	cfg := &Config{
		Server: ServerConfig{
			PublicURL: "https://api.example.com",
		},
		Database: DatabaseConfig{
			Host:    "db.internal",
			SSLMode: "disable",
		},
		Redis: RedisConfig{
			Host: "redis.example.com",
		},
	}

	if err := ValidateProductionTransportSafety(cfg); err == nil {
		t.Fatalf("expected production to reject public redis host")
	}
}

func TestValidateProductionTransportSafety_ProductionRejectsPublicTinodeWithoutTLS(t *testing.T) {
	t.Setenv("APP_ENV", AppEnvProduction)
	t.Setenv("TINODE_DATABASE_DSN", "postgres://tinode:secret@tinode.example.com:5432/tinode?sslmode=disable")

	cfg := &Config{
		Server: ServerConfig{
			PublicURL: "https://api.example.com",
		},
		Database: DatabaseConfig{
			Host:    "db.internal",
			SSLMode: "disable",
		},
		Redis: RedisConfig{
			Host: "redis.internal",
		},
	}

	if err := ValidateProductionTransportSafety(cfg); err == nil {
		t.Fatalf("expected public tinode dsn without tls to be rejected")
	}
}

func TestParsePostgresDSNHostAndSSLMode(t *testing.T) {
	tests := []struct {
		name        string
		raw         string
		wantHost    string
		wantSSLMode string
	}{
		{
			name:        "url dsn",
			raw:         "postgres://user:pass@db.example.internal:5432/tinode?sslmode=require",
			wantHost:    "db.example.internal",
			wantSSLMode: "require",
		},
		{
			name:        "key value dsn",
			raw:         "host=db.internal port=5432 user=postgres password=secret dbname=tinode sslmode=verify-full",
			wantHost:    "db.internal",
			wantSSLMode: "verify-full",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			host, sslmode, err := parsePostgresDSNHostAndSSLMode(tc.raw)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if host != tc.wantHost || sslmode != tc.wantSSLMode {
				t.Fatalf("parsePostgresDSNHostAndSSLMode() = (%q, %q), want (%q, %q)", host, sslmode, tc.wantHost, tc.wantSSLMode)
			}
		})
	}
}
