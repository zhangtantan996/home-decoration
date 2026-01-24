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

func setupSQLiteDB(t *testing.T) *gorm.DB {
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

func setupAppDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("auto migrate user: %v", err)
	}
	return db
}

func setupTinodeUsersDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupSQLiteDB(t)
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

	db := setupSQLiteDB(t)
	if err := db.Exec(`CREATE TABLE subscriptions (
		topic TEXT,
		userid INTEGER
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
		Base: model.Base{ID: userID},
		Phone:    "13800000000",
		Nickname: "tester",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
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
		name                string
		userIDParam         string
		seedUserID          uint64
		tinodeDBFactory     func(t *testing.T) *gorm.DB
		setEnv              func(t *testing.T)
		expectCode          int
		expectMessage       string
		expectTinodeUserID  bool
	}{
		{
			name:          "invalid user id",
			userIDParam:   "abc",
			setEnv:        setValidEnv,
			expectCode:    400,
			expectMessage: "参数错误",
		},
		{
			name:          "zero user id",
			userIDParam:   "0",
			setEnv:        setValidEnv,
			expectCode:    400,
			expectMessage: "参数错误",
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
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			appDB := setupAppDB(t)
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

			w := performRequest(
				t,
				http.MethodGet,
				"/api/v1/tinode/userid/"+tc.userIDParam,
				gin.Params{{Key: "userId", Value: tc.userIDParam}},
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
			name:  "unauthorized",
			topic: validTopic,
			userID: 10,
			tinodeDBFactory: func(t *testing.T) *gorm.DB {
				db := setupTinodeChatDB(t, true)
				if err := db.Exec(
					"INSERT INTO subscriptions (topic, userid) VALUES (?, ?)",
					validTopic,
					999,
				).Error; err != nil {
					t.Fatalf("seed subscription: %v", err)
				}
				return db
			},
			expectCode:    403,
			expectMessage: "无权删除此话题的消息",
		},
		{
			name:  "delete error",
			topic: validTopic,
			userID: 10,
			tinodeDBFactory: func(t *testing.T) *gorm.DB {
				db := setupTinodeChatDB(t, false)
				if err := db.Exec(
					"INSERT INTO subscriptions (topic, userid) VALUES (?, ?)",
					validTopic,
					10,
				).Error; err != nil {
					t.Fatalf("seed subscription: %v", err)
				}
				return db
			},
			expectCode:    500,
			expectMessage: "清空聊天记录失败",
		},
		{
			name:  "success",
			topic: validTopic,
			userID: 10,
			tinodeDBFactory: func(t *testing.T) *gorm.DB {
				db := setupTinodeChatDB(t, true)
				if err := db.Exec(
					"INSERT INTO subscriptions (topic, userid) VALUES (?, ?)",
					validTopic,
					10,
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
