package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/service"

	"gorm.io/gorm"
)

type options struct {
	tag          string
	phonePrefix  string
	runID        string
	keywords     []string
	phonePrefixes []string
	apply        bool
	allowStaging bool
}

type targets struct {
	users              []uint64
	providers          []uint64
	shops              []uint64
	materialApps       []uint64
	materialAppProduct []uint64
	merchantApps       []uint64
	projects           []uint64
	projectPhases      []uint64
	bookings           []uint64
	proposals          []uint64
	orders             []uint64
	escrows            []uint64
	milestones         []uint64
	quoteLists         []uint64
	quoteSubmissions   []uint64
	quotePriceBooks    []uint64
	caseAudits         []uint64
	providerCases      []uint64
}

type tableCount struct {
	Table string
	Count int64
}

func main() {
	opts := parseFlags()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	if err := config.ValidateDatabaseSafety(cfg); err != nil {
		log.Fatalf("数据库环境安全校验失败: %v", err)
	}

	appEnv := config.GetAppEnv()
	if appEnv == config.AppEnvProduction {
		log.Fatalf("安全保护：测试数据清理器禁止在 production 环境运行")
	}

	if appEnv == config.AppEnvStaging && opts.apply && !opts.allowStaging {
		log.Fatalf("安全保护：staging 环境默认只允许 dry-run；如确认执行删除，请显式追加 --allow-staging")
	}

	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	db := repository.DB
	t, err := collectTargets(db, opts)
	if err != nil {
		log.Fatalf("采集待清理目标失败: %v", err)
	}

	counts, err := previewCounts(db, t)
	if err != nil {
		log.Fatalf("统计待清理数据失败: %v", err)
	}

	printPlan(cfg, opts, counts, t)

	if !opts.apply {
		fmt.Println("\n模式: dry-run（未执行删除）")
		return
	}

	if err := applyCleanup(db, t); err != nil {
		log.Fatalf("执行清理失败: %v", err)
	}

	fmt.Println("\n已执行删除，下面是删除后的剩余统计：")
	postCounts, err := previewCounts(db, t)
	if err != nil {
		log.Fatalf("清理后统计失败: %v", err)
	}
	printCounts(postCounts)
}

func parseFlags() options {
	var opts options
	var keywordsCSV string
	var phonePrefixesCSV string
	flag.StringVar(&opts.tag, "tag", "[TEST]", "用于识别测试数据的文本标签")
	flag.StringVar(&opts.phonePrefix, "phone-prefix", "19999", "用于识别测试数据的手机号前缀")
	flag.StringVar(&keywordsCSV, "keywords", strings.Join(service.DirtyDataTextKeywords, ","), "用于识别测试/验收数据的文本关键词，多个逗号分隔")
	flag.StringVar(&phonePrefixesCSV, "phone-prefixes", strings.Join(service.DirtyDataPhonePrefixes, ","), "用于识别测试/验收数据的手机号前缀，多个逗号分隔")
	flag.StringVar(&opts.runID, "run-id", "", "用于识别测试数据的运行批次标记（会匹配备注/说明等文本字段）")
	flag.BoolVar(&opts.apply, "apply", false, "实际执行删除；默认只做 dry-run")
	flag.BoolVar(&opts.allowStaging, "allow-staging", false, "允许在 staging 环境实际执行删除")
	flag.Parse()
	opts.keywords = uniqueStrings(append(splitCSV(keywordsCSV), opts.tag))
	opts.phonePrefixes = uniqueStrings(append(splitCSV(phonePrefixesCSV), opts.phonePrefix))
	return opts
}

