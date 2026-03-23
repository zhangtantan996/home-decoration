package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"
)

const baseFindingsCTE = `
WITH phase_agg AS (
  SELECT
    project_id,
    COUNT(*) AS phase_total,
    COUNT(*) FILTER (WHERE status = 'pending') AS phase_pending_count,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS phase_in_progress_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS phase_completed_count
  FROM project_phases
  GROUP BY project_id
),
milestone_agg AS (
  SELECT
    project_id,
    COUNT(*) AS milestone_total,
    COUNT(*) FILTER (WHERE status = 0) AS milestone_pending_count,
    COUNT(*) FILTER (WHERE status = 1) AS milestone_in_progress_count,
    COUNT(*) FILTER (WHERE status = 2) AS milestone_submitted_count,
    COUNT(*) FILTER (WHERE status IN (3, 4)) AS milestone_accepted_or_paid_count
  FROM milestones
  GROUP BY project_id
),
escrow_agg AS (
  SELECT
    project_id,
    COUNT(*) AS escrow_total,
    COALESCE(SUM(total_amount), 0) AS escrow_total_amount,
    COALESCE(SUM(frozen_amount), 0) AS escrow_frozen_amount,
    COALESCE(SUM(available_amount), 0) AS escrow_available_amount,
    COALESCE(SUM(released_amount), 0) AS escrow_released_amount
  FROM escrow_accounts
  GROUP BY project_id
),
flow_agg AS (
  SELECT
    project_id,
    COUNT(*) AS flow_total,
    STRING_AGG(current_stage, ',' ORDER BY id) AS flow_stages,
    MIN(current_stage) FILTER (WHERE current_stage IS NOT NULL AND BTRIM(current_stage) <> '') AS flow_stage_one
  FROM business_flows
  WHERE project_id > 0
  GROUP BY project_id
),
provider_agg AS (
  SELECT
    p.id AS provider_id,
    p.user_id,
    p.provider_type,
    NULLIF(BTRIM(p.company_name), '') AS company_name,
    NULLIF(BTRIM(u.nickname), '') AS nickname,
    NULLIF(BTRIM(u.phone), '') AS phone
  FROM providers p
  LEFT JOIN users u ON u.id = p.user_id
),
snapshot AS (
  SELECT
    p.id AS project_id,
    p.name,
    p.owner_id,
    p.provider_id,
    p.construction_provider_id,
    p.foreman_id,
    p.status,
    p.business_status,
    p.current_phase,
    p.budget,
    p.construction_quote,
    p.started_at,
    p.start_date,
    p.expected_end,
    p.actual_end,
    p.completion_submitted_at,
    p.completion_rejected_at,
    p.disputed_at,
    p.inspiration_case_draft_id,

    COALESCE(ph.phase_total, 0) AS phase_total,
    COALESCE(ph.phase_pending_count, 0) AS phase_pending_count,
    COALESCE(ph.phase_in_progress_count, 0) AS phase_in_progress_count,
    COALESCE(ph.phase_completed_count, 0) AS phase_completed_count,

    COALESCE(ms.milestone_total, 0) AS milestone_total,
    COALESCE(ms.milestone_pending_count, 0) AS milestone_pending_count,
    COALESCE(ms.milestone_in_progress_count, 0) AS milestone_in_progress_count,
    COALESCE(ms.milestone_submitted_count, 0) AS milestone_submitted_count,
    COALESCE(ms.milestone_accepted_or_paid_count, 0) AS milestone_accepted_or_paid_count,

    COALESCE(es.escrow_total, 0) AS escrow_total,
    COALESCE(es.escrow_total_amount, 0) AS escrow_total_amount,
    COALESCE(es.escrow_frozen_amount, 0) AS escrow_frozen_amount,
    COALESCE(es.escrow_available_amount, 0) AS escrow_available_amount,
    COALESCE(es.escrow_released_amount, 0) AS escrow_released_amount,

    COALESCE(fl.flow_total, 0) AS flow_total,
    fl.flow_stages,
    fl.flow_stage_one,

    pa.provider_type,
    COALESCE(pa.nickname, pa.company_name, pa.phone) AS provider_display_seed
  FROM projects p
  LEFT JOIN phase_agg ph ON ph.project_id = p.id
  LEFT JOIN milestone_agg ms ON ms.project_id = p.id
  LEFT JOIN escrow_agg es ON es.project_id = p.id
  LEFT JOIN flow_agg fl ON fl.project_id = p.id
  LEFT JOIN provider_agg pa ON pa.provider_id = p.provider_id
),
findings AS (
  SELECT
    'P001' AS rule_code,
    'fatal' AS severity,
    project_id,
    name,
    status,
    business_status,
    current_phase,
    flow_stage_one AS flow_stage,
    flow_stages,
    phase_total,
    milestone_total,
    escrow_total,
    provider_id,
    construction_provider_id,
    foreman_id,
    completion_submitted_at,
    inspiration_case_draft_id,
    '项目缺托管账户' AS detail
  FROM snapshot
  WHERE escrow_total = 0
    AND (
      status IN (0, 1, 2)
      OR business_status IN ('construction_quote_confirmed', 'in_progress', 'completed')
    )

  UNION ALL

  SELECT
    'P002', 'fatal', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目缺施工阶段(project_phases)' AS detail
  FROM snapshot
  WHERE phase_total = 0
    AND business_status IN ('construction_quote_confirmed', 'in_progress', 'completed')

  UNION ALL

  SELECT
    'P003', 'fatal', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目缺里程碑(milestones)' AS detail
  FROM snapshot
  WHERE milestone_total = 0
    AND business_status IN ('construction_quote_confirmed', 'in_progress', 'completed')

  UNION ALL

  SELECT
    'P004', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目缺业务流(business_flows.project_id)' AS detail
  FROM snapshot
  WHERE flow_total = 0
    AND (
      provider_id > 0
      OR construction_provider_id > 0
      OR foreman_id > 0
      OR business_status <> 'draft'
    )

  UNION ALL

  SELECT
    'P005', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '一个项目绑定了多条业务流' AS detail
  FROM snapshot
  WHERE flow_total > 1

  UNION ALL

  SELECT
    'P006', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目已完工，但业务状态不是 completed' AS detail
  FROM snapshot
  WHERE status = 1
    AND business_status <> 'completed'

  UNION ALL

  SELECT
    'P007', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目已完工，但业务流阶段不是 completed/archived' AS detail
  FROM snapshot
  WHERE status = 1
    AND COALESCE(flow_stage_one, '') NOT IN ('completed', 'archived')

  UNION ALL

  SELECT
    'P008', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目施工中，但没有进行中阶段/节点' AS detail
  FROM snapshot
  WHERE business_status = 'in_progress'
    AND phase_in_progress_count = 0
    AND milestone_in_progress_count = 0
    AND milestone_submitted_count = 0
    AND COALESCE(current_phase, '') NOT IN ('待提交完工材料', '等待支付下一期施工款')

  UNION ALL

  SELECT
    'P009', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'current_phase 显示待验收，但没有 submitted 节点' AS detail
  FROM snapshot
  WHERE current_phase LIKE '%待验收%'
    AND milestone_submitted_count = 0
    AND current_phase <> '已完工待验收'

  UNION ALL

  SELECT
    'P010', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'current_phase 显示施工中，但没有进行中阶段' AS detail
  FROM snapshot
  WHERE current_phase LIKE '%施工中%'
    AND phase_in_progress_count = 0
    AND milestone_in_progress_count = 0

  UNION ALL

  SELECT
    'P011', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'current_phase=已完工待验收，但 completion_submitted_at 为空' AS detail
  FROM snapshot
  WHERE current_phase = '已完工待验收'
    AND completion_submitted_at IS NULL

  UNION ALL

  SELECT
    'P012', 'medium', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'current_phase=已归档，但 inspiration_case_draft_id 为空' AS detail
  FROM snapshot
  WHERE current_phase = '已归档'
    AND COALESCE(inspiration_case_draft_id, 0) = 0

  UNION ALL

  SELECT
    'P013', 'medium', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'provider_id 无效或服务商展示名会退化' AS detail
  FROM snapshot
  WHERE provider_id = 0
     OR provider_type IS NULL
     OR provider_display_seed IS NULL

  UNION ALL

  SELECT
    'P014', 'medium', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '托管账户金额口径异常' AS detail
  FROM snapshot
  WHERE escrow_total > 0
    AND (
      escrow_released_amount > escrow_total_amount
      OR escrow_frozen_amount + escrow_available_amount + escrow_released_amount > escrow_total_amount + 0.01
    )

  UNION ALL

  SELECT
    'P015', 'fatal', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '已完工项目缺阶段/节点/托管，属于结构断裂项目' AS detail
  FROM snapshot
  WHERE status = 1
    AND (phase_total = 0 OR milestone_total = 0 OR escrow_total = 0)
)
`

