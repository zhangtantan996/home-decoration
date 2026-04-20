package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type InspectionService struct{}

// CreateInspectionChecklist 创建验收清单
func (s *InspectionService) CreateInspectionChecklist(projectID, milestoneID, userID uint64, category string, items []model.InspectionItem) (*model.InspectionChecklist, error) {
	if projectID == 0 || milestoneID == 0 {
		return nil, errors.New("项目和节点不能为空")
	}

	// 验证项目和节点
	var milestone model.Milestone
	if err := repository.DB.Where("id = ? AND project_id = ?", milestoneID, projectID).First(&milestone).Error; err != nil {
		return nil, errors.New("验收节点不存在")
	}

	// 序列化检查项
	itemsJSON, err := json.Marshal(items)
	if err != nil {
		return nil, errors.New("检查项序列化失败")
	}

	checklist := &model.InspectionChecklist{
		MilestoneID: milestoneID,
		ProjectID:   projectID,
		Category:    category,
		Items:       string(itemsJSON),
		Status:      "pending",
		SubmittedBy: userID,
	}

	if err := repository.DB.Create(checklist).Error; err != nil {
		return nil, err
	}

	return checklist, nil
}

// GetInspectionChecklist 获取验收清单
func (s *InspectionService) GetInspectionChecklist(projectID, milestoneID uint64) (*model.InspectionChecklist, error) {
	var checklist model.InspectionChecklist
	if err := repository.DB.Where("project_id = ? AND milestone_id = ?", projectID, milestoneID).First(&checklist).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("验收清单不存在")
		}
		return nil, err
	}
	return &checklist, nil
}

// UpdateInspectionChecklist 更新验收清单
func (s *InspectionService) UpdateInspectionChecklist(checklistID, userID uint64, items []model.InspectionItem, notes string) (*model.InspectionChecklist, error) {
	var checklist model.InspectionChecklist
	if err := repository.DB.First(&checklist, checklistID).Error; err != nil {
		return nil, errors.New("验收清单不存在")
	}

	// 序列化检查项
	itemsJSON, err := json.Marshal(items)
	if err != nil {
		return nil, errors.New("检查项序列化失败")
	}

	// 检查是否全部通过
	allPassed := true
	for _, item := range items {
		if item.Required && !item.Passed {
			allPassed = false
			break
		}
	}

	status := "pending"
	if allPassed {
		status = "passed"
	} else {
		status = "failed"
	}

	now := time.Now()
	checklist.Items = string(itemsJSON)
	checklist.Status = status
	checklist.Notes = notes
	checklist.ReviewedBy = userID
	checklist.ReviewedAt = &now

	if err := repository.DB.Save(&checklist).Error; err != nil {
		return nil, err
	}

	return &checklist, nil
}

// SubmitInspection 商家提交验收申请
func (s *InspectionService) SubmitInspection(milestoneID, providerID uint64) error {
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		// 1. 检查节点是否存在
		var milestone model.Milestone
		if err := tx.First(&milestone, milestoneID).Error; err != nil {
			return errors.New("验收节点不存在")
		}

		// 2. 检查权限（商家是否是项目的服务商）
		var project model.Project
		if err := tx.First(&project, milestone.ProjectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.ProviderID != providerID {
			return errors.New("无权操作此节点")
		}

		// 3. 检查节点状态
		if milestone.Status == model.MilestoneStatusAccepted {
			return errors.New("节点已验收通过")
		}

		// 4. 创建或更新验收清单
		var checklist model.InspectionChecklist
		err := tx.Where("milestone_id = ? AND project_id = ?", milestoneID, milestone.ProjectID).First(&checklist).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		now := time.Now()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 创建新的验收清单
			checklist = model.InspectionChecklist{
				MilestoneID: milestoneID,
				ProjectID:   milestone.ProjectID,
				Category:    milestone.Name,
				Status:      "pending",
				SubmittedBy: providerID,
				SubmittedAt: &now,
			}
			if err := tx.Create(&checklist).Error; err != nil {
				return err
			}
		} else {
			// 更新现有验收清单
			checklist.Status = "pending"
			checklist.SubmittedAt = &now
			if err := tx.Save(&checklist).Error; err != nil {
				return err
			}
		}

		// 5. 更新节点状态
		milestone.Status = model.MilestoneStatusSubmitted
		milestone.SubmittedAt = &now
		if err := tx.Save(&milestone).Error; err != nil {
			return err
		}

		// 6. 发送通知给用户
		dispatcher := NewNotificationDispatcher()
		dispatcher.NotifyMilestoneSubmitted(project.OwnerID, milestone.ProjectID, milestoneID, milestone.Name)

		return nil
	})
}

