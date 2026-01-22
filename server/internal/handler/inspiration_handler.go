package handler

import (
	"home-decoration-server/internal/service"
	"home-decoration-server/pkg/response"
	"strconv"

	"github.com/gin-gonic/gin"
)

var inspirationService = &service.InspirationService{}

// GetInspirationList 获取灵感图库列表
// 支持未登录访问（点赞数/评论数）
// 登录后返回用户状态（isLiked/isFavorited）
func GetInspirationList(c *gin.Context) {
	var query service.InspirationQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	var userID *uint64
	if uid := c.GetUint64("userId"); uid > 0 {
		userID = &uid
	}

	items, total, err := inspirationService.ListInspiration(&query, userID)
	if err != nil {
		response.ServerError(c, "获取灵感列表失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"list":     items,
		"total":    total,
		"page":     query.Page,
		"pageSize": query.PageSize,
	})
}

// LikeCase 点赞案例
func LikeCase(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	caseIDStr := c.Param("id")
	caseID, err := strconv.ParseUint(caseIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的案例ID")
		return
	}

	likeCount, isLiked, err := inspirationService.LikeCase(userID, caseID)
	if err != nil {
		response.ServerError(c, "点赞失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"likeCount": likeCount,
		"isLiked":   isLiked,
	})
}

// UnlikeCase 取消点赞案例
func UnlikeCase(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	caseIDStr := c.Param("id")
	caseID, err := strconv.ParseUint(caseIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的案例ID")
		return
	}

	likeCount, isLiked, err := inspirationService.UnlikeCase(userID, caseID)
	if err != nil {
		response.ServerError(c, "取消点赞失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"likeCount": likeCount,
		"isLiked":   isLiked,
	})
}

func FavoriteCase(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	caseIDStr := c.Param("id")
	caseID, err := strconv.ParseUint(caseIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的案例ID")
		return
	}

	if err := inspirationService.FavoriteCase(userID, caseID); err != nil {
		response.ServerError(c, "收藏失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "收藏成功"})
}

func UnfavoriteCase(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	caseIDStr := c.Param("id")
	caseID, err := strconv.ParseUint(caseIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的案例ID")
		return
	}

	if err := inspirationService.UnfavoriteCase(userID, caseID); err != nil {
		response.ServerError(c, "取消收藏失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "已取消收藏"})
}

func FavoriteMaterialShop(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	shopIDStr := c.Param("id")
	shopID, err := strconv.ParseUint(shopIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的门店ID")
		return
	}

	if err := inspirationService.FavoriteMaterialShop(userID, shopID); err != nil {
		response.ServerError(c, "收藏失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "收藏成功"})
}

func UnfavoriteMaterialShop(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	shopIDStr := c.Param("id")
	shopID, err := strconv.ParseUint(shopIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的门店ID")
		return
	}

	if err := inspirationService.UnfavoriteMaterialShop(userID, shopID); err != nil {
		response.ServerError(c, "取消收藏失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "已取消收藏"})
}

func GetCaseComments(c *gin.Context) {
	caseIDStr := c.Param("id")
	caseID, err := strconv.ParseUint(caseIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的案例ID")
		return
	}

	var query service.CommentQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	comments, total, err := inspirationService.GetCaseComments(caseID, &query)
	if err != nil {
		response.ServerError(c, "获取评论失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"list":     comments,
		"total":    total,
		"page":     query.Page,
		"pageSize": query.PageSize,
	})
}

func CreateCaseComment(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	caseIDStr := c.Param("id")
	caseID, err := strconv.ParseUint(caseIDStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的案例ID")
		return
	}

	var req service.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}
	req.CaseID = caseID
	req.UserID = userID

	comment, err := inspirationService.CreateCaseComment(&req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, comment)
}

func GetUserFavorites(c *gin.Context) {
	userID := c.GetUint64("userId")
	if userID == 0 {
		response.Unauthorized(c, "未登录")
		return
	}

	var query service.FavoriteQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	items, total, err := inspirationService.GetUserFavorites(userID, &query)
	if err != nil {
		response.ServerError(c, "获取收藏列表失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"list":     items,
		"total":    total,
		"page":     query.Page,
		"pageSize": query.PageSize,
	})
}
