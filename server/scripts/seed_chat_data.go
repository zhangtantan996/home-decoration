package main

import (
	"log"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 初始化数据库
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	log.Println("🌱 开始插入聊天测试数据...")

	// 获取现有用户 (假设至少有 2 个用户)
	var users []model.User
	repository.DB.Limit(5).Find(&users)

	if len(users) < 2 {
		log.Println("❌ 至少需要 2 个用户才能创建测试会话，请先运行 seed_data.go")
		return
	}

	// 创建测试会话和消息
	testConversations := []struct {
		User1ID  uint64
		User2ID  uint64
		Messages []string
	}{
		{
			User1ID: uint64(users[0].ID),
			User2ID: uint64(users[1].ID),
			Messages: []string{
				"您好，我是张设计师，很高兴为您服务！",
				"您好，我想咨询一下现代简约风格的设计方案",
				"好的，请问您的房屋面积是多少？有什么特殊的功能需求吗？",
				"120平米，三室两厅。希望客厅和餐厅能够做开放式设计，主卧需要带衣帽间",
				"明白了，这个需求很常见。我之前做过类似的案例，效果非常不错。",
				"新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！",
			},
		},
	}

	// 如果有更多用户，添加更多会话
	if len(users) >= 3 {
		testConversations = append(testConversations, struct {
			User1ID  uint64
			User2ID  uint64
			Messages []string
		}{
			User1ID: uint64(users[0].ID),
			User2ID: uint64(users[2].ID),
			Messages: []string{
				"李师傅，水电改造什么时候能完工？",
				"预计明天下午可以完成，今天正在做最后的验收检查",
				"好的，辛苦了！验收通过后我会安排第一期款项",
				"收到，您放心！",
			},
		})
	}

	for _, tc := range testConversations {
		convID := model.GetConversationID(tc.User1ID, tc.User2ID)

		// 创建或更新会话
		conv := model.Conversation{
			ID:      convID,
			User1ID: tc.User1ID,
			User2ID: tc.User2ID,
		}

		result := repository.DB.Where("id = ?", convID).First(&conv)
		if result.RowsAffected == 0 {
			repository.DB.Create(&conv)
			log.Printf("✅ 创建会话: %s", convID)
		} else {
			log.Printf("⏭️ 会话已存在: %s", convID)
		}

		// 检查是否已有消息
		var msgCount int64
		repository.DB.Model(&model.ChatMessage{}).Where("conversation_id = ?", convID).Count(&msgCount)
		if msgCount > 0 {
			log.Printf("⏭️ 会话 %s 已有 %d 条消息，跳过插入", convID, msgCount)
			continue
		}

		// 插入消息
		baseTime := time.Now().Add(-time.Hour) // 从 1 小时前开始
		for i, content := range tc.Messages {
			var senderID, receiverID uint64
			if i%2 == 0 {
				// 偶数消息由 User2 发送 (模拟服务商)
				senderID = tc.User2ID
				receiverID = tc.User1ID
			} else {
				// 奇数消息由 User1 发送 (模拟用户)
				senderID = tc.User1ID
				receiverID = tc.User2ID
			}

			msg := model.ChatMessage{
				ConversationID: convID,
				SenderID:       senderID,
				ReceiverID:     receiverID,
				Content:        content,
				MsgType:        1,                      // 文本
				IsRead:         i < len(tc.Messages)-1, // 最后一条未读
				CreatedAt:      baseTime.Add(time.Duration(i*2) * time.Minute),
			}
			repository.DB.Create(&msg)
		}

		// 更新会话最后消息
		lastMsg := tc.Messages[len(tc.Messages)-1]
		repository.DB.Model(&conv).Updates(map[string]interface{}{
			"last_message_content": lastMsg,
			"last_message_time":    time.Now(),
			"user1_unread":         1, // User1 有 1 条未读 (最后一条来自 User2)
		})

		log.Printf("✅ 插入 %d 条测试消息到会话 %s", len(tc.Messages), convID)
	}

	log.Println("🎉 聊天测试数据插入完成！")
}
