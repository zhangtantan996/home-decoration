package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mattn/go-sqlite3"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/monitor"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/tinode"
)

const (
	validTinodeKey   = "AAAAAAAAAAAAAAAAAAAAAA=="
	invalidTinodeKey = "not_base64"
)

var sqliteRegisterOnce sync.Once

type responseEnvelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func migrateHandlerRuntimeTestSchema(t *testing.T, db *gorm.DB, extraModels ...interface{}) {
	t.Helper()

	models := []interface{}{
		&model.User{},
		&model.SysAdmin{},
		&model.Provider{},
		&model.MaterialShop{},
		&model.MerchantApplication{},
		&model.MaterialShopApplication{},
		&model.MaterialShopApplicationProduct{},
		&model.MaterialShopProduct{},
		&model.UserIdentity{},
		&model.SystemConfig{},
		&model.Notification{},
		&model.UserSettings{},
		&model.SMSAuditLog{},
		&model.MerchantServiceSetting{},
		&model.MaterialShopServiceSetting{},
		&model.Project{},
		&model.Booking{},
		&model.Proposal{},
		&model.Order{},
		&model.PaymentOrder{},
		&model.DemandMatch{},
		&model.AuditLog{},
	}
	models = append(models, extraModels...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("auto migrate runtime schema: %v", err)
	}
}

func setupRawSQLiteDB(t *testing.T) *gorm.DB {
	t.Helper()

	sqliteRegisterOnce.Do(func() {
		sql.Register("sqlite3_with_now", &sqlite3.SQLiteDriver{
			ConnectHook: func(conn *sqlite3.SQLiteConn) error {
				return conn.RegisterFunc("now", func() string {
					return time.Now().UTC().Format("2006-01-02 15:04:05")
				}, false)
			},
		})
	})

	dsn := fmt.Sprintf("file:memdb_%d?mode=memory&cache=shared", time.Now().UnixNano())
	sqlDB, err := sql.Open("sqlite3_with_now", dsn)
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	db, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatalf("open gorm db: %v", err)
	}

	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	return db
}

func setupSQLiteDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupRawSQLiteDB(t)
	migrateHandlerRuntimeTestSchema(t, db)
	return db
}

func setupAppDB(t *testing.T) *gorm.DB {
	t.Helper()

	return setupSQLiteDB(t)
}

func setupTinodeUsersDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupRawSQLiteDB(t)
	if err := db.Exec(`CREATE TABLE users (
		id INTEGER PRIMARY KEY,
		createdat TEXT,
		updatedat TEXT,
		state INTEGER,
		access BLOB,
		public BLOB
	)`).Error; err != nil {
		t.Fatalf("create tinode users table: %v", err)
	}
	return db
}

func setupTinodeChatDB(t *testing.T, includeMessages bool) *gorm.DB {
	t.Helper()

	db := setupRawSQLiteDB(t)
	if err := db.Exec(`CREATE TABLE subscriptions (
		topic TEXT,
		userid INTEGER,
		modegiven TEXT,
		deletedat TEXT
	)`).Error; err != nil {
		t.Fatalf("create subscriptions table: %v", err)
	}

	if includeMessages {
		if err := db.Exec(`CREATE TABLE messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			topic TEXT,
			content TEXT
		)`).Error; err != nil {
			t.Fatalf("create messages table: %v", err)
		}
	}

	return db
}

func seedUser(t *testing.T, db *gorm.DB, userID uint64) {
	t.Helper()

	user := model.User{
		Base:     model.Base{ID: userID},
		Phone:    "13800000000",
		Nickname: "tester",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
}

func seedSystemConfig(t *testing.T, db *gorm.DB, key string, value string) {
	t.Helper()

	config := model.SystemConfig{
		Key:         key,
		Value:       value,
		Description: "test",
		Editable:    true,
	}
	if err := db.Create(&config).Error; err != nil {
		t.Fatalf("seed system config %s: %v", key, err)
	}
}

func setRepositoryDBs(t *testing.T, appDB, tinodeDB *gorm.DB) {
	t.Helper()

	prevDB := repository.DB
	prevTinodeDB := repository.TinodeDB
	repository.DB = appDB
	repository.TinodeDB = tinodeDB

	t.Cleanup(func() {
		repository.DB = prevDB
		repository.TinodeDB = prevTinodeDB
	})
}

func performRequest(t *testing.T, method, path string, params gin.Params, userID *uint64, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, nil)
	c.Params = params
	if userID != nil {
		c.Set("userId", *userID)
	}
	handler(c)
	return w
}

