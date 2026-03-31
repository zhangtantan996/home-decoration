package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ProjectReviewPayload struct {
	Rating  float32  `json:"rating"`
	Content string   `json:"content"`
	Images  []string `json:"images"`
}

type ProjectReviewDetail struct {
	ID         uint64    `json:"id"`
	ProjectID  uint64    `json:"projectId"`
	ProviderID uint64    `json:"providerId"`
	Rating     float32   `json:"rating"`
	Content    string    `json:"content"`
	Images     []string  `json:"images"`
	CreatedAt  time.Time `json:"createdAt"`
}

func validateProjectReviewPayload(req *ProjectReviewPayload) error {
	if req == nil {
		return errors.New("参数不能为空")
	}
	if req.Rating < 1 || req.Rating > 5 {
		return errors.New("评分必须在 1 到 5 分之间")
	}
	if len(req.Images) > 9 {
		return errors.New("评价图片最多上传 9 张")
	}
	if len(strings.TrimSpace(req.Content)) > 2000 {
		return errors.New("评价内容不能超过 2000 字")
	}
	return nil
}

func formatProjectReviewArea(area float64) string {
	if area <= 0 {
		return ""
	}
	if area == float64(int64(area)) {
		return fmt.Sprintf("%d㎡", int64(area))
	}
	return fmt.Sprintf("%.1f㎡", area)
}

func decodeProviderReviewImages(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	var images []string
	if err := json.Unmarshal([]byte(raw), &images); err != nil {
		return []string{}
	}
	return imgutil.GetFullImageURLs(images)
}

func appendUniqueAction(actions []string, action string) []string {
	for _, item := range actions {
		if item == action {
			return actions
		}
	}
	return append(actions, action)
}

func loadProjectReviewByProjectTx(tx *gorm.DB, projectID uint64) (*model.ProviderReview, error) {
	var review model.ProviderReview
	if err := tx.Where("project_id = ?", projectID).Order("id DESC").First(&review).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &review, nil
}

func canSubmitOfficialProjectReview(project *model.Project, review *model.ProviderReview) bool {
	if !projectApprovedForOfficialReview(project) {
		return false
	}
	return review == nil
}

func toProjectReviewDetail(review *model.ProviderReview) *ProjectReviewDetail {
	if review == nil {
		return nil
	}
	return &ProjectReviewDetail{
		ID:         review.ID,
		ProjectID:  review.ProjectID,
		ProviderID: review.ProviderID,
		Rating:     review.Rating,
		Content:    review.Content,
		Images:     decodeProviderReviewImages(review.Images),
		CreatedAt:  review.CreatedAt,
	}
}

func (s *ProjectService) SubmitProjectReview(projectID, userID uint64, req *ProjectReviewPayload) (*ProjectReviewDetail, error) {
	if err := validateProjectReviewPayload(req); err != nil {
		return nil, err
	}

	var detail *ProjectReviewDetail
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&project, projectID).Error; err != nil {
			return errors.New("项目不存在")
		}
		if project.OwnerID != userID {
			return errors.New("无权操作此项目")
		}
		if !projectApprovedForOfficialReview(&project) {
			return errors.New("项目尚未完成整体验收，不能提交评价")
		}

		providerID := effectiveProjectProviderID(&project)
		if providerID == 0 {
			return errors.New("项目未关联可评价的服务商")
		}

		existing, err := loadProjectReviewByProjectTx(tx, projectID)
		if err != nil {
			return err
		}
		if existing != nil {
			return errors.New("该项目已提交正式评价，请勿重复操作")
		}

		imagesJSON, err := json.Marshal(req.Images)
		if err != nil {
			return err
		}

		review := &model.ProviderReview{
			ProjectID:    project.ID,
			ProviderID:   providerID,
			UserID:       userID,
			Rating:       req.Rating,
			Content:      strings.TrimSpace(req.Content),
			Images:       string(imagesJSON),
			ServiceType:  "完工验收",
			Area:         formatProjectReviewArea(project.Area),
			Style:        "",
			Tags:         "[]",
			HelpfulCount: 0,
		}
		if err := tx.Create(review).Error; err != nil {
			return err
		}
		if err := (&ProviderService{}).recalculateAggregatedRatingTx(tx, providerID); err != nil {
			return err
		}
		detail = toProjectReviewDetail(review)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return detail, nil
}
