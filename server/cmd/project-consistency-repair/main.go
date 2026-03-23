package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type repairTarget struct {
	ProjectID         uint64
	Name              string
	CurrentPhase      string
	Status            int8
	BusinessStatus    string
	MissingEscrow     bool
	MissingPhases     bool
	MissingMilestones bool
}

type repairAction struct {
	CreatedEscrow     bool
	CreatedPhases     bool
	CreatedMilestones bool
}

func main() {
	log.SetFlags(0)

	projectIDsFlag := flag.String("project-ids", "", "项目 ID，支持逗号分隔")
	apply := flag.Bool("apply", false, "执行写入修复；默认仅 dry-run")
	flag.Parse()

	projectIDs, err := parseProjectIDs(*projectIDsFlag)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Failed to load config: %v\n", err)
		os.Exit(1)
	}
	if err := repository.InitDB(&cfg.Database); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Failed to connect database: %v\n", err)
		os.Exit(1)
	}
	defer repository.CloseDB()

	targets, err := loadTargets(projectIDs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Failed to load repair targets: %v\n", err)
		os.Exit(1)
	}

	if len(targets) == 0 {
		fmt.Println("No repair targets.")
		return
	}

	fmt.Printf("Project Consistency Repair (%s)\n", ternary(*apply, "apply", "dry-run"))
	fmt.Println("============================================================")

	projectService := &service.ProjectService{}
	for _, target := range targets {
		fmt.Printf(
			"- project=%d name=%s current_phase=%s status=%d business_status=%s missing=[escrow:%t phases:%t milestones:%t]\n",
			target.ProjectID,
			target.Name,
			target.CurrentPhase,
			target.Status,
			target.BusinessStatus,
			target.MissingEscrow,
			target.MissingPhases,
			target.MissingMilestones,
		)

		if !*apply {
			continue
		}

		action, err := repairProject(projectService, target.ProjectID)
		if err != nil {
			fmt.Printf("  -> FAIL: %v\n", err)
			continue
		}
		fmt.Printf(
			"  -> OK: escrow=%t phases=%t milestones=%t\n",
			action.CreatedEscrow,
			action.CreatedPhases,
			action.CreatedMilestones,
		)
	}
}

func parseProjectIDs(raw string) ([]uint64, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("project-ids 不能为空，例如 -project-ids 99001")
	}

	parts := strings.Split(trimmed, ",")
	result := make([]uint64, 0, len(parts))
	seen := make(map[uint64]struct{}, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value == "" {
			continue
		}
		id, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("非法 project id %q", value)
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	if len(result) == 0 {
		return nil, errors.New("未解析到有效 project id")
	}
	return result, nil
}

func loadTargets(projectIDs []uint64) ([]repairTarget, error) {
	type row struct {
		ID             uint64 `gorm:"column:id"`
		Name           string `gorm:"column:name"`
		CurrentPhase   string `gorm:"column:current_phase"`
		Status         int8   `gorm:"column:status"`
		BusinessStatus string `gorm:"column:business_status"`
		EscrowCount    int64  `gorm:"column:escrow_count"`
		PhaseCount     int64  `gorm:"column:phase_count"`
		MilestoneCount int64  `gorm:"column:milestone_count"`
	}

	query := `
SELECT
  p.id,
  p.name,
  p.current_phase,
  p.status,
  p.business_status,
  COALESCE(es.escrow_count, 0) AS escrow_count,
  COALESCE(ph.phase_count, 0) AS phase_count,
  COALESCE(ms.milestone_count, 0) AS milestone_count
FROM projects p
LEFT JOIN (
  SELECT project_id, COUNT(*) AS escrow_count
  FROM escrow_accounts
  GROUP BY project_id
) es ON es.project_id = p.id
LEFT JOIN (
  SELECT project_id, COUNT(*) AS phase_count
  FROM project_phases
  GROUP BY project_id
) ph ON ph.project_id = p.id
LEFT JOIN (
  SELECT project_id, COUNT(*) AS milestone_count
  FROM milestones
  GROUP BY project_id
) ms ON ms.project_id = p.id
WHERE p.id IN ?
ORDER BY p.id ASC
`

	var rows []row
	if err := repository.DB.Raw(query, projectIDs).Scan(&rows).Error; err != nil {
		return nil, err
	}

	targets := make([]repairTarget, 0, len(rows))
	for _, item := range rows {
		targets = append(targets, repairTarget{
			ProjectID:         item.ID,
			Name:              item.Name,
			CurrentPhase:      item.CurrentPhase,
			Status:            item.Status,
			BusinessStatus:    item.BusinessStatus,
			MissingEscrow:     item.EscrowCount == 0,
			MissingPhases:     item.PhaseCount == 0,
			MissingMilestones: item.MilestoneCount == 0,
		})
	}
	return targets, nil
}

