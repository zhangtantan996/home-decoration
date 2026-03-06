//go:build ignore
// +build ignore

package main

import (
	"encoding/json"
	"log"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
)

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("配置加载失败:", err)
	}

	// 连接数据库
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	log.Println("开始填充详情页数据...")

	// 获取所有 Provider
	var providers []model.Provider
	repository.DB.Find(&providers)

	for _, p := range providers {
		// 更新 Provider 扩展字段
		updateProviderProfile(&p)

		// 创建案例
		createCases(p.ID, p.ProviderType)

		// 创建评价
		createReviews(p.ID)
	}

	log.Println("详情页数据填充完成！")
}

func updateProviderProfile(p *model.Provider) {
	updates := map[string]interface{}{
		"cover_image":      imgutil.ControlledInspirationCover(p.ID),
		"followers_count":  100 + int(p.ID)*10,
		"team_size":        1,
		"established_year": 2020,
	}

	// 根据类型设置不同的服务介绍
	switch p.ProviderType {
	case 1: // 设计师
		updates["service_intro"] = "专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承\"少即是多\"的设计理念，打造舒适、实用、美观的居住空间。"
		updates["team_size"] = 1
		// 西安区域数据
		areas := [][]string{
			{"雁塔区", "曲江新区", "高新区"},
			{"未央区", "莲湖区", "经开区"},
			{"碑林区", "新城区", "灞桥区"},
		}
		areaJson, _ := json.Marshal(areas[p.ID%3])
		updates["service_area"] = string(areaJson)

	case 2: // 公司
		updates["service_intro"] = "专业装修公司，提供从设计到施工的一站式服务。拥有专业施工团队，严格把控工程质量，让您省心省力。"
		updates["team_size"] = 20 + int(p.ID%10)*5
		certs, _ := json.Marshal([]string{"营业执照", "建筑装饰资质", "安全生产许可证"})
		updates["certifications"] = string(certs)
		areaJson, _ := json.Marshal([]string{"西安市全城"})
		updates["service_area"] = string(areaJson)

	case 3: // 工长
		updates["service_intro"] = "多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。"
		updates["team_size"] = 5 + int(p.ID%5)
		// 西安区域数据
		areas := [][]string{
			{"雁塔区", "高新区"},
			{"莲湖区", "未央区"},
			{"长安区", "曲江新区"},
		}
		areaJson, _ := json.Marshal(areas[p.ID%3])
		updates["service_area"] = string(areaJson)
	}

	repository.DB.Model(p).Updates(updates)
	log.Printf("更新 Provider %d 扩展字段", p.ID)
}

func createCases(providerID uint64, providerType int8) {
	// 检查是否已有案例
	var count int64
	repository.DB.Model(&model.ProviderCase{}).Where("provider_id = ?", providerID).Count(&count)
	if count > 0 {
		return
	}

	// 不同类型的案例模板
	var casesData []struct {
		Title       string
		Style       string
		Area        string
		Description string
	}

	switch providerType {
	case 1: // 设计师
		casesData = []struct {
			Title       string
			Style       string
			Area        string
			Description string
		}{
			{"现代简约三居室", "现代简约", "120㎡", "本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。"},
			{"北欧风两居室", "北欧风格", "90㎡", "小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。"},
			{"新中式别墅设计", "新中式", "280㎡", "传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。"},
		}
	case 2: // 公司
		casesData = []struct {
			Title       string
			Style       string
			Area        string
			Description string
		}{
			{"整装全包案例", "现代轻奢", "140㎡", "从毛坯到精装的全流程整装服务，包含硬装施工、主材选购、软装搭配等一站式解决方案。"},
			{"老房翻新改造", "简约现代", "100㎡", "20年老房焕新颜，水电全改造，空间重新规划，让老房子变成现代舒适住宅。"},
			{"商业空间装修", "工业风", "500㎡", "办公空间整体设计装修，兼顾美观与实用，打造高效舒适的工作环境。"},
		}
	case 3: // 工长
		casesData = []struct {
			Title       string
			Style       string
			Area        string
			Description string
		}{
			{"厨卫改造项目", "实用主义", "15㎡", "针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。"},
			{"水电改造工程", "标准施工", "120㎡", "全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。"},
			{"木工吊顶施工", "精工细作", "80㎡", "客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。"},
		}
	}

	for i, c := range casesData {
		seed := providerID + uint64(i)
		imagesJSON, _ := json.Marshal(imgutil.ControlledInspirationGallery(seed))
		providerCase := model.ProviderCase{
			ProviderID:  providerID,
			Title:       c.Title,
			CoverImage:  imgutil.ControlledInspirationCover(seed),
			Style:       c.Style,
			Area:        c.Area,
			Year:        "2024",
			Description: c.Description,
			Images:      string(imagesJSON),
			SortOrder:   i,
		}
		providerCase.CreatedAt = time.Now()
		providerCase.UpdatedAt = time.Now()

		repository.DB.Create(&providerCase)
	}
	log.Printf("为 Provider %d 创建 %d 个案例", providerID, len(casesData))
}