type findingRecord struct {
	RuleCode               string     `json:"ruleCode" gorm:"column:rule_code"`
	Severity               string     `json:"severity"`
	ProjectID              uint64     `json:"projectId" gorm:"column:project_id"`
	ProjectName            string     `json:"projectName" gorm:"column:name"`
	Status                 int8       `json:"status"`
	BusinessStatus         string     `json:"businessStatus" gorm:"column:business_status"`
	CurrentPhase           string     `json:"currentPhase" gorm:"column:current_phase"`
	FlowStage              string     `json:"flowStage" gorm:"column:flow_stage"`
	FlowStages             string     `json:"flowStages" gorm:"column:flow_stages"`
	PhaseTotal             int64      `json:"phaseTotal" gorm:"column:phase_total"`
	MilestoneTotal         int64      `json:"milestoneTotal" gorm:"column:milestone_total"`
	EscrowTotal            int64      `json:"escrowTotal" gorm:"column:escrow_total"`
	ProviderID             uint64     `json:"providerId" gorm:"column:provider_id"`
	ConstructionProviderID uint64     `json:"constructionProviderId" gorm:"column:construction_provider_id"`
	ForemanID              uint64     `json:"foremanId" gorm:"column:foreman_id"`
	CompletionSubmittedAt  *time.Time `json:"completionSubmittedAt" gorm:"column:completion_submitted_at"`
	InspirationCaseDraftID *uint64    `json:"inspirationCaseDraftId" gorm:"column:inspiration_case_draft_id"`
	Detail                 string     `json:"detail"`
}

