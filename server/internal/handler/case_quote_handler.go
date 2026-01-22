package handler

import (
	"errors"
	"home-decoration-server/internal/model"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"

	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

type caseDetailResponse struct {
	*model.ProviderCase
	LikeCount    int64 `json:"likeCount"`
	CommentCount int64 `json:"commentCount"`
	IsLiked      bool  `json:"isLiked"`
	IsFavorited  bool  `json:"isFavorited"`
}

// GetCaseDetail 获取案例详情（公开接口，不含报价明细）
func GetCaseDetail(c *gin.Context) {
	caseID := parseUint64(c.Param("id"))
	if caseID == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	var userID *uint64
	if uid := c.GetUint64("userId"); uid > 0 {
		userID = &uid
	}

	caseDetail, err := caseService.GetCaseDetail(caseID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "案例不存在")
			return
		}
		response.ServerError(c, "查询失败")
		return
	}

	caseDetail.CoverImage = imgutil.GetFullImageURL(caseDetail.CoverImage)
	caseDetail.Images = imgutil.NormalizeImageURLsJSON(caseDetail.Images)

	socialStats := inspirationService.GetCaseSocialStats(caseID, userID)
	response.Success(c, caseDetailResponse{
		ProviderCase: caseDetail,
		LikeCount:    socialStats.LikeCount,
		CommentCount: socialStats.CommentCount,
		IsLiked:      socialStats.IsLiked,
		IsFavorited:  socialStats.IsFavorited,
	})
}

// GetCaseQuote 获取案例报价明细（必须登录，不提供下载）
func GetCaseQuote(c *gin.Context) {
	caseID := parseUint64(c.Param("id"))
	if caseID == 0 {
		response.BadRequest(c, "ID无效")
		return
	}

	quote, err := caseService.GetCaseQuote(caseID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "案例不存在")
			return
		}
		response.ServerError(c, "查询失败")
		return
	}

	response.Success(c, quote)
}
