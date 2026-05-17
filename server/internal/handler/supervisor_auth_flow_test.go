package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"github.com/gin-gonic/gin"
)

func setupSupervisorFlowTestDB(t *testing.T) {
	t.Helper()
	service.InitJWT(config.GetConfig().JWT.Secret)
	db := setupSQLiteDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SupervisorPhoneWhitelist{},
		&model.SupervisorApplication{},
		&model.SupervisorAccount{},
		&model.SupervisorProfile{},
		&model.ProjectSupervisorAssignment{},
		&model.AuditLog{},
	); err != nil {
		t.Fatalf("auto migrate supervisor flow: %v", err)
	}
	previousDB := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = previousDB })
}

func performSupervisorJSON(method, path, body string, handler gin.HandlerFunc, params ...gin.Param) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(method, path, bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	if len(params) > 0 {
		ctx.Params = params
	}
	handler(ctx)
	return rec
}

func decodeSupervisorResponseData(t *testing.T, rec *httptest.ResponseRecorder, out interface{}) {
	t.Helper()
	var envelope struct {
		Code int             `json:"code"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode envelope: %v body=%s", err, rec.Body.String())
	}
	if envelope.Code != 0 {
		t.Fatalf("unexpected envelope code=%d body=%s", envelope.Code, rec.Body.String())
	}
	if err := json.Unmarshal(envelope.Data, out); err != nil {
		t.Fatalf("decode data: %v body=%s", err, rec.Body.String())
	}
}

func decodeSupervisorEnvelope(t *testing.T, rec *httptest.ResponseRecorder) struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
} {
	t.Helper()
	var envelope struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode envelope: %v body=%s", err, rec.Body.String())
	}
	return envelope
}

func TestSupervisorApprovalCreatesAccountAndBindableProfile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)

	phone := "13800139001"
	if err := repository.DB.Create(&model.SupervisorPhoneWhitelist{Phone: phone, Status: 1, CreatedByAdminID: 7}).Error; err != nil {
		t.Fatalf("seed whitelist: %v", err)
	}
	app := model.SupervisorApplication{
		Phone:       phone,
		WhitelistID: 1,
		Status:      supervisorApplicationStatusPending,
		FormJSON:    `{"realName":"张监理","cityCode":"610100","serviceArea":["610100"],"certifications":["cert-a"],"idNo":"110101199001011234","orgName":"监理机构","agreementConfirmed":true}`,
		SubmittedAt: time.Now(),
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("seed application: %v", err)
	}

	rec := performSupervisorJSON(http.MethodPost, "/api/v1/admin/supervisor-applications/1/approve", `{"reason":"资料审核通过"}`, AdminApproveSupervisorApplication, gin.Param{Key: "id", Value: "1"})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var account model.SupervisorAccount
	if err := repository.DB.Where("phone = ?", phone).First(&account).Error; err != nil {
		t.Fatalf("expected supervisor account: %v", err)
	}
	var profile model.SupervisorProfile
	if err := repository.DB.Where("supervisor_account_id = ?", account.ID).First(&profile).Error; err != nil {
		t.Fatalf("expected profile bound to account: %v", err)
	}
	if profile.UserID == 0 {
		t.Fatalf("approval must keep a valid compatibility user_id, got 0")
	}
	if profile.Status != 1 || !profile.Verified {
		t.Fatalf("unexpected profile status/verified: %+v", profile)
	}
}

func TestSupervisorRefreshReusesSessionID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)
	t.Setenv("SMS_FIXED_CODE_MODE", "true")
	t.Setenv("SMS_FIXED_CODE", "123456")

	phone := "13800139002"
	if err := repository.DB.Create(&model.SupervisorApplication{Phone: phone, WhitelistID: 1, Status: supervisorApplicationStatusApproved, FormJSON: `{}`, SubmittedAt: time.Now()}).Error; err != nil {
		t.Fatalf("seed application: %v", err)
	}
	account := model.SupervisorAccount{Phone: phone, Status: 1}
	if err := repository.DB.Create(&account).Error; err != nil {
		t.Fatalf("seed account: %v", err)
	}
	profile := model.SupervisorProfile{UserID: 100, SupervisorAccountID: &account.ID, Phone: phone, RealName: "张监理", Status: 1, Verified: true}
	if err := repository.DB.Create(&profile).Error; err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	loginRec := performSupervisorJSON(http.MethodPost, "/api/v1/supervisor/login", `{"phone":"`+phone+`","code":"123456"}`, SupervisorLogin(config.GetConfig()))
	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d body=%s", loginRec.Code, loginRec.Body.String())
	}
	var loginData struct {
		RefreshToken string `json:"refreshToken"`
		SessionID    string `json:"sessionId"`
	}
	decodeSupervisorResponseData(t, loginRec, &loginData)
	if loginData.RefreshToken == "" || loginData.SessionID == "" {
		t.Fatalf("expected token pair, got %+v", loginData)
	}

	refreshBody := `{"refreshToken":"` + loginData.RefreshToken + `"}`
	refreshRec := performSupervisorJSON(http.MethodPost, "/api/v1/supervisor/token/refresh", refreshBody, SupervisorRefreshToken)
	if refreshRec.Code != http.StatusOK {
		t.Fatalf("expected refresh 200, got %d body=%s", refreshRec.Code, refreshRec.Body.String())
	}
	var refreshData struct {
		SessionID string `json:"sessionId"`
	}
	decodeSupervisorResponseData(t, refreshRec, &refreshData)
	if refreshData.SessionID != loginData.SessionID {
		t.Fatalf("refresh must reuse sid: got=%s want=%s", refreshData.SessionID, loginData.SessionID)
	}
}

func TestSupervisorOnboardingSubmitRejectsIncompleteForm(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)
	t.Setenv("SMS_FIXED_CODE_MODE", "true")
	t.Setenv("SMS_FIXED_CODE", "123456")

	phone := "13800139003"
	if err := repository.DB.Create(&model.SupervisorPhoneWhitelist{Phone: phone, Status: 1, CreatedByAdminID: 7}).Error; err != nil {
		t.Fatalf("seed whitelist: %v", err)
	}

	rec := performSupervisorJSON(http.MethodPost, "/api/v1/supervisor/onboarding/submit", `{"phone":"`+phone+`","code":"123456","form":{"realName":"","cityCode":"","serviceArea":[],"certifications":[],"idNo":"","agreementConfirmed":false}}`, SubmitSupervisorOnboardingApplication)
	envelope := decodeSupervisorEnvelope(t, rec)
	if envelope.Code == 0 {
		t.Fatalf("incomplete onboarding form must be rejected, body=%s", rec.Body.String())
	}

	var count int64
	if err := repository.DB.Model(&model.SupervisorApplication{}).Where("phone = ?", phone).Count(&count).Error; err != nil {
		t.Fatalf("count applications: %v", err)
	}
	if count != 0 {
		t.Fatalf("invalid form must not create application, got count=%d", count)
	}
}

func TestSupervisorOnboardingStatusDoesNotExposeFormDataWithoutVerification(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)

	phone := "13800139013"
	app := model.SupervisorApplication{
		Phone:       phone,
		WhitelistID: 1,
		Status:      supervisorApplicationStatusPending,
		FormJSON:    `{"realName":"张监理","cityCode":"610100","serviceArea":["610100"],"certifications":["cert-a"],"idNo":"110101199001011234","orgName":"监理机构","agreementConfirmed":true}`,
		SubmittedAt: time.Now(),
	}
	if err := repository.DB.Create(&app).Error; err != nil {
		t.Fatalf("seed application: %v", err)
	}

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/supervisor/onboarding/status?phone="+phone, nil)
	GetSupervisorOnboardingStatus(ctx)

	var envelope struct {
		Code int            `json:"code"`
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode status response: %v body=%s", err, rec.Body.String())
	}
	if envelope.Code != 0 {
		t.Fatalf("unexpected code=%d body=%s", envelope.Code, rec.Body.String())
	}
	if _, exists := envelope.Data["formData"]; exists {
		t.Fatalf("public status response must not expose formData, got=%v", envelope.Data["formData"])
	}
}

func TestSupervisorOnboardingSubmitBlocksApprovedAccountResubmission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)
	t.Setenv("SMS_FIXED_CODE_MODE", "true")
	t.Setenv("SMS_FIXED_CODE", "123456")

	phone := "13800139004"
	if err := repository.DB.Create(&model.SupervisorPhoneWhitelist{Phone: phone, Status: 1, CreatedByAdminID: 7}).Error; err != nil {
		t.Fatalf("seed whitelist: %v", err)
	}
	if err := repository.DB.Create(&model.SupervisorApplication{Phone: phone, WhitelistID: 1, Status: supervisorApplicationStatusApproved, FormJSON: `{}`, SubmittedAt: time.Now()}).Error; err != nil {
		t.Fatalf("seed approved app: %v", err)
	}
	account := model.SupervisorAccount{Phone: phone, Status: 1}
	if err := repository.DB.Create(&account).Error; err != nil {
		t.Fatalf("seed account: %v", err)
	}
	profile := model.SupervisorProfile{UserID: 1004, SupervisorAccountID: &account.ID, Phone: phone, RealName: "已通过监理", CityCode: "610100", ServiceArea: `["610100"]`, Certifications: `["cert"]`, Status: 1, Verified: true}
	if err := repository.DB.Create(&profile).Error; err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	rec := performSupervisorJSON(http.MethodPost, "/api/v1/supervisor/onboarding/submit", `{"phone":"`+phone+`","code":"123456","form":{"realName":"重复申请","cityCode":"610100","serviceArea":["610100"],"certifications":["cert"],"idNo":"110101199001011234","agreementConfirmed":true}}`, SubmitSupervisorOnboardingApplication)
	envelope := decodeSupervisorEnvelope(t, rec)
	if envelope.Code == 0 {
		t.Fatalf("approved supervisor must not submit another application, body=%s", rec.Body.String())
	}

	var pendingCount int64
	if err := repository.DB.Model(&model.SupervisorApplication{}).Where("phone = ? AND status = ?", phone, supervisorApplicationStatusPending).Count(&pendingCount).Error; err != nil {
		t.Fatalf("count pending apps: %v", err)
	}
	if pendingCount != 0 {
		t.Fatalf("approved supervisor resubmission must not create pending app, got %d", pendingCount)
	}
}

func TestSupervisorLoginIgnoresLaterNonApprovedApplicationsWhenAccountIsActive(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)
	t.Setenv("SMS_FIXED_CODE_MODE", "true")
	t.Setenv("SMS_FIXED_CODE", "123456")

	phone := "13800139005"
	if err := repository.DB.Create(&model.SupervisorApplication{Phone: phone, WhitelistID: 1, Status: supervisorApplicationStatusApproved, FormJSON: `{}`, SubmittedAt: time.Now().Add(-time.Hour)}).Error; err != nil {
		t.Fatalf("seed approved app: %v", err)
	}
	if err := repository.DB.Create(&model.SupervisorApplication{Phone: phone, WhitelistID: 1, Status: supervisorApplicationStatusPending, FormJSON: `{}`, SubmittedAt: time.Now()}).Error; err != nil {
		t.Fatalf("seed stale pending app: %v", err)
	}
	account := model.SupervisorAccount{Phone: phone, Status: 1}
	if err := repository.DB.Create(&account).Error; err != nil {
		t.Fatalf("seed account: %v", err)
	}
	profile := model.SupervisorProfile{UserID: 1005, SupervisorAccountID: &account.ID, Phone: phone, RealName: "有效监理", Status: 1, Verified: true}
	if err := repository.DB.Create(&profile).Error; err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	rec := performSupervisorJSON(http.MethodPost, "/api/v1/supervisor/login", `{"phone":"`+phone+`","code":"123456"}`, SupervisorLogin(config.GetConfig()))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	envelope := decodeSupervisorEnvelope(t, rec)
	if envelope.Code != 0 {
		t.Fatalf("active approved supervisor must be able to login, body=%s", rec.Body.String())
	}
}

func TestSupervisorRevokeSessionRequiresOwnership(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)

	oldRedis := repository.RedisClient
	repository.RedisClient = nil
	t.Cleanup(func() {
		repository.RedisClient = oldRedis
	})

	pairA, err := service.IssueSupervisorTokenPair(3001, "13800139021", 4001, "127.0.0.1", "test-agent-a", "device-a")
	if err != nil {
		t.Fatalf("issue pair A: %v", err)
	}
	pairB, err := service.IssueSupervisorTokenPair(3002, "13800139022", 4002, "127.0.0.2", "test-agent-b", "device-b")
	if err != nil {
		t.Fatalf("issue pair B: %v", err)
	}

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v1/supervisor/sessions/"+pairB.SessionID+"/revoke", nil)
	ctx.Params = gin.Params{{Key: "sid", Value: pairB.SessionID}}
	ctx.Set("supervisorAccountId", uint64(3001))
	ctx.Set("sessionId", pairA.SessionID)

	SupervisorRevokeSession(ctx)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !service.IsSupervisorSessionActive(pairB.SessionID) {
		t.Fatalf("foreign session should remain active")
	}
}

func TestSupervisorRevokeCurrentSessionWithoutRedisSucceeds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)

	oldRedis := repository.RedisClient
	repository.RedisClient = nil
	t.Cleanup(func() {
		repository.RedisClient = oldRedis
	})

	pair, err := service.IssueSupervisorTokenPair(3001, "13800139023", 4001, "127.0.0.1", "test-agent", "device-a")
	if err != nil {
		t.Fatalf("issue pair: %v", err)
	}

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v1/supervisor/sessions/"+pair.SessionID+"/revoke", nil)
	ctx.Params = gin.Params{{Key: "sid", Value: pair.SessionID}}
	ctx.Set("supervisorAccountId", uint64(3001))
	ctx.Set("sessionId", pair.SessionID)

	SupervisorRevokeSession(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if envelope := decodeSupervisorEnvelope(t, rec); envelope.Code != 0 {
		t.Fatalf("expected success envelope, body=%s", rec.Body.String())
	}
}

func TestAdminCreateSupervisorAssignmentValidatesProjectAndActiveBoundAccount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)
	if err := repository.DB.AutoMigrate(&model.Project{}); err != nil {
		t.Fatalf("migrate project: %v", err)
	}

	unbound := model.SupervisorProfile{UserID: 2001, Phone: "13800139101", RealName: "未绑定监理", Status: 1, Verified: true}
	if err := repository.DB.Create(&unbound).Error; err != nil {
		t.Fatalf("seed unbound profile: %v", err)
	}
	disabledAccount := model.SupervisorAccount{Phone: "13800139102", Status: 0}
	if err := repository.DB.Create(&disabledAccount).Error; err != nil {
		t.Fatalf("seed disabled account: %v", err)
	}
	if err := repository.DB.Model(&model.SupervisorAccount{}).Where("id = ?", disabledAccount.ID).Update("status", 0).Error; err != nil {
		t.Fatalf("disable account: %v", err)
	}
	inactiveProfile := model.SupervisorProfile{UserID: 2002, SupervisorAccountID: &disabledAccount.ID, Phone: disabledAccount.Phone, RealName: "禁用监理", Status: 1, Verified: true}
	if err := repository.DB.Create(&inactiveProfile).Error; err != nil {
		t.Fatalf("seed inactive profile: %v", err)
	}
	activeAccount := model.SupervisorAccount{Phone: "13800139103", Status: 1}
	if err := repository.DB.Create(&activeAccount).Error; err != nil {
		t.Fatalf("seed active account: %v", err)
	}
	activeProfile := model.SupervisorProfile{UserID: 2003, SupervisorAccountID: &activeAccount.ID, Phone: activeAccount.Phone, RealName: "可分配监理", Status: 1, Verified: true}
	if err := repository.DB.Create(&activeProfile).Error; err != nil {
		t.Fatalf("seed active profile: %v", err)
	}
	project := model.Project{Name: "测试项目", Status: 1}
	if err := repository.DB.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}

	missingProjectRec := performSupervisorJSON(http.MethodPost, "/api/v1/admin/supervisor-assignments", fmt.Sprintf(`{"projectId":999999,"supervisorId":%d}`, activeProfile.ID), AdminCreateSupervisorAssignment)
	if decodeSupervisorEnvelope(t, missingProjectRec).Code == 0 {
		t.Fatalf("missing project must be rejected, body=%s", missingProjectRec.Body.String())
	}

	unboundRec := performSupervisorJSON(http.MethodPost, "/api/v1/admin/supervisor-assignments", fmt.Sprintf(`{"projectId":%d,"supervisorId":%d}`, project.ID, unbound.ID), AdminCreateSupervisorAssignment)
	if decodeSupervisorEnvelope(t, unboundRec).Code == 0 {
		t.Fatalf("unbound supervisor must be rejected, body=%s", unboundRec.Body.String())
	}

	inactiveRec := performSupervisorJSON(http.MethodPost, "/api/v1/admin/supervisor-assignments", fmt.Sprintf(`{"projectId":%d,"supervisorId":%d}`, project.ID, inactiveProfile.ID), AdminCreateSupervisorAssignment)
	if decodeSupervisorEnvelope(t, inactiveRec).Code == 0 {
		t.Fatalf("disabled supervisor account must be rejected, body=%s", inactiveRec.Body.String())
	}

	activeRec := performSupervisorJSON(http.MethodPost, "/api/v1/admin/supervisor-assignments", fmt.Sprintf(`{"projectId":%d,"supervisorId":%d}`, project.ID, activeProfile.ID), AdminCreateSupervisorAssignment)
	if decodeSupervisorEnvelope(t, activeRec).Code != 0 {
		t.Fatalf("active bound supervisor should be assignable, body=%s", activeRec.Body.String())
	}
}

func TestAdminCreateSupervisorAssignmentReactivatesRemovedAssignment(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)
	if err := repository.DB.AutoMigrate(&model.Project{}); err != nil {
		t.Fatalf("migrate project: %v", err)
	}

	account := model.SupervisorAccount{Phone: "13800139105", Status: 1}
	if err := repository.DB.Create(&account).Error; err != nil {
		t.Fatalf("seed account: %v", err)
	}
	profile := model.SupervisorProfile{UserID: 2005, SupervisorAccountID: &account.ID, Phone: account.Phone, RealName: "可重分配监理", Status: 1, Verified: true}
	if err := repository.DB.Create(&profile).Error; err != nil {
		t.Fatalf("seed profile: %v", err)
	}
	project := model.Project{Name: "重分配测试项目", Status: 1}
	if err := repository.DB.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}
	removed := model.ProjectSupervisorAssignment{
		ProjectID:    project.ID,
		SupervisorID: profile.ID,
		AssignedBy:   7,
		Status:       0,
		AssignedAt:   time.Now().Add(-time.Hour),
	}
	if err := repository.DB.Create(&removed).Error; err != nil {
		t.Fatalf("seed removed assignment: %v", err)
	}
	if err := repository.DB.Model(&model.ProjectSupervisorAssignment{}).Where("id = ?", removed.ID).Update("status", 0).Error; err != nil {
		t.Fatalf("mark assignment removed: %v", err)
	}

	rec := performSupervisorJSON(http.MethodPost, "/api/v1/admin/supervisor-assignments", fmt.Sprintf(`{"projectId":%d,"supervisorId":%d}`, project.ID, profile.ID), AdminCreateSupervisorAssignment)
	if decodeSupervisorEnvelope(t, rec).Code != 0 {
		t.Fatalf("removed assignment should be reactivated, body=%s", rec.Body.String())
	}

	var assignments []model.ProjectSupervisorAssignment
	if err := repository.DB.Where("project_id = ? AND supervisor_id = ?", project.ID, profile.ID).Find(&assignments).Error; err != nil {
		t.Fatalf("load assignments: %v", err)
	}
	if len(assignments) != 1 {
		t.Fatalf("expected existing assignment to be reused, got %d rows", len(assignments))
	}
	if assignments[0].Status != 1 {
		t.Fatalf("expected assignment to be active again, got status=%d", assignments[0].Status)
	}
}

func TestAdminSupervisorAssignmentWritesAuditOnAssignAndRemove(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)
	if err := repository.DB.AutoMigrate(&model.Project{}); err != nil {
		t.Fatalf("migrate project: %v", err)
	}

	account := model.SupervisorAccount{Phone: "13800139106", Status: 1}
	if err := repository.DB.Create(&account).Error; err != nil {
		t.Fatalf("seed account: %v", err)
	}
	profile := model.SupervisorProfile{UserID: 2006, SupervisorAccountID: &account.ID, Phone: account.Phone, RealName: "审计监理", Status: 1, Verified: true}
	if err := repository.DB.Create(&profile).Error; err != nil {
		t.Fatalf("seed profile: %v", err)
	}
	project := model.Project{Name: "审计测试项目", Status: 1}
	if err := repository.DB.Create(&project).Error; err != nil {
		t.Fatalf("seed project: %v", err)
	}

	assignRec := httptest.NewRecorder()
	assignCtx, _ := gin.CreateTestContext(assignRec)
	assignCtx.Request = httptest.NewRequest(http.MethodPost, "/api/v1/admin/supervisor-assignments", bytes.NewBufferString(fmt.Sprintf(`{"projectId":%d,"supervisorId":%d}`, project.ID, profile.ID)))
	assignCtx.Request.Header.Set("Content-Type", "application/json")
	assignCtx.Set("adminId", uint64(99))
	assignCtx.Set("admin_reason", "分配监理")

	AdminCreateSupervisorAssignment(assignCtx)

	if decodeSupervisorEnvelope(t, assignRec).Code != 0 {
		t.Fatalf("assign should succeed, body=%s", assignRec.Body.String())
	}

	var assignment model.ProjectSupervisorAssignment
	if err := repository.DB.Where("project_id = ? AND supervisor_id = ?", project.ID, profile.ID).First(&assignment).Error; err != nil {
		t.Fatalf("load assignment: %v", err)
	}
	var assignAudit model.AuditLog
	if err := repository.DB.Where("operation_type = ? AND resource_type = ? AND resource_id = ?", "assign_supervisor", "project_supervisor_assignment", assignment.ID).
		Order("id DESC").
		First(&assignAudit).Error; err != nil {
		t.Fatalf("expected assign audit: %v", err)
	}

	deleteRec := httptest.NewRecorder()
	deleteCtx, _ := gin.CreateTestContext(deleteRec)
	deleteCtx.Request = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/admin/supervisor-assignments/%d", assignment.ID), nil)
	deleteCtx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", assignment.ID)}}
	deleteCtx.Set("adminId", uint64(99))
	deleteCtx.Set("admin_reason", "移除监理")

	AdminDeleteSupervisorAssignment(deleteCtx)

	if decodeSupervisorEnvelope(t, deleteRec).Code != 0 {
		t.Fatalf("delete should succeed, body=%s", deleteRec.Body.String())
	}

	var removeAudit model.AuditLog
	if err := repository.DB.Where("operation_type = ? AND resource_type = ? AND resource_id = ?", "remove_supervisor", "project_supervisor_assignment", assignment.ID).
		Order("id DESC").
		First(&removeAudit).Error; err != nil {
		t.Fatalf("expected remove audit: %v", err)
	}
}

func TestLegacyAdminSupervisorStatusUpdatesLinkedAccount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupSupervisorFlowTestDB(t)

	account := model.SupervisorAccount{Phone: "13800139104", Status: 1}
	if err := repository.DB.Create(&account).Error; err != nil {
		t.Fatalf("seed account: %v", err)
	}
	profile := model.SupervisorProfile{UserID: 2004, SupervisorAccountID: &account.ID, Phone: account.Phone, RealName: "监理", Status: 1, Verified: true}
	if err := repository.DB.Create(&profile).Error; err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	rec := performSupervisorJSON(http.MethodPatch, "/api/v1/admin/supervisors/1/status", `{"status":0,"reason":"停用测试"}`, AdminUpdateSupervisorStatus, gin.Param{Key: "id", Value: "1"})
	if decodeSupervisorEnvelope(t, rec).Code != 0 {
		t.Fatalf("legacy status update should remain compatible, body=%s", rec.Body.String())
	}

	var updatedAccount model.SupervisorAccount
	if err := repository.DB.First(&updatedAccount, account.ID).Error; err != nil {
		t.Fatalf("load account: %v", err)
	}
	if updatedAccount.Status != 0 {
		t.Fatalf("linked account must be disabled, got %d", updatedAccount.Status)
	}
}