type summaryRecord struct {
	TotalFindings       int64 `json:"totalFindings" gorm:"column:total_findings"`
	DistinctBadProjects int64 `json:"distinctBadProjects" gorm:"column:distinct_bad_projects"`
	FatalCount          int64 `json:"fatalCount" gorm:"column:fatal_count"`
	HighCount           int64 `json:"highCount" gorm:"column:high_count"`
	MediumCount         int64 `json:"mediumCount" gorm:"column:medium_count"`
}

type report struct {
	GeneratedAt   time.Time       `json:"generatedAt"`
	ProjectID     uint64          `json:"projectId,omitempty"`
	Severity      string          `json:"severity"`
	Limit         int             `json:"limit"`
	TotalProjects int64           `json:"totalProjects"`
	Summary       summaryRecord   `json:"summary"`
	Findings      []findingOutput `json:"findings"`
}

type findingOutput struct {
	RuleCode       string                 `json:"ruleCode"`
	Severity       string                 `json:"severity"`
	ProjectID      uint64                 `json:"projectId"`
	ProjectName    string                 `json:"projectName"`
	Status         int8                   `json:"status"`
	BusinessStatus string                 `json:"businessStatus"`
	CurrentPhase   string                 `json:"currentPhase"`
	FlowStage      string                 `json:"flowStage"`
	Detail         string                 `json:"detail"`
	Context        map[string]interface{} `json:"context"`
}