func decodeResponse(t *testing.T, w *httptest.ResponseRecorder) responseEnvelope {
	t.Helper()

	var resp responseEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

func TestGetTinodeUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	setValidEnv := func(t *testing.T) {
		t.Setenv("TINODE_UID_ENCRYPTION_KEY", validTinodeKey)
	}
	setInvalidEnv := func(t *testing.T) {
		t.Setenv("TINODE_UID_ENCRYPTION_KEY", invalidTinodeKey)
	}

	tests := []struct {
		name               string
		userIDParam        string
		useSeedPublicID    bool
		seedUserID         uint64
		tinodeDBFactory    func(t *testing.T) *gorm.DB
		setEnv             func(t *testing.T)
		systemConfigs      map[string]string
		expectCode         int
		expectMessage      string
		expectTinodeUserID bool
	}{
		{
			name:          "user identifier not found",
			userIDParam:   "abc",
			setEnv:        setValidEnv,
			expectCode:    404,
			expectMessage: "用户不存在",
		},
		{
			name:          "zero user id",
			userIDParam:   "0",
			setEnv:        setValidEnv,
			expectCode:    404,
			expectMessage: "用户不存在",
		},
		{
			name:          "user not found",
			userIDParam:   "12",
			setEnv:        setValidEnv,
			expectCode:    404,
			expectMessage: "用户不存在",
		},
		{
			name:          "sync error",
			userIDParam:   "12",
			seedUserID:    12,
			setEnv:        setValidEnv,
			expectCode:    500,
			expectMessage: "Tinode 同步失败",
		},
		{
			name:            "tinode user id error",
			userIDParam:     "12",
			seedUserID:      12,
			tinodeDBFactory: setupTinodeUsersDB,
			setEnv:          setInvalidEnv,
			expectCode:      500,
			expectMessage:   "Tinode 用户ID生成失败",
		},
		{
			name:               "success",
			userIDParam:        "12",
			seedUserID:         12,
			tinodeDBFactory:    setupTinodeUsersDB,
			setEnv:             setValidEnv,
			expectCode:         0,
			expectMessage:      "success",
			expectTinodeUserID: true,
		},
		{
			name:               "success with public id",
			useSeedPublicID:    true,
			seedUserID:         12,
			tinodeDBFactory:    setupTinodeUsersDB,
			setEnv:             setValidEnv,
			expectCode:         0,
			expectMessage:      "success",
			expectTinodeUserID: true,
		},
		{
			name:            "force legacy lookup rejects public id",
			useSeedPublicID: true,
			seedUserID:      12,
			setEnv:          setValidEnv,
			systemConfigs: map[string]string{
				model.ConfigKeyPublicIDRollbackForceLegacyLookup: "true",
			},
			expectCode:    400,
			expectMessage: "参数错误",
		},
		{
			name:            "force legacy lookup with numeric id",
			userIDParam:     "12",
			seedUserID:      12,
			tinodeDBFactory: setupTinodeUsersDB,
			setEnv:          setValidEnv,
			systemConfigs: map[string]string{
				model.ConfigKeyPublicIDRollbackForceLegacyLookup: "true",
			},
			expectCode:         0,
			expectMessage:      "success",
			expectTinodeUserID: true,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			monitor.ResetPublicIDRollbackForTest()

			appDB := setupAppDB(t)
			for key, value := range tc.systemConfigs {
				seedSystemConfig(t, appDB, key, value)
			}
			if tc.seedUserID != 0 {
				seedUser(t, appDB, tc.seedUserID)
			}

			var tinodeDB *gorm.DB
			if tc.tinodeDBFactory != nil {
				tinodeDB = tc.tinodeDBFactory(t)
			}
			setRepositoryDBs(t, appDB, tinodeDB)

			if tc.setEnv != nil {
				tc.setEnv(t)
			}

			requestIdentifier := tc.userIDParam
			if tc.useSeedPublicID {
				var seededUser model.User
				if err := appDB.First(&seededUser, tc.seedUserID).Error; err != nil {
					t.Fatalf("load seeded user: %v", err)
				}
				requestIdentifier = seededUser.PublicID
			}

			w := performRequest(
				t,
				http.MethodGet,
				"/api/v1/tinode/userid/"+requestIdentifier,
				gin.Params{{Key: "userId", Value: requestIdentifier}},
				nil,
				GetTinodeUserID,
			)

			if w.Code != http.StatusOK {
				t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
			}

			resp := decodeResponse(t, w)
			if resp.Code != tc.expectCode {
				t.Fatalf("expected code %d, got %d", tc.expectCode, resp.Code)
			}
			if resp.Message != tc.expectMessage {
				t.Fatalf("expected message %q, got %q", tc.expectMessage, resp.Message)
			}

			if tc.expectTinodeUserID {
				var payload struct {
					TinodeUserID string `json:"tinodeUserId"`
				}
				if err := json.Unmarshal(resp.Data, &payload); err != nil {
					t.Fatalf("decode payload: %v", err)
				}
				if payload.TinodeUserID == "" {
					t.Fatalf("expected tinodeUserId to be set")
				}

				expectedID, err := tinode.UserIDToTinodeUserID(tc.seedUserID)
				if err != nil {
					t.Fatalf("compute expected tinode user id: %v", err)
				}
				if payload.TinodeUserID != expectedID {
					t.Fatalf("expected tinodeUserId %q, got %q", expectedID, payload.TinodeUserID)
				}
			}
		})
	}
}

