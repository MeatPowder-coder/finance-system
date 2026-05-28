-- Fixes for idempotent legacy import scripts

DROP INDEX IF EXISTS idx_transactions_external_ref_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_ref_unique ON transactions(external_ref);

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS legacy_ref VARCHAR(120);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'investments_legacy_ref_key'
  ) THEN
    ALTER TABLE investments
      ADD CONSTRAINT investments_legacy_ref_key UNIQUE (legacy_ref);
  END IF;
END;
$$;