func main() {
	log.SetFlags(0)

	projectID := flag.Uint64("project-id", 0, "只检查单个项目")
	severity := flag.String("severity", "all", "过滤严重度: all|fatal|high|medium")
	limit := flag.Int("limit", 200, "最大输出条数")
	format := flag.String("format", "table", "输出格式: table|json")
	outPath := flag.String("out", "", "输出文件路径")
	failOnFatal := flag.Bool("fail-on-fatal", false, "命中 fatal 时返回非零退出码")
	flag.Parse()

	if err := validateFlags(*severity, *format, *limit); err != nil {
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

	findings, err := loadFindings(*projectID, *severity, *limit)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Failed to load findings: %v\n", err)
		os.Exit(1)
	}
	summary, err := loadSummary(*projectID, *severity)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Failed to load summary: %v\n", err)
		os.Exit(1)
	}
	totalProjects, err := countProjects(*projectID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Failed to count projects: %v\n", err)
		os.Exit(1)
	}

	output := report{
		GeneratedAt:   time.Now(),
		ProjectID:     *projectID,
		Severity:      *severity,
		Limit:         *limit,
		TotalProjects: totalProjects,
		Summary:       summary,
		Findings:      toFindingOutputs(findings),
	}

	rendered, err := renderReport(output, *format)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Failed to render report: %v\n", err)
		os.Exit(1)
	}

	if *outPath != "" {
		if err := os.WriteFile(*outPath, []byte(rendered), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: Failed to write output: %v\n", err)
			os.Exit(1)
		}
	}
	fmt.Print(rendered)

	if *failOnFatal && summary.FatalCount > 0 {
		os.Exit(2)
	}
}

func validateFlags(severity, format string, limit int) error {
	switch severity {
	case "all", "fatal", "high", "medium":
	default:
		return fmt.Errorf("invalid severity %q", severity)
	}

	switch format {
	case "table", "json":
	default:
		return fmt.Errorf("invalid format %q", format)
	}

	if limit <= 0 {
		return fmt.Errorf("limit must be greater than 0")
	}

	return nil
}

func loadFindings(projectID uint64, severity string, limit int) ([]findingRecord, error) {
	query, args := buildFindingsQuery(projectID, severity, limit)
	var findings []findingRecord
	if err := repository.DB.Raw(query, args...).Scan(&findings).Error; err != nil {
		return nil, err
	}
	return findings, nil
}

func loadSummary(projectID uint64, severity string) (summaryRecord, error) {
	query, args := buildSummaryQuery(projectID, severity)
	var summary summaryRecord
	if err := repository.DB.Raw(query, args...).Scan(&summary).Error; err != nil {
		return summary, err
	}
	return summary, nil
}

