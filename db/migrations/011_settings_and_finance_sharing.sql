-- Settings, discoverable usernames, and granular finance sharing.

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL;

UPDATE transactions
   SET created_by_user_id = owner_user_id
 WHERE created_by_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_created_by_user_id ON transactions(created_by_user_id);

DO $$
DECLARE
  user_row RECORD;
  base_username TEXT;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  FOR user_row IN
    SELECT id, email
      FROM auth_users
     WHERE username IS NULL OR BTRIM(username) = ''
     ORDER BY created_at ASC, id ASC
  LOOP
    base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(user_row.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
    base_username := TRIM(BOTH '-' FROM base_username);
    IF base_username = '' THEN
      base_username := 'usuario';
    END IF;

    candidate := LEFT(base_username, 40);
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM auth_users WHERE username = candidate AND id <> user_row.id) LOOP
      candidate := LEFT(base_username, 34) || '-' || suffix::text;
      suffix := suffix + 1;
    END LOOP;

    UPDATE auth_users SET username = candidate WHERE id = user_row.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username_unique ON auth_users (LOWER(username));
ALTER TABLE auth_users ALTER COLUMN username SET NOT NULL;

CREATE TABLE IF NOT EXISTS finance_share_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED', 'EXPIRED')),
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (owner_user_id <> invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_share_invitations_owner ON finance_share_invitations(owner_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_share_invitations_invitee ON finance_share_invitations(invitee_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS finance_share_invitation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES finance_share_invitations(id) ON DELETE CASCADE,
  resource_type VARCHAR(32) NOT NULL CHECK (resource_type IN ('ACCOUNT', 'TRANSACTION', 'BUDGET', 'COMMITMENT', 'PROJECTION', 'DEFICIT', 'REPORT')),
  resource_id TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT ARRAY['READ']::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invitation_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_share_invitation_items_invitation ON finance_share_invitation_items(invitation_id);

CREATE TABLE IF NOT EXISTS finance_share_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  grantee_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  resource_type VARCHAR(32) NOT NULL CHECK (resource_type IN ('ACCOUNT', 'TRANSACTION', 'BUDGET', 'COMMITMENT', 'PROJECTION', 'DEFICIT', 'REPORT')),
  resource_id TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT ARRAY['READ']::text[],
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  source_invitation_id UUID REFERENCES finance_share_invitations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, grantee_user_id, resource_type, resource_id),
  CHECK (owner_user_id <> grantee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_share_grants_grantee ON finance_share_grants(grantee_user_id, status, resource_type);
CREATE INDEX IF NOT EXISTS idx_finance_share_grants_owner ON finance_share_grants(owner_user_id, status, resource_type);

CREATE TABLE IF NOT EXISTS finance_share_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  owner_user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  grantee_user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  invitation_id UUID REFERENCES finance_share_invitations(id) ON DELETE SET NULL,
  grant_id UUID REFERENCES finance_share_grants(id) ON DELETE SET NULL,
  action VARCHAR(32) NOT NULL,
  resource_type VARCHAR(32),
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_share_audit_owner ON finance_share_audit_log(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_share_audit_actor ON finance_share_audit_log(actor_user_id, created_at DESC);