func TestClearChatHistory(t *testing.T) {
	gin.SetMode(gin.TestMode)

	const validTopic = "usr123_usr456"

	tests := []struct {
		name            string
		topic           string
		userID          uint64
		tinodeDBFactory func(t *testing.T) *gorm.DB
		expectCode      int
		expectMessage   string
		verify          func(t *testing.T, db *gorm.DB, topic string)
	}{
		{
			name:          "empty topic",
			topic:         "",
			userID:        10,
			expectCode:    400,
			expectMessage: "参数错误",
		},
		{
			name:          "short topic",
			topic:         "ab",
			userID:        10,
			expectCode:    400,
			expectMessage: "无效的话题格式",
		},
		{
			name:          "tinode db nil",
			topic:         "usr123",
			userID:        10,
			expectCode:    503,
			expectMessage: "Tinode 服务不可用",
		},
		{
			name:   "insufficient permission",
			topic:  validTopic,
			userID: 10,
			tinodeDBFactory: func(t *testing.T) *gorm.DB {
				db := setupTinodeChatDB(t, true)
				if err := db.Exec(
					"INSERT INTO subscriptions (topic, userid, modegiven) VALUES (?, ?, ?)",
					validTopic,
					10,
					"R",
				).Error; err != nil {
					t.Fatalf("seed subscription: %v", err)
				}
				return db
			},
			expectCode:    403,
			expectMessage: "无权删除此话题的消息（需要管理员权限）",
		},
		{
			name:   "delete error",
			topic:  validTopic,
			userID: 10,
			tinodeDBFactory: func(t *testing.T) *gorm.DB {
				db := setupTinodeChatDB(t, false)
				if err := db.Exec(
					"INSERT INTO subscriptions (topic, userid, modegiven) VALUES (?, ?, ?)",
					validTopic,
					10,
					"O",
				).Error; err != nil {
					t.Fatalf("seed subscription: %v", err)
				}
				return db
			},
			expectCode:    500,
			expectMessage: "清空聊天记录失败",
		},
		{
			name:   "success",
			topic:  validTopic,
			userID: 10,
			tinodeDBFactory: func(t *testing.T) *gorm.DB {
				db := setupTinodeChatDB(t, true)
				if err := db.Exec(
					"INSERT INTO subscriptions (topic, userid, modegiven) VALUES (?, ?, ?)",
					validTopic,
					10,
					"O",
				).Error; err != nil {
					t.Fatalf("seed subscription: %v", err)
				}
				if err := db.Exec(
					"INSERT INTO messages (topic, content) VALUES (?, ?)",
					validTopic,
					"message 1",
				).Error; err != nil {
					t.Fatalf("seed message 1: %v", err)
				}
				if err := db.Exec(
					"INSERT INTO messages (topic, content) VALUES (?, ?)",
					validTopic,
					"message 2",
				).Error; err != nil {
					t.Fatalf("seed message 2: %v", err)
				}
				return db
			},
			expectCode:    0,
			expectMessage: "聊天记录已清空",
			verify: func(t *testing.T, db *gorm.DB, topic string) {
				if db == nil {
					t.Fatalf("expected tinode db")
				}
				deleter := tinode.NewMessageDeleter(db)
				count, err := deleter.GetMessageCount(context.Background(), topic)
				if err != nil {
					t.Fatalf("get message count: %v", err)
				}
				if count != 0 {
					t.Fatalf("expected 0 messages, got %d", count)
				}
			},
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			var tinodeDB *gorm.DB
			if tc.tinodeDBFactory != nil {
				tinodeDB = tc.tinodeDBFactory(t)
			}
			setRepositoryDBs(t, nil, tinodeDB)

			userID := tc.userID
			w := performRequest(
				t,
				http.MethodDelete,
				"/api/v1/tinode/topic/"+tc.topic+"/messages",
				gin.Params{{Key: "topic", Value: tc.topic}},
				&userID,
				ClearChatHistory,
			)

			if w.Code != http.StatusOK {
				t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
			}

			resp := decodeResponse(t, w)
			if resp.Code != tc.expectCode {
				t.Fatalf("expected code %d, got %d", tc.expectCode, resp.Code)
			}
			if resp.Message != tc.expectMessage {
				t.Fatalf("expected message %q, got %q", tc.expectMessage, resp.Message)
			}

			if tc.verify != nil {
				tc.verify(t, tinodeDB, tc.topic)
			}
		})
	}
}
