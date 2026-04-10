---
name: backend-worker
description: Implement Go backend domain, workflow, order/payment, and validation-support changes for the quote ERP mission.
---

# Backend Worker

NOTE: Startup, baseline checks, and cleanup are handled by `worker-base`. This skill defines the work procedure for backend-heavy features.

## When to Use This Skill

Use this skill for features that primarily modify:

- `server/internal/model/**`
- `server/internal/service/**`
- `server/internal/handler/**`
- `server/internal/router/**`
- backend-focused tests, fixtures, and validation helpers tightly coupled to backend behavior

Typical feature shapes:

- 源清单/工程量基础表模型与服务
- BusinessFlow / Project / Order / PaymentPlan 真相收口
- 确认/拒绝施工报价的事务、幂等、权限与阶段流转
- 里程碑释放/冻结、争议/退款/人工放款的后端控制

## Work Procedure

1. Read `mission.md`, mission `AGENTS.md`, `.factory/services.yaml`, and relevant `.factory/library/*.md` before editing.
2. Confirm the feature's target assertions in `features.json` and `validation-contract.md`. Keep the `fulfills` list visible while working.
3. Characterize current behavior first:
   - Find the existing service/handler/repository path.
   - Identify current tests covering the path.
   - Run the smallest existing test or API check that demonstrates current behavior.
4. Write or update failing backend tests first when there is an established test pattern:
   - Prefer focused `go test -run ...` coverage for the touched service/package.
   - If the repo lacks a direct test seam, add a focused test near the affected service or workflow helper.
5. Implement the backend change with strict layering:
   - Keep request parsing/response shaping in handlers.
   - Keep workflow/business truth in services.
   - Keep DB access in repositories/models.
6. If the feature affects workflow truth, verify all linked entities:
   - `BusinessFlow`
   - `QuoteList` / `QuoteSubmission`
   - `Project`
   - `Order`
   - `PaymentPlan`
   Ensure no dual source of truth remains.
7. Run focused verification after implementation:
   - Targeted `go test`
   - Relevant API smoke or curl
   - Any directly related repo verification script if the touched area requires it
8. If the feature changes user-visible truth, note the exact API fields / stage values that UI workers must rely on.
9. Do not edit unrelated user changes. If the feature cannot be completed without changing out-of-scope flows, return to orchestrator.

## Example Handoff

```json
{
  "salientSummary": "Implemented quote confirmation as a single backend transaction that creates a construction order, binds payment plans, and keeps BusinessFlow/Project/QuoteList aligned on one selected submission.",
  "whatWasImplemented": "Added quantity-base linkage and confirmation transaction updates across quote_workflow_service, project_service, order creation helpers, and related handlers/tests. Confirmation now creates one construction order with non-empty payment plans, repeated confirms no-op without creating duplicate entities, and reject returns the flow to the reselect/cancel path instead of leaving residual ready_to_start data.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "cd server && go test ./internal/service -run 'TestQuoteWorkflowConfirm|TestQuoteWorkflowReject'",
        "exitCode": 0,
        "observation": "Focused workflow tests passed after adding order/payment plan assertions."
      },
      {
        "command": "npm run verify:backend",
        "exitCode": 0,
        "observation": "Backend verification suite passed with go vet and go test."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Called the confirm quote API twice for the same pending submission using the focused smoke path.",
        "observed": "First call created one project/order/payment plan set and moved the flow to ready_to_start; second call returned the same settled truth with no duplicate entities."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "server/internal/service/quote_workflow_service_test.go",
        "cases": [
          {
            "name": "confirm quote creates one construction order and payment plans",
            "verifies": "The confirmed submission becomes the only selected truth and downstream entities are created once."
          },
          {
            "name": "reject quote returns flow to reselect path",
            "verifies": "Rejecting a pending quote does not leave ready_to_start/order/payment plan residue."
          }
        ]
      }
    ]
  },
  "discoveredIssues": [
    {
      "severity": "medium",
      "description": "User Web still assumed old billing truth and needed a follow-up workflow feature to consume the new construction order/payment plan payload."
    }
  ]
}
```

## When to Return to Orchestrator

- The feature requires changing contract-level scope (for example, introducing contract gating or another milestone not covered by current assertions).
- Current code paths expose contradictory workflow truth and you cannot decide which one to preserve from mission docs alone.
- The feature needs coordinated changes across multiple frontend surfaces before the backend change can be validated safely.
- Existing tests or fixtures are too stale to characterize the feature and need a separate validation-foundation feature first.
