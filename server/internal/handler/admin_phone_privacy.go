package handler

import (
	"strings"

	"home-decoration-server/internal/middleware"
	"home-decoration-server/internal/service"

	"github.com/gin-gonic/gin"
)

const adminPermissionViewFullPhone = "system:user:phone:view"

func adminCanViewFullPhone(c *gin.Context) bool {
	if c == nil {
		return false
	}
	return middleware.CurrentAdminHasAnyPermission(c, adminPermissionViewFullPhone)
}

func maskPhoneValue(raw string) string {
	phone := strings.TrimSpace(raw)
	if phone == "" {
		return ""
	}
	if len(phone) < 7 {
		return phone
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

func visiblePhoneForAdmin(c *gin.Context, raw string) string {
	phone := strings.TrimSpace(raw)
	if phone == "" {
		return ""
	}
	if adminCanViewFullPhone(c) {
		return phone
	}
	return maskPhoneValue(phone)
}

func sanitizeRefundApplicationPhonesForAdmin(c *gin.Context, view *service.RefundApplicationView) {
	if view == nil || view.User == nil {
		return
	}
	raw, _ := view.User["phone"].(string)
	view.User["phone"] = visiblePhoneForAdmin(c, raw)
}

func sanitizeProjectAuditPhonesForAdmin(c *gin.Context, view *service.ProjectAuditView) {
	if view == nil {
		return
	}
	if view.User != nil {
		raw, _ := view.User["phone"].(string)
		view.User["phone"] = visiblePhoneForAdmin(c, raw)
	}
	sanitizeRefundApplicationPhonesForAdmin(c, view.RefundApplication)
}
