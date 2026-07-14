-- User-scoped notifications for friendships, sharing and agent activity.

CREATE TABLE IF NOT EXISTS finance_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  notification_type VARCHAR(32) NOT NULL CHECK (notification_type IN (
    'FRIEND_REQUEST',
    'FRIEND_ACCEPTED',
    'SHARE_INVITATION',
    'SHARE_ACCEPTED',
    'AGENT_PROPOSAL',
    'AGENT_TASK',
    'SYSTEM'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_finance_notifications_owner_created
  ON finance_notifications(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_notifications_owner_unread
  ON finance_notifications(owner_user_id, read_at, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_notifications_dedupe
  ON finance_notifications(owner_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
