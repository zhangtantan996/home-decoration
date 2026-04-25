BEGIN;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS booking_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) NOT NULL DEFAULT 'design',
  ADD COLUMN IF NOT EXISTS deposit_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_content TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_signed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS provider_signed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS esign_flow_id VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS esign_provider VARCHAR(20) NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS contract_file_url VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deposit_payment_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_sign_token VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_sign_token VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_token_used_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS provider_token_used_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_booking_id ON contracts(booking_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_type ON contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_deposit_payment_id ON contracts(deposit_payment_id);
CREATE INDEX IF NOT EXISTS idx_contracts_user_sign_token ON contracts(user_sign_token);
CREATE INDEX IF NOT EXISTS idx_contracts_provider_sign_token ON contracts(provider_sign_token);
CREATE INDEX IF NOT EXISTS idx_contracts_esign_flow_id ON contracts(esign_flow_id);

COMMIT;
