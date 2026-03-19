package service

import (
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"
)

type AdminUserCleanupService struct {
	db *gorm.DB
}

type AdminUserCleanupResult struct {
	UserIDs []uint64 `json:"userIds"`
}

func NewAdminUserCleanupService(db *gorm.DB) *AdminUserCleanupService {
	return &AdminUserCleanupService{db: db}
}

func (s *AdminUserCleanupService) DeleteDirtyUsers(userIDs []uint64) (*AdminUserCleanupResult, error) {
	userIDs = uniqueUint64(userIDs)
	if len(userIDs) == 0 {
		return nil, fmt.Errorf("未提供待删除用户")
	}

	if err := s.ensureDirtyCandidates(userIDs); err != nil {
		return nil, err
	}

	targets, err := s.collectTargets(userIDs)
	if err != nil {
		return nil, err
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		steps := []struct {
			table  string
			column string
			ids    []uint64
		}{
			{"material_shop_application_products", "application_id", targets.materialApps},
			{"quote_submission_items", "quote_submission_id", targets.quoteSubmissions},
			{"quote_submissions", "id", targets.quoteSubmissions},
			{"quote_invitations", "quote_list_id", targets.quoteLists},
			{"quote_list_items", "quote_list_id", targets.quoteLists},
			{"quote_lists", "id", targets.quoteLists},
			{"quote_price_book_items", "price_book_id", targets.quotePriceBooks},
			{"quote_price_books", "id", targets.quotePriceBooks},
			{"transactions", "escrow_id", targets.escrows},
			{"payment_plans", "order_id", targets.orders},
			{"merchant_incomes", "order_id", targets.orders},
			{"merchant_incomes", "booking_id", targets.bookings},
			{"merchant_incomes", "provider_id", targets.providers},
			{"merchant_withdraws", "provider_id", targets.providers},
			{"merchant_bank_accounts", "provider_id", targets.providers},
			{"merchant_service_settings", "provider_id", targets.providers},
			{"notifications", "user_id", targets.users},
			{"after_sales", "booking_id", targets.bookings},
			{"after_sales", "user_id", targets.users},
			{"provider_reviews", "provider_id", targets.providers},
			{"provider_reviews", "user_id", targets.users},
			{"case_comments", "case_id", targets.providerCases},
			{"case_comments", "user_id", targets.users},
			{"user_likes", "user_id", targets.users},
			{"user_likes", "target_id", targets.providerCases},
			{"user_favorites", "user_id", targets.users},
			{"user_favorites", "target_id", targets.providers},
			{"user_favorites", "target_id", targets.providerCases},
			{"user_follows", "user_id", targets.users},
			{"user_follows", "target_id", targets.providers},
			{"identity_audit_logs", "user_id", targets.users},
			{"merchant_identity_change_applications", "user_id", targets.users},
			{"identity_applications", "user_id", targets.users},
			{"user_identities", "user_id", targets.users},
			{"material_shop_products", "shop_id", targets.shops},
			{"material_shop_applications", "id", targets.materialApps},
			{"material_shops", "id", targets.shops},
			{"case_audits", "id", targets.caseAudits},
			{"provider_cases", "id", targets.providerCases},
			{"workers", "user_id", targets.users},
			{"work_logs", "project_id", targets.projects},
			{"phase_tasks", "phase_id", targets.projectPhases},
			{"project_phases", "id", targets.projectPhases},
			{"milestones", "id", targets.milestones},
			{"escrow_accounts", "id", targets.escrows},
			{"orders", "id", targets.orders},
			{"proposals", "id", targets.proposals},
			{"bookings", "id", targets.bookings},
			{"projects", "id", targets.projects},
			{"merchant_applications", "id", targets.merchantApps},
			{"providers", "id", targets.providers},
			{"user_feedbacks", "user_id", targets.users},
			{"user_settings", "user_id", targets.users},
			{"user_verifications", "user_id", targets.users},
			{"user_login_devices", "user_id", targets.users},
			{"users", "id", targets.users},
		}

		for _, step := range steps {
			if err := deleteByIDs(tx, step.table, step.column, step.ids); err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return &AdminUserCleanupResult{UserIDs: targets.users}, nil
}

type cleanupTargets struct {
	users            []uint64
	providers        []uint64
	shops            []uint64
	materialApps     []uint64
	merchantApps     []uint64
	projects         []uint64
	projectPhases    []uint64
	bookings         []uint64
	proposals        []uint64
	orders           []uint64
	escrows          []uint64
	milestones       []uint64
	quoteLists       []uint64
	quoteSubmissions []uint64
	quotePriceBooks  []uint64
	caseAudits       []uint64
	providerCases    []uint64
}

func (s *AdminUserCleanupService) ensureDirtyCandidates(userIDs []uint64) error {
	if !hasTable(s.db, "users") {
		return fmt.Errorf("users 表不存在")
	}

	type userRow struct {
		ID       uint64
		Phone    string
		Nickname string
	}

	var rows []userRow
	if err := s.db.Table("users").Select("id", "phone", "nickname").Where("id IN ?", userIDs).Find(&rows).Error; err != nil {
		return err
	}

	if len(rows) != len(userIDs) {
		return fmt.Errorf("部分用户不存在或已被删除")
	}

	for _, row := range rows {
		if isDirtyUserCandidate(row.Nickname, row.Phone) {
			continue
		}
		return fmt.Errorf("用户 %d (%s) 不是可清理的测试/脏数据账号，仅允许删除带 [TEST] 标记或手机号前缀 19999 的用户", row.ID, strings.TrimSpace(row.Nickname))
	}

	return nil
}

func isDirtyUserCandidate(nickname, phone string) bool {
	return IsDirtyTextCandidate(nickname) || IsDirtyPhoneCandidate(phone)
}

func (s *AdminUserCleanupService) collectTargets(userIDs []uint64) (*cleanupTargets, error) {
	targets := &cleanupTargets{users: uniqueUint64(userIDs)}
	var err error

	targets.providers, err = collectProviderIDsByUsers(s.db, targets.users)
	if err != nil {
		return nil, err
	}
	targets.shops, err = collectMaterialShopIDsByUsers(s.db, targets.users)
	if err != nil {
		return nil, err
	}
	targets.materialApps, err = collectIDsByColumn(s.db, "material_shop_applications", "id", "user_id", targets.users)
	if err != nil {
		return nil, err
	}
	targets.merchantApps, err = collectIDsByColumn(s.db, "merchant_applications", "id", "user_id", targets.users)
	if err != nil {
		return nil, err
	}
	targets.projects, err = collectProjectIDsByUsers(s.db, targets.users, targets.providers)
	if err != nil {
		return nil, err
	}
	targets.projectPhases, err = collectIDsByColumn(s.db, "project_phases", "id", "project_id", targets.projects)
	if err != nil {
		return nil, err
	}
	targets.bookings, err = collectBookingIDsByUsers(s.db, targets.users, targets.providers)
	if err != nil {
		return nil, err
	}
	targets.proposals, err = collectProposalIDsByRefs(s.db, targets.bookings, targets.providers)
	if err != nil {
		return nil, err
	}
	targets.orders, err = collectOrderIDsByRefs(s.db, targets.projects, targets.bookings, targets.proposals)
	if err != nil {
		return nil, err
	}
	targets.escrows, err = collectEscrowIDsByRefs(s.db, targets.projects, targets.users)
	if err != nil {
		return nil, err
	}
	targets.milestones, err = collectIDsByColumn(s.db, "milestones", "id", "project_id", targets.projects)
	if err != nil {
		return nil, err
	}
	targets.quoteLists, err = collectQuoteListIDsByRefs(s.db, targets.projects, targets.users, targets.providers)
	if err != nil {
		return nil, err
	}
	targets.quoteSubmissions, err = collectQuoteSubmissionIDsByRefs(s.db, targets.quoteLists, targets.providers)
	if err != nil {
		return nil, err
	}
	targets.quotePriceBooks, err = collectIDsByColumn(s.db, "quote_price_books", "id", "provider_id", targets.providers)
	if err != nil {
		return nil, err
	}
	targets.caseAudits, err = collectIDsByColumn(s.db, "case_audits", "id", "provider_id", targets.providers)
	if err != nil {
		return nil, err
	}
	targets.providerCases, err = collectIDsByColumn(s.db, "provider_cases", "id", "provider_id", targets.providers)
	if err != nil {
		return nil, err
	}

	return targets, nil
}

func collectProviderIDsByUsers(db *gorm.DB, userIDs []uint64) ([]uint64, error) {
	return collectIDsByColumn(db, "providers", "id", "user_id", userIDs)
}

func collectMaterialShopIDsByUsers(db *gorm.DB, userIDs []uint64) ([]uint64, error) {
	return collectIDsByColumn(db, "material_shops", "id", "user_id", userIDs)
}

func collectProjectIDsByUsers(db *gorm.DB, userIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "projects") {
		return nil, nil
	}

	query := db.Table("projects").Distinct("id")
	var hasCondition bool
	if len(userIDs) > 0 {
		query = addInCondition(query, &hasCondition, "owner_id", userIDs)
	}
	if len(providerIDs) > 0 {
		query = addInCondition(query, &hasCondition, "provider_id", providerIDs)
	}
	if !hasCondition {
		return nil, nil
	}

	var ids []uint64
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func collectBookingIDsByUsers(db *gorm.DB, userIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "bookings") {
		return nil, nil
	}

	query := db.Table("bookings").Distinct("id")
	var hasCondition bool
	if len(userIDs) > 0 {
		query = addInCondition(query, &hasCondition, "user_id", userIDs)
	}
	if len(providerIDs) > 0 {
		query = addInCondition(query, &hasCondition, "provider_id", providerIDs)
	}
	if !hasCondition {
		return nil, nil
	}

	var ids []uint64
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func collectProposalIDsByRefs(db *gorm.DB, bookingIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "proposals") {
		return nil, nil
	}

	query := db.Table("proposals").Distinct("id")
	var hasCondition bool
	if len(bookingIDs) > 0 {
		query = addInCondition(query, &hasCondition, "booking_id", bookingIDs)
	}
	if len(providerIDs) > 0 {
		query = addInCondition(query, &hasCondition, "designer_id", providerIDs)
	}
	if !hasCondition {
		return nil, nil
	}

	var ids []uint64
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func collectOrderIDsByRefs(db *gorm.DB, projectIDs, bookingIDs, proposalIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "orders") {
		return nil, nil
	}

	query := db.Table("orders").Distinct("id")
	var hasCondition bool
	if len(projectIDs) > 0 {
		query = addInCondition(query, &hasCondition, "project_id", projectIDs)
	}
	if len(bookingIDs) > 0 {
		query = addInCondition(query, &hasCondition, "booking_id", bookingIDs)
	}
	if len(proposalIDs) > 0 {
		query = addInCondition(query, &hasCondition, "proposal_id", proposalIDs)
	}
	if !hasCondition {
		return nil, nil
	}

	var ids []uint64
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func collectEscrowIDsByRefs(db *gorm.DB, projectIDs, userIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "escrow_accounts") {
		return nil, nil
	}

	query := db.Table("escrow_accounts").Distinct("id")
	var hasCondition bool
	if len(projectIDs) > 0 {
		query = addInCondition(query, &hasCondition, "project_id", projectIDs)
	}
	if len(userIDs) > 0 {
		query = addInCondition(query, &hasCondition, "user_id", userIDs)
	}
	if !hasCondition {
		return nil, nil
	}

	var ids []uint64
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func collectQuoteListIDsByRefs(db *gorm.DB, projectIDs, userIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "quote_lists") {
		return nil, nil
	}

	query := db.Table("quote_lists").Distinct("id")
	var hasCondition bool
	if len(projectIDs) > 0 {
		query = addInCondition(query, &hasCondition, "project_id", projectIDs)
	}
	if len(userIDs) > 0 {
		query = addInCondition(query, &hasCondition, "owner_user_id", userIDs)
	}
	if len(providerIDs) > 0 {
		query = addInCondition(query, &hasCondition, "designer_provider_id", providerIDs)
	}
	if !hasCondition {
		return nil, nil
	}

	var ids []uint64
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func collectQuoteSubmissionIDsByRefs(db *gorm.DB, quoteListIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "quote_submissions") {
		return nil, nil
	}

	query := db.Table("quote_submissions").Distinct("id")
	var hasCondition bool
	if len(quoteListIDs) > 0 {
		query = addInCondition(query, &hasCondition, "quote_list_id", quoteListIDs)
	}
	if len(providerIDs) > 0 {
		query = addInCondition(query, &hasCondition, "provider_id", providerIDs)
	}
	if !hasCondition {
		return nil, nil
	}

	var ids []uint64
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func collectIDsByColumn(db *gorm.DB, table, selectColumn, filterColumn string, filterIDs []uint64) ([]uint64, error) {
	if !hasTable(db, table) || len(filterIDs) == 0 {
		return nil, nil
	}

	var ids []uint64
	if err := db.Table(table).Distinct(selectColumn).Where(filterColumn+" IN ?", filterIDs).Pluck(selectColumn, &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func deleteByIDs(tx *gorm.DB, table, column string, ids []uint64) error {
	if !hasTable(tx, table) || len(ids) == 0 {
		return nil
	}
	return tx.Table(table).Where(column+" IN ?", ids).Delete(&struct{}{}).Error
}

func addInCondition(db *gorm.DB, hasCondition *bool, column string, ids []uint64) *gorm.DB {
	if len(ids) == 0 {
		return db
	}
	if !*hasCondition {
		*hasCondition = true
		return db.Where(column+" IN ?", ids)
	}
	return db.Or(column+" IN ?", ids)
}

func hasTable(db *gorm.DB, table string) bool {
	return db != nil && db.Migrator().HasTable(table)
}

func uniqueUint64(values []uint64) []uint64 {
	if len(values) == 0 {
		return nil
	}

	seen := make(map[uint64]struct{}, len(values))
	result := make([]uint64, 0, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}

	sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })
	return result
}