// InspectMilestone 用户验收节点（通过/不通过）
func (s *InspectionService) InspectMilestone(milestoneID, userID uint64, passed bool, notes string) error {
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		// 1. 检查验收清单
		var checklist model.InspectionChecklist
		if err := tx.Where("milestone_id = ?", milestoneID).First(&checklist).Error; err != nil {
			return errors.New("验收清单不存在")
		}

		// 2. 检查节点
		var milestone model.Milestone
		if err := tx.First(&milestone, milestoneID).Error; err != nil {
			return errors.New("验收节点不存在")
		}

		// 3. 检查权限
		var project model.Project
		if err := tx.First(&project, milestone.ProjectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权操作此项目")
		}

		// 4. 检查节点状态
		if milestone.Status != model.MilestoneStatusSubmitted {
			return errors.New("节点未提交验收")
		}

		now := time.Now()
		if passed {
			// 验收通过
			checklist.Status = "passed"
			checklist.ReviewedBy = userID
			checklist.ReviewedAt = &now
			checklist.InspectionNotes = notes
			if err := tx.Save(&checklist).Error; err != nil {
				return err
			}

			// 更新节点状态
			milestone.Status = model.MilestoneStatusAccepted
			milestone.AcceptedAt = &now
			if err := tx.Save(&milestone).Error; err != nil {
				return err
			}

			// 自动触发放款
			settlementSvc := &SettlementService{}
			_, err := settlementSvc.ReleaseMilestoneTx(tx, &ReleaseMilestoneInput{
				ProjectID:    milestone.ProjectID,
				MilestoneID:  milestoneID,
				OperatorType: "user",
				OperatorID:   userID,
				Reason:       "验收通过自动放款",
				Source:       "inspection.passed",
			})
			if err != nil {
				return fmt.Errorf("放款失败: %v", err)
			}

			// 发送通知给商家
			dispatcher := NewNotificationDispatcher()
			dispatcher.NotifyMilestoneAccepted(project.ProviderID, milestone.ProjectID, milestoneID)
		} else {
			// 验收不通过
			checklist.Status = "failed"
			checklist.ReviewedBy = userID
			checklist.ReviewedAt = &now
			checklist.InspectionNotes = notes
			checklist.RejectedAt = &now
			if err := tx.Save(&checklist).Error; err != nil {
				return err
			}

			// 更新节点状态
			milestone.Status = model.MilestoneStatusRejected
			milestone.RejectionReason = notes
			if err := tx.Save(&milestone).Error; err != nil {
				return err
			}

			// 发送通知给商家
			dispatcher := NewNotificationDispatcher()
			dispatcher.NotifyMilestoneRejected(project.ProviderID, milestone.ProjectID, milestoneID, notes)
		}

		// 记录审计日志
		auditSvc := &AuditLogService{}
		if err := auditSvc.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "inspect_milestone",
			ResourceType:  "milestone",
			ResourceID:    milestoneID,
			Reason:        notes,
			Result:        "success",
			Metadata: map[string]any{
				"projectId":   milestone.ProjectID,
				"milestoneId": milestoneID,
				"passed":      passed,
				"notes":       notes,
			},
		}); err != nil {
			return err
		}

		return nil
	})
}

// RequestRectification 用户要求整改
func (s *InspectionService) RequestRectification(milestoneID, userID uint64, notes string) error {
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		// 1. 检查验收清单
		var checklist model.InspectionChecklist
		if err := tx.Where("milestone_id = ?", milestoneID).First(&checklist).Error; err != nil {
			return errors.New("验收清单不存在")
		}

		// 2. 检查节点
		var milestone model.Milestone
		if err := tx.First(&milestone, milestoneID).Error; err != nil {
			return errors.New("验收节点不存在")
		}

		// 3. 检查权限
		var project model.Project
		if err := tx.First(&project, milestone.ProjectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权操作此项目")
		}

		// 4. 更新验收清单
		now := time.Now()
		checklist.Status = "failed"
		checklist.ReviewedBy = userID
		checklist.ReviewedAt = &now
		checklist.InspectionNotes = notes
		checklist.RejectedAt = &now
		if err := tx.Save(&checklist).Error; err != nil {
			return err
		}

		// 5. 更新节点状态
		milestone.Status = model.MilestoneStatusRejected
		milestone.RejectionReason = notes
		if err := tx.Save(&milestone).Error; err != nil {
			return err
		}

		// 6. 发送通知给商家
		dispatcher := NewNotificationDispatcher()
		dispatcher.NotifyMilestoneRejected(project.ProviderID, milestone.ProjectID, milestoneID, notes)

		// 7. 记录审计日志
		auditSvc := &AuditLogService{}
		if err := auditSvc.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "request_rectification",
			ResourceType:  "milestone",
			ResourceID:    milestoneID,
			Reason:        notes,
			Result:        "success",
			Metadata: map[string]any{
				"projectId":   milestone.ProjectID,
				"milestoneId": milestoneID,
				"notes":       notes,
			},
		}); err != nil {
			return err
		}

		return nil
	})
}

