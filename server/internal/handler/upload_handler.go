package handler

import (
	"errors"
	"fmt"
	"home-decoration-server/pkg/response"
	"image"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
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
	imageExtByContentType = map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/gif":  ".gif",
		"image/webp": ".webp",
	}
	unsupportedImageContentTypes = map[string]string{
		"image/heic": "HEIC",
		"image/heif": "HEIF",
		"image/avif": "AVIF",
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
	headerContentType := normalizeContentType(file.Header.Get("Content-Type"))

	if allowedTypes, isImage := imageContentTypesByExt[ext]; isImage {
		if isDangerousUploadContent(contentType, sample) || isDangerousUploadContent(headerContentType, sample) {
			return "", errors.New("不允许上传可执行或脚本文件")
		}
		if _, ok := allowedTypes[contentType]; ok {
			return ext, nil
		}

		if canonicalExt, ok := imageExtByContentType[contentType]; ok {
			if _, allowed := allowedExts[canonicalExt]; allowed {
				return canonicalExt, nil
			}
			return "", errors.New("不支持的图片格式")
		}

		if canonicalExt, ok := imageExtByContentType[headerContentType]; ok {
			if _, allowed := allowedExts[canonicalExt]; allowed {
				return canonicalExt, nil
			}
			return "", errors.New("不支持的图片格式")
		}

		if format := detectUnsupportedImageFormat(contentType, headerContentType, sample); format != "" {
			return "", fmt.Errorf("暂不支持%s图片，请先转换为 JPG/PNG/WEBP 后上传", format)
		}

		if normalizedExt, ok := validateKnownRasterImageByDecode(file, ext, allowedExts); ok {
			return normalizedExt, nil
		}

		return "", errors.New("图片内容无效，请上传 JPG/PNG/GIF/WEBP 图片")
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

func detectUnsupportedImageFormat(contentType string, headerContentType string, sample []byte) string {
	if format := detectUnsupportedImageFormatByType(contentType, headerContentType); format != "" {
		return format
	}
	return detectUnsupportedImageFormatBySample(sample)
}

func detectUnsupportedImageFormatByType(contentTypes ...string) string {
	for _, contentType := range contentTypes {
		if format, ok := unsupportedImageContentTypes[contentType]; ok {
			return format
		}
	}
	return ""
}

func detectUnsupportedImageFormatBySample(sample []byte) string {
	if len(sample) < 12 || string(sample[4:8]) != "ftyp" {
		return ""
	}

	brand := strings.ToLower(string(sample[8:12]))
	switch brand {
	case "heic", "heix", "hevc", "hevx", "heim", "heis":
		return "HEIC"
	case "mif1", "msf1":
		return "HEIF"
	case "avif", "avis":
		return "AVIF"
	default:
		return ""
	}
}

func validateKnownRasterImageByDecode(file *multipart.FileHeader, ext string, allowedExts map[string]struct{}) (string, bool) {
	if ext == ".webp" {
		return "", false
	}

	reader, err := file.Open()
	if err != nil {
		return "", false
	}
	defer reader.Close()

	_, format, err := image.DecodeConfig(reader)
	if err != nil {
		return "", false
	}

	var normalizedExt string
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "jpeg":
		normalizedExt = ".jpg"
	case "png":
		normalizedExt = ".png"
	case "gif":
		normalizedExt = ".gif"
	default:
		return "", false
	}

	if _, ok := allowedExts[normalizedExt]; !ok {
		return "", false
	}

	return normalizedExt, true
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
	asset, err := persistUploadedFile(file, buildUploadPublicPath("cases", filename))
	if err != nil {
		response.Error(c, 500, "保存文件失败")
		return
	}

	response.Success(c, gin.H{
		"url":  asset.URL,
		"path": asset.Path,
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
	monthDir := time.Now().Format("200601")
	asset, err := persistUploadedFile(file, buildUploadPublicPath(filepath.ToSlash(filepath.Join("chat", monthDir)), filename))
	if err != nil {
		response.Error(c, 500, "保存文件失败")
		return
	}

	response.Success(c, gin.H{
		"url":      asset.URL,
		"path":     asset.Path,
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
