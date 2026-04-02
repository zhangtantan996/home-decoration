package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"

	"gorm.io/gorm"
)

const (
	defaultDemandPageSize = 10
	maxDemandPageSize     = 50
	defaultMaxMatch       = 3
)

type DemandService struct {
	repo *repository.DemandRepository
}

func NewDemandService() *DemandService {
	return &DemandService{repo: repository.NewDemandRepository()}
}

type DemandAttachmentInput struct {
	URL  string `json:"url"`
	Name string `json:"name"`
	Size int64  `json:"size"`
}

type UpsertDemandInput struct {
	DemandType  string                  `json:"demandType"`
	Title       string                  `json:"title"`
	City        string                  `json:"city"`
	District    string                  `json:"district"`
	Address     string                  `json:"address"`
	Area        float64                 `json:"area"`
	BudgetMin   float64                 `json:"budgetMin"`
	BudgetMax   float64                 `json:"budgetMax"`
	Timeline    string                  `json:"timeline"`
	StylePref   string                  `json:"stylePref"`
	Description string                  `json:"description"`
	Attachments []DemandAttachmentInput `json:"attachments"`
	MaxMatch    int                     `json:"maxMatch"`
}

type DemandListFilter struct {
	Status   string
	Page     int
	PageSize int
}

type AdminDemandListFilter struct {
	Status   string
	Page     int
	PageSize int
}

type ReviewDemandInput struct {
	Action string `json:"action"`
	Note   string `json:"note"`
}

type AssignDemandInput struct {
	ProviderIDs           []uint64 `json:"providerIds"`
	ResponseDeadlineHours int      `json:"responseDeadlineHours"`
}

type LeadActionInput struct {
	Reason string `json:"reason"`
}

