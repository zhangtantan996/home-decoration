package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newAdminAuditTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + t.Name() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.SysRole{},
		&model.SysMenu{},
		&model.SysRoleMenu{},
		&model.SysAdmin{},
		&model.SysAdminRole{},
		&model.Provider{},
		&model.MerchantWithdraw{},
		&model.MerchantIncome{},
		&model.Notification{},
		&model.AuditLog{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	return db
}

func withAdminAuditRepositoryDB(t *testing.T, db *gorm.DB) {
	t.Helper()
	oldDB := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = oldDB
	})
}

func TestAdminCreateRoleWritesBusinessAuditLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newAdminAuditTestDB(t)
	withAdminAuditRepositoryDB(t, db)

	body := bytes.NewBufferString(`{"name":"财务管理员","key":"finance_auditor","sort":1,"status":1,"remark":"新增财务角色"}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/admin/roles", body)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("admin_id", uint64(7001))

	AdminCreateRole(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", w.Code, w.Body.String())
	}

	var logs []model.AuditLog
	if err := db.Where("operation_type = ?", "create_role").Find(&logs).Error; err != nil {
		t.Fatalf("query audit logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected 1 create_role audit, got %d", len(logs))
	}
	if logs[0].OperatorID != 7001 || logs[0].ResourceType != "sys_role" {
		t.Fatalf("unexpected audit log: %+v", logs[0])
	}
}

func TestAdminWithdrawApproveWritesBusinessAuditLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newAdminAuditTestDB(t)
	withAdminAuditRepositoryDB(t, db)

	provider := model.Provider{Base: model.Base{ID: 301}, UserID: 501, CompanyName: "测试商家", ProviderType: 2}
	withdraw := model.MerchantWithdraw{Base: model.Base{ID: 401}, ProviderID: provider.ID, OrderNo: "W-401", Amount: 888, BankName: "工行", Status: model.MerchantWithdrawStatusPendingReview}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	if err := db.Create(&withdraw).Error; err != nil {
		t.Fatalf("create withdraw: %v", err)
	}

	payload, _ := json.Marshal(map[string]string{"remark": "审核通过"})
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/admin/withdraws/401/approve", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "401"}}
	c.Set("admin_id", uint64(7002))

	AdminWithdrawApprove(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", w.Code, w.Body.String())
	}

	var logEntry model.AuditLog
	if err := db.Where("operation_type = ?", "approve_withdraw_application").First(&logEntry).Error; err != nil {
		t.Fatalf("query audit log: %v", err)
	}
	if logEntry.ResourceID != withdraw.ID || logEntry.OperatorID != 7002 {
		t.Fatalf("unexpected audit log: %+v", logEntry)
	}
}
