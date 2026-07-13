import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { getAccessibleAccountIds, getAccessibleIds, getAccessibleTransactionIds } from "../access.js";

type DbExecutor = {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
};

export type DashboardWidgetInput = {
  widgetKey: string;
  widgetType: "metric" | "table" | "line_chart" | "bar_chart" | "pie_chart" | "timeline" | "monthly_cashflow" | "debt_projection" | "investment_return" | "portfolio_performance";
  title: string;
  position: number;
  dataSource: string;
  config?: Record<string, unknown>;
};

export type DashboardTabInput = {
  key: string;
  title: string;
  order?: number;
  description?: string;
  widgetKeys?: string[];
};

function currentYYYYMM() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Invalid month: ${month}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function normalizeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 140) || "finance-view";
}

function toNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function hasPlanningTables() {
  const result = await query<{ ok: boolean }>(`
    SELECT (
      to_regclass('public.budgets') IS NOT NULL
      AND to_regclass('public.budget_lines') IS NOT NULL
      AND to_regclass('public.budget_deficit_events') IS NOT NULL
      AND to_regclass('public.budget_funding_accounts') IS NOT NULL
      AND to_regclass('public.agent_schedules') IS NOT NULL
      AND to_regclass('public.generated_views') IS NOT NULL
      AND to_regclass('public.generated_view_widgets') IS NOT NULL
      AND to_regclass('public.agent_reminders') IS NOT NULL
      AND to_regclass('public.projection_scenarios') IS NOT NULL
    ) AS ok
  `);
  return Boolean(result.rows[0]?.ok);
}

async function ensurePlanningTables() {
  if (!(await hasPlanningTables())) {
    throw new Error("Planning tables are not available in this database.");
  }
}

const DEFAULT_CATEGORY_SEEDS = [
  { code: "SALARIO", name: "Salario", direction: "INFLOW" },
  { code: "OTROS_INGRESOS", name: "Otros ingresos", direction: "INFLOW" },
  { code: "ALIMENTACION", name: "Alimentacion", direction: "OUTFLOW" },
  { code: "TRANSPORTE", name: "Transporte", direction: "OUTFLOW" },
  { code: "VIVIENDA", name: "Vivienda", direction: "OUTFLOW" },
  { code: "SERVICIOS", name: "Servicios", direction: "OUTFLOW" },
  { code: "SALUD", name: "Salud", direction: "OUTFLOW" },
  { code: "EDUCACION", name: "Educacion", direction: "OUTFLOW" },
  { code: "SUSCRIPCIONES", name: "Suscripciones", direction: "OUTFLOW" },
  { code: "ENTRETENIMIENTO", name: "Entretenimiento", direction: "OUTFLOW" },
  { code: "AHORRO", name: "Ahorro", direction: "OUTFLOW" },
  { code: "INVERSION", name: "Inversion", direction: "OUTFLOW" },
  { code: "DEUDAS", name: "Deudas", direction: "OUTFLOW" },
  { code: "IMPUESTOS", name: "Impuestos", direction: "OUTFLOW" },
  { code: "OTROS_GASTOS", name: "Otros gastos", direction: "OUTFLOW" },
];

export async function ensureOwnerCategories(ownerUserId: string) {
  await ensurePlanningTables();
  const existing = await query<{ id: number; code: string; name: string; direction: string; created_at: string }>(
    `SELECT id, code, name, direction, created_at
       FROM categories
      WHERE owner_user_id = $1
      ORDER BY name ASC`,
    [ownerUserId]
  );

  if (existing.rows.length > 0) {
    return existing.rows;
  }

  await withTransaction(async (client) => {
    for (const seed of DEFAULT_CATEGORY_SEEDS) {
      await client.query(
        `INSERT INTO categories (owner_user_id, code, name, direction)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (owner_user_id, code) DO NOTHING`,
        [ownerUserId, seed.code, seed.name, seed.direction]
      );
    }
  });

  const seeded = await query<{ id: number; code: string; name: string; direction: string; created_at: string }>(
    `SELECT id, code, name, direction, created_at
       FROM categories
      WHERE owner_user_id = $1
      ORDER BY name ASC`,
    [ownerUserId]
  );
  return seeded.rows;
}

