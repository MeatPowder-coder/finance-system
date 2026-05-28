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
const copilotModeSchema = z.enum(["ACCOUNTANT", "ANALYST"]);

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
  limit: z.coerce.number().int().min(1).max(500).default(100),
  accountId: z.coerce.number().int().positive().optional(),
  direction: directionSchema.optional(),
  status: statusSchema.optional(),
});

const createInvestmentSchema = z.object({
  symbol: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(160),
  assetType: z.enum(["STOCK", "ETF", "CRYPTO", "BOND", "FUND", "OTHER"]).default("OTHER"),
  quantity: z.coerce.number().nonnegative(),
  avgCost: z.coerce.number().nonnegative(),
  currency: z.string().trim().min(3).max(10).default("USD"),
  accountId: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().max(1500).optional(),
  isActive: z.boolean().default(true),
});

const updateInvestmentSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  assetType: z.enum(["STOCK", "ETF", "CRYPTO", "BOND", "FUND", "OTHER"]).optional(),
  quantity: z.coerce.number().nonnegative().optional(),
  avgCost: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  accountId: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(1500).optional(),
  isActive: z.boolean().optional(),
});

const createCopilotSessionSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  mode: copilotModeSchema.default("ACCOUNTANT"),
});

const chatMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});

function guessTitleFromMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "Copilot";
  return normalized.length > 64 ? `${normalized.slice(0, 61)}...` : normalized;
}

