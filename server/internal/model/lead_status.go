package model

import "strings"

const (
	LeadFollowStatusPendingContact   = "pending_contact"
	LeadFollowStatusContacted        = "contacted"
	LeadFollowStatusInterested       = "interested"
	LeadFollowStatusInvalid          = "invalid"
	LeadFollowStatusConvertedProject = "converted_project"
	LeadFollowStatusPendingBooking   = "pending_booking"
	LeadFollowStatusConvertedBooking = "converted_booking"
	LeadFollowStatusClosed           = "closed"
)

const (
	LeadQualityUnknown    = "unknown"
	LeadQualityLowIntent  = "low_intent"
	LeadQualityValid      = "valid"
	LeadQualityHighIntent = "high_intent"
	LeadQualityInvalid    = "invalid"
)

func NormalizeLeadFollowStatus(value string) string {
	switch strings.TrimSpace(value) {
	case "", "pending", "待联系":
		return LeadFollowStatusPendingContact
	case LeadFollowStatusPendingContact:
		return LeadFollowStatusPendingContact
	case "已联系", LeadFollowStatusContacted:
		return LeadFollowStatusContacted
	case "有意向", LeadFollowStatusInterested:
		return LeadFollowStatusInterested
	case "无效线索", LeadFollowStatusInvalid:
		return LeadFollowStatusInvalid
	case "已转项目", "converted", LeadFollowStatusConvertedProject:
		return LeadFollowStatusConvertedProject
	case "待转预约", LeadFollowStatusPendingBooking:
		return LeadFollowStatusPendingBooking
	case "已转预约", LeadFollowStatusConvertedBooking:
		return LeadFollowStatusConvertedBooking
	case "已关闭", LeadFollowStatusClosed:
		return LeadFollowStatusClosed
	default:
		return ""
	}
}

func IsValidLeadFollowStatus(value string) bool {
	return NormalizeLeadFollowStatus(value) != ""
}

func NormalizeLeadQuality(value string) string {
	switch strings.TrimSpace(value) {
	case "", "unknown", "未知":
		return LeadQualityUnknown
	case "low_intent", "低意向":
		return LeadQualityLowIntent
	case "valid", "有效", "真实需求":
		return LeadQualityValid
	case "high_intent", "高意向":
		return LeadQualityHighIntent
	case "invalid", "无效":
		return LeadQualityInvalid
	default:
		return ""
	}
}

func IsValidLeadQuality(value string) bool {
	return NormalizeLeadQuality(value) != ""
}
