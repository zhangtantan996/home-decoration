# Quote ERP Mission Notes

Quote ERP specific notes for workers on this mission.

**What belongs here:** quote-task semantics, bridge-vs-close distinctions, payload truths, mission-specific terminology.  
**What does NOT belong here:** generic repo setup or duplicated product prose from `mission.md`.

---

## Bridge vs Close

### Bridge

Bridge covers:
- 预算/风格/沟通结果确认
- 工程量基础表 / 源清单
- 报价任务来源、版本、分配与 submit-to-user 之前的状态

Bridge does **not** create:
- `Project`
- construction `Order`
- construction `PaymentPlan`

### Close

Close starts when the user confirms the selected construction quote.

Close must establish:
- one selected quote truth
- one construction order
- non-empty payment plans
- one project bound to the confirmed quote
- `ready_to_start` result state

## Known Legacy Drift to Watch

- Legacy billing/order code paths may still exist; do not let them remain a parallel truth after quote confirmation.
- Some current UIs still rely on older budget/bill semantics; update them to consume the confirmed quote transaction truth.

## Guardrails

- Quote deviation must not pass silently.
- Reject paths must return to reselect/cancel semantics, not leave implicit ready-to-start residue.
- Locked quote truths must not be editable through hidden or legacy save paths.