function formatMoney(value: number, currency = "COP") {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

async function buildCopilotContext() {
  const [summaryRes, accountsRes, txRes] = await Promise.all([
    query<{ total_balance: string; inflow: string; outflow: string }>(
      `SELECT
         COALESCE((SELECT SUM(balance_current) FROM accounts WHERE is_active = TRUE), 0)::text AS total_balance,
         COALESCE((SELECT SUM(amount) FROM transactions WHERE direction = 'INFLOW' AND transaction_date >= date_trunc('month', CURRENT_DATE)::date), 0)::text AS inflow,
         COALESCE((SELECT SUM(amount) FROM transactions WHERE direction = 'OUTFLOW' AND transaction_date >= date_trunc('month', CURRENT_DATE)::date), 0)::text AS outflow`
    ),
    query<{
      id: number;
      name: string;
      currency: string;
      balance_current: string;
      account_type: string;
    }>(
      `SELECT id, name, currency, balance_current::text, account_type
         FROM accounts
        WHERE is_active = TRUE
        ORDER BY balance_current DESC
        LIMIT 8`
    ),
    query<{
      transaction_date: string;
      description: string | null;
      amount: string;
      currency: string;
      direction: "INFLOW" | "OUTFLOW";
      account_name: string;
    }>(
      `SELECT t.transaction_date::text,
              t.description,
              t.amount::text,
              t.currency,
              t.direction,
              a.name AS account_name
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
        ORDER BY t.transaction_date DESC, t.id DESC
        LIMIT 12`
    ),
  ]);

  return {
    totalBalance: Number(summaryRes.rows[0]?.total_balance || 0),
    monthInflow: Number(summaryRes.rows[0]?.inflow || 0),
    monthOutflow: Number(summaryRes.rows[0]?.outflow || 0),
    accounts: accountsRes.rows,
    recentTransactions: txRes.rows,
  };
}

function buildRuleBasedReply(userMessage: string, context: Awaited<ReturnType<typeof buildCopilotContext>>) {
  const lower = userMessage.toLowerCase();
  const lines: string[] = [];

  if (lower.includes("saldo") || lower.includes("balance") || lower.includes("patrimonio")) {
    lines.push(`Saldo consolidado actual: ${formatMoney(context.totalBalance, "COP")}.`);
  }

  if (lower.includes("ingreso") || lower.includes("inflow")) {
    lines.push(`Ingresos del mes: ${formatMoney(context.monthInflow, "COP")}.`);
  }

  if (lower.includes("gasto") || lower.includes("egreso") || lower.includes("outflow")) {
    lines.push(`Egresos del mes: ${formatMoney(context.monthOutflow, "COP")}.`);
  }

  if (lower.includes("cuenta") || lower.includes("accounts")) {
    if (context.accounts.length === 0) {
      lines.push("No hay cuentas activas registradas todavía.");
    } else {
      lines.push("Top cuentas por saldo:");
      for (const account of context.accounts.slice(0, 5)) {
        lines.push(`- ${account.name} (${account.account_type}): ${formatMoney(Number(account.balance_current || 0), account.currency || "COP")}`);
      }
    }
  }

  if (lower.includes("transacci") || lower.includes("movim") || lower.includes("reciente")) {
    if (context.recentTransactions.length === 0) {
      lines.push("No hay transacciones recientes.");
    } else {
      lines.push("Movimientos recientes:");
      for (const tx of context.recentTransactions.slice(0, 6)) {
        const sign = tx.direction === "INFLOW" ? "+" : "-";
        lines.push(
          `- ${tx.transaction_date}: ${tx.description || "Sin descripcion"} (${tx.account_name}) ${sign}${formatMoney(Number(tx.amount || 0), tx.currency || "COP")}`
        );
      }
    }
  }

  if (lines.length === 0) {
    lines.push("Puedo ayudarte con saldos, flujo mensual, cuentas, transacciones y organización financiera.");
    lines.push(`Ahora mismo tu saldo consolidado es ${formatMoney(context.totalBalance, "COP")}.`);
    lines.push("Si quieres, pídeme algo concreto como: 'muéstrame gastos del mes' o 'resumen de cuentas'.");
  }

  return lines.join("\n");
}

async function buildOpenAIReply(userMessage: string, context: Awaited<ReturnType<typeof buildCopilotContext>>) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;

  const model = (process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();

  const system = [
    "Eres un copiloto financiero en español.",
    "Responde de forma concreta, técnica y accionable.",
    "No inventes datos: usa exclusivamente el contexto provisto.",
    "Si faltan datos, dilo explícitamente.",
  ].join(" ");

  const contextText = [
    `Saldo total: ${context.totalBalance}`,
    `Ingresos mes: ${context.monthInflow}`,
    `Egresos mes: ${context.monthOutflow}`,
    `Cuentas: ${context.accounts.map((a) => `${a.name}:${a.balance_current}${a.currency}`).join(" | ") || "ninguna"}`,
    `Transacciones recientes: ${context.recentTransactions.map((t) => `${t.transaction_date} ${t.description || "Sin descripcion"} ${t.direction} ${t.amount}${t.currency}`).join(" | ") || "ninguna"}`,
  ].join("\n");

  const payload = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: system }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: `Contexto:\n${contextText}\n\nPregunta:\n${userMessage}` }],
      },
    ],
    temperature: 0.2,
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data: any = await res.json();

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim() || null;
}

app.get("/health", async () => ({
  ok: true,
  service: "finance-system-api",
  at: new Date().toISOString(),
}));

app.get("/ready", async (_req, reply) => {
  try {
    await query("SELECT 1");
    return { ok: true, db: true };
  } catch (error: any) {
    return reply.code(503).send({ ok: false, db: false, error: error?.message || "db not ready" });
  }
});