func collectTargets(db *gorm.DB, opts options) (*targets, error) {
	result := &targets{}
	var err error

	result.users, err = collectUserIDs(db, opts)
	if err != nil {
		return nil, err
	}
	result.providers, err = collectProviderIDs(db, opts, result.users)
	if err != nil {
		return nil, err
	}
	result.shops, err = collectMaterialShopIDs(db, opts, result.users)
	if err != nil {
		return nil, err
	}
	result.materialApps, err = collectMaterialApplicationIDs(db, opts, result.users)
	if err != nil {
		return nil, err
	}
	result.materialAppProduct, err = collectIDsByColumn(db, "material_shop_application_products", "id", "application_id", result.materialApps)
	if err != nil {
		return nil, err
	}
	result.merchantApps, err = collectMerchantApplicationIDs(db, opts, result.users)
	if err != nil {
		return nil, err
	}
	result.projects, err = collectProjectIDs(db, opts, result.users, result.providers)
	if err != nil {
		return nil, err
	}
	result.projectPhases, err = collectIDsByColumn(db, "project_phases", "id", "project_id", result.projects)
	if err != nil {
		return nil, err
	}
	result.bookings, err = collectBookingIDs(db, opts, result.users, result.providers)
	if err != nil {
		return nil, err
	}
	result.proposals, err = collectProposalIDs(db, opts, result.bookings, result.providers)
	if err != nil {
		return nil, err
	}
	result.orders, err = collectOrderIDs(db, result.projects, result.bookings, result.proposals)
	if err != nil {
		return nil, err
	}
	result.escrows, err = collectEscrowIDs(db, result.projects, result.users)
	if err != nil {
		return nil, err
	}
	result.milestones, err = collectIDsByColumn(db, "milestones", "id", "project_id", result.projects)
	if err != nil {
		return nil, err
	}
	result.quoteLists, err = collectQuoteListIDs(db, opts, result.projects, result.users, result.providers)
	if err != nil {
		return nil, err
	}
	result.quoteSubmissions, err = collectQuoteSubmissionIDs(db, result.quoteLists, result.providers)
	if err != nil {
		return nil, err
	}
	result.quotePriceBooks, err = collectIDsByColumn(db, "quote_price_books", "id", "provider_id", result.providers)
	if err != nil {
		return nil, err
	}
	result.caseAudits, err = collectCaseAuditIDs(db, opts, result.providers)
	if err != nil {
		return nil, err
	}
	result.providerCases, err = collectProviderCaseIDs(db, opts, result.providers)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func collectUserIDs(db *gorm.DB, opts options) ([]uint64, error) {
	if !hasTable(db, "users") {
		return nil, nil
	}

	query := db.Table("users").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"nickname", "public_id"}, opts.keywords)
	query = addPrefixConditions(query, &hasCondition, "phone", opts.phonePrefixes)
	query = addLikeCondition(query, &hasCondition, "nickname", opts.runID)
	query = addLikeCondition(query, &hasCondition, "public_id", opts.runID)

	if !hasCondition {
		return nil, nil
	}

	var ids []uint64
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return uniqueUint64(ids), nil
}

func collectProviderIDs(db *gorm.DB, opts options, userIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "providers") {
		return nil, nil
	}

	query := db.Table("providers").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"company_name", "specialty", "service_intro"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "company_name", opts.runID)
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

func collectMaterialShopIDs(db *gorm.DB, opts options, userIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "material_shops") {
		return nil, nil
	}

	query := db.Table("material_shops").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"name", "company_name", "description", "address"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "name", opts.runID)
	query = addLikeCondition(query, &hasCondition, "company_name", opts.runID)
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

func collectMaterialApplicationIDs(db *gorm.DB, opts options, userIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "material_shop_applications") {
		return nil, nil
	}

	query := db.Table("material_shop_applications").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"shop_name", "company_name", "contact_name", "shop_description", "address"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "shop_name", opts.runID)
	query = addLikeCondition(query, &hasCondition, "company_name", opts.runID)
	query = addPrefixConditions(query, &hasCondition, "phone", opts.phonePrefixes)
	query = addPrefixConditions(query, &hasCondition, "contact_phone", opts.phonePrefixes)
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

func collectMerchantApplicationIDs(db *gorm.DB, opts options, userIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "merchant_applications") {
		return nil, nil
	}

	query := db.Table("merchant_applications").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"real_name", "company_name", "introduction", "design_philosophy", "office_address"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "real_name", opts.runID)
	query = addLikeCondition(query, &hasCondition, "company_name", opts.runID)
	query = addPrefixConditions(query, &hasCondition, "phone", opts.phonePrefixes)
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

func collectProjectIDs(db *gorm.DB, opts options, userIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "projects") {
		return nil, nil
	}

	query := db.Table("projects").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"name", "address", "current_phase"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "name", opts.runID)
	query = addLikeCondition(query, &hasCondition, "address", opts.runID)
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

func collectBookingIDs(db *gorm.DB, opts options, userIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "bookings") {
		return nil, nil
	}

	query := db.Table("bookings").Distinct("id")
	var hasCondition bool
	query = addPrefixConditions(query, &hasCondition, "phone", opts.phonePrefixes)
	query = addKeywordConditions(query, &hasCondition, []string{"notes", "address"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "notes", opts.runID)
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

func collectProposalIDs(db *gorm.DB, opts options, bookingIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "proposals") {
		return nil, nil
	}

	query := db.Table("proposals").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"summary"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "summary", opts.runID)
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

