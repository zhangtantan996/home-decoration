package main

import (
	"fmt"
	"log"
	"strings"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/utils/tencentim"
)

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 初始化数据库连接
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	// 初始化 IM 客户端
	if err := tencentim.InitClient(); err != nil {
		log.Fatalf("初始化 IM 客户端失败: %v", err)
	}

	if !tencentim.IsEnabled() {
		log.Println("⚠️  腾讯云 IM 未启用，请先在后台配置 SDKAppID 和 SecretKey")
		return
	}

	// 查询所有用户
	var users []model.User
	if err := repository.DB.Find(&users).Error; err != nil {
		log.Fatalf("查询用户失败: %v", err)
	}

	log.Printf("📋 共找到 %d 个用户需要同步\n", len(users))

	successCount := 0
	failCount := 0

	for i, user := range users {
		// 处理昵称
		nickname := user.Nickname
		if nickname == "" {
			suffix := ""
			if len(user.Phone) >= 4 {
				suffix = user.Phone[len(user.Phone)-4:]
			}
			nickname = fmt.Sprintf("用户%s", suffix)
		}

		// 处理头像 URL
		avatar := getFullImageURL(user.Avatar, cfg.Server.PublicURL)

		// 同步到腾讯云 IM
		if err := tencentim.SyncUserToIM(user.ID, nickname, avatar); err != nil {
			log.Printf("❌ [%d/%d] 用户 %d 同步失败: %v\n", i+1, len(users), user.ID, err)
			failCount++
		} else {
			log.Printf("✅ [%d/%d] 用户 %d (%s) 同步成功\n", i+1, len(users), user.ID, nickname)
			successCount++
		}
	}

	log.Printf("\n========== 同步完成 ==========")
	log.Printf("✅ 成功: %d", successCount)
	log.Printf("❌ 失败: %d", failCount)
	log.Printf("📊 总计: %d", len(users))
}

// getFullImageURL 将相对路径转换为完整 URL
func getFullImageURL(path, baseURL string) string {
	if path == "" {
		return ""
	}

	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path
	}

	baseURL = strings.TrimRight(baseURL, "/")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	return baseURL + path
}
