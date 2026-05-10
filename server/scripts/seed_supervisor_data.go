//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"log"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
)

const SUPERVISOR_PHONE = "13800000008"
const TEST_PREFIX = "[TEST]"

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("配置加载失败: %v", err)
	}

	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	db := repository.DB

	// 手动添加可能缺失的列，避免 AutoMigrate 失败
	db.Exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_reason varchar(500);")
	db.Exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;")
	db.Exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS closure_type varchar(20);")

	fmt.Println("========================================")
	fmt.Println("开始注入监理工作台测试数据 (手机号:", SUPERVISOR_PHONE, ")")
	fmt.Println("========================================")

	// ==================== 1. 确保监理账号存在 ====================
	user := model.User{
		Phone:    SUPERVISOR_PHONE,
		Nickname: "监理总管",
		UserType: 4, // 假设监理为 4（其实独立于 user_type）
		Status:   1,
	}

	if err := db.Where("phone = ?", SUPERVISOR_PHONE).FirstOrCreate(&user).Error; err != nil {
		log.Fatalf("创建监理 User 失败: %v", err)
	}

	account := model.SupervisorAccount{
		Phone:  SUPERVISOR_PHONE,
		Status: 1,
	}
	if err := db.Where("phone = ?", SUPERVISOR_PHONE).FirstOrCreate(&account).Error; err != nil {
		log.Fatalf("创建 SupervisorAccount 失败: %v", err)
	}

	profile := model.SupervisorProfile{
		UserID:              user.ID,
		SupervisorAccountID: &account.ID,
		RealName:            "金牌监理张工",
		Phone:               SUPERVISOR_PHONE,
		CityCode:            "310100",
		ServiceArea:         `["310100", "310115"]`,
		Certifications:      `["国家注册监理工程师", "高级室内装饰监理师"]`,
		Status:              1,
		Verified:            true,
	}
	if err := db.Where("phone = ?", SUPERVISOR_PHONE).FirstOrCreate(&profile).Error; err != nil {
		log.Fatalf("创建 SupervisorProfile 失败: %v", err)
	}

	fmt.Printf("✅ 监理账号准备就绪 (UserID: %d, AccountID: %d)\n", user.ID, account.ID)

	// ==================== 2. 创建 5 个测试项目 ====================
	now := time.Now()
	startDate1 := now.AddDate(0, 0, -45)
	expectedEnd1 := now.AddDate(0, 1, 0)

	startDate2 := now.AddDate(0, 0, -10)
	expectedEnd2 := now.AddDate(0, 2, 0)

	testProjects := []model.Project{
		{
			OwnerID:      user.ID, // 随便分配一个 Owner
			ProviderID:   90001,   // 依赖 seed_test_data.sql 里的数据
			Name:         TEST_PREFIX + " 星河湾 3期大平层",
			Address:      "浦东新区锦绣路2580号",
			Area:         220.5,
			Budget:       1200000,
			Status:       model.ProjectStatusActive,
			CurrentPhase: "水电阶段",
			StartDate:    &startDate1,
			ExpectedEnd:  &expectedEnd1,
		},
		{
			OwnerID:      user.ID,
			ProviderID:   90002,
			Name:         TEST_PREFIX + " 汤臣一品 A栋复式",
			Address:      "浦东新区花园石桥路28弄",
			Area:         350.0,
			Budget:       3500000,
			Status:       model.ProjectStatusActive,
			CurrentPhase: "泥木阶段",
			StartDate:    &startDate2,
			ExpectedEnd:  &expectedEnd2,
		},
		{
			OwnerID:      user.ID,
			ProviderID:   90003,
			Name:         TEST_PREFIX + " 翠湖天地 4期",
			Address:      "黄浦区济南路260弄",
			Area:         180.0,
			Budget:       800000,
			Status:       model.ProjectStatusActive,
			CurrentPhase: "开工准备",
			StartDate:    &now,
		},
		{
			OwnerID:      user.ID,
			ProviderID:   90004,
			Name:         TEST_PREFIX + " 融创外滩壹号院",
			Address:      "黄浦区中山南路200号",
			Area:         280.0,
			Budget:       2000000,
			Status:       model.ProjectStatusPaused,
			CurrentPhase: "油漆阶段",
			PauseReason:  "业主材料未到位",
		},
		{
			OwnerID:      user.ID,
			ProviderID:   90005,
			Name:         TEST_PREFIX + " 檀宫 独栋别墅",
			Address:      "长宁区青溪路555号",
			Area:         850.0,
			Budget:       15000000,
			Status:       model.ProjectStatusCompleted,
			CurrentPhase: "竣工验收",
		},
	}

	for i := range testProjects {
		if err := db.Where("name = ?", testProjects[i].Name).FirstOrCreate(&testProjects[i]).Error; err != nil {
			log.Printf("创建项目失败: %v", err)
		}
	}
	fmt.Printf("✅ 创建 %d 个测试项目\n", len(testProjects))

	// ==================== 3. 关联监理与项目 ====================
	for _, project := range testProjects {
		assignment := model.ProjectSupervisorAssignment{
			ProjectID:    project.ID,
			SupervisorID: profile.ID, // 使用 supervisor_profiles.id
			Status:       1,
			AssignedAt:   now.AddDate(0, 0, -50),
		}
		if err := db.Where("project_id = ? AND supervisor_id = ?", project.ID, profile.ID).FirstOrCreate(&assignment).Error; err != nil {
			log.Printf("创建监理项目分配失败: %v", err)
		}
	}
	fmt.Println("✅ 分配项目到监理账号")

	// ==================== 4. 创建项目阶段和日志 ====================
	phases := []string{"开工准备", "水电施工", "泥木施工", "油漆施工", "安装竣工"}
	for _, project := range testProjects {
		for i, phaseName := range phases {
			phaseTypeKey := "preparation"
			switch phaseName {
			case "开工准备":
				phaseTypeKey = "preparation"
			case "水电施工":
				phaseTypeKey = "water_electricity"
			case "泥木施工":
				phaseTypeKey = "mud_wood"
			case "油漆施工":
				phaseTypeKey = "paint"
			case "安装竣工":
				phaseTypeKey = "installation"
			}

			// 创建阶段
			phase := model.ProjectPhase{
				ProjectID:         project.ID,
				PhaseType:         phaseTypeKey,
				Name:              phaseName,
				Seq:               i + 1,
				Status:            "completed",
				ResponsiblePerson: "张监理",
				EstimatedDays:     15,
			}
			if i == len(phases)-1 {
				phase.Status = "in_progress"
			}
			if err := db.Where("project_id = ? AND seq = ?", project.ID, i+1).FirstOrCreate(&phase).Error; err != nil {
				log.Printf("创建阶段失败: %v", err)
			}

			// 创建任务
			task := model.PhaseTask{
				PhaseID:     phase.ID,
				Name:        phaseName + " - 基础巡检",
				IsCompleted: phase.Status == "completed",
			}
			if err := db.Where("phase_id = ? AND name = ?", phase.ID, task.Name).FirstOrCreate(&task).Error; err != nil {
				log.Printf("创建任务失败: %v", err)
			}

			logEntry := model.WorkLog{
				ProjectID:   project.ID,
				PhaseID:     phase.ID,
				CreatedBy:   user.ID, // 记录创建人
				Title:       phaseName + " - 巡检记录",
				LogDate:     now.AddDate(0, 0, -i),
				Description: "现场施工进度正常，工艺符合规范要求。材料已核对无误。",
				Photos:      `["https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=600", "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=600"]`,
				AIAnalysis:  `{"status": "normal"}`,
				Issues:      `[]`,
			}
			var existingLog model.WorkLog
			if err := db.Where("project_id = ? AND phase_id = ?", project.ID, phase.ID).First(&existingLog).Error; err != nil {
				if err := db.Create(&logEntry).Error; err != nil {
					log.Printf("创建日志失败: %v", err)
				}
			}
		}
	}
	fmt.Println("✅ 创建阶段、任务及施工日志")

	// ==================== 5. 插入风险预警 (SupervisionIssue) ====================
	for idx, project := range testProjects {
		if idx%2 == 0 { // 随意挑几个创建风险
			issue := model.SupervisionIssue{
				ProjectID:    project.ID,
				SupervisorID: profile.ID,
				IssueType:    "quality",
				Severity:     "high",
				Status:       "open",
				DeadlineAt:   &now,
			}
			if err := db.Where("project_id = ? AND issue_type = ?", project.ID, issue.IssueType).FirstOrCreate(&issue).Error; err != nil {
				log.Printf("创建风险失败: %v", err)
			}
		}
	}
	fmt.Println("✅ 创建监理风险预警")

	fmt.Println("========================================")
	fmt.Println("🎉 监理数据注入完毕！现在可以登录 13800000008 查看看板和项目详情了。")
}