// ResubmitInspection 商家整改后重新提交
func (s *InspectionService) ResubmitInspection(milestoneID, providerID uint64, notes string) error {
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		// 1. 检查验收清单
		var checklist model.InspectionChecklist
		if err := tx.Where("milestone_id = ?", milestoneID).First(&checklist).Error; err != nil {
			return errors.New("验收清单不存在")
		}

		// 2. 检查节点
		var milestone model.Milestone
		if err := tx.First(&milestone, milestoneID).Error; err != nil {
			return errors.New("验收节点不存在")
		}

		// 3. 检查权限
		var project model.Project
		if err := tx.First(&project, milestone.ProjectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.ProviderID != providerID {
			return errors.New("无权操作此节点")
		}

		// 4. 检查是否允许重新提交
		if checklist.Status != "failed" {
			return errors.New("只有验收不通过的节点才能重新提交")
		}

		// 5. 更新验收清单
		now := time.Now()
		checklist.Status = "resubmitted"
		checklist.RectificationNotes = notes
		checklist.ResubmitCount++
		checklist.ResubmittedAt = &now
		if err := tx.Save(&checklist).Error; err != nil {
			return err
		}

		// 6. 更新节点状态
		milestone.Status = model.MilestoneStatusSubmitted
		milestone.SubmittedAt = &now
		if err := tx.Save(&milestone).Error; err != nil {
			return err
		}

		// 7. 发送通知给用户
		dispatcher := NewNotificationDispatcher()
		dispatcher.NotifyMilestoneResubmitted(project.OwnerID, milestone.ProjectID, milestoneID)

		// 8. 记录审计日志
		auditSvc := &AuditLogService{}
		if err := auditSvc.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "provider",
			OperatorID:    providerID,
			OperationType: "resubmit_inspection",
			ResourceType:  "milestone",
			ResourceID:    milestoneID,
			Reason:        notes,
			Result:        "success",
			Metadata: map[string]any{
				"projectId":      milestone.ProjectID,
				"milestoneId":    milestoneID,
				"resubmitCount":  checklist.ResubmitCount,
				"notes":          notes,
			},
		}); err != nil {
			return err
		}

		return nil
	})
}

