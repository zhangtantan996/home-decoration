---
name: workflow-worker
description: Implement cross-surface quote workflow features spanning admin, merchant, user-web, validation helpers, and tightly coupled backend/UI contracts.
---

# Workflow Worker

NOTE: Startup, baseline checks, and cleanup are handled by `worker-base`. This skill defines the work procedure for cross-surface workflow features.

## When to Use This Skill

Use this skill for features that span one or more of:

- `admin/**`
- `merchant/**`
- `web/**`
- `mini/**` (only as a secondary surface in this mission)
- focused validation scripts / fixtures / Playwright coverage tied to the quote workflow
- small supporting backend contract updates that are inseparable from the UI flow

Typical feature shapes:

- Admin / Merchant 源清单与桥接任务展示
- submit-to-user、唯一激活报价版本、用户入口曝光控制
- User Web 待开工承接页、账单/支付计划入口
- 监理轻角色、治理面、偏差标记、轻量变更单 UI + contract wiring
- focused smoke / E2E / routing alignment needed for this mission

## Work Procedure

1. Read `mission.md`, mission `AGENTS.md`, `.factory/services.yaml`, and relevant library notes before editing.
2. Read the target feature in `features.json` and the exact assertion IDs it fulfills. Your job is to make those assertions truly testable on the real surface.
3. Trace the full surface path before editing:
   - entry page / menu / route
   - service/API call
   - downstream result page or governance view
4. If the feature depends on backend truth that does not yet exist, stop and return to orchestrator instead of inventing temporary UI truth.
5. Add or update tests before implementation when a nearby pattern exists:
   - focused Playwright for the touched flow
   - component/page test only if the app already uses one nearby
   - route/fixture alignment when validation tooling itself is broken
6. Implement one surface at a time while preserving real navigation:
   - Admin and Merchant should be entered via `/admin/` and `/merchant/`
   - User-facing verification should prefer `User Web` first
   - Mini is supplemental; do not make it the first blocking surface
7. After editing, verify with the smallest meaningful stack:
   - relevant `verify:*` scripts
   - focused Playwright or smoke
   - manual navigation through the real route chain
8. Record any UI/backend payload assumptions explicitly in the handoff so later workers and validators know what was verified.
9. Never silently work around broken validation paths. If you repair a smoke/e2e entrypoint, say exactly what changed and why.

## Example Handoff

```json
{
  "salientSummary": "Updated the Admin→Merchant→User Web quote bridge so source/baseline metadata is visible, submit-to-user locks one active submission, and the user can navigate to the ready_to_start billing surface from the real progress flow.",
  "whatWasImplemented": "Wired source/base metadata through admin and merchant quote task surfaces, blocked user quote-confirm access until submit-to-user, aligned the merchant base path for focused Playwright, and updated User Web ready_to_start/billing pages to render the confirmed construction order and non-empty payment plans from the new backend truth.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "npm run verify:admin",
        "exitCode": 0,
        "observation": "Admin lint/build passed with the new source-task fields."
      },
      {
        "command": "npm run verify:merchant",
        "exitCode": 0,
        "observation": "Merchant build passed after route and task detail updates."
      },
      {
        "command": "WEB_BASE_URL=http://127.0.0.1:5175 npx playwright test tests/e2e/quote-system-v1.smoke.test.ts --workers=2",
        "exitCode": 0,
        "observation": "Focused quote workflow browser validation passed through the real gateway flow."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Opened Admin task detail, submitted one merchant submission to user, then navigated as the user from progress to quote confirmation and on to ready_to_start.",
        "observed": "Only the submitted submission was visible to the user and the ready_to_start page showed the confirmed quote summary plus a payment-plan entry."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/e2e/quote-system-v1.smoke.test.ts",
        "cases": [
          {
            "name": "user cannot see confirm action before submit-to-user",
            "verifies": "Bridge exposure is blocked until Admin submits a formal quote version."
          },
          {
            "name": "ready_to_start page shows construction order billing after confirmation",
            "verifies": "The user-facing result page is bound to the confirmed transaction truth."
          }
        ]
      }
    ]
  },
  "discoveredIssues": [
    {
      "severity": "medium",
      "description": "The governance list still lacked a direct frozen-state filter, so a follow-up guardrail feature was needed to make payment pauses visible."
    }
  ]
}
```

## When to Return to Orchestrator

- The required flow depends on backend truth or permissions that do not yet exist.
- Real navigation cannot be preserved without a broader routing or product-scope decision.
- The feature would require changing more than one frontend surface plus a backend contract in a way that should be split into separate features.
- The only available way to pass validation would be a test-only hack or UI-only fake that contradicts mission docs.
