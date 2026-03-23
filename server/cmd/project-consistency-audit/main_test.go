package main

import (
	"strings"
	"testing"
	"time"
)

func TestValidateFlags(t *testing.T) {
	t.Parallel()

	if err := validateFlags("fatal", "table", 10); err != nil {
		t.Fatalf("expected valid flags, got %v", err)
	}
	if err := validateFlags("oops", "table", 10); err == nil {
		t.Fatalf("expected invalid severity")
	}
	if err := validateFlags("all", "xml", 10); err == nil {
		t.Fatalf("expected invalid format")
	}
	if err := validateFlags("all", "json", 0); err == nil {
		t.Fatalf("expected invalid limit")
	}
}

func TestBuildFindingsQuery(t *testing.T) {
	t.Parallel()

	query, args := buildFindingsQuery(99001, "fatal", 20)
	if !strings.Contains(query, "WHERE project_id = ? AND severity = ?") {
		t.Fatalf("expected project and severity filters, got query: %s", query)
	}
	if !strings.Contains(query, "LIMIT ?") {
		t.Fatalf("expected limit placeholder")
	}
	if len(args) != 3 {
		t.Fatalf("expected 3 args, got %d", len(args))
	}
	if args[0] != uint64(99001) || args[1] != "fatal" || args[2] != 20 {
		t.Fatalf("unexpected args: %#v", args)
	}
}

func TestBuildSummaryQueryWithoutFilters(t *testing.T) {
	t.Parallel()

	query, args := buildSummaryQuery(0, "all")
	if strings.Contains(query, " WHERE ") {
		t.Fatalf("did not expect outer where clause when no filters: %s", query)
	}
	if len(args) != 0 {
		t.Fatalf("expected no args, got %#v", args)
	}
}

func TestToFindingOutputs(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 23, 12, 0, 0, 0, time.UTC)
	draftID := uint64(7)
	outputs := toFindingOutputs([]findingRecord{
		{
			RuleCode:               "P011",
			Severity:               "high",
			ProjectID:              99001,
			ProjectName:            "测试项目",
			Status:                 1,
			BusinessStatus:         "completed",
			CurrentPhase:           "已完工待验收",
			FlowStage:              "completed",
			FlowStages:             "completed",
			PhaseTotal:             0,
			MilestoneTotal:         0,
			EscrowTotal:            0,
			ProviderID:             1,
			ConstructionProviderID: 2,
			ForemanID:              3,
			CompletionSubmittedAt:  &now,
			InspirationCaseDraftID: &draftID,
			Detail:                 "detail",
		},
	})

	if len(outputs) != 1 {
		t.Fatalf("expected 1 output, got %d", len(outputs))
	}
	context := outputs[0].Context
	if context["providerId"] != uint64(1) {
		t.Fatalf("expected providerId in context, got %#v", context)
	}
	if context["completionSubmittedAt"] != now.Format(time.RFC3339) {
		t.Fatalf("expected completionSubmittedAt in context, got %#v", context)
	}
	if context["inspirationCaseDraftId"] != uint64(7) {
		t.Fatalf("expected inspirationCaseDraftId in context, got %#v", context)
	}
}