export async function listSchedulesData(ownerUserId: string, status?: "ACTIVE" | "INACTIVE") {
  await ensurePlanningTables();
  const values: any[] = [];
  const where: string[] = [];
  values.push(ownerUserId);
  where.push(`owner_user_id = $${values.length}`);
  if (status) {
    values.push(status === "ACTIVE");
    where.push(`is_active = $${values.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await query(
    `SELECT id, name, cadence, timezone, is_active, payload, created_at, updated_at
       FROM agent_schedules
       ${whereClause}
      ORDER BY created_at DESC`,
    values
  );
  return result.rows;
}

export async function createScheduleData(ownerUserId: string, input: {
  name: string;
  cadence: string;
  timezone?: string;
  isActive?: boolean;
  payload?: Record<string, unknown>;
}) {
  await ensurePlanningTables();
  const result = await query(
    `INSERT INTO agent_schedules (owner_user_id, name, cadence, timezone, is_active, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, name, cadence, timezone, is_active, payload, created_at, updated_at`,
    [
      ownerUserId,
      input.name,
      input.cadence,
      input.timezone || "America/Bogota",
      input.isActive ?? true,
      JSON.stringify(input.payload || {}),
    ]
  );
  return result.rows[0];
}

export async function updateScheduleData(
  ownerUserId: string,
  scheduleId: string,
  input: {
    name?: string;
    cadence?: string;
    timezone?: string;
    isActive?: boolean;
    payload?: Record<string, unknown>;
  }
) {
  await ensurePlanningTables();
  const result = await query(
    `UPDATE agent_schedules
        SET name = COALESCE($2, name),
            cadence = COALESCE($3, cadence),
            timezone = COALESCE($4, timezone),
            is_active = COALESCE($5, is_active),
            payload = COALESCE($6::jsonb, payload),
            updated_at = NOW()
      WHERE id = $1
        AND owner_user_id = $7
      RETURNING id, name, cadence, timezone, is_active, payload, created_at, updated_at`,
    [
      scheduleId,
      input.name || null,
      input.cadence || null,
      input.timezone || null,
      typeof input.isActive === "boolean" ? input.isActive : null,
      input.payload ? JSON.stringify(input.payload) : null,
      ownerUserId,
    ]
  );
  return result.rows[0] || null;
}

async function listAccountsData(ownerUserId: string) {
  const accountIds = await getAccessibleAccountIds(ownerUserId, "READ");
  if (!accountIds.length) return [];
  const result = await query(
    `SELECT id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at
       FROM accounts
      WHERE id = ANY($1::bigint[])
      ORDER BY balance_current DESC, name ASC`
    ,
    [accountIds.map(Number)]
  );
  return result.rows;
}

async function listTransactionsData(ownerUserId: string, limit = 20, month?: string) {
  const transactionIds = await getAccessibleTransactionIds(ownerUserId, "READ");
  if (!transactionIds.length) return [];
  const values: any[] = [transactionIds.map(Number)];
  const where: string[] = [`t.id = ANY($1::bigint[])`];
  if (month) {
    const bounds = monthBounds(month);
    values.push(bounds.startDate, bounds.endDate);
    where.push(`t.transaction_date >= $${values.length - 1}::date`);
    where.push(`t.transaction_date < $${values.length}::date`);
  }
  values.push(Math.max(1, Math.min(100, limit)));
  const result = await query(
    `SELECT t.id,
            t.transaction_date,
            t.description,
            t.amount,
            t.currency,
            t.direction,
            t.status,
            t.account_id,
            a.name AS account_name,
            t.category_id,
            c.name AS category_name,
            t.counterparty_id,
            cp.name AS counterparty_name,
            t.notes,
            t.external_ref,
            t.created_at,
            t.updated_at
      FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN counterparties cp ON cp.id = t.counterparty_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.transaction_date DESC, t.id DESC
      LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

async function listBudgetsData(ownerUserId: string, month: string) {
  await ensurePlanningTables();
  const bounds = monthBounds(month);
  const [budgetIds, accountIds, transactionIds] = await Promise.all([
    getAccessibleIds(ownerUserId, "BUDGET", "READ"),
    getAccessibleAccountIds(ownerUserId, "READ"),
    getAccessibleTransactionIds(ownerUserId, "READ"),
  ]);
  if (!budgetIds.length) return [];
  const result = await query(
    `SELECT b.id,
            b.name,
            b.period,
            b.currency,
            b.start_date,
            b.end_date,
            COALESCE((
              SELECT SUM(bl.limit_amount)
                FROM budget_lines bl
               WHERE bl.budget_id = b.id
            ), 0) AS allocated_amount,
            COALESCE((
              SELECT SUM(t.amount)
                FROM transactions t
                JOIN budget_lines bl2 ON bl2.category_id = t.category_id AND bl2.budget_id = b.id
               WHERE t.direction = 'OUTFLOW'
                 AND t.status <> 'VOID'
                 AND t.id = ANY($6::bigint[])
                 AND t.transaction_date >= b.start_date
                 AND t.transaction_date <= b.end_date
            ), 0) AS actual_amount,
            COALESCE((
              SELECT json_agg(
                       json_build_object(
                         'id', bl.id,
                         'categoryId', bl.category_id,
                         'categoryName', c.name,
                         'limitAmount', bl.limit_amount
                       )
                       ORDER BY bl.id ASC
                     )
                FROM budget_lines bl
           LEFT JOIN categories c ON c.id = bl.category_id
               WHERE bl.budget_id = b.id
            ), '[]'::json) AS lines,
            COALESCE((
              SELECT json_agg(
                       json_build_object(
                         'id', a.id,
                         'code', a.code,
                         'name', a.name,
                         'currency', a.currency,
                         'balanceCurrent', a.balance_current
                       )
                       ORDER BY a.name ASC
                     )
               FROM budget_funding_accounts bfa
               JOIN accounts a ON a.id = bfa.account_id
               WHERE bfa.budget_id = b.id
                 AND a.id = ANY($5::bigint[])
            ), '[]'::json) AS funding_accounts,
            COALESCE((
              SELECT json_build_object(
                       'deficitEntryCount', COUNT(*) FILTER (WHERE e.event_type = 'ENTERED_DEFICIT'),
                       'incidentCount', COUNT(*)::int,
                       'maxDeficitAmount', COALESCE(MAX(e.deficit_amount), 0),
                       'lastCauseCode', (ARRAY_AGG(e.cause_code ORDER BY e.detected_at DESC, e.id DESC))[1],
                       'lastCauseSummary', (ARRAY_AGG(e.cause_summary ORDER BY e.detected_at DESC, e.id DESC))[1],
                       'lastDetectedAt', (ARRAY_AGG(e.detected_at ORDER BY e.detected_at DESC, e.id DESC))[1]
                     )
                FROM budget_deficit_events e
               WHERE e.budget_id = b.id
                 AND e.period_month = $4
            ), json_build_object(
              'deficitEntryCount', 0,
              'incidentCount', 0,
              'maxDeficitAmount', 0,
              'lastCauseCode', NULL,
              'lastCauseSummary', NULL,
              'lastDetectedAt', NULL
            )) AS deficit_summary
       FROM budgets b
      WHERE b.id = ANY($1::bigint[])
        AND b.end_date >= $2::date
        AND b.start_date < $3::date
      ORDER BY b.start_date DESC, b.id DESC`,
    [budgetIds.map(Number), bounds.startDate, bounds.endDate, month, accountIds.map(Number), transactionIds.map(Number)]
  );

  return result.rows.map((row: any) => ({
    id: Number(row.id),
    name: row.name,
    period: row.period,
    currency: row.currency,
    startDate: row.start_date,
    endDate: row.end_date,
    allocatedAmount: toNumber(row.allocated_amount),
    actualAmount: toNumber(row.actual_amount),
    remainingBudgetAmount: toNumber(row.allocated_amount) - toNumber(row.actual_amount),
    lines: Array.isArray(row.lines) ? row.lines : [],
    fundingAccounts: Array.isArray(row.funding_accounts) ? row.funding_accounts : [],
    deficitSummary: row.deficit_summary || null,
  }));
}

export async function listGeneratedViewsData(ownerUserId: string, status?: string) {
  await ensurePlanningTables();
  const values: any[] = [];
  const where: string[] = [];
  values.push(ownerUserId);
  where.push(`v.owner_user_id = $${values.length}`);
  if (status) {
    values.push(status);
    where.push(`v.status = $${values.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const views = await query(
    `SELECT v.id, v.source_proposal_id, v.slug, v.title, v.description, v.layout, v.status, v.config, v.created_at, v.updated_at
       FROM generated_views v
       ${whereClause}
      ORDER BY v.created_at DESC`,
    values
  );
  const widgets = await query(
    `SELECT view_id, id, widget_key, widget_type, title, position, data_source, config
       FROM generated_view_widgets
      WHERE owner_user_id = $1
      ORDER BY position ASC, id ASC`
    ,
    [ownerUserId]
  );
  const widgetsByView = new Map<string, any[]>();
  for (const row of widgets.rows as any[]) {
    const list = widgetsByView.get(String(row.view_id)) || [];
    list.push(row);
    widgetsByView.set(String(row.view_id), list);
  }
  return (views.rows as any[]).map((view) => ({
    ...view,
    widgets: widgetsByView.get(String(view.id)) || [],
  }));
}

async function listRemindersData(ownerUserId: string, status?: string) {
  await ensurePlanningTables();
  const values: any[] = [];
  const where: string[] = [];
  values.push(ownerUserId);
  where.push(`r.owner_user_id = $${values.length}`);
  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await query(
    `SELECT r.id,
            r.schedule_id,
            s.name AS schedule_name,
            s.cadence AS schedule_cadence,
            s.timezone AS schedule_timezone,
            s.is_active AS schedule_is_active,
            r.title,
            r.channel,
            r.target,
            r.message_template,
            r.next_run_at,
            r.status,
            r.metadata,
            r.created_at,
            r.updated_at
       FROM agent_reminders r
  LEFT JOIN agent_schedules s ON s.id = r.schedule_id
       ${whereClause}
      ORDER BY r.created_at DESC`,
    values
  );
  return result.rows;
}

async function listProjectionScenariosData(ownerUserId: string, scenarioType?: string) {
  await ensurePlanningTables();
  const values: any[] = [];
  const where: string[] = [];
  values.push(ownerUserId);
  where.push(`owner_user_id = $${values.length}`);
  if (scenarioType) {
    values.push(scenarioType);
    where.push(`scenario_type = $${values.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await query(
    `SELECT id, proposal_id, scenario_type, title, assumptions, result, created_at, updated_at
       FROM projection_scenarios
       ${whereClause}
      ORDER BY created_at DESC`,
    values
  );
  return result.rows;
}

async function buildMonthlyFinanceSummary(ownerUserId: string, month: string) {
  await ensurePlanningTables();
  const bounds = monthBounds(month);
  const [eventsRes, balancesRes] = await Promise.all([
    query<any>(
      `SELECT e.id,
              e.budget_id,
              b.name AS budget_name,
              e.event_type,
              e.deficit_amount,
              e.cause_code
         FROM budget_deficit_events e
         JOIN budgets b ON b.id = e.budget_id
        WHERE e.period_month = $1
          AND b.owner_user_id = $2
        ORDER BY e.detected_at DESC, e.id DESC`,
      [month, ownerUserId]
    ),
    query<{ total_balance: string }>(
      `SELECT COALESCE(SUM(balance_current), 0)::text AS total_balance
         FROM accounts
        WHERE is_active = TRUE
          AND owner_user_id = $1`,
      [ownerUserId]
    ),
  ]);

  const txSummary = await query<{ inflow: string; outflow: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount ELSE 0 END), 0)::text AS inflow,
       COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END), 0)::text AS outflow
     FROM transactions
     WHERE transaction_date >= $1::date
       AND transaction_date < $2::date
       AND status <> 'VOID'
       AND owner_user_id = $3`,
    [bounds.startDate, bounds.endDate, ownerUserId]
  );

  const events = eventsRes.rows;
  const enteredCount = events.filter((row) => row.event_type === "ENTERED_DEFICIT").length;
  const nonExitEvents = events.filter((row) => row.event_type !== "EXITED_DEFICIT");
  const maxDeficitAmount = nonExitEvents.reduce((max, row) => Math.max(max, Number(row.deficit_amount || 0)), 0);
  const totalRecordedDeficitAmount = nonExitEvents.reduce((acc, row) => acc + Number(row.deficit_amount || 0), 0);

  const budgetAgg = new Map<number, { budgetId: number; budgetName: string; incidents: number; maxDeficitAmount: number }>();
  const causeAgg = new Map<string, { causeCode: string; count: number }>();

  for (const row of events) {
    const budgetId = Number(row.budget_id);
    const prevBudget = budgetAgg.get(budgetId) || {
      budgetId,
      budgetName: row.budget_name,
      incidents: 0,
      maxDeficitAmount: 0,
    };
    prevBudget.incidents += 1;
    prevBudget.maxDeficitAmount = Math.max(prevBudget.maxDeficitAmount, Number(row.deficit_amount || 0));
    budgetAgg.set(budgetId, prevBudget);

    const causeCode = String(row.cause_code || "UNKNOWN");
    const prevCause = causeAgg.get(causeCode) || { causeCode, count: 0 };
    prevCause.count += 1;
    causeAgg.set(causeCode, prevCause);
  }

  return {
    month,
    totalBalance: toNumber(balancesRes.rows[0]?.total_balance),
    monthInflow: toNumber(txSummary.rows[0]?.inflow),
    monthOutflow: toNumber(txSummary.rows[0]?.outflow),
    deficitEntryCount: enteredCount,
    totalIncidentCount: events.length,
    maxDeficitAmount,
    totalRecordedDeficitAmount: Math.max(0, totalRecordedDeficitAmount),
    topProblemBudgets: [...budgetAgg.values()].sort((a, b) => b.incidents - a.incidents || b.maxDeficitAmount - a.maxDeficitAmount).slice(0, 5),
    frequentCauses: [...causeAgg.values()].sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

async function createBudgetData(ownerUserId: string, input: {
  name: string;
  period: "MONTHLY" | "YEARLY";
  currency: string;
  startDate: string;
  endDate: string;
  fundingAccountIds?: number[];
  lines: Array<{ categoryId: number; limitAmount: number }>;
}) {
  await ensurePlanningTables();
  return await withTransaction(async (client) => {
    await ensureOwnerCategories(ownerUserId);
    const categoryIds = [...new Set(input.lines.map((line) => line.categoryId))];
    const categoryCheck = await client.query<{ id: number }>(
      `SELECT id
         FROM categories
        WHERE id = ANY($1::bigint[])
          AND owner_user_id = $2`,
      [categoryIds, ownerUserId]
    );
    if (categoryCheck.rows.length !== categoryIds.length) {
      throw new Error("Selecciona una categoria valida para este presupuesto.");
    }

    const budgetRes = await client.query(
      `INSERT INTO budgets (owner_user_id, name, period, currency, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, period, currency, start_date, end_date, created_at`,
      [ownerUserId, input.name, input.period, input.currency.toUpperCase(), input.startDate, input.endDate]
    );
    const budget = budgetRes.rows[0] as any;

    for (const line of input.lines) {
      await client.query(
        `INSERT INTO budget_lines (owner_user_id, budget_id, category_id, limit_amount) VALUES ($1, $2, $3, $4)`,
        [ownerUserId, budget.id, line.categoryId, line.limitAmount]
      );
    }

    const fundingAccountIds =
      input.fundingAccountIds && input.fundingAccountIds.length > 0
        ? [...new Set(input.fundingAccountIds)]
        : (
            await client.query<{ id: number }>(
              `SELECT id
                 FROM accounts
                WHERE is_active = TRUE
                  AND owner_user_id = $1
                ORDER BY id ASC`
              ,
              [ownerUserId]
            )
          ).rows.map((row) => Number(row.id));

    for (const accountId of fundingAccountIds) {
      await client.query(
        `INSERT INTO budget_funding_accounts (owner_user_id, budget_id, account_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [ownerUserId, budget.id, accountId]
      );
    }

    return {
      ...budget,
      fundingAccountIds,
    };
  });
}

export async function createGeneratedViewData(ownerUserId: string, input: {
  slug?: string;
  title: string;
  description?: string | null;
  layout?: "GRID" | "STACK";
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tabs?: DashboardTabInput[];
  widgets?: DashboardWidgetInput[];
  config?: Record<string, unknown>;
  sourceProposalId?: string | null;
}) {
  await ensurePlanningTables();
  const slug = normalizeSlug(input.slug || input.title);
  return await withTransaction(async (client) => {
    const viewRes = await client.query(
      `INSERT INTO generated_views (owner_user_id, source_proposal_id, slug, title, description, layout, status, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (owner_user_id, slug) DO UPDATE
         SET title = EXCLUDED.title,
             description = EXCLUDED.description,
             layout = EXCLUDED.layout,
             status = EXCLUDED.status,
             config = EXCLUDED.config,
             updated_at = NOW()
      RETURNING id, source_proposal_id, slug, title, description, layout, status, config, created_at, updated_at`,
      [
        ownerUserId,
        input.sourceProposalId || null,
        slug,
        input.title,
        input.description || null,
        input.layout || "GRID",
        input.status || "DRAFT",
        JSON.stringify({
          ...(input.config || {}),
          tabs: input.tabs || [],
          source: input.config?.source || "agent",
        }),
      ]
    );
    const view = viewRes.rows[0] as any;

    await client.query(`DELETE FROM generated_view_widgets WHERE view_id = $1 AND owner_user_id = $2`, [view.id, ownerUserId]);
    for (const widget of input.widgets || []) {
      await client.query(
        `INSERT INTO generated_view_widgets (owner_user_id, view_id, widget_key, widget_type, title, position, data_source, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          ownerUserId,
          view.id,
          widget.widgetKey,
          widget.widgetType,
          widget.title,
          widget.position,
          widget.dataSource,
          JSON.stringify(widget.config || {}),
        ]
      );
    }

    return {
      ...view,
      widgets: input.widgets || [],
      tabs: input.tabs || [],
    };
  });
}

export async function getGeneratedViewData(ownerUserId: string, viewId: string) {
  await ensurePlanningTables();
  const viewRes = await query(
    `SELECT id, source_proposal_id, slug, title, description, layout, status, config, created_at, updated_at
       FROM generated_views
      WHERE id = $1
        AND owner_user_id = $2
      LIMIT 1`,
    [viewId, ownerUserId]
  );
  if (!viewRes.rowCount) return null;
  const widgetRes = await query(
    `SELECT id, view_id, widget_key, widget_type, title, position, data_source, config, created_at
       FROM generated_view_widgets
      WHERE view_id = $1
        AND owner_user_id = $2
      ORDER BY position ASC, id ASC`,
    [viewId, ownerUserId]
  );
  const view = viewRes.rows[0] as any;
  return {
    ...view,
    widgets: (widgetRes.rows as any[]).map((widget) => ({
      widgetKey: widget.widget_key,
      widgetType: widget.widget_type,
      title: widget.title,
      position: widget.position,
      dataSource: widget.data_source,
      config: widget.config || {},
    })),
    tabs: Array.isArray(view?.config?.tabs)
      ? view.config.tabs.map((tab: any) => ({
          key: String(tab.key),
          title: String(tab.title),
          order: tab.order === undefined ? undefined : Number(tab.order),
          description: tab.description ? String(tab.description) : undefined,
          widgetKeys: Array.isArray(tab.widgetKeys) ? tab.widgetKeys.map((value: unknown) => String(value)) : undefined,
        }))
      : [],
  };
}

async function createReminderData(ownerUserId: string, input: {
  title: string;
  cadence: string;
  channel: "IN_APP" | "EMAIL" | "WEBHOOK" | "N8N";
  target?: string | null;
  messageTemplate: string;
  timezone?: string;
  nextRunAt?: string | null;
  scheduleId?: string | null;
}) {
  await ensurePlanningTables();
  return await withTransaction(async (client) => {
    let scheduleId = input.scheduleId || null;
    if (scheduleId) {
      const existing = await client.query(`SELECT id FROM agent_schedules WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [
        scheduleId,
        ownerUserId,
      ]);
      if (!existing.rowCount) {
        throw new Error("Schedule not found.");
      }
    } else {
      const scheduleRes = await client.query<{ id: string }>(
        `INSERT INTO agent_schedules (owner_user_id, name, cadence, timezone, is_active, payload)
         VALUES ($1, $2, $3, $4, TRUE, '{}'::jsonb)
         RETURNING id`,
        [ownerUserId, input.title, input.cadence, input.timezone || "America/Bogota"]
      );
      scheduleId = scheduleRes.rows[0].id;
    }

    const reminderRes = await client.query(
      `INSERT INTO agent_reminders (owner_user_id, schedule_id, title, channel, target, message_template, next_run_at, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', '{}'::jsonb)
       RETURNING id, schedule_id, title, channel, target, message_template, next_run_at, status, metadata, created_at, updated_at`,
      [ownerUserId, scheduleId, input.title, input.channel, input.target || null, input.messageTemplate, input.nextRunAt || null]
    );
    return reminderRes.rows[0];
  });
}

async function createProjectionScenarioData(ownerUserId: string, input: {
  scenarioType: "DEBT_PAYOFF" | "CASHFLOW" | "INVESTMENT";
  title: string;
  assumptions?: Record<string, unknown>;
  result?: Record<string, unknown>;
  proposalId?: string | null;
}) {
  await ensurePlanningTables();
  const result = await query(
    `INSERT INTO projection_scenarios (owner_user_id, proposal_id, scenario_type, title, assumptions, result)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     RETURNING id, proposal_id, scenario_type, title, assumptions, result, created_at, updated_at`,
    [
      ownerUserId,
      input.proposalId || null,
      input.scenarioType,
      input.title,
      JSON.stringify(input.assumptions || {}),
      JSON.stringify(input.result || {}),
    ]
  );
  return result.rows[0];
}

export function buildFinanceToolkit(ownerUserId: string) {
  const monthlyFinanceSnapshotTool = createTool({
    id: "finance_get_snapshot",
    description: "Returns a compact financial snapshot for the selected month, including balances, budgets and recent transactions.",
    inputSchema: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      transactionLimit: z.coerce.number().int().min(1).max(50).default(12),
    }),
    execute: async (input: any) => {
      const currentMonth = (input?.month as string | undefined) || currentYYYYMM();
      const transactionLimit = Number(input?.transactionLimit ?? 12);
      const [accounts, transactions, budgets] = await Promise.all([
        listAccountsData(ownerUserId),
        listTransactionsData(ownerUserId, transactionLimit, currentMonth),
        hasPlanningTables().then((ok) => (ok ? listBudgetsData(ownerUserId, currentMonth) : [])),
      ]);

      const monthInflow = transactions.filter((tx: any) => tx.direction === "INFLOW").reduce((acc, tx) => acc + toNumber(tx.amount), 0);
      const monthOutflow = transactions.filter((tx: any) => tx.direction === "OUTFLOW").reduce((acc, tx) => acc + toNumber(tx.amount), 0);

      return {
        month: currentMonth,
        totalBalance: accounts.reduce((acc, account: any) => acc + toNumber(account.balance_current), 0),
        monthInflow,
        monthOutflow,
        accounts: accounts.slice(0, 8),
        recentTransactions: transactions.slice(0, transactionLimit),
        budgets: budgets.slice(0, 8),
      };
    },
  });

  const accountsTool = createTool({
    id: "finance_list_accounts",
    description: "List active financial accounts with balances and currencies.",
    inputSchema: z.object({}),
    execute: async () => ({ accounts: await listAccountsData(ownerUserId) }),
  });

  const transactionsTool = createTool({
    id: "finance_list_transactions",
    description: "List recent transactions or transactions filtered by month.",
    inputSchema: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
    execute: async (input: any) => {
      const month = input?.month as string | undefined;
      const limit = Number(input?.limit ?? 20);
      return { transactions: await listTransactionsData(ownerUserId, limit, month) };
    },
  });

  const createTransactionTool = createTool({
    id: "finance_create_transaction",
    description: "Create a posted financial transaction and update the selected account balance.",
    inputSchema: z.object({
      transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.coerce.number().positive(),
      direction: z.enum(["INFLOW", "OUTFLOW"]),
      accountId: z.coerce.number().int().positive(),
      currency: z.string().trim().min(3).max(10).default("COP"),
      status: z.enum(["PENDING", "POSTED", "RECONCILED", "VOID"]).default("POSTED"),
      description: z.string().trim().max(500).optional(),
      categoryId: z.coerce.number().int().positive().optional(),
      counterpartyId: z.coerce.number().int().positive().optional(),
      notes: z.string().trim().max(3000).optional(),
    }),
    execute: async (input: any) => {
      const accountId = Number(input?.accountId);
      const transactionDate = String(input?.transactionDate || "");
      const amount = Number(input?.amount);
      const currency = String(input?.currency || "COP");
      const direction = String(input?.direction || "OUTFLOW") as "INFLOW" | "OUTFLOW";
      const status = String(input?.status || "POSTED") as "PENDING" | "POSTED" | "RECONCILED" | "VOID";
      const description = input?.description ? String(input.description) : undefined;
      const categoryId = input?.categoryId === undefined ? undefined : Number(input.categoryId);
      const counterpartyId = input?.counterpartyId === undefined ? undefined : Number(input.counterpartyId);
      const notes = input?.notes ? String(input.notes) : undefined;
      const result = await withTransaction(async (client) => {
        const account = await client.query(`SELECT id, is_active FROM accounts WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [accountId, ownerUserId]);
        if (!account.rows[0]) throw new Error("Account not found.");
        if (!account.rows[0].is_active) throw new Error("Account is inactive.");
        if (categoryId) {
          const category = await client.query(`SELECT id FROM categories WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [categoryId, ownerUserId]);
          if (!category.rowCount) throw new Error("Category not found.");
        }

        const inserted = await client.query(
          `INSERT INTO transactions (
             owner_user_id,
             transaction_date, description, amount, currency, direction, status, account_id, category_id, counterparty_id, notes
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, transaction_date, description, amount, currency, direction, status, account_id, category_id, counterparty_id, notes, external_ref, created_at, updated_at`,
          [
            ownerUserId,
            transactionDate,
            description || null,
            amount,
            currency.toUpperCase(),
            direction,
            status,
            accountId,
            categoryId || null,
            counterpartyId || null,
            notes || null,
          ]
        );
        const delta = direction === "INFLOW" ? amount : -amount;
        const accountUpdated = await client.query(
          `UPDATE accounts
              SET balance_current = balance_current + $1,
                  updated_at = NOW()
            WHERE id = $2
              AND owner_user_id = $3
          RETURNING id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at`,
          [delta, accountId, ownerUserId]
        );
        return { transaction: inserted.rows[0], account: accountUpdated.rows[0] };
      });
      return result;
    },
  });

  const budgetsTool = createTool({
    id: "finance_list_budgets",
    description: "List budgets for a month including lines, funding accounts and deficit summary.",
    inputSchema: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).default(currentYYYYMM()),
    }),
    execute: async (input: any) => ({ budgets: await listBudgetsData(ownerUserId, String(input?.month || currentYYYYMM())) }),
  });

  const createBudgetTool = createTool({
    id: "finance_create_budget",
    description: "Create a budget with category lines and optional funding accounts.",
    inputSchema: z.object({
      name: z.string().trim().min(2).max(160),
      period: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
      currency: z.string().trim().min(3).max(10).default("COP"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fundingAccountIds: z.array(z.coerce.number().int().positive()).optional(),
      lines: z.array(
        z.object({
          categoryId: z.coerce.number().int().positive(),
          limitAmount: z.coerce.number().nonnegative(),
        })
      ).min(1),
    }),
    execute: async (input: any) => {
      const normalized = {
        name: String(input?.name),
        period: String(input?.period || "MONTHLY") as "MONTHLY" | "YEARLY",
        currency: String(input?.currency || "COP"),
        startDate: String(input?.startDate),
        endDate: String(input?.endDate),
        fundingAccountIds: Array.isArray(input?.fundingAccountIds)
          ? input.fundingAccountIds.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value))
          : undefined,
        lines: Array.isArray(input?.lines)
          ? input.lines.map((line: any) => ({
              categoryId: Number(line.categoryId),
              limitAmount: Number(line.limitAmount),
            }))
          : [],
      };
      return { budget: await createBudgetData(ownerUserId, normalized) };
    },
  });

  const generatedViewsTool = createTool({
    id: "finance_list_generated_views",
    description: "List generated dashboards/views with widgets and tab definitions.",
    inputSchema: z.object({
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    }),
    execute: async ({ status }) => ({ views: await listGeneratedViewsData(ownerUserId, status) }),
  });

  const createGeneratedViewTool = createTool({
    id: "finance_upsert_generated_view",
    description: "Create or update a generated dashboard/view, including its tabs and widgets.",
    inputSchema: z.object({
      slug: z.string().trim().max(140).optional(),
      title: z.string().trim().min(2).max(220),
      description: z.string().trim().max(4000).optional(),
      layout: z.enum(["GRID", "STACK"]).default("GRID"),
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
      sourceProposalId: z.string().uuid().optional(),
      tabs: z.array(
        z.object({
          key: z.string().trim().min(1).max(80),
          title: z.string().trim().min(1).max(120),
          order: z.coerce.number().int().min(0).optional(),
          description: z.string().trim().max(400).optional(),
          widgetKeys: z.array(z.string().trim().min(1).max(120)).optional(),
        })
      ).optional(),
      widgets: z.array(
        z.object({
          widgetKey: z.string().trim().min(1).max(120),
          widgetType: z.enum(["metric", "table", "line_chart", "bar_chart", "pie_chart", "timeline", "monthly_cashflow", "debt_projection", "investment_return", "portfolio_performance"]),
          title: z.string().trim().min(1).max(220),
          position: z.coerce.number().int().min(1).default(1),
          dataSource: z.string().trim().min(1).max(120),
          config: z.record(z.string(), z.any()).optional(),
        })
      ).optional(),
      config: z.record(z.string(), z.any()).optional(),
    }),
    execute: async (input: any) => {
      const tabs = Array.isArray(input?.tabs)
        ? input.tabs.map((tab: any) => ({
            key: String(tab.key),
            title: String(tab.title),
            order: tab.order === undefined ? undefined : Number(tab.order),
            description: tab.description ? String(tab.description) : undefined,
            widgetKeys: Array.isArray(tab.widgetKeys) ? tab.widgetKeys.map((value: unknown) => String(value)) : undefined,
          }))
        : undefined;
      const widgets = Array.isArray(input?.widgets)
        ? input.widgets.map((widget: any) => ({
            widgetKey: String(widget.widgetKey),
            widgetType: widget.widgetType,
            title: String(widget.title),
            position: widget.position === undefined ? 1 : Number(widget.position),
            dataSource: String(widget.dataSource),
            config: widget.config && typeof widget.config === "object" ? widget.config : undefined,
          }))
        : undefined;
      const viewInput = {
        slug: input?.slug ? String(input.slug) : undefined,
        title: String(input?.title),
        description: input?.description ? String(input.description) : undefined,
        layout: String(input?.layout || "GRID") as "GRID" | "STACK",
        status: String(input?.status || "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        sourceProposalId: input?.sourceProposalId ? String(input.sourceProposalId) : undefined,
        tabs,
        widgets,
        config: input?.config && typeof input.config === "object" ? input.config : undefined,
      };
      return { view: await createGeneratedViewData(ownerUserId, viewInput as any) };
    },
  });

  const schedulesTool = createTool({
    id: "finance_list_schedules",
    description: "List agent schedules / cron jobs.",
    inputSchema: z.object({
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    }),
    execute: async (input: any) => ({ schedules: await listSchedulesData(ownerUserId, input?.status) }),
  });

  const createScheduleTool = createTool({
    id: "finance_create_schedule",
    description: "Create a reusable schedule / cron job for reminders or agent workflows.",
    inputSchema: z.object({
      name: z.string().trim().min(2).max(220),
      cadence: z.string().trim().min(3).max(80),
      timezone: z.string().trim().min(3).max(80).default("America/Bogota"),
      isActive: z.boolean().default(true),
      payload: z.record(z.string(), z.any()).optional(),
    }),
    execute: async (input: any) => {
      const schedule = await createScheduleData(ownerUserId, {
        name: String(input?.name),
        cadence: String(input?.cadence),
        timezone: input?.timezone ? String(input.timezone) : "America/Bogota",
        isActive: Boolean(input?.isActive ?? true),
        payload: input?.payload && typeof input.payload === "object" ? input.payload : undefined,
      });
      return { schedule };
    },
  });

  const updateScheduleTool = createTool({
    id: "finance_update_schedule",
    description: "Update an existing agent schedule / cron job.",
    inputSchema: z.object({
      scheduleId: z.string().uuid(),
      name: z.string().trim().min(2).max(220).optional(),
      cadence: z.string().trim().min(3).max(80).optional(),
      timezone: z.string().trim().min(3).max(80).optional(),
      isActive: z.boolean().optional(),
      payload: z.record(z.string(), z.any()).optional(),
    }),
    execute: async (input: any) => {
      const schedule = await updateScheduleData(ownerUserId, String(input?.scheduleId), {
        name: input?.name ? String(input.name) : undefined,
        cadence: input?.cadence ? String(input.cadence) : undefined,
        timezone: input?.timezone ? String(input.timezone) : undefined,
        isActive: typeof input?.isActive === "boolean" ? input.isActive : undefined,
        payload: input?.payload && typeof input.payload === "object" ? input.payload : undefined,
      });
      if (!schedule) {
        throw new Error("Schedule not found.");
      }
      return { schedule };
    },
  });

  const remindersTool = createTool({
    id: "finance_list_reminders",
    description: "List active or paused reminders.",
    inputSchema: z.object({
      status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]).optional(),
    }),
    execute: async ({ status }) => ({ reminders: await listRemindersData(ownerUserId, status) }),
  });

  const createReminderTool = createTool({
    id: "finance_create_reminder",
    description: "Create a reminder backed by the agent schedules table.",
    inputSchema: z.object({
      title: z.string().trim().min(2).max(220),
      cadence: z.string().trim().min(3).max(80).default("MONTHLY"),
      channel: z.enum(["IN_APP", "EMAIL", "WEBHOOK", "N8N"]).default("IN_APP"),
      target: z.string().trim().max(300).optional(),
      messageTemplate: z.string().trim().min(4).max(4000),
      timezone: z.string().trim().min(3).max(80).default("America/Bogota"),
      nextRunAt: z.string().datetime().optional(),
      scheduleId: z.string().uuid().optional(),
    }),
    execute: async (input: any) => {
      const reminderInput = {
        title: String(input?.title),
        cadence: String(input?.cadence || "MONTHLY"),
        channel: String(input?.channel || "IN_APP") as "IN_APP" | "EMAIL" | "WEBHOOK" | "N8N",
        target: input?.target ? String(input.target) : undefined,
        messageTemplate: String(input?.messageTemplate),
        timezone: String(input?.timezone || "America/Bogota"),
        nextRunAt: input?.nextRunAt ? String(input.nextRunAt) : undefined,
        scheduleId: input?.scheduleId ? String(input.scheduleId) : undefined,
      };
      return { reminder: await createReminderData(ownerUserId, reminderInput) };
    },
  });

  const projectionsTool = createTool({
    id: "finance_list_projection_scenarios",
    description: "List saved financial projection scenarios.",
    inputSchema: z.object({
      scenarioType: z.enum(["DEBT_PAYOFF", "CASHFLOW", "INVESTMENT"]).optional(),
    }),
    execute: async ({ scenarioType }) => ({ scenarios: await listProjectionScenariosData(ownerUserId, scenarioType) }),
  });

  const createProjectionTool = createTool({
    id: "finance_create_projection_scenario",
    description: "Create a saved financial projection scenario.",
    inputSchema: z.object({
      scenarioType: z.enum(["DEBT_PAYOFF", "CASHFLOW", "INVESTMENT"]),
      title: z.string().trim().min(2).max(220),
      assumptions: z.record(z.string(), z.any()).optional(),
      result: z.record(z.string(), z.any()).optional(),
      proposalId: z.string().uuid().optional(),
    }),
    execute: async (input: any) => {
      const scenarioInput = {
        scenarioType: String(input?.scenarioType) as "DEBT_PAYOFF" | "CASHFLOW" | "INVESTMENT",
        title: String(input?.title),
        assumptions: input?.assumptions && typeof input.assumptions === "object" ? input.assumptions : undefined,
        result: input?.result && typeof input.result === "object" ? input.result : undefined,
        proposalId: input?.proposalId ? String(input.proposalId) : undefined,
      };
      return { scenario: await createProjectionScenarioData(ownerUserId, scenarioInput) };
    },
  });

  const monthlySummaryTool = createTool({
    id: "finance_monthly_summary",
    description: "Summarize a month of finance activity, including deficits and balances.",
    inputSchema: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).default(currentYYYYMM()),
    }),
    execute: async (input: any) => {
      const month = String(input?.month || currentYYYYMM());
      return { summary: await buildMonthlyFinanceSummary(ownerUserId, month) };
    },
  });

  return {
    finance_get_snapshot: monthlyFinanceSnapshotTool,
    finance_list_accounts: accountsTool,
    finance_list_transactions: transactionsTool,
    finance_create_transaction: createTransactionTool,
    finance_list_budgets: budgetsTool,
    finance_create_budget: createBudgetTool,
    finance_list_generated_views: generatedViewsTool,
    finance_upsert_generated_view: createGeneratedViewTool,
    finance_list_schedules: schedulesTool,
    finance_create_schedule: createScheduleTool,
    finance_update_schedule: updateScheduleTool,
    finance_list_reminders: remindersTool,
    finance_create_reminder: createReminderTool,
    finance_list_projection_scenarios: projectionsTool,
    finance_create_projection_scenario: createProjectionTool,
    finance_monthly_summary: monthlySummaryTool,
  };
}

export type FinanceToolkit = ReturnType<typeof buildFinanceToolkit>;