func collectOrderIDs(db *gorm.DB, projectIDs, bookingIDs, proposalIDs []uint64) ([]uint64, error) {
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

func collectEscrowIDs(db *gorm.DB, projectIDs, userIDs []uint64) ([]uint64, error) {
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

func collectQuoteListIDs(db *gorm.DB, opts options, projectIDs, userIDs, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "quote_lists") {
		return nil, nil
	}

	query := db.Table("quote_lists").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"title", "scenario_type"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "title", opts.runID)
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

func collectQuoteSubmissionIDs(db *gorm.DB, quoteListIDs, providerIDs []uint64) ([]uint64, error) {
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

func collectCaseAuditIDs(db *gorm.DB, opts options, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "case_audits") {
		return nil, nil
	}

	query := db.Table("case_audits").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"title", "description"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "title", opts.runID)
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

func collectProviderCaseIDs(db *gorm.DB, opts options, providerIDs []uint64) ([]uint64, error) {
	if !hasTable(db, "provider_cases") {
		return nil, nil
	}

	query := db.Table("provider_cases").Distinct("id")
	var hasCondition bool
	query = addKeywordConditions(query, &hasCondition, []string{"title", "description"}, opts.keywords)
	query = addLikeCondition(query, &hasCondition, "title", opts.runID)
	query = addLikeCondition(query, &hasCondition, "description", opts.runID)
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

func previewCounts(db *gorm.DB, t *targets) ([]tableCount, error) {
	counts := []tableCount{
		mustCount(db, "users", "id", t.users),
		mustCount(db, "providers", "id", t.providers),
		mustCount(db, "material_shops", "id", t.shops),
		mustCount(db, "material_shop_applications", "id", t.materialApps),
		mustCount(db, "merchant_applications", "id", t.merchantApps),
		mustCount(db, "projects", "id", t.projects),
		mustCount(db, "bookings", "id", t.bookings),
		mustCount(db, "proposals", "id", t.proposals),
		mustCount(db, "orders", "id", t.orders),
		mustCount(db, "escrow_accounts", "id", t.escrows),
		mustCount(db, "quote_lists", "id", t.quoteLists),
		mustCount(db, "quote_submissions", "id", t.quoteSubmissions),
		mustCount(db, "provider_cases", "id", t.providerCases),
		mustCount(db, "case_audits", "id", t.caseAudits),
	}

	sort.Slice(counts, func(i, j int) bool {
		return counts[i].Table < counts[j].Table
	})

	return counts, nil
}

func applyCleanup(db *gorm.DB, t *targets) error {
	return db.Transaction(func(tx *gorm.DB) error {
		steps := []struct {
			table  string
			column string
			ids    []uint64
		}{
			{"material_shop_application_products", "application_id", t.materialApps},
			{"quote_submission_items", "quote_submission_id", t.quoteSubmissions},
			{"quote_submissions", "id", t.quoteSubmissions},
			{"quote_invitations", "quote_list_id", t.quoteLists},
			{"quote_list_items", "quote_list_id", t.quoteLists},
			{"quote_lists", "id", t.quoteLists},
			{"quote_price_book_items", "price_book_id", t.quotePriceBooks},
			{"quote_price_books", "id", t.quotePriceBooks},
			{"transactions", "escrow_id", t.escrows},
			{"payment_plans", "order_id", t.orders},
			{"merchant_incomes", "order_id", t.orders},
			{"merchant_incomes", "booking_id", t.bookings},
			{"merchant_incomes", "provider_id", t.providers},
			{"merchant_withdraws", "provider_id", t.providers},
			{"merchant_bank_accounts", "provider_id", t.providers},
			{"merchant_service_settings", "provider_id", t.providers},
			{"notifications", "user_id", t.users},
			{"after_sales", "booking_id", t.bookings},
			{"after_sales", "user_id", t.users},
			{"provider_reviews", "provider_id", t.providers},
			{"provider_reviews", "user_id", t.users},
			{"case_comments", "case_id", t.providerCases},
			{"case_comments", "user_id", t.users},
			{"user_likes", "user_id", t.users},
			{"user_likes", "target_id", t.providerCases},
			{"user_favorites", "user_id", t.users},
			{"user_favorites", "target_id", t.providers},
			{"user_favorites", "target_id", t.providerCases},
			{"user_follows", "user_id", t.users},
			{"user_follows", "target_id", t.providers},
			{"audit_logs", "operator_id", t.users},
			{"identity_audit_logs", "user_id", t.users},
			{"merchant_identity_change_applications", "user_id", t.users},
			{"identity_applications", "user_id", t.users},
			{"user_identities", "user_id", t.users},
			{"material_shop_products", "shop_id", t.shops},
			{"material_shop_applications", "id", t.materialApps},
			{"material_shops", "id", t.shops},
			{"case_audits", "id", t.caseAudits},
			{"provider_cases", "id", t.providerCases},
			{"workers", "user_id", t.users},
			{"work_logs", "project_id", t.projects},
			{"phase_tasks", "phase_id", t.projectPhases},
			{"project_phases", "id", t.projectPhases},
			{"milestones", "id", t.milestones},
			{"escrow_accounts", "id", t.escrows},
			{"orders", "id", t.orders},
			{"proposals", "id", t.proposals},
			{"bookings", "id", t.bookings},
			{"projects", "id", t.projects},
			{"merchant_applications", "id", t.merchantApps},
			{"providers", "id", t.providers},
			{"user_feedbacks", "user_id", t.users},
			{"user_settings", "user_id", t.users},
			{"user_verifications", "user_id", t.users},
			{"user_login_devices", "user_id", t.users},
			{"users", "id", t.users},
		}

		for _, step := range steps {
			if err := deleteByIDs(tx, step.table, step.column, step.ids); err != nil {
				return err
			}
		}

		return nil
	})
}

func printPlan(cfg *config.Config, opts options, counts []tableCount, t *targets) {
	fmt.Println("========================================")
	fmt.Println("测试数据清理计划")
	fmt.Println("========================================")
	fmt.Printf("环境: %s\n", config.GetAppEnv())
	fmt.Printf("数据库: %s@%s/%s\n", cfg.Database.User, cfg.Database.Host, cfg.Database.DBName)
	fmt.Printf("标记标签: %s\n", opts.tag)
	fmt.Printf("关键词: %s\n", strings.Join(opts.keywords, ", "))
	fmt.Printf("手机号前缀: %s\n", strings.Join(opts.phonePrefixes, ", "))
	if strings.TrimSpace(opts.runID) != "" {
		fmt.Printf("Run ID: %s\n", opts.runID)
	}
	fmt.Printf("模式: %s\n", map[bool]string{true: "apply", false: "dry-run"}[opts.apply])
	fmt.Printf("目标用户: %d, 服务商: %d, 项目: %d, 预约: %d, 订单: %d\n", len(t.users), len(t.providers), len(t.projects), len(t.bookings), len(t.orders))
	fmt.Println()
	printCounts(counts)
}

func printCounts(counts []tableCount) {
	for _, item := range counts {
		fmt.Printf("- %-30s %d\n", item.Table, item.Count)
	}
}

func mustCount(db *gorm.DB, table, column string, ids []uint64) tableCount {
	if !hasTable(db, table) || len(ids) == 0 {
		return tableCount{Table: table, Count: 0}
	}

	var count int64
	_ = db.Table(table).Where(column+" IN ?", ids).Count(&count).Error
	return tableCount{Table: table, Count: count}
}

func deleteByIDs(tx *gorm.DB, table, column string, ids []uint64) error {
	if !hasTable(tx, table) || len(ids) == 0 {
		return nil
	}
	return tx.Table(table).Where(column+" IN ?", ids).Delete(&struct{}{}).Error
}

func addLikeCondition(db *gorm.DB, hasCondition *bool, column, keyword string) *gorm.DB {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return db
	}

	return addCondition(db, hasCondition, column+" LIKE ?", "%"+keyword+"%")
}

func addPrefixCondition(db *gorm.DB, hasCondition *bool, column, prefix string) *gorm.DB {
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		return db
	}

	return addCondition(db, hasCondition, column+" LIKE ?", prefix+"%")
}

