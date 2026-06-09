package handler

import (
	"errors"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AdminQuoteInquiryQuery 管理后台查询参数
type AdminQuoteInquiryQuery struct {
	Page             int    `form:"page" binding:"omitempty,min=1"`
	PageSize         int    `form:"pageSize" binding:"omitempty,min=1,max=100"`
	Keyword          string `form:"keyword"`
	ConversionStatus string `form:"conversionStatus"`
	FollowStatus     string `form:"followStatus"`
	AssignedAdminID  uint64 `form:"assignedAdminId"`
	City             string `form:"city"`
	CityCode         string `form:"cityCode"`
	StartDate        string `form:"startDate"`
	EndDate          string `form:"endDate"`
	HasPhone         *bool  `form:"hasPhone"`
}

// AdminListQuoteInquiries 管理后台查询询价列表
func AdminListQuoteInquiries(c *gin.Context) {
	var query AdminQuoteInquiryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = 10
	}

	items, total, err := quoteInquiryService.AdminListInquiries(service.AdminQuoteInquiryListFilter{
		Page:             query.Page,
		PageSize:         query.PageSize,
		Keyword:          query.Keyword,
		City:             query.City,
		CityCode:         query.CityCode,
		ConversionStatus: query.ConversionStatus,
		FollowStatus:     query.FollowStatus,
		AssignedAdminID:  query.AssignedAdminID,
		StartDate:        query.StartDate,
		EndDate:          query.EndDate,
		HasPhone:         query.HasPhone,
	})
	if err != nil {
		if isSchemaUpgradeErrorMessage(err.Error()) {
			response.ServerError(c, "查询失败，请联系管理员检查数据库是否已升级")
		} else {
			response.ServerError(c, "查询失败，请稍后重试")
		}
		return
	}

	response.PageSuccess(c, items, total, query.Page, query.PageSize)
}

// AdminGetQuoteInquiry 获取管理后台详情
func AdminGetQuoteInquiry(c *gin.Context) {
	inquiryID := parseUint64(c.Param("id"))
	if inquiryID == 0 {
		response.BadRequest(c, "无效报价ID")
		return
	}

	detail, err := quoteInquiryService.GetInquiryDetailForAdmin(inquiryID)
	if err != nil {
		respondScopedAccessError(c, err, "获取报价详情失败")
		return
	}
	detail.Phone = visiblePhoneForAdmin(c, detail.Phone)

	response.Success(c, detail)
}