type DemandSummary struct {
	ID           uint64    `json:"id"`
	DemandType   string    `json:"demandType"`
	Title        string    `json:"title"`
	City         string    `json:"city"`
	District     string    `json:"district"`
	Area         float64   `json:"area"`
	BudgetMin    float64   `json:"budgetMin"`
	BudgetMax    float64   `json:"budgetMax"`
	Timeline     string    `json:"timeline"`
	Status       string    `json:"status"`
	MatchedCount int       `json:"matchedCount"`
	MaxMatch     int       `json:"maxMatch"`
	ReviewNote   string    `json:"reviewNote"`
	ClosedReason string    `json:"closedReason"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type DemandProposalSummary struct {
	ID               uint64     `json:"id"`
	SourceType       string     `json:"sourceType"`
	Summary          string     `json:"summary"`
	DesignFee        float64    `json:"designFee"`
	ConstructionFee  float64    `json:"constructionFee"`
	MaterialFee      float64    `json:"materialFee"`
	EstimatedDays    int        `json:"estimatedDays"`
	Status           int8       `json:"status"`
	Version          int        `json:"version"`
	SubmittedAt      *time.Time `json:"submittedAt"`
	ResponseDeadline *time.Time `json:"responseDeadline"`
	Attachments      string     `json:"attachments"`
}

type DemandProviderSummary struct {
	ID              uint64   `json:"id"`
	UserID          uint64   `json:"userId"`
	Name            string   `json:"name"`
	Avatar          string   `json:"avatar"`
	Rating          float32  `json:"rating"`
	CompletedCnt    int      `json:"completedCnt"`
	Verified        bool     `json:"verified"`
	ProviderType    int8     `json:"providerType"`
	SubType         string   `json:"subType"`
	YearsExperience int      `json:"yearsExperience"`
	Specialty       string   `json:"specialty"`
	ServiceArea     []string `json:"serviceArea"`
}

type DemandMatchView struct {
	ID               uint64                 `json:"id"`
	Status           string                 `json:"status"`
	AssignedAt       *time.Time             `json:"assignedAt"`
	ResponseDeadline *time.Time             `json:"responseDeadline"`
	RespondedAt      *time.Time             `json:"respondedAt"`
	DeclineReason    string                 `json:"declineReason"`
	ProposalID       uint64                 `json:"proposalId"`
	Provider         DemandProviderSummary  `json:"provider"`
	Proposal         *DemandProposalSummary `json:"proposal,omitempty"`
}

type DemandDetailView struct {
	DemandSummary
	Address     string                  `json:"address"`
	StylePref   string                  `json:"stylePref"`
	Description string                  `json:"description"`
	Attachments []DemandAttachmentInput `json:"attachments"`
	ReviewedAt  *time.Time              `json:"reviewedAt"`
	ReviewerID  uint64                  `json:"reviewerId"`
	Matches     []DemandMatchView       `json:"matches"`
}

type DemandCandidateView struct {
	Provider    DemandProviderSummary `json:"provider"`
	MatchScore  int                   `json:"matchScore"`
	ScoreReason []string              `json:"scoreReason"`
}

type MerchantLeadView struct {
	ID               uint64                  `json:"id"`
	Status           string                  `json:"status"`
	AssignedAt       *time.Time              `json:"assignedAt"`
	ResponseDeadline *time.Time              `json:"responseDeadline"`
	RespondedAt      *time.Time              `json:"respondedAt"`
	DeclineReason    string                  `json:"declineReason"`
	ProposalID       uint64                  `json:"proposalId"`
	Demand           DemandSummary           `json:"demand"`
	Attachments      []DemandAttachmentInput `json:"attachments"`
}

func normalizePage(page int) int {
	if page <= 0 {
		return 1
	}
	return page
}

func normalizePageSize(pageSize int) int {
	if pageSize <= 0 {
		return defaultDemandPageSize
	}
	if pageSize > maxDemandPageSize {
		return maxDemandPageSize
	}
	return pageSize
}

func normalizeDemandType(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case model.DemandTypeDesign:
		return model.DemandTypeDesign
	case model.DemandTypePartial:
		return model.DemandTypePartial
	case model.DemandTypeMaterial:
		return model.DemandTypeMaterial
	default:
		return model.DemandTypeRenovation
	}
}

func toAttachmentsJSON(items []DemandAttachmentInput) string {
	if len(items) == 0 {
		return "[]"
	}
	filtered := make([]DemandAttachmentInput, 0, len(items))
	for _, item := range items {
		normalizedURL := normalizeStoredAsset(item.URL)
		if normalizedURL == "" {
			continue
		}
		filtered = append(filtered, DemandAttachmentInput{
			URL:  normalizedURL,
			Name: strings.TrimSpace(item.Name),
			Size: item.Size,
		})
	}
	if len(filtered) == 0 {
		return "[]"
	}
	payload, err := json.Marshal(filtered)
	if err != nil {
		return "[]"
	}
	return string(payload)
}

func parseDemandAttachments(raw string) []DemandAttachmentInput {
	if strings.TrimSpace(raw) == "" {
		return []DemandAttachmentInput{}
	}
	var items []DemandAttachmentInput
	if err := json.Unmarshal([]byte(raw), &items); err == nil {
		for i := range items {
			items[i].URL = imgutil.GetFullImageURL(items[i].URL)
		}
		return items
	}
	return []DemandAttachmentInput{}
}

func parseServiceAreas(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	var items []string
	if err := json.Unmarshal([]byte(raw), &items); err == nil {
		return items
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '，' || r == ';' || r == '；'
	})
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		v := strings.TrimSpace(part)
		if v != "" {
			result = append(result, v)
		}
	}
	return result
}

func buildDemandSummary(demand *model.Demand) DemandSummary {
	return DemandSummary{
		ID:           demand.ID,
		DemandType:   demand.DemandType,
		Title:        demand.Title,
		City:         demand.City,
		District:     demand.District,
		Area:         demand.Area,
		BudgetMin:    demand.BudgetMin,
		BudgetMax:    demand.BudgetMax,
		Timeline:     demand.Timeline,
		Status:       demand.Status,
		MatchedCount: demand.MatchedCount,
		MaxMatch:     demand.MaxMatch,
		ReviewNote:   demand.ReviewNote,
		ClosedReason: demand.ClosedReason,
		CreatedAt:    demand.CreatedAt,
		UpdatedAt:    demand.UpdatedAt,
	}
}

func buildProviderSummary(provider model.Provider, user model.User) DemandProviderSummary {
	name := ResolveProviderDisplayName(provider, &user)
	return DemandProviderSummary{
		ID:              provider.ID,
		UserID:          provider.UserID,
		Name:            name,
		Avatar:          imgutil.GetFullImageURL(ResolveProviderAvatarPathWithUser(provider, &user)),
		Rating:          provider.Rating,
		CompletedCnt:    provider.CompletedCnt,
		Verified:        provider.Verified,
		ProviderType:    provider.ProviderType,
		SubType:         provider.SubType,
		YearsExperience: provider.YearsExperience,
		Specialty:       provider.Specialty,
		ServiceArea:     parseServiceAreas(provider.ServiceArea),
	}
}

func buildProposalSummary(proposal *model.Proposal) *DemandProposalSummary {
	if proposal == nil {
		return nil
	}
	return &DemandProposalSummary{
		ID:               proposal.ID,
		SourceType:       proposal.SourceType,
		Summary:          proposal.Summary,
		DesignFee:        proposal.DesignFee,
		ConstructionFee:  proposal.ConstructionFee,
		MaterialFee:      proposal.MaterialFee,
		EstimatedDays:    proposal.EstimatedDays,
		Status:           proposal.Status,
		Version:          proposal.Version,
		SubmittedAt:      proposal.SubmittedAt,
		ResponseDeadline: proposal.UserResponseDeadline,
		Attachments:      proposal.Attachments,
	}
}

func validateDemandForSubmit(demand *model.Demand) error {
	if strings.TrimSpace(demand.Title) == "" {
		return errors.New("需求标题不能为空")
	}
	if strings.TrimSpace(demand.City) == "" || strings.TrimSpace(demand.District) == "" {
		return errors.New("请补充所在城市和区域")
	}
	if strings.TrimSpace(demand.Address) == "" {
		return errors.New("请补充详细地址")
	}
	if demand.Area <= 0 {
		return errors.New("请填写房屋面积")
	}
	if demand.BudgetMin <= 0 && demand.BudgetMax <= 0 {
		return errors.New("请填写预算范围")
	}
	if strings.TrimSpace(demand.Description) == "" {
		return errors.New("请填写需求描述")
	}
	return nil
}

func (s *DemandService) CreateDemand(userID uint64, input *UpsertDemandInput) (*model.Demand, error) {
	demand := &model.Demand{
		UserID:      userID,
		DemandType:  normalizeDemandType(input.DemandType),
		Title:       strings.TrimSpace(input.Title),
		City:        strings.TrimSpace(input.City),
		District:    strings.TrimSpace(input.District),
		Address:     strings.TrimSpace(input.Address),
		Area:        input.Area,
		BudgetMin:   input.BudgetMin,
		BudgetMax:   input.BudgetMax,
		Timeline:    strings.TrimSpace(input.Timeline),
		StylePref:   strings.TrimSpace(input.StylePref),
		Description: strings.TrimSpace(input.Description),
		Attachments: toAttachmentsJSON(input.Attachments),
		Status:      model.DemandStatusDraft,
		MaxMatch:    defaultMaxMatch,
	}
	if input.MaxMatch > 0 {
		demand.MaxMatch = input.MaxMatch
	}
	if err := s.repo.CreateDemand(nil, demand); err != nil {
		return nil, fmt.Errorf("create demand: %w", err)
	}
	return demand, nil
}

func (s *DemandService) UpdateDemand(userID, demandID uint64, input *UpsertDemandInput) (*model.Demand, error) {
	demand, err := s.repo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	if demand.UserID != userID {
		return nil, errors.New("无权操作该需求")
	}
	if demand.Status == model.DemandStatusClosed || demand.Status == model.DemandStatusMatched || demand.Status == model.DemandStatusMatching {
		return nil, errors.New("当前需求状态不允许修改")
	}
	demand.DemandType = normalizeDemandType(input.DemandType)
	demand.Title = strings.TrimSpace(input.Title)
	demand.City = strings.TrimSpace(input.City)
	demand.District = strings.TrimSpace(input.District)
	demand.Address = strings.TrimSpace(input.Address)
	demand.Area = input.Area
	demand.BudgetMin = input.BudgetMin
	demand.BudgetMax = input.BudgetMax
	demand.Timeline = strings.TrimSpace(input.Timeline)
	demand.StylePref = strings.TrimSpace(input.StylePref)
	demand.Description = strings.TrimSpace(input.Description)
	demand.Attachments = toAttachmentsJSON(input.Attachments)
	if input.MaxMatch > 0 {
		demand.MaxMatch = input.MaxMatch
	}
	if err := s.repo.SaveDemand(nil, demand); err != nil {
		return nil, fmt.Errorf("update demand: %w", err)
	}
	return demand, nil
}

func (s *DemandService) SubmitDemand(userID, demandID uint64) (*model.Demand, error) {
	demand, err := s.repo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	if demand.UserID != userID {
		return nil, errors.New("无权操作该需求")
	}
	if demand.Status != model.DemandStatusDraft && demand.Status != model.DemandStatusSubmitted {
		return nil, errors.New("当前状态不可提交")
	}
	if err := validateDemandForSubmit(demand); err != nil {
		return nil, err
	}
	demand.Status = model.DemandStatusSubmitted
	if err := s.repo.SaveDemand(nil, demand); err != nil {
		return nil, fmt.Errorf("submit demand: %w", err)
	}
	if _, err := businessFlowSvc.EnsureLeadFlow(nil, model.BusinessFlowSourceDemand, demand.ID, userID, 0); err != nil {
		return nil, fmt.Errorf("init business flow: %w", err)
	}
	return demand, nil
}

func (s *DemandService) ListUserDemands(userID uint64, filter DemandListFilter) ([]DemandSummary, int64, error) {
	page := normalizePage(filter.Page)
	pageSize := normalizePageSize(filter.PageSize)
	query := repository.DB.Model(&model.Demand{}).Where("user_id = ?", userID)
	if strings.TrimSpace(filter.Status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(filter.Status))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var demands []model.Demand
	if err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&demands).Error; err != nil {
		return nil, 0, err
	}
	items := make([]DemandSummary, 0, len(demands))
	for i := range demands {
		items = append(items, buildDemandSummary(&demands[i]))
	}
	return items, total, nil
}

func (s *DemandService) ListAdminDemands(filter AdminDemandListFilter) ([]DemandSummary, int64, error) {
	page := normalizePage(filter.Page)
	pageSize := normalizePageSize(filter.PageSize)
	query := repository.DB.Model(&model.Demand{})
	if strings.TrimSpace(filter.Status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(filter.Status))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var demands []model.Demand
	if err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&demands).Error; err != nil {
		return nil, 0, err
	}
	items := make([]DemandSummary, 0, len(demands))
	for i := range demands {
		items = append(items, buildDemandSummary(&demands[i]))
	}
	return items, total, nil
}

func (s *DemandService) GetDemandDetailForUser(userID, demandID uint64) (*DemandDetailView, error) {
	demand, err := s.repo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	if demand.UserID != userID {
		return nil, errors.New("无权查看该需求")
	}
	return s.buildDemandDetail(demand)
}

func (s *DemandService) GetDemandDetailForAdmin(demandID uint64) (*DemandDetailView, error) {
	demand, err := s.repo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	return s.buildDemandDetail(demand)
}

func (s *DemandService) buildDemandDetail(demand *model.Demand) (*DemandDetailView, error) {
	var matches []model.DemandMatch
	if err := repository.DB.Where("demand_id = ?", demand.ID).Order("created_at ASC").Find(&matches).Error; err != nil {
		return nil, err
	}
	matchViews := make([]DemandMatchView, 0, len(matches))
	for _, match := range matches {
		var provider model.Provider
		if err := repository.DB.First(&provider, match.ProviderID).Error; err != nil {
			continue
		}
		var user model.User
		_ = repository.DB.First(&user, provider.UserID).Error
		var proposal *model.Proposal
		if match.ProposalID > 0 {
			var record model.Proposal
			if err := repository.DB.First(&record, match.ProposalID).Error; err == nil {
				proposal = &record
			}
		}
		matchViews = append(matchViews, DemandMatchView{
			ID:               match.ID,
			Status:           match.Status,
			AssignedAt:       match.AssignedAt,
			ResponseDeadline: match.ResponseDeadline,
			RespondedAt:      match.RespondedAt,
			DeclineReason:    match.DeclineReason,
			ProposalID:       match.ProposalID,
			Provider:         buildProviderSummary(provider, user),
			Proposal:         buildProposalSummary(proposal),
		})
	}
	summary := buildDemandSummary(demand)
	return &DemandDetailView{
		DemandSummary: summary,
		Address:       demand.Address,
		StylePref:     demand.StylePref,
		Description:   demand.Description,
		Attachments:   parseDemandAttachments(demand.Attachments),
		ReviewedAt:    demand.ReviewedAt,
		ReviewerID:    demand.ReviewerID,
		Matches:       matchViews,
	}, nil
}

func (s *DemandService) ReviewDemand(adminID, demandID uint64, input *ReviewDemandInput) (*model.Demand, error) {
	demand, err := s.repo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	action := strings.TrimSpace(strings.ToLower(input.Action))
	if action != "approve" && action != "reject" {
		return nil, errors.New("无效审核动作")
	}
	if demand.Status != model.DemandStatusSubmitted && demand.Status != model.DemandStatusReviewing && demand.Status != model.DemandStatusApproved {
		return nil, errors.New("当前状态不可审核")
	}
	now := time.Now()
	demand.ReviewerID = adminID
	demand.ReviewNote = strings.TrimSpace(input.Note)
	demand.ReviewedAt = &now
	if action == "approve" {
		demand.Status = model.DemandStatusApproved
		demand.ClosedReason = ""
	} else {
		demand.Status = model.DemandStatusClosed
		demand.ClosedReason = "rejected"
	}
	if err := s.repo.SaveDemand(nil, demand); err != nil {
		return nil, err
	}
	return demand, nil
}

func (s *DemandService) ListDemandCandidates(demandID uint64, page, pageSize int) ([]DemandCandidateView, int64, error) {
	demand, err := s.repo.GetDemandByID(demandID)
	if err != nil {
		return nil, 0, errors.New("需求不存在")
	}
	targetCityCodes := resolveDemandTargetCityCodes(demand)
	var providers []model.Provider
	if err := repository.DB.Where("status = ?", 1).Order("verified DESC, rating DESC, completed_cnt DESC").Find(&providers).Error; err != nil {
		return nil, 0, err
	}
	items := make([]DemandCandidateView, 0, len(providers))
	for _, provider := range providers {
		var user model.User
		_ = repository.DB.First(&user, provider.UserID).Error
		score, reasons := scoreDemandCandidate(demand, targetCityCodes, &provider)
		items = append(items, DemandCandidateView{
			Provider:    buildProviderSummary(provider, user),
			MatchScore:  score,
			ScoreReason: reasons,
		})
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].MatchScore == items[j].MatchScore {
			return items[i].Provider.ID < items[j].Provider.ID
		}
		return items[i].MatchScore > items[j].MatchScore
	})
	total := int64(len(items))
	page = normalizePage(page)
	pageSize = normalizePageSize(pageSize)
	start := (page - 1) * pageSize
	if start >= len(items) {
		return []DemandCandidateView{}, total, nil
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	return items[start:end], total, nil
}

func scoreDemandCandidate(demand *model.Demand, targetCityCodes []string, provider *model.Provider) (int, []string) {
	score := 0
	reasons := make([]string, 0, 4)
	if provider.Verified {
		score += 30
		reasons = append(reasons, "已认证服务商")
	}
	serviceAreas := parseServiceAreas(provider.ServiceArea)
	if isDemandServiceAreaMatched(serviceAreas, demand, targetCityCodes) {
		score += 30
		reasons = append(reasons, "服务城市匹配")
	}
	switch demand.DemandType {
	case model.DemandTypeDesign:
		if provider.ProviderType == 1 {
			score += 25
			reasons = append(reasons, "设计需求匹配")
		}
	case model.DemandTypePartial:
		if provider.ProviderType == 3 || provider.ProviderType == 1 {
			score += 20
			reasons = append(reasons, "局改能力匹配")
		}
	default:
		if provider.ProviderType == 2 || provider.ProviderType == 3 {
			score += 25
			reasons = append(reasons, "整装施工匹配")
		}
	}
	score += int(provider.Rating * 5)
	score += minInt(provider.CompletedCnt, 15)
	if provider.YearsExperience >= 5 {
		score += 5
		reasons = append(reasons, "经验稳定")
	}
	return score, reasons
}

func resolveDemandTargetCityCodes(demand *model.Demand) []string {
	names := make([]string, 0, 2)
	if city := strings.TrimSpace(demand.City); city != "" {
		names = append(names, city)
	}
	if district := strings.TrimSpace(demand.District); district != "" {
		names = append(names, district)
	}
	if len(names) == 0 {
		return []string{}
	}

	var regions []model.Region
	if err := repository.DB.Where("name IN ?", names).Find(&regions).Error; err != nil {
		return []string{}
	}

	targets := make([]string, 0, len(regions))
	for _, region := range regions {
		switch region.Level {
		case 2:
			targets = append(targets, region.Code)
		case 3:
			if strings.TrimSpace(region.ParentCode) != "" {
				targets = append(targets, region.ParentCode)
			}
		}
	}
	return dedupeStringList(targets)
}

func isDemandServiceAreaMatched(serviceAreas []string, demand *model.Demand, targetCityCodes []string) bool {
	targetSet := make(map[string]struct{}, len(targetCityCodes))
	for _, code := range targetCityCodes {
		targetSet[code] = struct{}{}
	}

	for _, area := range serviceAreas {
		trimmed := strings.TrimSpace(area)
		if trimmed == "" {
			continue
		}
		if _, ok := targetSet[trimmed]; ok {
			return true
		}
		if strings.Contains(trimmed, demand.District) || strings.Contains(trimmed, demand.City) {
			return true
		}
	}
	return false
}

func dedupeStringList(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	result := make([]string, 0, len(items))
	for _, item := range items {
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *DemandService) AssignDemand(adminID, demandID uint64, input *AssignDemandInput) ([]model.DemandMatch, error) {
	demand, err := s.repo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	if demand.Status != model.DemandStatusApproved && demand.Status != model.DemandStatusMatching {
		return nil, errors.New("当前状态不可分配")
	}
	if len(input.ProviderIDs) == 0 {
		return nil, errors.New("请至少选择一个商家")
	}
	maxMatch := demand.MaxMatch
	if maxMatch <= 0 {
		maxMatch = defaultMaxMatch
	}
	providerIDs := dedupeUint64(input.ProviderIDs)
	if len(providerIDs) > maxMatch {
		providerIDs = providerIDs[:maxMatch]
	}
	hours := input.ResponseDeadlineHours
	if hours <= 0 {
		hours = 48
	}
	now := time.Now()
	deadline := now.Add(time.Duration(hours) * time.Hour)
	created := make([]model.DemandMatch, 0, len(providerIDs))
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		for _, providerID := range providerIDs {
			var provider model.Provider
			if err := tx.First(&provider, providerID).Error; err != nil {
				return fmt.Errorf("provider %d not found", providerID)
			}
			var existing model.DemandMatch
			err := tx.Where("demand_id = ? AND provider_id = ?", demandID, providerID).First(&existing).Error
			if err == nil {
				continue
			}
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			record := model.DemandMatch{
				DemandID:         demandID,
				ProviderID:       providerID,
				Status:           model.DemandMatchStatusPending,
				AssignedBy:       adminID,
				AssignedAt:       &now,
				ResponseDeadline: &deadline,
			}
			if err := tx.Create(&record).Error; err != nil {
				return err
			}
			created = append(created, record)
		}
		var count int64
		if err := tx.Model(&model.DemandMatch{}).Where("demand_id = ?", demandID).Count(&count).Error; err != nil {
			return err
		}
		demand.Status = model.DemandStatusMatching
		demand.MatchedCount = int(count)
		return s.repo.SaveDemand(tx, demand)
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func dedupeUint64(items []uint64) []uint64 {
	seen := make(map[uint64]struct{}, len(items))
	result := make([]uint64, 0, len(items))
	for _, item := range items {
		if item == 0 {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}

func (s *DemandService) ListMerchantLeads(providerID uint64, status string, page, pageSize int) ([]MerchantLeadView, int64, error) {
	query := repository.DB.Model(&model.DemandMatch{}).Where("provider_id = ?", providerID)
	if strings.TrimSpace(status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(status))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var matches []model.DemandMatch
	page = normalizePage(page)
	pageSize = normalizePageSize(pageSize)
	if err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&matches).Error; err != nil {
		return nil, 0, err
	}
	items := make([]MerchantLeadView, 0, len(matches))
	for _, match := range matches {
		demand, err := s.repo.GetDemandByID(match.DemandID)
		if err != nil {
			continue
		}
		items = append(items, MerchantLeadView{
			ID:               match.ID,
			Status:           match.Status,
			AssignedAt:       match.AssignedAt,
			ResponseDeadline: match.ResponseDeadline,
			RespondedAt:      match.RespondedAt,
			DeclineReason:    match.DeclineReason,
			ProposalID:       match.ProposalID,
			Demand:           buildDemandSummary(demand),
			Attachments:      parseDemandAttachments(demand.Attachments),
		})
	}
	return items, total, nil
}

func (s *DemandService) AcceptLead(providerID, matchID uint64) (*model.DemandMatch, error) {
	match, err := s.repo.GetMatchByID(matchID)
	if err != nil {
		return nil, errors.New("线索不存在")
	}
	if match.ProviderID != providerID {
		return nil, errors.New("无权操作该线索")
	}
	if match.Status != model.DemandMatchStatusPending {
		return nil, errors.New("当前状态不可接受")
	}
	now := time.Now()
	match.Status = model.DemandMatchStatusAccepted
	match.RespondedAt = &now
	if err := s.repo.SaveMatch(nil, match); err != nil {
		return nil, err
	}
	if demand, err := s.repo.GetDemandByID(match.DemandID); err == nil && demand.Status == model.DemandStatusMatching {
		demand.Status = model.DemandStatusMatched
		_ = s.repo.SaveDemand(nil, demand)
	}
	_ = businessFlowSvc.AdvanceBySource(nil, model.BusinessFlowSourceDemand, match.DemandID, map[string]interface{}{
		"current_stage":        model.BusinessFlowStageNegotiating,
		"designer_provider_id": providerID,
	})
	return match, nil
}

func (s *DemandService) DeclineLead(providerID, matchID uint64, reason string) (*model.DemandMatch, error) {
	match, err := s.repo.GetMatchByID(matchID)
	if err != nil {
		return nil, errors.New("线索不存在")
	}
	if match.ProviderID != providerID {
		return nil, errors.New("无权操作该线索")
	}
	if match.Status != model.DemandMatchStatusPending {
		return nil, errors.New("当前状态不可拒绝")
	}
	now := time.Now()
	match.Status = model.DemandMatchStatusDeclined
	match.RespondedAt = &now
	match.DeclineReason = strings.TrimSpace(reason)
	if err := s.repo.SaveMatch(nil, match); err != nil {
		return nil, err
	}
	return match, nil
}

func (s *DemandService) GetDemandMatch(matchID uint64) (*model.DemandMatch, error) {
	match, err := s.repo.GetMatchByID(matchID)
	if err != nil {
		return nil, errors.New("线索不存在")
	}
	return match, nil
}

func (s *DemandService) MarkMatchQuoted(tx *gorm.DB, proposal *model.Proposal) error {
	if proposal == nil || proposal.SourceType != model.ProposalSourceDemand || proposal.DemandMatchID == 0 {
		return nil
	}
	queryDB := repository.DB
	if tx != nil {
		queryDB = tx
	}
	var match model.DemandMatch
	if err := queryDB.First(&match, proposal.DemandMatchID).Error; err != nil {
		return err
	}
	now := time.Now()
	match.Status = model.DemandMatchStatusQuoted
	match.ProposalID = proposal.ID
	match.RespondedAt = &now
	if err := s.repo.SaveMatch(tx, &match); err != nil {
		return err
	}
	var demand model.Demand
	if err := queryDB.First(&demand, proposal.DemandID).Error; err != nil {
		return err
	}
	demand.Status = model.DemandStatusMatched
	return s.repo.SaveDemand(tx, &demand)
}

func (s *DemandService) GetLeadCount(providerID uint64) (int64, error) {
	var count int64
	if err := repository.DB.Model(&model.DemandMatch{}).
		Where("provider_id = ? AND status = ?", providerID, model.DemandMatchStatusPending).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
