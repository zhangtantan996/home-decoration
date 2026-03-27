package handler

import (
	"errors"
	"html"
	"io"
	"net/http"
	"strings"

	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type paymentLaunchRequest struct {
	TerminalType string `json:"terminalType"`
}

func bindPaymentLaunchRequest(c *gin.Context) (*paymentLaunchRequest, error) {
	var req paymentLaunchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if errors.Is(err, io.EOF) {
			return &req, nil
		}
		return nil, err
	}
	return &req, nil
}

func PaymentLaunch(c *gin.Context) {
	paymentID := parseUint64(c.Param("id"))
	if paymentID == 0 {
		renderPaymentLaunchError(c, http.StatusBadRequest, "无效支付单ID")
		return
	}
	document, err := paymentService.BuildLaunchDocument(paymentID, strings.TrimSpace(c.Query("token")))
	if err != nil {
		renderPaymentLaunchError(c, http.StatusBadRequest, err.Error())
		return
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(document))
}

func PaymentStatus(c *gin.Context) {
	paymentID := parseUint64(c.Param("id"))
	if paymentID == 0 {
		response.BadRequest(c, "无效支付单ID")
		return
	}
	result, err := paymentService.GetPaymentStatusForUser(paymentID, getCurrentUserID(c))
	if err != nil {
		respondScopedAccessError(c, err, "获取支付状态失败")
		return
	}
	response.Success(c, result)
}

func PaymentDetail(c *gin.Context) {
	paymentID := parseUint64(c.Param("id"))
	if paymentID == 0 {
		response.BadRequest(c, "无效支付单ID")
		return
	}
	result, err := paymentService.GetPaymentDetailForUser(paymentID, getCurrentUserID(c))
	if err != nil {
		respondScopedAccessError(c, err, "获取支付详情失败")
		return
	}
	response.Success(c, result)
}

func PaymentAlipayNotify(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusBadRequest, "failure")
		return
	}
	if err := paymentService.HandleAlipayNotify(c.Request.PostForm); err != nil {
		c.String(http.StatusBadRequest, "failure")
		return
	}
	c.String(http.StatusOK, "success")
}

func PaymentAlipayReturn(c *gin.Context) {
	paymentID := parseUint64(c.Query("paymentId"))
	if paymentID == 0 {
		response.BadRequest(c, "无效支付单ID")
		return
	}
	target, err := paymentService.ResolveReturnURL(paymentID, strings.TrimSpace(c.Query("terminalType")))
	if err != nil {
		respondScopedAccessError(c, err, "支付返回地址无效")
		return
	}
	c.Redirect(http.StatusFound, target)
}

func renderPaymentLaunchError(c *gin.Context, status int, message string) {
	var builder strings.Builder
	builder.WriteString("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Payment Error</title></head><body>")
	builder.WriteString("<h1>支付无法启动</h1><p>")
	builder.WriteString(html.EscapeString(message))
	builder.WriteString("</p></body></html>")
	c.Data(status, "text/html; charset=utf-8", []byte(builder.String()))
}
