package tinode

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/utils/image"

	sqlite3 "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/xtea"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

const sqliteWithNowDriver = "sqlite3_with_now"

var registerSQLiteWithNowOnce sync.Once

func openSQLiteWithNow(t *testing.T) *gorm.DB {
	t.Helper()

	registerSQLiteWithNowOnce.Do(func() {
		sql.Register(sqliteWithNowDriver, &sqlite3.SQLiteDriver{
			ConnectHook: func(conn *sqlite3.SQLiteConn) error {
				return conn.RegisterFunc("NOW", func() string {
					return time.Now().UTC().Format("2006-01-02 15:04:05")
				}, false)
			},
		})
	})

	sqlDB, err := sql.Open(sqliteWithNowDriver, ":memory:")
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })

	db, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatalf("open gorm db: %v", err)
	}
	return db
}

func createUsersTable(t *testing.T, db *gorm.DB) {
	t.Helper()

	if err := db.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY,
			createdat DATETIME,
			updatedat DATETIME,
			state INTEGER,
			access BLOB,
			public BLOB
		)
	`).Error; err != nil {
		t.Fatalf("create users table: %v", err)
	}
}

func expectedTinodeUID(t *testing.T, uidKey []byte, userID uint64) uint64 {
	t.Helper()

	cipher, err := xtea.NewCipher(uidKey)
	if err != nil {
		t.Fatalf("init xtea cipher: %v", err)
	}

	src := make([]byte, 8)
	dst := make([]byte, 8)
	binary.LittleEndian.PutUint64(src, userID)
	cipher.Encrypt(dst, src)
	return binary.LittleEndian.Uint64(dst)
}

func expectedTinodeUserID(t *testing.T, uidKey []byte, userID uint64) string {
	t.Helper()

	uid := expectedTinodeUID(t, uidKey, userID)
	buf := make([]byte, 8)
	binary.LittleEndian.PutUint64(buf, uid)
	return "usr" + base64.RawURLEncoding.EncodeToString(buf)
}

func TestValidateConfig(t *testing.T) {
	cases := []struct {
		name        string
		uidKey      string
		tokenKey    string
		wantErr     bool
		errContains string
	}{
		{
			name:        "missing uid key",
			uidKey:      "",
			tokenKey:    "token",
			wantErr:     true,
			errContains: "TINODE_UID_ENCRYPTION_KEY",
		},
		{
			name:        "missing token key",
			uidKey:      "uid",
			tokenKey:    "",
			wantErr:     true,
			errContains: "TINODE_AUTH_TOKEN_KEY",
		},
		{
			name:     "all set",
			uidKey:   "uid",
			tokenKey: "token",
			wantErr:  false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("TINODE_UID_ENCRYPTION_KEY", tc.uidKey)
			t.Setenv("TINODE_AUTH_TOKEN_KEY", tc.tokenKey)

			err := ValidateConfig()
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error")
				}
				if tc.errContains != "" && !strings.Contains(err.Error(), tc.errContains) {
					t.Fatalf("expected error to contain %q, got %v", tc.errContains, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestUserIDToTinodeUserID(t *testing.T) {
	validUIDKey := []byte("0123456789ABCDEF")
	validUIDKeyB64 := base64.StdEncoding.EncodeToString(validUIDKey)
	shortUIDKeyB64 := base64.StdEncoding.EncodeToString([]byte("123456789012345"))
	maxInt64 := uint64(^uint64(0) >> 1)

	cases := []struct {
		name        string
		uidKey      string
		uidKeyBytes []byte
		userID      uint64
		wantErr     bool
		errContains string
	}{
		{
			name:        "missing uid key",
			uidKey:      "",
			userID:      1,
			wantErr:     true,
			errContains: "TINODE_UID_ENCRYPTION_KEY",
		},
		{
			name:        "invalid base64 uid key",
			uidKey:      "not_base64",
			userID:      1,
			wantErr:     true,
			errContains: "decode TINODE_UID_ENCRYPTION_KEY",
		},
		{
			name:        "uid key wrong length",
			uidKey:      shortUIDKeyB64,
			userID:      1,
			wantErr:     true,
			errContains: "must decode to 16 bytes",
		},
		{
			name:        "user id too large",
			uidKey:      validUIDKeyB64,
			uidKeyBytes: validUIDKey,
			userID:      maxInt64 + 1,
			wantErr:     true,
			errContains: "userID too large",
		},
		{
			name:        "success",
			uidKey:      validUIDKeyB64,
			uidKeyBytes: validUIDKey,
			userID:      42,
			wantErr:     false,
		},
		{
			name:        "max int64 allowed",
			uidKey:      validUIDKeyB64,
			uidKeyBytes: validUIDKey,
			userID:      maxInt64,
			wantErr:     false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("TINODE_UID_ENCRYPTION_KEY", tc.uidKey)

			got, err := UserIDToTinodeUserID(tc.userID)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error")
				}
				if tc.errContains != "" && !strings.Contains(err.Error(), tc.errContains) {
					t.Fatalf("expected error to contain %q, got %v", tc.errContains, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.uidKeyBytes == nil {
				t.Fatalf("test case missing uidKeyBytes")
			}

			want := expectedTinodeUserID(t, tc.uidKeyBytes, tc.userID)
			if got != want {
				t.Fatalf("expected %q, got %q", want, got)
			}
		})
	}
}

func TestGenerateTinodeToken(t *testing.T) {
	uidKey := []byte("0123456789ABCDEF")
	uidKeyB64 := base64.StdEncoding.EncodeToString(uidKey)
	shortUIDKeyB64 := base64.StdEncoding.EncodeToString([]byte("123456789012345"))

	tokenKey := bytes.Repeat([]byte{0x11}, sha256.Size)
	tokenKeyB64 := base64.StdEncoding.EncodeToString(tokenKey)
	shortTokenKeyB64 := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{0x22}, sha256.Size-1))

	maxInt64 := uint64(^uint64(0) >> 1)

	cases := []struct {
		name          string
		uidKey        string
		uidKeyBytes   []byte
		tokenKey      string
		tokenKeyBytes []byte
		userID        uint64
		wantErr       bool
		errContains   string
	}{
		{
			name:        "missing token key",
			uidKey:      uidKeyB64,
			tokenKey:    "",
			userID:      1,
			wantErr:     true,
			errContains: "TINODE_AUTH_TOKEN_KEY",
		},
		{
			name:        "invalid token key base64",
			uidKey:      uidKeyB64,
			tokenKey:    "not_base64",
			userID:      1,
			wantErr:     true,
			errContains: "decode TINODE_AUTH_TOKEN_KEY",
		},
		{
			name:        "token key too short",
			uidKey:      uidKeyB64,
			tokenKey:    shortTokenKeyB64,
			userID:      1,
			wantErr:     true,
			errContains: "too short",
		},
		{
			name:        "missing uid key",
			uidKey:      "",
			tokenKey:    tokenKeyB64,
			userID:      1,
			wantErr:     true,
			errContains: "TINODE_UID_ENCRYPTION_KEY",
		},
		{
			name:        "uid key wrong length",
			uidKey:      shortUIDKeyB64,
			tokenKey:    tokenKeyB64,
			userID:      1,
			wantErr:     true,
			errContains: "must decode to 16 bytes",
		},
		{
			name:        "user id too large",
			uidKey:      uidKeyB64,
			tokenKey:    tokenKeyB64,
			userID:      maxInt64 + 1,
			wantErr:     true,
			errContains: "userID too large",
		},
		{
			name:          "success",
			uidKey:        uidKeyB64,
			uidKeyBytes:   uidKey,
			tokenKey:      tokenKeyB64,
			tokenKeyBytes: tokenKey,
			userID:        99,
			wantErr:       false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("TINODE_UID_ENCRYPTION_KEY", tc.uidKey)
			t.Setenv("TINODE_AUTH_TOKEN_KEY", tc.tokenKey)

			start := time.Now().UTC()
			token, err := GenerateTinodeToken(tc.userID, "tester")
			end := time.Now().UTC()

			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error")
				}
				if tc.errContains != "" && !strings.Contains(err.Error(), tc.errContains) {
					t.Fatalf("expected error to contain %q, got %v", tc.errContains, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			decoded, err := base64.StdEncoding.DecodeString(token)
			if err != nil {
				t.Fatalf("decode token: %v", err)
			}

			payloadSize := binary.Size(tokenLayout{})
			if payloadSize <= 0 {
				t.Fatalf("unexpected token layout size: %d", payloadSize)
			}
			if len(decoded) != payloadSize+sha256.Size {
				t.Fatalf("unexpected token size: want %d, got %d", payloadSize+sha256.Size, len(decoded))
			}

			payload := decoded[:payloadSize]
			sig := decoded[payloadSize:]

			var tl tokenLayout
			if err := binary.Read(bytes.NewReader(payload), binary.LittleEndian, &tl); err != nil {
				t.Fatalf("decode token layout: %v", err)
			}

			if tl.AuthLevel != tinodeAuthLevelAuth {
				t.Errorf("unexpected auth level: want %d, got %d", tinodeAuthLevelAuth, tl.AuthLevel)
			}
			if tl.SerialNumber != 1 {
				t.Errorf("unexpected serial number: want 1, got %d", tl.SerialNumber)
			}
			if tl.Features != 0 {
				t.Errorf("unexpected features: want 0, got %d", tl.Features)
			}

			if tc.uidKeyBytes == nil || tc.tokenKeyBytes == nil {
				t.Fatalf("test case missing key bytes")
			}
			expectedUID := expectedTinodeUID(t, tc.uidKeyBytes, tc.userID)
			if tl.Uid != expectedUID {
				t.Errorf("unexpected uid: want %d, got %d", expectedUID, tl.Uid)
			}

			expires := time.Unix(int64(tl.Expires), 0).UTC()
			minExpires := start.Add(defaultTokenLifetime).Add(-2 * time.Second)
			maxExpires := end.Add(defaultTokenLifetime).Add(2 * time.Second)
			if expires.Before(minExpires) || expires.After(maxExpires) {
				t.Errorf("expires out of range: got %v, expected between %v and %v", expires, minExpires, maxExpires)
			}

			h := hmac.New(sha256.New, tc.tokenKeyBytes)
			_, _ = h.Write(payload)
			expectedSig := h.Sum(nil)
			if !hmac.Equal(sig, expectedSig) {
				t.Errorf("token signature mismatch")
			}
		})
	}
}

func TestSyncUserToTinodeWithTx_Errors(t *testing.T) {
	user := &model.User{
		Base:     model.Base{ID: 7},
		Nickname: "Tester",
		Avatar:   "avatar.png",
	}

	cases := []struct {
		name        string
		dbFactory   func(t *testing.T) *gorm.DB
		user        *model.User
		errContains string
	}{
		{
			name:        "nil user",
			dbFactory:   func(t *testing.T) *gorm.DB { return openSQLiteWithNow(t) },
			user:        nil,
			errContains: "user is nil",
		},
		{
			name:        "nil db",
			dbFactory:   func(t *testing.T) *gorm.DB { return nil },
			user:        user,
			errContains: "database connection is nil",
		},
		{
			name:        "missing users table",
			dbFactory:   func(t *testing.T) *gorm.DB { return openSQLiteWithNow(t) },
			user:        user,
			errContains: "no such table",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := tc.dbFactory(t)
			err := SyncUserToTinodeWithTx(db, tc.user)
			if err == nil {
				t.Fatalf("expected error")
			}
			if tc.errContains != "" && !strings.Contains(err.Error(), tc.errContains) {
				t.Fatalf("expected error to contain %q, got %v", tc.errContains, err)
			}
		})
	}
}

func TestSyncUserToTinodeWithTx_Upsert(t *testing.T) {
	insertUser := &model.User{
		Base:     model.Base{ID: 10},
		Nickname: "Alice",
		Avatar:   "avatars/alice.png",
	}
	updateUser := &model.User{
		Base:     model.Base{ID: 11},
		Nickname: "Bob",
		Avatar:   "avatars/bob.png",
	}

	cases := []struct {
		name  string
		setup func(t *testing.T, db *gorm.DB)
		user  *model.User
	}{
		{
			name: "insert new user",
			setup: func(t *testing.T, db *gorm.DB) {
				createUsersTable(t, db)
			},
			user: insertUser,
		},
		{
			name: "update existing user",
			setup: func(t *testing.T, db *gorm.DB) {
				createUsersTable(t, db)
				if err := db.Exec(
					"INSERT INTO users (id, createdat, updatedat, state, access, public) VALUES (?, ?, ?, ?, ?, ?)",
					updateUser.ID,
					time.Now().UTC(),
					time.Now().UTC(),
					0,
					[]byte("OLD"),
					[]byte(`{"fn":"old","photo":"old"}`),
				).Error; err != nil {
					t.Fatalf("seed user: %v", err)
				}
			},
			user: updateUser,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := openSQLiteWithNow(t)
			tc.setup(t, db)

			if err := SyncUserToTinodeWithTx(db, tc.user); err != nil {
				t.Fatalf("sync user: %v", err)
			}

			var count int64
			if err := db.Raw("SELECT COUNT(*) FROM users WHERE id = ?", tc.user.ID).Scan(&count).Error; err != nil {
				t.Fatalf("count users: %v", err)
			}
			if count != 1 {
				t.Fatalf("expected 1 user row, got %d", count)
			}

			row := db.Raw("SELECT access, public FROM users WHERE id = ?", tc.user.ID).Row()
			var accessBytes, publicBytes []byte
			if err := row.Scan(&accessBytes, &publicBytes); err != nil {
				t.Fatalf("scan user: %v", err)
			}
			if string(accessBytes) != `{"Auth":"JRWPAS","Anon":"N"}` {
				t.Errorf("unexpected access JSON: %s", string(accessBytes))
			}

			var public map[string]interface{}
			if err := json.Unmarshal(publicBytes, &public); err != nil {
				t.Fatalf("decode public JSON: %v", err)
			}

			fn, ok := public["fn"].(string)
			if !ok {
				t.Fatalf("expected public.fn to be string, got %T", public["fn"])
			}
			if fn != tc.user.Nickname {
				t.Errorf("unexpected public.fn: want %q, got %q", tc.user.Nickname, fn)
			}

			photo, ok := public["photo"].(string)
			if !ok {
				t.Fatalf("expected public.photo to be string, got %T", public["photo"])
			}
			expectedPhoto := image.GetFullImageURL(tc.user.Avatar)
			if photo != expectedPhoto {
				t.Errorf("unexpected public.photo: want %q, got %q", expectedPhoto, photo)
			}
		})
	}
}
