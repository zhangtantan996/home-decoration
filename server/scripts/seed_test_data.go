package main

import (
	"fmt"
	"log"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

// 测试数据标记前缀 - 方便后续清理
const TEST_PREFIX = "[TEST]"

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("配置加载失败: %v", err)
	}

	// 连接数据库
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	db := repository.DB

	fmt.Println("========================================")
	fmt.Println("开始插入测试数据...")
	fmt.Println("测试数据前缀:", TEST_PREFIX)
	fmt.Println("========================================")

	// ==================== 1. 创建测试用户 ====================
	testUsers := []model.User{
		{Phone: "13900001001", Nickname: TEST_PREFIX + "业主张三", UserType: 1, Status: 1},
		{Phone: "13900001002", Nickname: TEST_PREFIX + "业主李四", UserType: 1, Status: 1},
		{Phone: "13900001003", Nickname: TEST_PREFIX + "业主王五", UserType: 1, Status: 1},
		{Phone: "13900002001", Nickname: TEST_PREFIX + "设计师小王", UserType: 2, Status: 1},
		{Phone: "13900002002", Nickname: TEST_PREFIX + "设计师小李", UserType: 2, Status: 1},
		{Phone: "13900002003", Nickname: TEST_PREFIX + "装修公司老板", UserType: 2, Status: 1},
		{Phone: "13900002004", Nickname: TEST_PREFIX + "工长老张", UserType: 2, Status: 1},
		{Phone: "13900003001", Nickname: TEST_PREFIX + "水电工小陈", UserType: 3, Status: 1},
		{Phone: "13900003002", Nickname: TEST_PREFIX + "木工师傅", UserType: 3, Status: 1},
	}

	for i := range testUsers {
		if err := db.Where("phone = ?", testUsers[i].Phone).FirstOrCreate(&testUsers[i]).Error; err != nil {
			log.Printf("创建用户失败: %v", err)
		}
	}
	fmt.Printf("✅ 创建 %d 个测试用户\n", len(testUsers))

	// ==================== 2. 创建测试服务商 ====================
	testProviders := []model.Provider{
		{
			UserID:        testUsers[3].ID, // 设计师小王
			ProviderType:  1,               // 设计师
			CompanyName:   TEST_PREFIX + "王氏设计工作室",
			Rating:        4.9,
			RestoreRate:   95.5,
			BudgetControl: 92.0,
			CompletedCnt:  56,
			Verified:      true,
			Latitude:      30.2741,
			Longitude:     120.1551,
		},
		{
			UserID:        testUsers[4].ID, // 设计师小李
			ProviderType:  1,               // 设计师
			CompanyName:   TEST_PREFIX + "简约空间设计",
			Rating:        4.7,
			RestoreRate:   88.0,
			BudgetControl: 90.0,
			CompletedCnt:  32,
			Verified:      true,
			Latitude:      30.2850,
			Longitude:     120.1620,
		},
		{
			UserID:        testUsers[5].ID, // 装修公司老板
			ProviderType:  2,               // 公司
			CompanyName:   TEST_PREFIX + "优居装饰有限公司",
			LicenseNo:     "TEST-91330000MA1XXXXX",
			Rating:        4.8,
			RestoreRate:   92.0,
			BudgetControl: 88.0,
			CompletedCnt:  128,
			Verified:      true,
			Latitude:      30.2600,
			Longitude:     120.1400,
		},
		{
			UserID:        testUsers[6].ID, // 工长老张
			ProviderType:  3,               // 工长
			CompanyName:   TEST_PREFIX + "张工长施工队",
			Rating:        4.6,
			RestoreRate:   85.0,
			BudgetControl: 95.0,
			CompletedCnt:  89,
			Verified:      true,
			Latitude:      30.2900,
			Longitude:     120.1700,
		},
	}

	for i := range testProviders {
		if err := db.Where("user_id = ?", testProviders[i].UserID).FirstOrCreate(&testProviders[i]).Error; err != nil {
			log.Printf("创建服务商失败: %v", err)
		}
	}
	fmt.Printf("✅ 创建 %d 个测试服务商\n", len(testProviders))

	// ==================== 3. 创建测试工人 ====================
	testWorkers := []model.Worker{
		{
			UserID:     testUsers[7].ID,
			SkillType:  "水电",
			Origin:     "江西",
			CertWater:  true,
			CertHeight: false,
			HourlyRate: 150,
			Insured:    true,
			Available:  true,
			Latitude:   30.2800,
			Longitude:  120.1600,
		},
		{
			UserID:     testUsers[8].ID,
			SkillType:  "木工",
			Origin:     "安徽",
			CertWater:  false,
			CertHeight: true,
			HourlyRate: 180,
			Insured:    true,
			Available:  true,
			Latitude:   30.2700,
			Longitude:  120.1500,
		},
	}

	for i := range testWorkers {
		if err := db.Where("user_id = ?", testWorkers[i].UserID).FirstOrCreate(&testWorkers[i]).Error; err != nil {
			log.Printf("创建工人失败: %v", err)
		}
	}
	fmt.Printf("✅ 创建 %d 个测试工人\n", len(testWorkers))

	// ==================== 4. 创建测试项目 ====================
	now := time.Now()
	startDate := now.AddDate(0, 0, -30)
	expectedEnd := now.AddDate(0, 2, 0)

	testProjects := []model.Project{
		{
			OwnerID:      testUsers[0].ID,
			ProviderID:   testProviders[0].ID,
			Name:         TEST_PREFIX + "西溪诚园 A栋1201",
			Address:      "杭州市西湖区西溪诚园A栋1201室",
			Latitude:     30.2741,
			Longitude:    120.1551,
			Area:         120.5,
			Budget:       350000,
			Status:       1, // 进行中
			CurrentPhase: "水电阶段",
			StartDate:    &startDate,
			ExpectedEnd:  &expectedEnd,
		},
		{
			OwnerID:      testUsers[1].ID,
			ProviderID:   testProviders[2].ID,
			Name:         TEST_PREFIX + "滨江金色家园 B栋502",
			Address:      "杭州市滨江区金色家园B栋502室",
			Latitude:     30.2100,
			Longitude:    120.2100,
			Area:         95.0,
			Budget:       280000,
			Status:       1,
			CurrentPhase: "泥木阶段",
			StartDate:    &startDate,
			ExpectedEnd:  &expectedEnd,
		},
		{
			OwnerID:      testUsers[2].ID,
			ProviderID:   testProviders[3].ID,
			Name:         TEST_PREFIX + "城西银泰城 C栋1808",
			Address:      "杭州市拱墅区城西银泰城C栋1808室",
			Latitude:     30.3000,
			Longitude:    120.1200,
			Area:         150.0,
			Budget:       500000,
			Status:       0, // 待开始
			CurrentPhase: "设计阶段",
		},
	}

	for i := range testProjects {
		if err := db.Where("name = ?", testProjects[i].Name).FirstOrCreate(&testProjects[i]).Error; err != nil {
			log.Printf("创建项目失败: %v", err)
		}
	}
	fmt.Printf("✅ 创建 %d 个测试项目\n", len(testProjects))

	// ==================== 5. 创建测试里程碑 ====================
	milestoneTemplates := []struct {
		Name       string
		Seq        int8
		Percentage float32
	}{
		{"设计定稿", 1, 10},
		{"水电验收", 2, 20},
		{"泥木验收", 3, 25},
		{"油漆验收", 4, 20},
		{"安装验收", 5, 15},
		{"竣工验收", 6, 10},
	}

	milestoneCount := 0
	for _, project := range testProjects {
		for _, tmpl := range milestoneTemplates {
			milestone := model.Milestone{
				ProjectID:  project.ID,
				Name:       tmpl.Name,
				Seq:        tmpl.Seq,
				Amount:     project.Budget * float64(tmpl.Percentage) / 100,
				Percentage: tmpl.Percentage,
				Status:     0,
				Criteria:   fmt.Sprintf("%s验收标准：符合国家规范，无明显质量问题", tmpl.Name),
			}
			if err := db.Where("project_id = ? AND seq = ?", project.ID, tmpl.Seq).FirstOrCreate(&milestone).Error; err != nil {
				log.Printf("创建里程碑失败: %v", err)
			}
			milestoneCount++
		}
	}
	fmt.Printf("✅ 创建 %d 个测试里程碑\n", milestoneCount)

	// ==================== 6. 创建测试托管账户 ====================
	for _, project := range testProjects {
		escrow := model.EscrowAccount{
			ProjectID:      project.ID,
			TotalAmount:    project.Budget * 0.3, // 假设已充值30%
			FrozenAmount:   0,
			ReleasedAmount: 0,
			Status:         1,
		}
		if err := db.Where("project_id = ?", project.ID).FirstOrCreate(&escrow).Error; err != nil {
			log.Printf("创建托管账户失败: %v", err)
		}
	}
	fmt.Printf("✅ 创建 %d 个测试托管账户\n", len(testProjects))

	// ==================== 7. 创建测试施工日志 ====================
	logCount := 0
	for _, project := range testProjects[:2] { // 只给进行中的项目创建日志
		for i := 0; i < 5; i++ {
			logDate := now.AddDate(0, 0, -i)
			workLog := model.WorkLog{
				ProjectID:   project.ID,
				WorkerID:    testWorkers[0].ID,
				LogDate:     logDate,
				Description: fmt.Sprintf("%s - 第%d天施工记录：今日完成相关工序，进度正常。", TEST_PREFIX, i+1),
			}
			if err := db.Create(&workLog).Error; err != nil {
				log.Printf("创建施工日志失败: %v", err)
			}
			logCount++
		}
	}
	fmt.Printf("✅ 创建 %d 条测试施工日志\n", logCount)

	fmt.Println("========================================")
	fmt.Println("✅ 测试数据插入完成！")
	fmt.Println("")
	fmt.Println("清理测试数据请运行: go run scripts/clean_test_data.go")
	fmt.Println("========================================")
}