func repairProject(projectService *service.ProjectService, projectID uint64) (*repairAction, error) {
	action := &repairAction{}
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			return err
		}

		var escrowCount int64
		if err := tx.Model(&model.EscrowAccount{}).Where("project_id = ?", projectID).Count(&escrowCount).Error; err != nil {
			return err
		}
		if escrowCount == 0 {
			escrow := model.EscrowAccount{
				ProjectID:   project.ID,
				UserID:      project.OwnerID,
				ProjectName: project.Name,
				Status:      1,
			}
			if err := tx.Create(&escrow).Error; err != nil {
				return err
			}
			action.CreatedEscrow = true
		}

		var phaseCount int64
		if err := tx.Model(&model.ProjectPhase{}).Where("project_id = ?", projectID).Count(&phaseCount).Error; err != nil {
			return err
		}
		if phaseCount == 0 {
			if err := projectService.InitProjectPhases(tx, projectID); err != nil {
				return err
			}
			if err := syncPhaseStatusFromProject(tx, &project); err != nil {
				return err
			}
			action.CreatedPhases = true
		}

		var milestoneCount int64
		if err := tx.Model(&model.Milestone{}).Where("project_id = ?", projectID).Count(&milestoneCount).Error; err != nil {
			return err
		}
		if milestoneCount == 0 {
			total := project.ConstructionQuote
			if total <= 0 {
				total = project.Budget
			}
			if err := projectService.InitProjectMilestones(tx, projectID, total); err != nil {
				return err
			}
			action.CreatedMilestones = true
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return action, nil
}

func syncPhaseStatusFromProject(tx *gorm.DB, project *model.Project) error {
	if project == nil {
		return nil
	}

	var phases []model.ProjectPhase
	if err := tx.Where("project_id = ?", project.ID).Order("seq ASC").Find(&phases).Error; err != nil {
		return err
	}
	if len(phases) == 0 {
		return nil
	}

	activeSeq, completedAll := inferPhaseState(project)
	for _, phase := range phases {
		nextStatus := "pending"
		switch {
		case completedAll:
			nextStatus = "completed"
		case activeSeq > 0 && phase.Seq < activeSeq:
			nextStatus = "completed"
		case activeSeq > 0 && phase.Seq == activeSeq:
			nextStatus = "in_progress"
		}

		updates := map[string]interface{}{"status": nextStatus}
		if nextStatus == "in_progress" {
			if project.StartDate != nil {
				updates["start_date"] = *project.StartDate
			} else if project.StartedAt != nil {
				updates["start_date"] = *project.StartedAt
			}
		}
		if nextStatus == "completed" {
			if project.ActualEnd != nil {
				updates["end_date"] = *project.ActualEnd
			} else if project.ExpectedEnd != nil && completedAll {
				updates["end_date"] = *project.ExpectedEnd
			}
		}

		if err := tx.Model(&model.ProjectPhase{}).Where("id = ?", phase.ID).Updates(updates).Error; err != nil {
			return err
		}
	}

	return nil
}

func inferPhaseState(project *model.Project) (activeSeq int, completedAll bool) {
	if project == nil {
		return 0, false
	}

	currentPhase := strings.TrimSpace(project.CurrentPhase)
	if project.Status == model.ProjectStatusCompleted ||
		project.BusinessStatus == model.ProjectBusinessStatusCompleted ||
		strings.Contains(currentPhase, "完工") ||
		strings.Contains(currentPhase, "竣工") {
		return 0, true
	}

	switch {
	case strings.Contains(currentPhase, "准备"), strings.Contains(currentPhase, "待开工"):
		return 1, false
	case strings.Contains(currentPhase, "拆改"):
		return 2, false
	case strings.Contains(currentPhase, "水电"), strings.Contains(currentPhase, "电"):
		return 3, false
	case strings.Contains(currentPhase, "泥木"), strings.Contains(currentPhase, "木"):
		return 4, false
	case strings.Contains(currentPhase, "油漆"):
		return 5, false
	case strings.Contains(currentPhase, "安装"):
		return 6, false
	case strings.Contains(currentPhase, "验收"):
		return 7, false
	default:
		return 0, false
	}
}

func ternary[T any](condition bool, whenTrue, whenFalse T) T {
	if condition {
		return whenTrue
	}
	return whenFalse
}
