package handler

import (
	"fmt"
	"home-decoration-server/pkg/response"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// UploadFile 通用文件上传 (用于聊天、头像等)
func UploadFile(c *gin.Context) {
	// 获取当前登录用户ID
	userID := c.GetUint64("userId")

	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, 400, "请选择要上传的文件")
		return
	}

	// 文件大小限制 50MB
	if file.Size > 50*1024*1024 {
		response.Error(c, 400, "文件大小不能超过50MB")
		return
	}

	// 验证文件类型 (黑名单机制更安全，或者只许白名单)
	ext := strings.ToLower(filepath.Ext(file.Filename))
	// 简单白名单
	allowedExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
		".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true,
		".ppt": true, ".pptx": true, ".txt": true, ".zip": true, ".rar": true,
		".mp4": true, ".mov": true, ".avi": true,
	}

	if !allowedExts[ext] {
		response.Error(c, 400, "不支持的文件格式")
		return
	}

	// 生成唯一文件名
	// 格式: chat_{userId}_{timestamp}_{random}{ext}
	filename := fmt.Sprintf("chat_%d_%d%s", userID, time.Now().UnixNano(), ext)

	// 按年月分文件夹，防止单文件夹文件过多
	monthDir := time.Now().Format("200601")
	uploadDir := filepath.Join("./uploads/chat", monthDir)

	// 确保目录存在
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		response.Error(c, 500, "创建目录失败")
		return
	}

	// 保存文件
	dst := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		response.Error(c, 500, "保存文件失败")
		return
	}

	// 生成访问URL (注意不需要 public_url 前缀，前端会自动拼接或 config 处理，或者这里返回相对路径)
	// Router 中配置了 r.Static("/uploads", "./uploads")
	// 所以 URL 应该是 /uploads/chat/200601/filename
	// 注意 filepath.Join 会用反斜杠，在 URL 中需要替换为正斜杠
	fileURL := fmt.Sprintf("/uploads/chat/%s/%s", monthDir, filename)
	fileURL = strings.ReplaceAll(fileURL, "\\", "/")

	response.Success(c, gin.H{
		"url":      fileURL,
		"filename": file.Filename,
		"size":     file.Size,
		"type":     ext,
	})
}