// AcceptAllMilestones 整体验收一次性放款
func (s *InspectionService) AcceptAllMilestones(projectID, userID uint64) error {
	return repository.DB.Transaction(func(tx *gorm.DB) error {
		// 1. 检查项目是否存在
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}

		// 2. 检查用户权限
		if project.OwnerID != userID {
			return errors.New("无权操作此项目")
		}

		// 3. 获取所有阶段节点
		var milestones []model.Milestone
		if err := tx.Where("project_id = ?", projectID).Order("seq ASC").Find(&milestones).Error; err != nil {
			return err
		}

		if len(milestones) == 0 {
			return errors.New("项目没有验收节点")
		}

		// 4. 检查所有阶段是否已提交
		for _, milestone := range milestones {
			if milestone.Status != model.MilestoneStatusSubmitted && milestone.Status != model.MilestoneStatusAccepted {
				return fmt.Errorf("节点 %s 未提交验收，无法整体验收", milestone.Name)
			}
		}

		// 5. 一次性验收所有阶段
		now := time.Now()
		for _, milestone := range milestones {
			if milestone.Status == model.MilestoneStatusAccepted {
				continue // 已验收的跳过
			}

			milestone.Status = model.MilestoneStatusAccepted
			milestone.AcceptedAt = &now
			if err := tx.Save(&milestone).Error; err != nil {
				return err
			}
		}

		// 6. 计算总金额并一次性放款
		totalAmount := 0.0
		for _, milestone := range milestones {
			totalAmount += milestone.Amount
		}

		// 7. 创建结算单并执行放款
		settlementSvc := &SettlementService{}
		for _, milestone := range milestones {
			if milestone.PaidAt != nil || milestone.ReleasedAt != nil {
				continue // 已放款的跳过
			}

			_, err := settlementSvc.ReleaseMilestoneTx(tx, &ReleaseMilestoneInput{
				ProjectID:    projectID,
				MilestoneID:  milestone.ID,
				OperatorType: "user",
				OperatorID:   userID,
				Reason:       "整体验收一次性放款",
				Source:       "inspection.accept_all",
			})
			if err != nil {
				return fmt.Errorf("节点 %s 放款失败: %v", milestone.Name, err)
			}
		}

		// 8. 更新项目状态
		if err := tx.Model(&project).Updates(map[string]interface{}{
			"status":          model.ProjectStatusCompleted,
			"business_status": model.ProjectBusinessStatusCompleted,
		}).Error; err != nil {
			return err
		}

		// 9. 发送通知
		dispatcher := NewNotificationDispatcher()
		dispatcher.NotifyProjectCompletionSubmitted(userID, projectID)

		// 10. 记录审计日志
		auditSvc := &AuditLogService{}
		if err := auditSvc.CreateBusinessRecordTx(tx, &CreateAuditRecordInput{
			OperatorType:  "user",
			OperatorID:    userID,
			OperationType: "accept_all_milestones",
			ResourceType:  "project",
			ResourceID:    projectID,
			Reason:        "整体验收一次性放款",
			Result:        "success",
			Metadata: map[string]any{
				"projectId":     projectID,
				"totalAmount":   totalAmount,
				"milestoneCount": len(milestones),
			},
		}); err != nil {
			return err
		}

		return nil
	})
}

// GetInspectionTemplate 获取验收清单模板
func (s *InspectionService) GetInspectionTemplate(category string) (*model.InspectionTemplate, error) {
	var template model.InspectionTemplate
	if err := repository.DB.Where("category = ? AND status = 1", category).First(&template).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 返回默认模板
			return s.getDefaultTemplate(category), nil
		}
		return nil, err
	}
	return &template, nil
}

// getDefaultTemplate 获取默认验收清单模板
func (s *InspectionService) getDefaultTemplate(category string) *model.InspectionTemplate {
	templates := map[string][]model.InspectionItem{
		"水电": {
			{Name: "电线布线规范", Description: "电线布线横平竖直，无交叉", Required: true},
			{Name: "水管安装牢固", Description: "水管固定牢固，无渗漏", Required: true},
			{Name: "开关插座位置", Description: "开关插座位置符合设计要求", Required: true},
			{Name: "防水测试", Description: "卫生间、厨房防水测试通过", Required: true},
		},
		"瓦工": {
			{Name: "墙砖铺贴平整", Description: "墙砖铺贴平整，无空鼓", Required: true},
			{Name: "地砖铺贴规范", Description: "地砖铺贴规范，缝隙均匀", Required: true},
			{Name: "防水层完整", Description: "防水层完整，无破损", Required: true},
		},
		"木工": {
			{Name: "吊顶安装牢固", Description: "吊顶安装牢固，无松动", Required: true},
			{Name: "柜体制作规范", Description: "柜体制作规范，尺寸准确", Required: true},
			{Name: "门窗安装到位", Description: "门窗安装到位，开关顺畅", Required: true},
		},
		"油漆": {
			{Name: "墙面平整光滑", Description: "墙面平整光滑，无裂纹", Required: true},
			{Name: "涂料颜色均匀", Description: "涂料颜色均匀，无色差", Required: true},
			{Name: "边角处理细致", Description: "边角处理细致，无污染", Required: true},
		},
	}

	items, ok := templates[category]
	if !ok {
		items = []model.InspectionItem{
			{Name: "施工质量", Description: "施工质量符合要求", Required: true},
			{Name: "材料规格", Description: "材料规格符合合同约定", Required: true},
		}
	}

	itemsJSON, _ := json.Marshal(items)
	return &model.InspectionTemplate{
		Category:    category,
		Name:        fmt.Sprintf("%s验收清单", category),
		Description: fmt.Sprintf("%s阶段验收标准", category),
		Items:       string(itemsJSON),
		IsDefault:   true,
		Status:      1,
	}
}
