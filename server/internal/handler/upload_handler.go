package handler

import (
	"errors"
	"fmt"
	imgutil "home-decoration-server/internal/utils/image"
	"home-decoration-server/pkg/response"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	caseUploadAllowedExts = map[string]struct{}{
		".jpg": {}, ".jpeg": {}, ".png": {}, ".webp": {},
		".pdf": {}, ".doc": {}, ".docx": {}, ".xls": {}, ".xlsx": {},
		".ppt": {}, ".pptx": {}, ".txt": {}, ".zip": {}, ".rar": {},
	}
	chatUploadAllowedExts = map[string]struct{}{
		".jpg": {}, ".jpeg": {}, ".png": {}, ".gif": {}, ".webp": {},
		".pdf": {}, ".doc": {}, ".docx": {}, ".xls": {}, ".xlsx": {},
		".ppt": {}, ".pptx": {}, ".txt": {}, ".zip": {}, ".rar": {},
		".mp4": {}, ".mov": {}, ".avi": {},
		".m4a": {}, ".aac": {}, ".mp3": {}, ".wav": {}, ".ogg": {},
	}
	avatarUploadAllowedExts = map[string]struct{}{
		".jpg": {}, ".jpeg": {}, ".png": {}, ".gif": {},
	}
	merchantUploadAllowedExts = map[string]struct{}{
		".jpg": {}, ".jpeg": {}, ".png": {}, ".webp": {},
		".pdf": {}, ".doc": {}, ".docx": {}, ".xls": {}, ".xlsx": {},
		".ppt": {}, ".pptx": {}, ".txt": {}, ".zip": {}, ".rar": {},
		".dwg": {}, ".dxf": {},
	}
	imageContentTypesByExt = map[string]map[string]struct{}{
		".jpg":  {"image/jpeg": {}},
		".jpeg": {"image/jpeg": {}},
		".png":  {"image/png": {}},
		".gif":  {"image/gif": {}},
		".webp": {"image/webp": {}},
	}
	dangerousUploadContentTypes = map[string]struct{}{
		"text/html":                {},
		"application/xhtml+xml":    {},
		"image/svg+xml":            {},
		"application/javascript":   {},
		"text/javascript":          {},
		"application/x-javascript": {},
		"application/x-httpd-php":  {},
		"application/x-php":        {},
		"text/x-php":               {},
		"application/x-sh":         {},
		"text/x-shellscript":       {},
	}
	dangerousUploadMarkers = []string{
		"<?php",
		"<!doctype html",
		"<html",
		"<script",
		"<svg",
		"#!/bin/",
		"#!/usr/bin/",
	}
)

func validateUploadFileHeader(file *multipart.FileHeader, allowedExts map[string]struct{}) (string, error) {
	if file == nil {
		return "", errors.New("请选择要上传的文件")
	}

	ext := strings.ToLower(filepath.Ext(filepath.Base(file.Filename)))
	if _, ok := allowedExts[ext]; !ok {
		return "", errors.New("不支持的文件格式")
	}

	contentType, sample, err := sniffUploadFile(file)
	if err != nil {
		return "", errors.New("读取上传文件失败")
	}

	if allowedTypes, isImage := imageContentTypesByExt[ext]; isImage {
		if _, ok := allowedTypes[contentType]; !ok {
			return "", errors.New("图片内容与扩展名不匹配")
		}
		return ext, nil
	}

	if isDangerousUploadContent(contentType, sample) {
		return "", errors.New("不允许上传可执行或脚本文件")
	}

	return ext, nil
}

func sniffUploadFile(file *multipart.FileHeader) (string, []byte, error) {
	reader, err := file.Open()
	if err != nil {
		return "", nil, err
	}
	defer reader.Close()

	sample := make([]byte, 512)
	n, err := io.ReadFull(reader, sample)
	if err != nil && err != io.ErrUnexpectedEOF {
		return "", nil, err
	}

	sample = sample[:n]
	contentType := normalizeContentType(http.DetectContentType(sample))
	return contentType, sample, nil
}

func normalizeContentType(raw string) string {
	base, _, ok := strings.Cut(strings.ToLower(strings.TrimSpace(raw)), ";")
	if !ok {
		return strings.ToLower(strings.TrimSpace(raw))
	}
	return strings.TrimSpace(base)
}

func isDangerousUploadContent(contentType string, sample []byte) bool {
	if _, ok := dangerousUploadContentTypes[contentType]; ok {
		return true
	}

	lowerSample := strings.ToLower(string(sample))
	for _, marker := range dangerousUploadMarkers {
		if strings.Contains(lowerSample, marker) {
			return true
		}
	}

	return false
}

func saveCaseUpload(c *gin.Context, ownerID uint64, filenamePrefix string) {
	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, 400, "请选择要上传的文件")
		return
	}

	if file.Size > 20*1024*1024 {
		response.Error(c, 400, "文件大小不能超过20MB")
		return
	}

	ext, err := validateUploadFileHeader(file, caseUploadAllowedExts)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	filename := fmt.Sprintf("%s_%d_%d%s", filenamePrefix, ownerID, time.Now().UnixNano(), ext)
	uploadDir := "./uploads/cases"

	if err := os.MkdirAll(uploadDir, 0750); err != nil {
		response.Error(c, 500, "创建目录失败")
		return
	}

	dst := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		response.Error(c, 500, "保存文件失败")
		return
	}

	imageURL := fmt.Sprintf("/uploads/cases/%s", filename)

	response.Success(c, gin.H{
		"url":  imgutil.GetFullImageURL(imageURL),
		"path": imageURL,
	})
}

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

	ext, err := validateUploadFileHeader(file, chatUploadAllowedExts)
	if err != nil {
		response.Error(c, 400, err.Error())
		return
	}

	// 生成唯一文件名
	// 格式: chat_{userId}_{timestamp}_{random}{ext}
	filename := fmt.Sprintf("chat_%d_%d%s", userID, time.Now().UnixNano(), ext)

	// 按年月分文件夹，防止单文件夹文件过多
	monthDir := time.Now().Format("200601")
	uploadDir := filepath.Join("./uploads/chat", monthDir)

	// 确保目录存在
	if err := os.MkdirAll(uploadDir, 0750); err != nil {
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
		"url":      imgutil.GetFullImageURL(fileURL),
		"path":     fileURL,
		"filename": file.Filename,
		"size":     file.Size,
		"type":     ext,
	})
}

// AdminUploadImage 管理员上传作品图片 (封面/详情图)
func AdminUploadImage(c *gin.Context) {
	adminID := c.GetUint64("admin_id")
	saveCaseUpload(c, adminID, "admin_case")
}
