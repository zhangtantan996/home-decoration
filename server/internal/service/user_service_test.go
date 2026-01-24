package service

import (
	"database/sql"
	"encoding/base64"
	"strings"
	"sync"
	"testing"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	sqlite3 "github.com/mattn/go-sqlite3"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

const (
	testPhone    = "13812345678"
	testPassword = "Passw0rd!"
)

var sqliteWithNowOnce sync.Once

func setupMainDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open main db: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("auto migrate user: %v", err)
	}

	repository.DB = db
	t.Cleanup(func() {
		repository.DB = nil
		_ = sqlDB.Close()
	})

	return db
}

func setupTinodeDBWithRollbackTrigger(t *testing.T) *gorm.DB {
	t.Helper()

	sqliteWithNowOnce.Do(func() {
		sql.Register("sqlite3_with_now", &sqlite3.SQLiteDriver{
			ConnectHook: func(conn *sqlite3.SQLiteConn) error {
				return conn.RegisterFunc("NOW", func() string {
					return time.Now().UTC().Format("2006-01-02 15:04:05")
				}, true)
			},
		})
	})

	db, err := gorm.Open(gormsqlite.Dialector{
		DriverName: "sqlite3_with_now",
		DSN:        ":memory:",
	}, &gorm.Config{})
	if err != nil {
		t.Fatalf("open tinode db: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get tinode sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	if err := db.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY,
			createdat TEXT,
			updatedat TEXT,
			state INTEGER,
			access BLOB,
			public BLOB
		)
	`).Error; err != nil {
		t.Fatalf("create tinode users table: %v", err)
	}

	if err := db.Exec(`
		CREATE TRIGGER users_fail_insert
		AFTER INSERT ON users
		BEGIN
			SELECT RAISE(ROLLBACK, 'forced rollback');
		END;
	`).Error; err != nil {
		t.Fatalf("create tinode rollback trigger: %v", err)
	}

	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	return db
}

func setValidTinodeEnv(t *testing.T) {
	t.Helper()
	t.Setenv("TINODE_UID_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("1234567890abcdef")))
	t.Setenv("TINODE_AUTH_TOKEN_KEY", base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
}

func setInvalidTinodeEnv(t *testing.T) {
	t.Helper()
	t.Setenv("TINODE_UID_ENCRYPTION_KEY", "")
	t.Setenv("TINODE_AUTH_TOKEN_KEY", "")
}

func insertUser(t *testing.T, db *gorm.DB, user *model.User) {
	t.Helper()
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("insert user: %v", err)
	}
}

func mustHashPassword(t *testing.T, raw string) string {
	t.Helper()
	hashed, err := HashPassword(raw)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	return hashed
}

func countTinodeUsers(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var count int64
	if err := db.Table("users").Count(&count).Error; err != nil {
		t.Fatalf("count tinode users: %v", err)
	}
	return count
}

func intPtr(v int) *int {
	return &v
}

func int64Ptr(v int64) *int64 {
	return &v
}

func int8Ptr(v int8) *int8 {
	return &v
}

func TestUserService_Register(t *testing.T) {
	svc := &UserService{}
	cfg := &config.JWTConfig{ExpireHour: 1}

	cases := []struct {
		name              string
		req               RegisterRequest
		setup             func(t *testing.T, db *gorm.DB)
		wantErr           bool
		wantUserType      *int8
		wantTinodeError   bool
		wantTinodeToken   bool
		wantHashedPass    bool
		wantTinodeUserCnt *int64
	}{
		{
			name: "invalid_phone",
			req: RegisterRequest{
				Phone: "123",
				Code:  "123456",
			},
			wantErr: true,
		},
		{
			name: "invalid_code",
			req: RegisterRequest{
				Phone: testPhone,
				Code:  "000000",
			},
			wantErr: true,
		},
		{
			name: "duplicate_phone",
			req: RegisterRequest{
				Phone: testPhone,
				Code:  "123456",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				insertUser(t, db, &model.User{
					Phone:  testPhone,
					Status: 1,
				})
			},
			wantErr: true,
		},
		{
			name: "weak_password",
			req: RegisterRequest{
				Phone:    testPhone,
				Code:     "123456",
				Password: "short",
			},
			wantErr: true,
		},
		{
			name: "success_tinode_token_error",
			req: RegisterRequest{
				Phone:    testPhone,
				Code:     "123456",
				Password: testPassword,
				Nickname: "tester",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				setInvalidTinodeEnv(t)
			},
			wantUserType:    int8Ptr(1),
			wantTinodeError: true,
			wantHashedPass:  true,
		},
		{
			name: "success_tinode_sync_rollback",
			req: RegisterRequest{
				Phone:    testPhone,
				Code:     "123456",
				Nickname: "worker",
				UserType: 2,
			},
			setup: func(t *testing.T, db *gorm.DB) {
				setValidTinodeEnv(t)
				tinodeDB := setupTinodeDBWithRollbackTrigger(t)
				repository.TinodeDB = tinodeDB
				t.Cleanup(func() {
					repository.TinodeDB = nil
				})
			},
			wantUserType:      int8Ptr(2),
			wantTinodeToken:   true,
			wantTinodeUserCnt: int64Ptr(0),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := setupMainDB(t)
			repository.TinodeDB = nil
			InitJWT("test-secret")

			if tc.setup != nil {
				tc.setup(t, db)
			}

			token, user, err := svc.Register(&tc.req, cfg)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error")
				}
				if token != nil || user != nil {
					t.Fatalf("expected nil token/user on error")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if token == nil || user == nil {
				t.Fatalf("expected token and user")
			}
			if user.ID == 0 {
				t.Fatalf("expected user ID to be set")
			}
			if token.Token == "" || token.RefreshToken == "" {
				t.Fatalf("expected token and refresh token")
			}
			if token.ExpiresIn != int64(cfg.ExpireHour*3600) {
				t.Fatalf("unexpected expiresIn: %d", token.ExpiresIn)
			}
			if tc.wantUserType != nil && user.UserType != *tc.wantUserType {
				t.Fatalf("unexpected user type: %d", user.UserType)
			}
			if tc.wantHashedPass {
				if user.Password == "" {
					t.Fatalf("expected hashed password")
				}
				if user.Password == tc.req.Password {
					t.Fatalf("password should be hashed")
				}
				if !CheckPassword(tc.req.Password, user.Password) {
					t.Fatalf("hashed password mismatch")
				}
			}
			if tc.wantTinodeError {
				if token.TinodeError == "" || !strings.Contains(token.TinodeError, "Tinode token generation failed") {
					t.Fatalf("expected tinode error")
				}
				if token.TinodeToken != "" {
					t.Fatalf("expected empty tinode token on error")
				}
			}
			if tc.wantTinodeToken {
				if token.TinodeToken == "" {
					t.Fatalf("expected tinode token")
				}
				if token.TinodeError != "" {
					t.Fatalf("expected no tinode error")
				}
			}
			if tc.wantTinodeUserCnt != nil {
				if repository.TinodeDB == nil {
					t.Fatalf("expected tinode db")
				}
				count := countTinodeUsers(t, repository.TinodeDB)
				if count != *tc.wantTinodeUserCnt {
					t.Fatalf("unexpected tinode user count: %d", count)
				}
			}
		})
	}
}

func TestUserService_Login(t *testing.T) {
	svc := &UserService{}
	cfg := &config.JWTConfig{ExpireHour: 1}

	cases := []struct {
		name              string
		req               LoginRequest
		setup             func(t *testing.T, db *gorm.DB)
		wantErr           bool
		wantTinodeError   bool
		wantTinodeToken   bool
		wantNickSuffix    string
		wantFailedCount   *int
		wantTinodeUserCnt *int64
	}{
		{
			name: "invalid_phone",
			req: LoginRequest{
				Phone: testPhone[:3],
				Code:  "123456",
				Type:  "code",
			},
			wantErr: true,
		},
		{
			name: "password_missing",
			req: LoginRequest{
				Phone: testPhone,
				Type:  "password",
			},
			wantErr: true,
		},
		{
			name: "invalid_code",
			req: LoginRequest{
				Phone: testPhone,
				Code:  "000000",
				Type:  "code",
			},
			wantErr: true,
		},
		{
			name: "password_user_not_found",
			req: LoginRequest{
				Phone:    testPhone,
				Password: testPassword,
				Type:     "password",
			},
			wantErr: true,
		},
		{
			name: "code_login_auto_create",
			req: LoginRequest{
				Phone: testPhone,
				Code:  "123456",
				Type:  "code",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				setValidTinodeEnv(t)
			},
			wantTinodeToken: true,
			wantNickSuffix:  testPhone[7:],
		},
		{
			name: "locked_account",
			req: LoginRequest{
				Phone: testPhone,
				Code:  "123456",
				Type:  "code",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				lockedUntil := time.Now().Add(10 * time.Minute)
				insertUser(t, db, &model.User{
					Phone:       testPhone,
					Status:      1,
					LockedUntil: &lockedUntil,
				})
			},
			wantErr: true,
		},
		{
			name: "disabled_account",
			req: LoginRequest{
				Phone: testPhone,
				Code:  "123456",
				Type:  "code",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				insertUser(t, db, &model.User{
					Phone:  testPhone,
					Status: 0,
				})
			},
			wantErr: true,
		},
		{
			name: "password_wrong_increments_count",
			req: LoginRequest{
				Phone:    testPhone,
				Password: "WrongPass1!",
				Type:     "password",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				hashed := mustHashPassword(t, testPassword)
				insertUser(t, db, &model.User{
					Phone:    testPhone,
					Password: hashed,
					Status:   1,
				})
			},
			wantErr:         true,
			wantFailedCount: intPtr(1),
		},
		{
			name: "password_login_success",
			req: LoginRequest{
				Phone:    testPhone,
				Password: testPassword,
				Type:     "password",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				setValidTinodeEnv(t)
				hashed := mustHashPassword(t, testPassword)
				insertUser(t, db, &model.User{
					Phone:    testPhone,
					Password: hashed,
					Status:   1,
				})
			},
			wantTinodeToken: true,
		},
		{
			name: "tinode_token_error_does_not_block",
			req: LoginRequest{
				Phone: testPhone,
				Code:  "123456",
				Type:  "code",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				setInvalidTinodeEnv(t)
				failedAt := time.Now().Add(-5 * time.Minute)
				insertUser(t, db, &model.User{
					Phone:             testPhone,
					Status:            1,
					LoginFailedCount:  2,
					LastFailedLoginAt: &failedAt,
				})
			},
			wantTinodeError: true,
			wantFailedCount: intPtr(0),
		},
		{
			name: "tinode_sync_rollback_does_not_block",
			req: LoginRequest{
				Phone: testPhone,
				Code:  "123456",
				Type:  "code",
			},
			setup: func(t *testing.T, db *gorm.DB) {
				setValidTinodeEnv(t)
				tinodeDB := setupTinodeDBWithRollbackTrigger(t)
				repository.TinodeDB = tinodeDB
				t.Cleanup(func() {
					repository.TinodeDB = nil
				})
				insertUser(t, db, &model.User{
					Phone:  testPhone,
					Status: 1,
				})
			},
			wantTinodeToken:   true,
			wantTinodeUserCnt: int64Ptr(0),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := setupMainDB(t)
			repository.TinodeDB = nil
			InitJWT("test-secret")

			if tc.setup != nil {
				tc.setup(t, db)
			}

			token, user, err := svc.Login(&tc.req, cfg)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error")
				}
				if token != nil || user != nil {
					t.Fatalf("expected nil token/user on error")
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if token == nil || user == nil {
					t.Fatalf("expected token and user")
				}
				if user.ID == 0 {
					t.Fatalf("expected user ID to be set")
				}
				if token.Token == "" || token.RefreshToken == "" {
					t.Fatalf("expected token and refresh token")
				}
				if token.ExpiresIn != int64(cfg.ExpireHour*3600) {
					t.Fatalf("unexpected expiresIn: %d", token.ExpiresIn)
				}
				if tc.wantNickSuffix != "" {
					if user.Nickname == "" || !strings.HasSuffix(user.Nickname, tc.wantNickSuffix) {
						t.Fatalf("unexpected nickname: %s", user.Nickname)
					}
				}
				if tc.wantTinodeError {
					if token.TinodeError == "" || !strings.Contains(token.TinodeError, "Tinode token generation failed") {
						t.Fatalf("expected tinode error")
					}
					if token.TinodeToken != "" {
						t.Fatalf("expected empty tinode token on error")
					}
				}
				if tc.wantTinodeToken {
					if token.TinodeToken == "" {
						t.Fatalf("expected tinode token")
					}
					if token.TinodeError != "" {
						t.Fatalf("expected no tinode error")
					}
				}
			}

			if tc.wantFailedCount != nil {
				var stored model.User
				if err := db.Where("phone = ?", tc.req.Phone).First(&stored).Error; err != nil {
					t.Fatalf("load user: %v", err)
				}
				if stored.LoginFailedCount != *tc.wantFailedCount {
					t.Fatalf("unexpected login_failed_count: %d", stored.LoginFailedCount)
				}
				if *tc.wantFailedCount == 0 && stored.LastFailedLoginAt != nil {
					t.Fatalf("expected last_failed_login_at to be cleared")
				}
				if *tc.wantFailedCount > 0 && stored.LastFailedLoginAt == nil {
					t.Fatalf("expected last_failed_login_at to be set")
				}
			}

			if tc.wantTinodeUserCnt != nil {
				if repository.TinodeDB == nil {
					t.Fatalf("expected tinode db")
				}
				count := countTinodeUsers(t, repository.TinodeDB)
				if count != *tc.wantTinodeUserCnt {
					t.Fatalf("unexpected tinode user count: %d", count)
				}
			}
		})
	}
}
