import { query } from "./db.js";

export const SHARE_RESOURCE_TYPES = [
  "ACCOUNT",
  "TRANSACTION",
  "BUDGET",
  "COMMITMENT",
  "PROJECTION",
  "DEFICIT",
  "REPORT",
] as const;

// New invitations share transactions through their parent account. The
// broader list remains for reading legacy transaction grants during migration.
export const SHARE_INVITATION_RESOURCE_TYPES = [
  "ACCOUNT",
  "BUDGET",
  "COMMITMENT",
  "PROJECTION",
  "DEFICIT",
  "REPORT",
] as const;

export const SHARE_PERMISSIONS = ["READ", "WRITE", "UPLOAD", "ANALYZE"] as const;

export type ShareResourceType = (typeof SHARE_RESOURCE_TYPES)[number];
export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

function cleanIds(rows: Array<{ id: string | number }>) {
  return [...new Set(rows.map((row) => String(row.id)))];
}

async function grantIds(userId: string, resourceType: ShareResourceType, permission: SharePermission) {
  const result = await query<{ resource_id: string }>(
    `SELECT resource_id
       FROM finance_share_grants
      WHERE grantee_user_id = $1
        AND resource_type = $2
        AND status = 'ACTIVE'
        AND $3 = ANY(permissions)`,
    [userId, resourceType, permission]
  );
  return result.rows.map((row) => row.resource_id);
}

export async function getAccessibleAccountIds(userId: string, permission: SharePermission = "READ") {
  const [owned, shared] = await Promise.all([
    query<{ id: number }>(`SELECT id FROM accounts WHERE owner_user_id = $1`, [userId]),
    grantIds(userId, "ACCOUNT", permission),
  ]);
  return cleanIds([...owned.rows, ...shared.map((id) => ({ id }))]);
}

export async function getAccessibleTransactionIds(userId: string, permission: SharePermission = "READ") {
  const [owned, accountIds] = await Promise.all([
    query<{ id: number }>(`SELECT id FROM transactions WHERE owner_user_id = $1`, [userId]),
    getAccessibleAccountIds(userId, permission),
  ]);
  const inherited = accountIds.length
    ? (
        await query<{ id: number }>(`SELECT id FROM transactions WHERE account_id = ANY($1::bigint[])`, [accountIds.map(Number)])
      ).rows
    : [];
  // Transaction access is intentionally inherited from an account grant.
  // Legacy transaction-level grants are no longer sufficient on their own.
  return cleanIds([...owned.rows, ...inherited]);
}

export async function getAccessibleIds(userId: string, resourceType: Exclude<ShareResourceType, "ACCOUNT" | "TRANSACTION">, permission: SharePermission = "READ") {
  const ownedTable: Record<string, string> = {
    BUDGET: "budgets",
    COMMITMENT: "recurring_rules",
    PROJECTION: "projection_scenarios",
    DEFICIT: "budget_deficit_events",
    REPORT: "generated_views",
  };
  const table = ownedTable[resourceType];
  const [owned, shared] = await Promise.all([
    table ? query<{ id: string | number }>(`SELECT id FROM ${table} WHERE owner_user_id = $1`, [userId]) : { rows: [] },
    grantIds(userId, resourceType, permission),
  ]);
  return cleanIds([...(owned.rows || []), ...shared.map((id) => ({ id }))]);
}

export async function canAccessResource(
  userId: string,
  resourceType: ShareResourceType,
  resourceId: string | number,
  permission: SharePermission = "READ"
) {
  const id = String(resourceId);
  if (resourceType === "ACCOUNT") {
    return (await getAccessibleAccountIds(userId, permission)).includes(id);
  }
  if (resourceType === "TRANSACTION") {
    return (await getAccessibleTransactionIds(userId, permission)).includes(id);
  }
  return (await getAccessibleIds(userId, resourceType, permission)).includes(id);
}

export async function isResourceOwner(userId: string, resourceType: ShareResourceType, resourceId: string | number) {
  const tables: Record<ShareResourceType, string> = {
    ACCOUNT: "accounts",
    TRANSACTION: "transactions",
    BUDGET: "budgets",
    COMMITMENT: "recurring_rules",
    PROJECTION: "projection_scenarios",
    DEFICIT: "budget_deficit_events",
    REPORT: "generated_views",
  };
  const result = await query(
    `SELECT 1 FROM ${tables[resourceType]} WHERE id = $1 AND owner_user_id = $2 LIMIT 1`,
    [resourceId, userId]
  );
  return Boolean(result.rowCount);
}

export function normalizeSharePermissions(values: unknown, fallback: SharePermission[] = ["READ"]) {
  const requested = Array.isArray(values) ? values : fallback;
  const permissions = [...new Set(requested.map((value) => String(value).trim().toUpperCase()))].filter(
    (value): value is SharePermission => (SHARE_PERMISSIONS as readonly string[]).includes(value)
  );
  return permissions.length ? permissions : fallback;
}
