//go:build ignore
// +build ignore

package main

import (
	"encoding/json"
	"fmt"
	"log"

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

	// 连接数据库
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	fmt.Println("Seeding material shops...")

	shops := []model.MaterialShop{
		{
			Type:              "showroom",
			Name:              "红星美凯龙家居馆",
			Cover:             "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
			BrandLogo:         "",
			Rating:            4.8,
			ReviewCount:       1256,
			MainProducts:      toJSON([]string{"瓷砖", "地板", "卫浴", "橱柜", "灯饰"}),
			ProductCategories: "瓷砖,地板,卫浴,橱柜,灯饰",
			Address:           "北京市朝阳区东四环北路6号",
			Latitude:          39.9219,
			Longitude:         116.4837,
			OpenTime:          "09:00-21:00",
			Tags:              toJSON([]string{"免费停车", "设计服务", "送货上门"}),
			IsVerified:        true,
		},
		{
			Type:              "brand",
			Name:              "TOTO卫浴专卖店",
			Cover:             "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800",
			BrandLogo:         "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/TOTO_logo.svg/200px-TOTO_logo.svg.png",
			Rating:            4.9,
			ReviewCount:       892,
			MainProducts:      toJSON([]string{"智能马桶", "花洒", "浴缸", "洗脸盆"}),
			ProductCategories: "卫浴",
			Address:           "北京市海淀区中关村大街15号",
			Latitude:          39.9789,
			Longitude:         116.3074,
			OpenTime:          "10:00-21:30",
			Tags:              toJSON([]string{"正品保障", "安装服务", "全国联保"}),
			IsVerified:        true,
		},
		{
			Type:              "showroom",
			Name:              "居然之家设计中心",
			Cover:             "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800",
			BrandLogo:         "",
			Rating:            4.7,
			ReviewCount:       2341,
			MainProducts:      toJSON([]string{"全屋定制", "瓷砖", "地板", "门窗", "智能家居"}),
			ProductCategories: "定制,瓷砖,地板,门窗",
			Address:           "北京市丰台区南四环西路1号",
			Latitude:          39.8289,
			Longitude:         116.3193,
			OpenTime:          "09:30-21:00",
			Tags:              toJSON([]string{"免费设计", "VR体验", "品质保障"}),
			IsVerified:        true,
		},
		{
			Type:              "brand",
			Name:              "马可波罗瓷砖旗舰店",
			Cover:             "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
			BrandLogo:         "https://example.com/marco-polo-logo.png",
			Rating:            4.6,
			ReviewCount:       567,
			MainProducts:      toJSON([]string{"抛光砖", "仿古砖", "木纹砖", "大理石瓷砖"}),
			ProductCategories: "瓷砖",
			Address:           "北京市朝阳区建国路88号",
			Latitude:          39.9075,
			Longitude:         116.4714,
			OpenTime:          "09:00-20:00",
			Tags:              toJSON([]string{"样板间展示", "免费切割", "施工指导"}),
			IsVerified:        true,
		},
		{
			Type:              "brand",
			Name:              "大自然地板专卖",
			Cover:             "https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800",
			BrandLogo:         "https://example.com/nature-floor-logo.png",
			Rating:            4.5,
			ReviewCount:       423,
			MainProducts:      toJSON([]string{"实木地板", "复合地板", "强化地板"}),
			ProductCategories: "地板",
			Address:           "北京市西城区月坛北街甲2号",
			Latitude:          39.9134,
			Longitude:         116.3479,
			OpenTime:          "09:00-19:00",
			Tags:              toJSON([]string{"环保认证", "免费量房", "终身维护"}),
			IsVerified:        true,
		},
	}

	for _, shop := range shops {
		result := repository.DB.Create(&shop)
		if result.Error != nil {
			log.Printf("Failed to create shop '%s': %v", shop.Name, result.Error)
		} else {
			fmt.Printf("Created shop: %s (ID: %d)\n", shop.Name, shop.ID)
		}
	}

	fmt.Println("Seed completed!")
}

func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
