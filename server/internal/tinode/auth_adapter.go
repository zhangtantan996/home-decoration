package tinode

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/utils/image"

	"golang.org/x/crypto/xtea"
	"gorm.io/gorm"
)

// Tinode auth-token format (server/auth/token/auth_token.go in tinode/chat):
// [8:UID][4:expires][2:authLevel][2:serial-number][2:feature-bits][32:signature] = 50 bytes.
type tokenLayout struct {
	Uid          uint64
	Expires      uint32
	AuthLevel    uint16
	SerialNumber uint16
	Features     uint16
}

const (
	// Match Tinode's auth.LevelAuth (see tinode/chat server/auth/auth.go).
	tinodeAuthLevelAuth uint16 = 20
	// Default token lifetime: 2 weeks (matches Tinode's default expire_in=1209600).
	defaultTokenLifetime = 14 * 24 * time.Hour
)

// ValidateConfig checks that all required Tinode environment variables are set.
// This should be called at application startup to fail fast if configuration is missing.
func ValidateConfig() error {
	required := []string{
		"TINODE_UID_ENCRYPTION_KEY",
		"TINODE_AUTH_TOKEN_KEY",
	}
	for _, key := range required {
		if os.Getenv(key) == "" {
			return fmt.Errorf("required environment variable %s is not set", key)
		}
	}
	return nil
}

func mustDecodeBase64Env(name string) ([]byte, error) {
	val := os.Getenv(name)
	if val == "" {
		return nil, fmt.Errorf("%s is empty", name)
	}
	decoded, err := base64.StdEncoding.DecodeString(val)
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", name, err)
	}
	return decoded, nil
}

// encodeUserIDToTinodeUID converts our numeric userID into Tinode's internal Uid value.
//
// Tinode stores a decoded int64 in SQL databases for compatibility, while the protocol uses
// an encrypted 64-bit Uid (see tinode/chat server/store/types/uidgen.go).
//
// For our integration we use the app's userID as the decoded id in Tinode's users table, and
// derive the encrypted Uid using Tinode's UID_ENCRYPTION_KEY.
func encodeUserIDToTinodeUID(userID uint64) (uint64, error) {
	// Tinode uses a 16-byte XTEA key for UID encryption.
	uidKey, err := mustDecodeBase64Env("TINODE_UID_ENCRYPTION_KEY")
	if err != nil {
		return 0, err
	}
	if len(uidKey) != 16 {
		return 0, fmt.Errorf("TINODE_UID_ENCRYPTION_KEY must decode to 16 bytes, got %d", len(uidKey))
	}
	if userID > uint64(^uint64(0)>>1) {
		return 0, fmt.Errorf("userID too large for tinode int64 mapping: %d", userID)
	}

	cipher, err := xtea.NewCipher(uidKey)
	if err != nil {
		return 0, fmt.Errorf("init xtea cipher: %w", err)
	}

	src := make([]byte, 8)
	dst := make([]byte, 8)
	binary.LittleEndian.PutUint64(src, userID)
	cipher.Encrypt(dst, src)
	return binary.LittleEndian.Uint64(dst), nil
}

// UserIDToTinodeUserID converts an app numeric userID to Tinode user topic id, like `usrXXXX`.
//
// Tinode user id is: "usr" + base64url(no padding, little-endian 8 bytes of encrypted uid).
// See tinode/chat `types.Uid.UserId()`.
func UserIDToTinodeUserID(userID uint64) (string, error) {
	uid, err := encodeUserIDToTinodeUID(userID)
	if err != nil {
		return "", err
	}

	buf := make([]byte, 8)
	binary.LittleEndian.PutUint64(buf, uid)
	return "usr" + base64.RawURLEncoding.EncodeToString(buf), nil
}

// GenerateTinodeToken generates a Tinode-compatible HMAC token string for token auth.
//
// The returned string must be used as login.secret with scheme="token".
// It is NOT a JWT.
func GenerateTinodeToken(userID uint64, nickname string) (string, error) {
	_ = nickname // reserved for future use

	// Token signing key must match Tinode's auth_config.token.key.
	key, err := mustDecodeBase64Env("TINODE_AUTH_TOKEN_KEY")
	if err != nil {
		return "", err
	}
	if len(key) < sha256.Size {
		return "", fmt.Errorf("TINODE_AUTH_TOKEN_KEY too short: need >=%d bytes after base64 decode, got %d", sha256.Size, len(key))
	}

	uid, err := encodeUserIDToTinodeUID(userID)
	if err != nil {
		return "", err
	}

	expires := time.Now().Add(defaultTokenLifetime).UTC()

	tl := tokenLayout{
		Uid:          uid,
		Expires:      uint32(expires.Unix()),
		AuthLevel:    tinodeAuthLevelAuth,
		SerialNumber: 1,
		Features:     0,
	}

	payloadBuf := new(bytes.Buffer)
	if err := binary.Write(payloadBuf, binary.LittleEndian, &tl); err != nil {
		return "", fmt.Errorf("encode token payload: %w", err)
	}
	payload := payloadBuf.Bytes()

	h := hmac.New(sha256.New, key)
	_, _ = h.Write(payload)
	sig := h.Sum(nil)

	full := append(append([]byte{}, payload...), sig...)
	return base64.StdEncoding.EncodeToString(full), nil
}

// SyncUserToTinode upserts the user into tinode users table.
// Errors are returned to caller; caller should log and continue.
func SyncUserToTinode(user *model.User) error {
	if user == nil {
		return errors.New("user is nil")
	}
	if repository.TinodeDB == nil {
		return errors.New("tinode db is not initialized")
	}

	return SyncUserToTinodeWithTx(repository.TinodeDB, user)
}

// SyncUserToTinodeWithTx upserts the user into tinode users table within a transaction.
// This function should be called within a transaction context to ensure atomicity.
func SyncUserToTinodeWithTx(db *gorm.DB, user *model.User) error {
	if user == nil {
		return errors.New("user is nil")
	}
	if db == nil {
		return errors.New("database connection is nil")
	}

	publicData := map[string]interface{}{
		"fn":    user.Nickname,
		"photo": image.GetFullImageURL(user.Avatar),
	}
	publicJSON, err := json.Marshal(publicData)
	if err != nil {
		return fmt.Errorf("marshal public json: %w", err)
	}

	// Tinode expects non-null default access; NULL may crash the server on login
	// in some versions of the postgres adapter.
	// Mirror Tinode's defaults: {"Auth":"JRWPAS","Anon":"N"}.
	accessJSON := []byte(`{"Auth":"JRWPAS","Anon":"N"}`)

	// For SQL stores Tinode uses bigint ids; we map them to app user IDs.
	query := `
		INSERT INTO users (id, createdat, updatedat, state, access, public)
		VALUES ($1, NOW(), NOW(), 0, $2, $3)
		ON CONFLICT (id) DO UPDATE SET
			updatedat = NOW(),
			access = $2,
			public = $3
	`

	if err := db.Exec(query, user.ID, accessJSON, publicJSON).Error; err != nil {
		log.Printf("[Tinode] upsert users failed: userID=%d, err=%v", user.ID, err)
		return err
	}

	return nil
}
