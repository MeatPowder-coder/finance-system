import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { query, withTransaction } from "./db.js";

const app = Fastify({ logger: true });

const port = Number(process.env.API_PORT || 4100);
const host = process.env.API_HOST || "0.0.0.0";
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3005")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

await app.register(cors, {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (corsOrigins.includes(origin)) return cb(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
    if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
});

const accountTypeSchema = z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT", "LOAN", "OTHER"]);
const directionSchema = z.enum(["INFLOW", "OUTFLOW"]);
const statusSchema = z.enum(["PENDING", "POSTED", "RECONCILED", "VOID"]);

const createAccountSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  currency: z.string().trim().min(3).max(10).default("COP"),
  accountType: accountTypeSchema,
  balanceCurrent: z.coerce.number().default(0),
});

const updateAccountSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  accountType: accountTypeSchema.optional(),
  balanceCurrent: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
});

const createTransactionSchema = z.object({
  transactionDate: z.string().date(),
  description: z.string().trim().max(500).optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(3).max(10).default("COP"),
  direction: directionSchema,
  status: statusSchema.default("POSTED"),
  accountId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive().optional(),
});

const listTransactionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  accountId: z.coerce.number().int().positive().optional(),
  direction: directionSchema.optional(),
  status: statusSchema.optional(),
});

app.get("/health", async () => ({
  ok: true,
  service: "finance-system-api",
  at: new Date().toISOString(),
}));

app.get("/v1/meta", async () => {
  const [accounts, txs] = await Promise.all([
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM accounts"),
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM transactions"),
  ]);

  return {
    data: {
      accounts: Number(accounts.rows[0]?.c || 0),
      transactions: Number(txs.rows[0]?.c || 0),
    },
  };
});

app.get("/v1/accounts", async () => {
  const result = await query(
    `SELECT id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at
       FROM accounts
      ORDER BY id ASC`
  );

  return { data: result.rows };
});

app.post("/v1/accounts", async (req, reply) => {
  const parsed = createAccountSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;

  const result = await query(
    `INSERT INTO accounts (code, name, currency, account_type, balance_current)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at`,
    [payload.code, payload.name, payload.currency.toUpperCase(), payload.accountType, payload.balanceCurrent]
  );

  return reply.code(201).send({ data: result.rows[0] });
});

app.patch("/v1/accounts/:id", async (req, reply) => {
  const id = Number((req.params as any)?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return reply.code(400).send({ error: "Invalid account id" });
  }

  const parsed = updateAccountSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;
  if (Object.keys(payload).length === 0) {
    return reply.code(400).send({ error: "Empty payload" });
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (payload.name !== undefined) {
    fields.push(`name = $${values.length + 1}`);
    values.push(payload.name);
  }

  if (payload.currency !== undefined) {
    fields.push(`currency = $${values.length + 1}`);
    values.push(payload.currency.toUpperCase());
  }

  if (payload.accountType !== undefined) {
    fields.push(`account_type = $${values.length + 1}`);
    values.push(payload.accountType);
  }

  if (payload.balanceCurrent !== undefined) {
    fields.push(`balance_current = $${values.length + 1}`);
    values.push(payload.balanceCurrent);
  }

  if (payload.isActive !== undefined) {
    fields.push(`is_active = $${values.length + 1}`);
    values.push(payload.isActive);
  }

  fields.push("updated_at = NOW()");
  values.push(id);

  const result = await query(
    `UPDATE accounts
        SET ${fields.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at`,
    values
  );

  if (!result.rows[0]) {
    return reply.code(404).send({ error: "Account not found" });
  }

  return { data: result.rows[0] };
});

app.get("/v1/transactions", async (req) => {
  const parsed = listTransactionQuerySchema.parse((req as any).query || {});

  const where: string[] = [];
  const values: any[] = [];

  if (parsed.accountId) {
    values.push(parsed.accountId);
    where.push(`t.account_id = $${values.length}`);
  }

  if (parsed.direction) {
    values.push(parsed.direction);
    where.push(`t.direction = $${values.length}`);
  }

  if (parsed.status) {
    values.push(parsed.status);
    where.push(`t.status = $${values.length}`);
  }

  values.push(parsed.limit);

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query(
    `SELECT t.id, t.transaction_date, t.description, t.amount, t.currency, t.direction, t.status,
            t.account_id, t.category_id, t.external_ref, t.created_at, t.updated_at,
            a.name AS account_name, a.account_type AS account_type
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       ${whereClause}
      ORDER BY t.transaction_date DESC, t.id DESC
      LIMIT $${values.length}`,
    values
  );

  return { data: result.rows };
});

app.post("/v1/transactions", async (req, reply) => {
  const parsed = createTransactionSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;

  const data = await withTransaction(async (client) => {
    const account = await client.query(
      `SELECT id, code, name, currency, account_type, balance_current, is_active
         FROM accounts
        WHERE id = $1
        LIMIT 1`,
      [payload.accountId]
    );

    if (!account.rows[0]) {
      throw Object.assign(new Error("Account not found"), { code: "ACCOUNT_NOT_FOUND" });
    }

    if (!account.rows[0].is_active) {
      throw Object.assign(new Error("Account is inactive"), { code: "ACCOUNT_INACTIVE" });
    }

    const inserted = await client.query(
      `INSERT INTO transactions (
         transaction_date,
         description,
         amount,
         currency,
         direction,
         status,
         account_id,
         category_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, transaction_date, description, amount, currency, direction, status,
                 account_id, category_id, external_ref, created_at, updated_at`,
      [
        payload.transactionDate,
        payload.description || null,
        payload.amount,
        payload.currency.toUpperCase(),
        payload.direction,
        payload.status,
        payload.accountId,
        payload.categoryId || null,
      ]
    );

    const balanceDelta = payload.direction === "INFLOW" ? payload.amount : -payload.amount;

    const accountUpdated = await client.query(
      `UPDATE accounts
          SET balance_current = balance_current + $1,
              updated_at = NOW()
        WHERE id = $2
      RETURNING id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at`,
      [balanceDelta, payload.accountId]
    );

    return {
      transaction: inserted.rows[0],
      account: accountUpdated.rows[0],
    };
  });

  return reply.code(201).send({ data });
});

app.get("/v1/summary", async () => {
  const [balances, flow] = await Promise.all([
    query<{ total_balance: string }>(
      `SELECT COALESCE(SUM(balance_current), 0)::text AS total_balance
         FROM accounts
        WHERE is_active = TRUE`
    ),
    query<{ inflow: string; outflow: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount ELSE 0 END), 0)::text AS inflow,
         COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END), 0)::text AS outflow
       FROM transactions
       WHERE transaction_date >= date_trunc('month', CURRENT_DATE)::date`
    ),
  ]);

  return {
    data: {
      totalBalance: Number(balances.rows[0]?.total_balance || 0),
      monthInflow: Number(flow.rows[0]?.inflow || 0),
      monthOutflow: Number(flow.rows[0]?.outflow || 0),
    },
  };
});

app.setErrorHandler((error: any, _request, reply) => {
  app.log.error(error);

  if (error?.code === "ACCOUNT_NOT_FOUND") {
    return reply.code(404).send({ error: error.message });
  }

  if (error?.code === "ACCOUNT_INACTIVE") {
    return reply.code(409).send({ error: error.message });
  }

  return reply.code(500).send({ error: error?.message || "Internal server error" });
});

await app.listen({ host, port });