func countProjects(projectID uint64) (int64, error) {
	query := "SELECT COUNT(*) FROM projects"
	args := []interface{}{}
	if projectID > 0 {
		query += " WHERE id = ?"
		args = append(args, projectID)
	}

	var total int64
	if err := repository.DB.Raw(query, args...).Scan(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

func buildFindingsQuery(projectID uint64, severity string, limit int) (string, []interface{}) {
	clauses, args := buildFilters(projectID, severity)
	query := baseFindingsCTE + `
SELECT
  rule_code,
  severity,
  project_id,
  name,
  status,
  business_status,
  current_phase,
  flow_stage,
  flow_stages,
  phase_total,
  milestone_total,
  escrow_total,
  provider_id,
  construction_provider_id,
  foreman_id,
  completion_submitted_at,
  inspiration_case_draft_id,
  detail
FROM findings`
	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	query += `
ORDER BY
  CASE severity
    WHEN 'fatal' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  project_id,
  rule_code
LIMIT ?`
	args = append(args, limit)
	return query, args
}

func buildSummaryQuery(projectID uint64, severity string) (string, []interface{}) {
	clauses, args := buildFilters(projectID, severity)
	query := baseFindingsCTE + `
SELECT
  COUNT(*) AS total_findings,
  COUNT(DISTINCT project_id) AS distinct_bad_projects,
  COUNT(*) FILTER (WHERE severity = 'fatal') AS fatal_count,
  COUNT(*) FILTER (WHERE severity = 'high') AS high_count,
  COUNT(*) FILTER (WHERE severity = 'medium') AS medium_count
FROM findings`
	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	return query, args
}

func buildFilters(projectID uint64, severity string) ([]string, []interface{}) {
	var clauses []string
	var args []interface{}
	if projectID > 0 {
		clauses = append(clauses, "project_id = ?")
		args = append(args, projectID)
	}
	if severity != "" && severity != "all" {
		clauses = append(clauses, "severity = ?")
		args = append(args, severity)
	}
	return clauses, args
}

func toFindingOutputs(findings []findingRecord) []findingOutput {
	outputs := make([]findingOutput, 0, len(findings))
	for _, item := range findings {
		context := map[string]interface{}{
			"status":                 item.Status,
			"businessStatus":         item.BusinessStatus,
			"currentPhase":           item.CurrentPhase,
			"flowStage":              item.FlowStage,
			"flowStages":             item.FlowStages,
			"phaseTotal":             item.PhaseTotal,
			"milestoneTotal":         item.MilestoneTotal,
			"escrowTotal":            item.EscrowTotal,
			"providerId":             item.ProviderID,
			"constructionProviderId": item.ConstructionProviderID,
			"foremanId":              item.ForemanID,
		}
		if item.CompletionSubmittedAt != nil {
			context["completionSubmittedAt"] = item.CompletionSubmittedAt.Format(time.RFC3339)
		}
		if item.InspirationCaseDraftID != nil {
			context["inspirationCaseDraftId"] = *item.InspirationCaseDraftID
		}
		outputs = append(outputs, findingOutput{
			RuleCode:       item.RuleCode,
			Severity:       item.Severity,
			ProjectID:      item.ProjectID,
			ProjectName:    item.ProjectName,
			Status:         item.Status,
			BusinessStatus: item.BusinessStatus,
			CurrentPhase:   item.CurrentPhase,
			FlowStage:      item.FlowStage,
			Detail:         item.Detail,
			Context:        context,
		})
	}
	return outputs
}

func renderReport(output report, format string) (string, error) {
	if format == "json" {
		payload, err := json.MarshalIndent(output, "", "  ")
		if err != nil {
			return "", err
		}
		return string(payload) + "\n", nil
	}

	var b strings.Builder
	b.WriteString("Project Consistency Audit\n")
	b.WriteString("============================================================\n")
	b.WriteString(fmt.Sprintf("generated_at: %s\n", output.GeneratedAt.Format(time.RFC3339)))
	if output.ProjectID > 0 {
		b.WriteString(fmt.Sprintf("project_id: %d\n", output.ProjectID))
	}
	b.WriteString(fmt.Sprintf("severity: %s\n", output.Severity))
	b.WriteString(fmt.Sprintf("limit: %d\n", output.Limit))
	b.WriteString(fmt.Sprintf("total_projects_scanned: %d\n", output.TotalProjects))
	b.WriteString(fmt.Sprintf("bad_projects: %d\n", output.Summary.DistinctBadProjects))
	b.WriteString(fmt.Sprintf("total_findings: %d\n", output.Summary.TotalFindings))
	b.WriteString(fmt.Sprintf("fatal: %d\n", output.Summary.FatalCount))
	b.WriteString(fmt.Sprintf("high: %d\n", output.Summary.HighCount))
	b.WriteString(fmt.Sprintf("medium: %d\n", output.Summary.MediumCount))
	b.WriteString("\n")

	tw := tabwriter.NewWriter(&b, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "SEVERITY\tRULE\tPROJECT\tNAME\tDETAIL")
	for _, item := range output.Findings {
		fmt.Fprintf(tw, "%s\t%s\t%d\t%s\t%s\n",
			strings.ToUpper(item.Severity),
			item.RuleCode,
			item.ProjectID,
			trimForTable(item.ProjectName, 18),
			item.Detail,
		)
	}
	_ = tw.Flush()

	if len(output.Findings) == 0 {
		b.WriteString("No findings.\n")
	}

	return b.String(), nil
}

func trimForTable(value string, max int) string {
	value = strings.TrimSpace(value)
	if max <= 0 || len([]rune(value)) <= max {
		return value
	}
	runes := []rune(value)
	return string(runes[:max-1]) + "…"
}
