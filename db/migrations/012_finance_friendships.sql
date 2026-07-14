-- Mutual friendships gate financial sharing without exposing a global user directory.

CREATE TABLE IF NOT EXISTS finance_friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  addressee_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requester_user_id <> addressee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_friend_requests_addressee
  ON finance_friend_requests(addressee_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_friend_requests_requester
  ON finance_friend_requests(requester_user_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_friend_requests_pending_pair
  ON finance_friend_requests(
    LEAST(requester_user_id, addressee_user_id),
    GREATEST(requester_user_id, addressee_user_id)
  )
  WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS finance_friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'REMOVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_friendships_user_a
  ON finance_friendships(user_a_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_friendships_user_b
  ON finance_friendships(user_b_id, status);

ALTER TABLE finance_share_invitations
  ADD COLUMN IF NOT EXISTS friendship_id UUID REFERENCES finance_friendships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_share_invitations_friendship
  ON finance_share_invitations(friendship_id, status);

-- Preserve already accepted sharing relationships as active friendships.
INSERT INTO finance_friendships (user_a_id, user_b_id, status)
SELECT LEAST(owner_user_id, grantee_user_id),
       GREATEST(owner_user_id, grantee_user_id),
       'ACTIVE'
  FROM finance_share_grants
 WHERE status = 'ACTIVE'
   AND owner_user_id <> grantee_user_id
 GROUP BY LEAST(owner_user_id, grantee_user_id), GREATEST(owner_user_id, grantee_user_id)
ON CONFLICT (user_a_id, user_b_id)
DO UPDATE SET status = 'ACTIVE', removed_at = NULL, updated_at = NOW();

UPDATE finance_share_invitations i
   SET friendship_id = f.id
  FROM finance_friendships f
 WHERE i.friendship_id IS NULL
   AND f.status = 'ACTIVE'
   AND f.user_a_id = LEAST(i.owner_user_id, i.invitee_user_id)
   AND f.user_b_id = GREATEST(i.owner_user_id, i.invitee_user_id);

CREATE INDEX IF NOT EXISTS idx_finance_share_audit_friendships
  ON finance_share_audit_log(owner_user_id, grantee_user_id, created_at DESC);
