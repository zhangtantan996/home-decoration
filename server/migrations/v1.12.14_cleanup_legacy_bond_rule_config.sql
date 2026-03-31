BEGIN;

DELETE FROM system_configs
WHERE key = 'payment.merchant_deposit_rules';

COMMIT;