func addKeywordConditions(db *gorm.DB, hasCondition *bool, columns []string, keywords []string) *gorm.DB {
	for _, keyword := range keywords {
		keyword = strings.TrimSpace(keyword)
		if keyword == "" {
			continue
		}
		for _, column := range columns {
			db = addLikeCondition(db, hasCondition, column, keyword)
		}
	}
	return db
}

func addPrefixConditions(db *gorm.DB, hasCondition *bool, column string, prefixes []string) *gorm.DB {
	for _, prefix := range prefixes {
		prefix = strings.TrimSpace(prefix)
		if prefix == "" {
			continue
		}
		db = addPrefixCondition(db, hasCondition, column, prefix)
	}
	return db
}

func addInCondition(db *gorm.DB, hasCondition *bool, column string, ids []uint64) *gorm.DB {
	if len(ids) == 0 {
		return db
	}
	return addCondition(db, hasCondition, column+" IN ?", ids)
}

func addCondition(db *gorm.DB, hasCondition *bool, query string, args ...interface{}) *gorm.DB {
	if !*hasCondition {
		*hasCondition = true
		return db.Where(query, args...)
	}
	return db.Or(query, args...)
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

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	return strings.Split(raw, ",")
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			continue
		}
		key := strings.ToLower(normalized)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, normalized)
	}
	sort.Strings(result)
	return result
}

func init() {
	log.SetFlags(0)
	log.SetOutput(os.Stderr)
}
