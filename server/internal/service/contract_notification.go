package service

import (
	"fmt"
)

// NotifyContractUserSigned 通知商家用户已签署合同
func (d *NotificationDispatcher) NotifyContractUserSigned(providerUserID, contractID, projectID uint64) {
	if providerUserID == 0 || contractID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      providerUserID,
		UserType:    "provider",
		Title:       "用户已签署合同",
		Content:     "用户已完成合同签署，请尽快签署合同。",
		Type:        "contract.user_signed",
		RelatedID:   contractID,
		RelatedType: "contract",
		ActionURL:   fmt.Sprintf("/contracts/%d", contractID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"contractId": contractID,
			"projectId":  projectID,
		},
	})
}

// NotifyContractProviderSigned 通知用户商家已签署合同
func (d *NotificationDispatcher) NotifyContractProviderSigned(userID, contractID, projectID uint64) {
	if userID == 0 || contractID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "商家已签署合同",
		Content:     "商家已完成合同签署，合同已生效，请支付定金。",
		Type:        "contract.provider_signed",
		RelatedID:   contractID,
		RelatedType: "contract",
		ActionURL:   fmt.Sprintf("/contracts/%d", contractID),
		Category:    NotificationCategoryProject,
		Extra: map[string]interface{}{
			"contractId": contractID,
			"projectId":  projectID,
		},
	})
}

// NotifyContractDepositPaid 通知合同定金已支付
func (d *NotificationDispatcher) NotifyContractDepositPaid(userID, contractID, projectID uint64) {
	if userID == 0 || contractID == 0 {
		return
	}
	_ = d.service.Create(&CreateNotificationInput{
		UserID:      userID,
		UserType:    "user",
		Title:       "定金支付成功",
		Content:     "合同定金已支付成功，合同已生效。",
		Type:        "contract.deposit_paid",
		RelatedID:   contractID,
		RelatedType: "contract",
		ActionURL:   fmt.Sprintf("/contracts/%d", contractID),
		Category:    NotificationCategoryPayment,
		Extra: map[string]interface{}{
			"contractId": contractID,
			"projectId":  projectID,
		},
	})
}