func createReviews(providerID uint64) {
	// 检查是否已有评价
	var count int64
	repository.DB.Model(&model.ProviderReview{}).Where("provider_id = ?", providerID).Count(&count)
	if count > 0 {
		return
	}

	// 获取一些用户作为评价者
	var users []model.User
	repository.DB.Where("user_type = 1").Limit(10).Find(&users)
	if len(users) == 0 {
		// 如果没有业主用户，创建一些
		userNames := []string{"王女士", "李先生", "张女士", "刘先生", "陈小姐", "赵先生", "周女士", "吴先生"}
		avatars := []string{
			imgutil.DefaultInspirationAvatarPath,
			imgutil.DefaultInspirationAvatarPath,
			imgutil.DefaultInspirationAvatarPath,
			imgutil.DefaultInspirationAvatarPath,
		}
		for i := 0; i < 8; i++ {
			user := model.User{
				Phone:    "138" + string(rune('0'+i%10)) + "0008000",
				Nickname: userNames[i],
				Avatar:   avatars[i%len(avatars)],
				UserType: 1,
				Status:   1,
			}
			repository.DB.FirstOrCreate(&user, model.User{Phone: user.Phone})
			users = append(users, user)
		}
	}

	// 丰富的评价数据模板
	reviews := []struct {
		Rating      float32
		Content     string
		HasImages   bool
		ServiceType string
		Area        string
		Style       string
		Tags        []string
	}{
		{5.0, "非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！", true, "整装", "120㎡", "现代简约", []string{"服务好", "设计赞", "沟通顺畅"}},
		{4.5, "整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！", false, "整装", "95㎡", "北欧风格", []string{"工期准时", "质量好"}},
		{5.0, "服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。", true, "半包", "110㎡", "现代简约", []string{"细节到位", "质量好", "服务好"}},
		{4.0, "设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。", false, "整装", "88㎡", "简约现代", []string{"性价比高"}},
		{5.0, "第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！", true, "整装", "75㎡", "新中式", []string{"服务好", "设计赞", "老客户"}},
		{4.5, "从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。", false, "半包", "130㎡", "轻奢风格", []string{"专业", "进度透明"}},
	}

	// 根据 providerID 打乱评价顺序，使每个 Provider 的评价不同
	numReviews := 3 + int(providerID%4) // 3, 4, 5, 6
	startIdx := int(providerID % 6)     // 从不同位置开始

	for i := 0; i < numReviews; i++ {
		reviewIdx := (startIdx + i) % len(reviews)
		r := reviews[reviewIdx]
		userIdx := (int(providerID) + i) % len(users)

		// 处理 tags
		tagsJSON, _ := json.Marshal(r.Tags)

		// 处理 images
		var imagesJSON string
		if r.HasImages {
			imgData, _ := json.Marshal(imgutil.ControlledInspirationGallery(providerID + uint64(reviewIdx) + uint64(i)))
			imagesJSON = string(imgData)
		}

		review := model.ProviderReview{
			ProviderID:   providerID,
			UserID:       users[userIdx].ID,
			Rating:       r.Rating,
			Content:      r.Content,
			Images:       imagesJSON,
			ServiceType:  r.ServiceType,
			Area:         r.Area,
			Style:        r.Style,
			Tags:         string(tagsJSON),
			HelpfulCount: (numReviews - i) * 5,
		}
		review.CreatedAt = time.Now().AddDate(0, 0, -i*7-int(providerID%10))
		review.UpdatedAt = time.Now()

		repository.DB.Create(&review)
	}

	// 更新 Provider 的评价数量
	repository.DB.Model(&model.Provider{}).Where("id = ?", providerID).Update("review_count", numReviews)

	log.Printf("为 Provider %d 创建 %d 条评价", providerID, numReviews)
}