app.get("/v1/meta", async () => {
  const [accounts, txs, investments, sessions] = await Promise.all([
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM accounts"),
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM transactions"),
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM investments"),
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM copilot_sessions"),
  ]);

  return {
    data: {
      accounts: Number(accounts.rows[0]?.c || 0),
      transactions: Number(txs.rows[0]?.c || 0),
      investments: Number(investments.rows[0]?.c || 0),
      copilotSessions: Number(sessions.rows[0]?.c || 0),
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
    `SELECT t.id,
            t.transaction_date,
            t.description,
            t.amount,
            t.currency,
            t.direction,
            t.status,
            t.account_id,
            t.category_id,
            t.external_ref,
            t.created_at,
            t.updated_at,
            a.name AS account_name,
            a.account_type AS account_type
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
       RETURNING id,
                 transaction_date,
                 description,
                 amount,
                 currency,
                 direction,
                 status,
                 account_id,
                 category_id,
                 external_ref,
                 created_at,
                 updated_at`,
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

app.get("/v1/investments", async () => {
  const result = await query(
    `SELECT i.id,
            i.symbol,
            i.name,
            i.asset_type,
            i.quantity,
            i.avg_cost,
            i.currency,
            i.account_id,
            a.name AS account_name,
            i.notes,
            i.is_active,
            i.created_at,
            i.updated_at,
            (i.quantity * i.avg_cost) AS invested_amount
       FROM investments i
  LEFT JOIN accounts a ON a.id = i.account_id
      ORDER BY i.updated_at DESC, i.id DESC`
  );

  return { data: result.rows };
});

app.post("/v1/investments", async (req, reply) => {
  const parsed = createInvestmentSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;

  const result = await query(
    `INSERT INTO investments (
       symbol,
       name,
       asset_type,
       quantity,
       avg_cost,
       currency,
       account_id,
       notes,
       is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id,
               symbol,
               name,
               asset_type,
               quantity,
               avg_cost,
               currency,
               account_id,
               notes,
               is_active,
               created_at,
               updated_at`,
    [
      payload.symbol.toUpperCase(),
      payload.name,
      payload.assetType,
      payload.quantity,
      payload.avgCost,
      payload.currency.toUpperCase(),
      payload.accountId || null,
      payload.notes || null,
      payload.isActive,
    ]
  );

  return reply.code(201).send({ data: result.rows[0] });
});

app.patch("/v1/investments/:id", async (req, reply) => {
  const id = Number((req.params as any)?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return reply.code(400).send({ error: "Invalid investment id" });
  }

  const parsed = updateInvestmentSchema.safeParse((req as any).body || {});
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
  if (payload.assetType !== undefined) {
    fields.push(`asset_type = $${values.length + 1}`);
    values.push(payload.assetType);
  }
  if (payload.quantity !== undefined) {
    fields.push(`quantity = $${values.length + 1}`);
    values.push(payload.quantity);
  }
  if (payload.avgCost !== undefined) {
    fields.push(`avg_cost = $${values.length + 1}`);
    values.push(payload.avgCost);
  }
  if (payload.currency !== undefined) {
    fields.push(`currency = $${values.length + 1}`);
    values.push(payload.currency.toUpperCase());
  }
  if (payload.accountId !== undefined) {
    fields.push(`account_id = $${values.length + 1}`);
    values.push(payload.accountId);
  }
  if (payload.notes !== undefined) {
    fields.push(`notes = $${values.length + 1}`);
    values.push(payload.notes || null);
  }
  if (payload.isActive !== undefined) {
    fields.push(`is_active = $${values.length + 1}`);
    values.push(payload.isActive);
  }

  fields.push("updated_at = NOW()");
  values.push(id);

  const result = await query(
    `UPDATE investments
        SET ${fields.join(", ")}
      WHERE id = $${values.length}
      RETURNING id,
                symbol,
                name,
                asset_type,
                quantity,
                avg_cost,
                currency,
                account_id,
                notes,
                is_active,
                created_at,
                updated_at`,
    values
  );

  if (!result.rows[0]) {
    return reply.code(404).send({ error: "Investment not found" });
  }

  return { data: result.rows[0] };
});

app.get("/v1/investments/summary", async () => {
  const result = await query<{
    positions: string;
    invested_total: string;
    active_positions: string;
  }>(
    `SELECT
       COUNT(*)::text AS positions,
       COALESCE(SUM(quantity * avg_cost), 0)::text AS invested_total,
       COALESCE(SUM(CASE WHEN is_active THEN 1 ELSE 0 END), 0)::text AS active_positions
     FROM investments`
  );

  return {
    data: {
      positions: Number(result.rows[0]?.positions || 0),
      activePositions: Number(result.rows[0]?.active_positions || 0),
      investedTotal: Number(result.rows[0]?.invested_total || 0),
    },
  };
});

app.get("/v1/copilot/sessions", async () => {
  const result = await query(
    `SELECT s.id,
            s.title,
            s.mode,
            s.created_at,
            s.updated_at,
            COUNT(m.id)::int AS message_count
       FROM copilot_sessions s
  LEFT JOIN copilot_messages m ON m.session_id = s.id
      GROUP BY s.id
      ORDER BY s.updated_at DESC`
  );

  return { data: result.rows };
});

app.post("/v1/copilot/sessions", async (req, reply) => {
  const parsed = createCopilotSessionSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;

  const title = payload.title || "Nueva sesión";

  const result = await query(
    `INSERT INTO copilot_sessions (title, mode)
     VALUES ($1, $2)
     RETURNING id, title, mode, created_at, updated_at`,
    [title, payload.mode]
  );

  return reply.code(201).send({ data: result.rows[0] });
});

app.get("/v1/copilot/sessions/:id/messages", async (req, reply) => {
  const sessionId = String((req.params as any)?.id || "");

  const exists = await query(`SELECT id FROM copilot_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
  if (!exists.rowCount) {
    return reply.code(404).send({ error: "Session not found" });
  }

  const result = await query(
    `SELECT id, role, content, created_at
       FROM copilot_messages
      WHERE session_id = $1
      ORDER BY created_at ASC, id ASC`,
    [sessionId]
  );

  return { data: result.rows };
});

app.post("/v1/copilot/chat", async (req, reply) => {
  const parsed = chatMessageSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { sessionId, message } = parsed.data;

  const sessionRes = await query<{ id: string; title: string; mode: "ACCOUNTANT" | "ANALYST" }>(
    `SELECT id, title, mode
       FROM copilot_sessions
      WHERE id = $1
      LIMIT 1`,
    [sessionId]
  );

  if (!sessionRes.rowCount) {
    return reply.code(404).send({ error: "Session not found" });
  }

  const session = sessionRes.rows[0];

  await query(
    `INSERT INTO copilot_messages (session_id, role, content)
     VALUES ($1, 'user', $2)`,
    [sessionId, message]
  );

  const context = await buildCopilotContext();

  let assistantReply: string | null = null;
  try {
    assistantReply = await buildOpenAIReply(message, context);
  } catch (error: any) {
    app.log.warn({ error: error?.message || error }, "openai reply failed, falling back to rules");
  }

  if (!assistantReply) {
    assistantReply = buildRuleBasedReply(message, context);
  }

  const assistantInsert = await query(
    `INSERT INTO copilot_messages (session_id, role, content)
     VALUES ($1, 'assistant', $2)
     RETURNING id, role, content, created_at`,
    [sessionId, assistantReply]
  );

  const currentTitle = (session.title || "").trim();
  if (currentTitle === "Nueva sesión") {
    await query(`UPDATE copilot_sessions SET title = $1, updated_at = NOW() WHERE id = $2`, [guessTitleFromMessage(message), sessionId]);
  } else {
    await query(`UPDATE copilot_sessions SET updated_at = NOW() WHERE id = $1`, [sessionId]);
  }

  return reply.code(201).send({
    data: {
      sessionId,
      mode: session.mode,
      assistantMessage: assistantInsert.rows[0],
      context: {
        totalBalance: context.totalBalance,
        monthInflow: context.monthInflow,
        monthOutflow: context.monthOutflow,
      },
    },
  });
});

app.get("/v1/summary", async () => {
  const [balances, flow, portfolio] = await Promise.all([
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
    query<{ invested_total: string; positions: string }>(
      `SELECT
         COALESCE(SUM(quantity * avg_cost), 0)::text AS invested_total,
         COUNT(*)::text AS positions
       FROM investments
       WHERE is_active = TRUE`
    ),
  ]);

  return {
    data: {
      totalBalance: Number(balances.rows[0]?.total_balance || 0),
      monthInflow: Number(flow.rows[0]?.inflow || 0),
      monthOutflow: Number(flow.rows[0]?.outflow || 0),
      investedTotal: Number(portfolio.rows[0]?.invested_total || 0),
      activePositions: Number(portfolio.rows[0]?.positions || 0),
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