func AdminUpdateQuoteInquiryFollowUp(c *gin.Context) {
	inquiryID := parseUint64(c.Param("id"))
	if inquiryID == 0 {
		response.BadRequest(c, "无效报价ID")
		return
	}

	var req struct {
		FollowStatus    string  `json:"followStatus"`
		AssignedAdminID *uint64 `json:"assignedAdminId"`
		NextFollowAt    string  `json:"nextFollowAt"`
		InvalidReason   string  `json:"invalidReason"`
		Notes           string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var nextFollowAt *time.Time
	if trimmed := strings.TrimSpace(req.NextFollowAt); trimmed != "" {
		parsed, err := time.Parse(time.RFC3339, trimmed)
		if err != nil {
			if fallback, fallbackErr := time.ParseInLocation("2006-01-02 15:04", trimmed, time.Local); fallbackErr == nil {
				parsed = fallback
			} else {
				response.BadRequest(c, "下次跟进时间格式无效")
				return
			}
		}
		nextFollowAt = &parsed
	}

	detail, err := quoteInquiryService.UpdateFollowUp(inquiryID, service.UpdateQuoteInquiryFollowUpInput{
		FollowStatus:    req.FollowStatus,
		AssignedAdminID: req.AssignedAdminID,
		NextFollowAt:    nextFollowAt,
		InvalidReason:   req.InvalidReason,
		Notes:           req.Notes,
		OperatorID:      c.GetUint64("adminId"),
		ClientIP:        c.ClientIP(),
		UserAgent:       c.Request.UserAgent(),
	})
	if err != nil {
		respondSchemaAwareDomainMutationError(c, err, "更新跟进失败", "更新跟进失败，请联系管理员检查数据库是否已升级")
		return
	}
	detail.Phone = visiblePhoneForAdmin(c, detail.Phone)

	response.Success(c, detail)
}

func AdminConvertQuoteInquiryToBooking(c *gin.Context) {
	inquiryID := parseUint64(c.Param("id"))
	if inquiryID == 0 {
		response.BadRequest(c, "无效报价ID")
		return
	}
	var req struct {
		OwnerID       uint64 `json:"ownerId"`
		ProviderID    uint64 `json:"providerId" binding:"required"`
		ProviderType  string `json:"providerType" binding:"required"`
		PreferredDate string `json:"preferredDate" binding:"required"`
		Notes         string `json:"notes"`
		Reason        string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var booking *model.Booking
	var inquiry model.QuoteInquiry
	now := time.Now()
	if err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&inquiry, inquiryID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errQuoteInquiryNotFound
			}
			return err
		}
		if inquiry.ConvertedToBookingID != nil && *inquiry.ConvertedToBookingID > 0 {
			return errQuoteInquiryAlreadyConverted
		}
		if err := service.RestoreQuoteInquirySensitiveFields(&inquiry); err != nil {
			return errQuoteInquiryDecryptFailed
		}
		ownerID := req.OwnerID
		if ownerID == 0 && inquiry.UserID != nil {
			ownerID = *inquiry.UserID
		}
		if ownerID == 0 {
			return errQuoteInquiryOwnerRequired
		}
		var owner model.User
		if err := tx.Select("id", "status").First(&owner, ownerID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errQuoteInquiryOwnerNotFound
			}
			return err
		}
		if owner.Status != 1 {
			return errQuoteInquiryOwnerDisabled
		}

		created, err := bookingService.CreateTx(tx, ownerID, &service.CreateBookingRequest{
			ProviderID:     req.ProviderID,
			ProviderType:   req.ProviderType,
			Address:        inquiry.Address,
			Area:           inquiry.Area,
			RenovationType: inquiry.RenovationType,
			BudgetRange:    inquiry.BudgetRange,
			PreferredDate:  req.PreferredDate,
			Phone:          inquiry.Phone,
			Notes:          strings.TrimSpace(req.Notes),
			HouseLayout:    inquiry.HouseLayout,
		})
		if err != nil {
			return err
		}
		booking = created
		bookingID := booking.ID
		if err := tx.Model(&model.Booking{}).Where("id = ?", booking.ID).Updates(map[string]interface{}{
			"source_type":      "quote_inquiry",
			"source_id":        inquiry.ID,
			"follow_status":    model.LeadFollowStatusPendingContact,
			"last_followed_at": &now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.QuoteInquiry{}).Where("id = ?", inquiry.ID).Updates(map[string]interface{}{
			"conversion_status":       "converted",
			"converted_to_booking_id": &bookingID,
			"converted_at":            &now,
			"follow_status":           model.LeadFollowStatusConvertedBooking,
			"last_followed_at":        &now,
		}).Error; err != nil {
			return err
		}
		return (&service.AuditLogService{}).CreateBusinessRecordTx(tx, &service.CreateAuditRecordInput{
			OperatorType:  "admin",
			OperatorID:    c.GetUint64("adminId"),
			OperationType: "quote_inquiry_convert_booking",
			ResourceType:  "quote_inquiry",
			ResourceID:    inquiry.ID,
			Reason:        readAdminReason(c, req.Reason, "报价线索转预约"),
			Result:        "success",
			BeforeState: map[string]interface{}{
				"conversionStatus":     inquiry.ConversionStatus,
				"convertedToBookingId": inquiry.ConvertedToBookingID,
				"followStatus":         inquiry.FollowStatus,
			},
			AfterState: map[string]interface{}{
				"conversionStatus":     "converted",
				"convertedToBookingId": booking.ID,
				"followStatus":         model.LeadFollowStatusConvertedBooking,
			},
			Metadata: map[string]interface{}{
				"bookingId": booking.ID,
			},
			ClientIP:  c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
		})
	}); err != nil {
		switch {
		case errors.Is(err, errQuoteInquiryNotFound):
			response.NotFound(c, "报价线索不存在")
		case errors.Is(err, errQuoteInquiryAlreadyConverted):
			response.BadRequest(c, "该报价线索已转预约")
		case errors.Is(err, errQuoteInquiryOwnerRequired):
			response.BadRequest(c, "匿名报价线索转预约必须指定业主ID")
		case errors.Is(err, errQuoteInquiryOwnerNotFound):
			response.BadRequest(c, "业主不存在")
		case errors.Is(err, errQuoteInquiryOwnerDisabled):
			response.BadRequest(c, "业主账号不可用")
		case errors.Is(err, errQuoteInquiryDecryptFailed):
			response.ServerError(c, "报价线索敏感信息解密失败")
		default:
			respondSchemaAwareDomainMutationError(c, err, "转预约失败", "转预约失败，请联系管理员检查数据库是否已升级")
		}
		return
	}

	if booking == nil {
		response.ServerError(c, "转预约失败")
		return
	}

	response.SuccessWithMessage(c, "报价线索已转预约", booking)
}

var (
	errQuoteInquiryNotFound         = errors.New("quote inquiry not found")
	errQuoteInquiryAlreadyConverted = errors.New("quote inquiry already converted")
	errQuoteInquiryOwnerRequired    = errors.New("quote inquiry owner required")
	errQuoteInquiryOwnerNotFound    = errors.New("quote inquiry owner not found")
	errQuoteInquiryOwnerDisabled    = errors.New("quote inquiry owner disabled")
	errQuoteInquiryDecryptFailed    = errors.New("quote inquiry decrypt failed")
)
