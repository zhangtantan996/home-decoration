-- Reconcile escrow balance semantics:
-- available_amount = releasable balance
-- frozen_amount = administratively frozen / disputed balance
-- released_amount = already released balance
-- total_amount = available + frozen + released

UPDATE escrow_accounts
SET available_amount = COALESCE(available_amount, 0) + COALESCE(frozen_amount, 0),
    frozen_amount = 0
WHERE status <> 2
  AND COALESCE(frozen_amount, 0) > 0;

UPDATE escrow_accounts
SET total_amount = COALESCE(available_amount, 0) + COALESCE(frozen_amount, 0) + COALESCE(released_amount, 0)
WHERE total_amount <> COALESCE(available_amount, 0) + COALESCE(frozen_amount, 0) + COALESCE(released_amount, 0);
