package handler

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"
	"log"

	"github.com/gin-gonic/gin"
)

// FixData 修复数据接口
func FixData(c *gin.Context) {
	// 1. 修复 user_id = 0 的 Booking
	var bookings []model.Booking
	if err := repository.DB.Where("user_id = ?", 0).Find(&bookings).Error; err == nil {
		count := len(bookings)
		if count > 0 {
			repository.DB.Model(&model.Booking{}).Where("user_id = ?", 0).Update("user_id", 1)
			log.Printf("[FixData] Fixed %d bookings with user_id=0", count)
		}
	}

	// 2. 修复 designer_id = 0 的 Proposal
	// 获取一个有效的 Provider ID
	var provider model.Provider
	repository.DB.First(&provider)
	if provider.ID > 0 {
		repository.DB.Model(&model.Proposal{}).Where("designer_id = ?", 0).Update("designer_id", provider.ID)
		log.Printf("[FixData] Fixed proposals with designer_id=0 to %d", provider.ID)
	}

	// 3. 确保 Booking 有有效的 Provider ID
	if provider.ID > 0 {
		repository.DB.Model(&model.Booking{}).Where("provider_id = ?", 0).Update("provider_id", provider.ID)
	}

	// 4. 重置过期时间（确保不会马上被 cron 取消）
	repository.DB.Model(&model.Order{}).Where("status = ?", 0).Update("expire_at", "2025-12-31 23:59:59")

	response.SuccessWithMessage(c, "数据修复完成", nil)
}
