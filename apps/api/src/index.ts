import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { query, withTransaction } from "./db.js";
import { runMastraAgentChat } from "./agent/mastra-runtime.js";
import {
  createGeneratedViewData,
  createScheduleData,
  ensureOwnerCategories,
  getGeneratedViewData,
  listSchedulesData,
  listGeneratedViewsData,
  updateScheduleData,
} from "./agent/finance-toolkit.js";
import { getFinanceToolingContract } from "./tooling/agent-contract.js";
import { getFinanceOpenApiSpec } from "./tooling/openapi.js";
import {
  extractTelegramWebhookMessage,
  getTelegramStatus,
  isTelegramChatAllowed,
  sendTelegramTextMessage,
} from "./integrations/telegram.js";
import {
  getAuthPublicConfig,
  isAuthEnabled,
  isInternalFinanceRequest,
  exchangeGoogleAuthorizationCode,
  loginWithEmailPassword,
  registerWithEmailPassword,
  refreshAuthTokens,
  revokeRefreshToken,
  resolveFinanceSession,
  INTERNAL_REQUEST_HEADER,
} from "./auth.js";
import {
  financeMcpEnabled,
  financeMcpPath,
  getFinanceMcpServer,
  getFinanceMcpStatus,
  getFinanceMcpToolList,
} from "./mcp/finance-mcp.js";
import {
  canAccessResource,
  getAccessibleAccountIds,
  getAccessibleIds,
  getAccessibleTransactionIds,
  isResourceOwner,
  normalizeSharePermissions,
  SHARE_PERMISSIONS,
  SHARE_INVITATION_RESOURCE_TYPES,
} from "./access.js";

export const app = Fastify({
  logger: true,
  bodyLimit: 60 * 1024 * 1024,
});

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
    if (origin === "tauri://localhost") return cb(null, true);
    if (/^https?:\/\/tauri\.localhost(?::\d+)?$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
});

const authEnabled = isAuthEnabled();

app.addHook("onRequest", async (req, reply) => {
  if (process.env.NODE_ENV === "test") return;
  if (!authEnabled) return;
  if (req.method === "OPTIONS") return;

  const requestUrl = new URL(req.raw.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (
    pathname === "/" ||
    pathname === "/health" ||
    pathname === "/ready" ||
    pathname.startsWith("/v1/auth/") ||
    pathname === "/v1/tooling/manifest" ||
    pathname === "/v1/tooling/examples" ||
    pathname === "/v1/tooling/schema" ||
    pathname === "/v1/tooling/openapi" ||
    pathname === "/v1/mcp/status" ||
    pathname === "/v1/mcp/tools" ||
    pathname === "/v1/integrations/telegram/status"
  ) {
    return;
  }

  if (pathname === "/v1/integrations/telegram/webhook" || isInternalFinanceRequest(req)) {
    return;
  }

  const session = await resolveFinanceSession(req);
  if (!session) {
    return reply.code(401).send({
      error: "Autenticacion requerida.",
      code: "AUTH_REQUIRED",
    });
  }

  (req as any).auth = session;
});

async function handleFinanceMcpRequest(request: any, reply: any) {
  if (!financeMcpEnabled) {
    return reply.code(503).send({
      error: "MCP finance bridge disabled.",
      code: "MCP_FINANCE_DISABLED",
    });
  }

  const ownerUserId = String(request.auth?.userId || "").trim();
  if (!ownerUserId) {
    return reply.code(401).send({ error: "Autenticacion requerida.", code: "AUTH_REQUIRED" });
  }

  const requestHost = request.headers.host || `localhost:${port}`;
  const requestUrl = new URL(request.raw.url || financeMcpPath, `http://${requestHost}`);
  reply.hijack();
  await getFinanceMcpServer(ownerUserId).startHTTP({
    url: requestUrl,
    httpPath: financeMcpPath,
    req: request.raw,
    res: reply.raw,
    options: {
      serverless: true,
    },
  });
}

function classifyAuthFailure(error: unknown, fallbackCode: string) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();

  if (normalized.includes("credenciales invalidas")) {
    return { statusCode: 401, code: "AUTH_INVALID_CREDENTIALS", message: "Credenciales invalidas." };
  }

  if (normalized.includes("ese correo ya tiene una cuenta")) {
    return { statusCode: 409, code: "AUTH_EMAIL_ALREADY_EXISTS", message: "Ese correo ya tiene una cuenta. Inicia sesion o usa Google." };
  }

  if (normalized.includes("no tiene contraseña") || normalized.includes("no tiene contrasena")) {
    return {
      statusCode: 409,
      code: "AUTH_PASSWORD_REQUIRED",
      message: "Esta cuenta no tiene contraseña. Entra con Google o crea una contraseña.",
    };
  }

  if (normalized.includes("google no esta configurado") || normalized.includes("google no está configurado")) {
    return { statusCode: 503, code: "AUTH_GOOGLE_NOT_CONFIGURED", message: "Google no esta configurado." };
  }

  if (normalized.includes("redirect_uri_mismatch")) {
    return {
      statusCode: 400,
      code: "AUTH_GOOGLE_REDIRECT_URI_MISMATCH",
      message: message || "La URI de redireccion de Google no coincide con la configuracion autorizada.",
    };
  }

  if (normalized.includes("sesion invalida") || normalized.includes("la sesion ha expirado") || normalized.includes("cuenta esta desactivada")) {
    return { statusCode: 401, code: "AUTH_SESSION_INVALID", message: message || "La sesion ya no es valida." };
  }

  return {
    statusCode: 500,
    code: fallbackCode,
    message: message || "No se pudo completar la autenticacion.",
  };
}


const accountTypeSchema = z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT", "LOAN", "OTHER"]);
const directionSchema = z.enum(["INFLOW", "OUTFLOW"]);
const statusSchema = z.enum(["PENDING", "POSTED", "RECONCILED", "VOID"]);
const copilotModeSchema = z.enum(["ACCOUNTANT", "ANALYST"]);
const counterpartyTypeSchema = z.enum(["PERSON", "BUSINESS", "INTERNAL", "OTHER"]);

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
  counterpartyId: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().max(3000).optional(),
  tags: z.array(z.coerce.number().int().positive()).max(50).optional(),
  splits: z
    .array(
      z.object({
        description: z.string().trim().max(500).optional(),
        categoryId: z.coerce.number().int().positive().optional(),
        counterpartyId: z.coerce.number().int().positive().optional(),
        amount: z.coerce.number().positive(),
      })
    )
    .max(100)
    .optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        fileUrl: z.string().trim().url().max(3000),
        mimeType: z.string().trim().max(120).optional(),
        fileSize: z.coerce.number().int().nonnegative().optional(),
      })
    )
    .max(50)
    .optional(),
});

const listTransactionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  accountId: z.coerce.number().int().positive().optional(),
  direction: directionSchema.optional(),
  status: statusSchema.optional(),
  q: z.string().trim().max(120).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  counterpartyId: z.coerce.number().int().positive().optional(),
  tagId: z.coerce.number().int().positive().optional(),
});

const reportRangeSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const categoryBreakdownQuerySchema = reportRangeSchema.extend({
  direction: directionSchema.default("OUTFLOW"),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

const createCategorySchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  direction: z.enum(["INFLOW", "OUTFLOW", "BOTH"]).default("BOTH"),
});

const createCounterpartySchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: counterpartyTypeSchema.default("OTHER"),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(3000).optional(),
  isActive: z.boolean().default(true),
});

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().max(16).optional(),
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

const COPILOT_MAX_ATTACHMENTS = 6;
const COPILOT_MAX_ATTACHMENT_DATA_URL_CHARS = 20_000_000;
const COPILOT_MAX_TOTAL_ATTACHMENT_DATA_URL_CHARS = 45_000_000;

const copilotAttachmentSchema = z.object({
  kind: z.enum(["image", "file"]).default("file"),
  name: z.string().trim().min(1).max(255),
  mediaType: z.string().trim().min(3).max(180),
  dataUrl: z.string().trim().max(COPILOT_MAX_ATTACHMENT_DATA_URL_CHARS),
});

const chatMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  model: z.string().trim().min(2).max(120).optional(),
  attachments: z.array(copilotAttachmentSchema).max(COPILOT_MAX_ATTACHMENTS).optional(),
});

const listAgentRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  status: z.enum(["RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
});

const listProposalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
});

const listGeneratedViewsQuerySchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

const generatedViewTabSchema = z.object({
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  order: z.coerce.number().int().min(0).optional(),
  description: z.string().trim().max(400).optional(),
  widgetKeys: z.array(z.string().trim().min(1).max(120)).optional(),
});

const generatedViewWidgetSchema = z.object({
  widgetKey: z.string().trim().min(1).max(120),
  widgetType: z.enum(["metric", "table", "line_chart", "bar_chart", "pie_chart", "timeline", "monthly_cashflow", "debt_projection", "investment_return", "portfolio_performance"]),
  title: z.string().trim().min(1).max(220),
  position: z.coerce.number().int().min(1).default(1),
  dataSource: z.string().trim().min(1).max(120),
  config: z.record(z.string(), z.any()).optional(),
});

const generatedViewCreateSchema = z.object({
  slug: z.string().trim().max(140).optional(),
  title: z.string().trim().min(2).max(220),
  description: z.string().trim().max(4000).optional(),
  layout: z.enum(["GRID", "STACK"]).default("GRID"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  sourceProposalId: z.string().uuid().optional(),
  tabs: z.array(generatedViewTabSchema).optional(),
  widgets: z.array(generatedViewWidgetSchema).optional(),
  config: z.record(z.string(), z.any()).optional(),
});

const generatedViewUpdateSchema = generatedViewCreateSchema.partial();

const listRemindersQuerySchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]).optional(),
});

const listSchedulesQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const createScheduleSchema = z.object({
  name: z.string().trim().min(2).max(220),
  cadence: z.string().trim().min(3).max(80),
  timezone: z.string().trim().min(3).max(80).default("America/Bogota"),
  isActive: z.boolean().default(true),
  payload: z.record(z.string(), z.any()).optional(),
});

const updateScheduleSchema = z.object({
  name: z.string().trim().min(2).max(220).optional(),
  cadence: z.string().trim().min(3).max(80).optional(),
  timezone: z.string().trim().min(3).max(80).optional(),
  isActive: z.boolean().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

const agentChatSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  channel: z.enum(["WEB", "DESKTOP", "API", "SYSTEM"]).default("WEB"),
  model: z.string().trim().min(2).max(120).optional(),
});

const settingsProfileSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  username: z.string().trim().min(3).max(48).regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/).optional(),
});

const settingsPreferencesSchema = z.object({
  theme: z.string().trim().max(40).optional(),
  backgroundMode: z.enum(["auto", "plain", "grid", "aurora"]).optional(),
  timezone: z.string().trim().max(80).optional(),
  language: z.string().trim().max(12).optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
});

const shareInvitationSchema = z.object({
  username: z.string().trim().min(3).max(48),
  message: z.string().trim().max(1000).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(14),
  items: z.array(z.object({
    resourceType: z.enum(SHARE_INVITATION_RESOURCE_TYPES),
    resourceId: z.string().trim().min(1).max(120),
    permissions: z.array(z.enum(SHARE_PERMISSIONS)).min(1).max(SHARE_PERMISSIONS.length).default(["READ"]),
  })).min(1).max(100),
});

const shareGrantUpdateSchema = z.object({
  permissions: z.array(z.enum(SHARE_PERMISSIONS)).min(1).max(SHARE_PERMISSIONS.length),
});

const friendRequestSchema = z.object({
  username: z.string().trim().min(3).max(48).regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/),
});

const authGoogleExchangeSchema = z.object({
  code: z.string().trim().min(1).max(5000),
  codeVerifier: z.string().trim().min(1).max(5000),
  redirectUri: z.string().trim().min(1).max(3000),
  state: z.string().trim().min(1).max(5000).optional(),
});

const authRefreshSchema = z.object({
  refreshToken: z.string().trim().min(1).max(5000),
});

const authEmailSchema = z.object({
  email: z.string().trim().email().max(220),
  password: z.string().min(8).max(200),
});

const authRegisterSchema = authEmailSchema.extend({
  name: z.string().trim().min(1).max(160).optional(),
});

const agentProposalDecisionSchema = z.object({
  reason: z.string().trim().max(1500).optional(),
});

const createReminderSchema = z.object({
  title: z.string().trim().min(2).max(220),
  cadence: z.string().trim().min(3).max(80).default("MONTHLY"),
  channel: z.enum(["IN_APP", "EMAIL", "WEBHOOK", "N8N", "TELEGRAM"]).default("IN_APP"),
  target: z.string().trim().max(300).optional(),
  messageTemplate: z.string().trim().min(4).max(4000),
  timezone: z.string().trim().min(3).max(80).default("America/Bogota"),
  nextRunAt: z.string().datetime().optional(),
});


const listBudgetsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const listBudgetDeficitsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const updateBudgetDeficitEventSchema = z.object({
  causeSummary: z.string().trim().min(2).max(2000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const upsertBudgetSchema = z.object({
  name: z.string().trim().min(2).max(160),
  period: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  currency: z.string().trim().min(3).max(10).default("COP"),
  startDate: z.string().date(),
  endDate: z.string().date(),
  fundingAccountIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
  lines: z
    .array(
      z.object({
        categoryId: z.coerce.number().int().positive(),
        limitAmount: z.coerce.number().nonnegative(),
      })
    )
    .min(1)
    .max(400),
});

const listCommitmentsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  activeOnly: z.coerce.boolean().default(true),
});

const upsertCommitmentSchema = z.object({
  name: z.string().trim().min(2).max(160),
  cadence: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(3).max(10).default("COP"),
  direction: directionSchema.default("OUTFLOW"),
  categoryId: z.coerce.number().int().positive().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  nextRunAt: z.string().date().optional(),
  notes: z.string().trim().max(1200).optional(),
});

const runProjectionSchema = z.object({
  horizonMonths: z.coerce.number().int().min(1).max(24).default(6),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  monthlyFixedOutflow: z.coerce.number().nonnegative().optional(),
  monthlySavingsGoal: z.coerce.number().nonnegative().default(0),
  monthlyInvestmentGoal: z.coerce.number().nonnegative().default(0),
  includeCommitments: z.coerce.boolean().default(true),
  scenarioTitle: z.string().trim().min(2).max(220).optional(),
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

function closeAmountDiff(expected: number, actual: number) {
  return Math.abs(expected - actual) < 0.01;
}

function monthStartFromYYYYMM(month: string) {
  return `${month}-01`;
}

function monthEndFromYYYYMM(month: string) {
  const [y, m] = month.split("-").map((v) => Number(v));
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

function currentYYYYMM() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(yyyyMm: string, monthsToAdd: number) {
  const [y, m] = yyyyMm.split("-").map((v) => Number(v));
  const d = new Date(Date.UTC(y, m - 1 + monthsToAdd, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function monthFromDateString(value: string) {
  return value.slice(0, 7);
}

function normalizeAmount(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function materiallyChanged(nextValue: number, prevValue: number) {
  return Math.abs(nextValue - prevValue) >= 0.01;
}

function buildDeficitCause(params: { overBudgetAmount: number; fundingShortfallAmount: number; hasFundingAccounts: boolean }) {
  const { overBudgetAmount, fundingShortfallAmount, hasFundingAccounts } = params;
  if (overBudgetAmount > 0 && fundingShortfallAmount > 0) {
    return {
      code: "BOTH_OVERSPENT_AND_UNDERFUNDED",
      summary: "El presupuesto excedio su limite y las cuentas financiadoras no alcanzan a cubrirlo.",
    };
  }
  if (overBudgetAmount > 0) {
    return {
      code: "OVERSPENT_CATEGORY",
      summary: "El gasto real del periodo supero el limite presupuestado.",
    };
  }
  if (fundingShortfallAmount > 0) {
    return {
      code: hasFundingAccounts ? "INSUFFICIENT_FUNDING_ACCOUNTS" : "MANUAL_REALLOCATION_GAP",
      summary: hasFundingAccounts
        ? "Las cuentas financiadoras asociadas no tienen saldo suficiente para respaldar el presupuesto."
        : "El presupuesto no tiene fondeo suficiente asignado para cubrir su limite actual.",
    };
  }
  return {
    code: "NONE",
    summary: "Sin deficit detectado.",
  };
}

const agentRuntimeEnabled = String(process.env.AGENT_RUNTIME_ENABLED || "false").toLowerCase() === "true";
const agentDefaultName = (process.env.AGENT_DEFAULT_NAME || "FinanceSupervisorAgent").trim();

let agentFoundationCache: boolean | null = null;

async function hasAgentFoundationTables() {
  if (agentFoundationCache !== null) return agentFoundationCache;
  const result = await query<{ ok: boolean }>(
    `SELECT (
      to_regclass('public.agent_runs') IS NOT NULL
      AND to_regclass('public.agent_proposals') IS NOT NULL
      AND to_regclass('public.agent_schedules') IS NOT NULL
      AND to_regclass('public.generated_views') IS NOT NULL
      AND to_regclass('public.agent_reminders') IS NOT NULL
    ) AS ok`
  );
  agentFoundationCache = Boolean(result.rows[0]?.ok);
  return agentFoundationCache;
}

function slugify(value: string) {
  const cleaned = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (cleaned) return cleaned;
  return `vista-${Date.now().toString().slice(-8)}`;
}

let legacySchemaCache: boolean | null = null;
let planningTablesCache: boolean | null = null;

async function isLegacyJournalSchema() {
  if (legacySchemaCache !== null) return legacySchemaCache;
  const result = await query<{ applied: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM schema_migrations
        WHERE filename = '010_multi_tenant_ownership.sql'
     ) AS applied`
  );
  legacySchemaCache = !Boolean(result.rows[0]?.applied);
  return legacySchemaCache;
}

async function hasPlanningTables() {
  if (planningTablesCache !== null) return planningTablesCache;
  const result = await query<{ ok: boolean }>(
    `SELECT (
      to_regclass('public.budgets') IS NOT NULL
      AND to_regclass('public.budget_lines') IS NOT NULL
      AND to_regclass('public.budget_funding_accounts') IS NOT NULL
      AND to_regclass('public.budget_deficit_events') IS NOT NULL
    ) AS ok`
  );
  planningTablesCache = Boolean(result.rows[0]?.ok);
  return planningTablesCache;
}

function normalizeCategoryName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCategoryCode(value: string) {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (cleaned || "CATEGORY").slice(0, 40);
}

function buildLegacyCategoryCode(value: string) {
  return normalizeCategoryCode(slugify(value).replace(/-/g, "_") || value);
}

function buildAvailableCategoryCode(baseCode: string, usedCodes: Set<string>) {
  const normalizedBase = normalizeCategoryCode(baseCode);
  if (!usedCodes.has(normalizedBase)) return normalizedBase;

  let attempt = 2;
  while (attempt < 10_000) {
    const suffix = `_${attempt}`;
    const candidate = `${normalizedBase.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`;
    if (!usedCodes.has(candidate)) return candidate;
    attempt += 1;
  }

  return `${normalizedBase.slice(0, 32)}_${Date.now().toString().slice(-7)}`;
}

async function syncLegacyCategories(db: DbExecutor, ownerUserId: string) {
  if (!(await isLegacyJournalSchema()) || !(await hasPlanningTables())) {
    const existing = await db.query(
      `SELECT id, code, name, direction, created_at
         FROM categories
        WHERE owner_user_id = $1
        ORDER BY name ASC`,
      [ownerUserId]
    );
    return existing.rows;
  }

  const [legacyCategoriesRes, existingCategoriesRes] = await Promise.all([
    db.query<{ name: string }>(
      `SELECT DISTINCT BTRIM(categoria) AS name
         FROM transacciones
        WHERE categoria IS NOT NULL
          AND BTRIM(categoria) <> ''
        ORDER BY BTRIM(categoria) ASC`
    ),
    db.query<{ id: number; code: string; name: string; direction: string; created_at: string }>(
      `SELECT id, code, name, direction, created_at
         FROM categories
        WHERE owner_user_id = $1
        ORDER BY name ASC`,
      [ownerUserId]
    ),
  ]);

  const existingByName = new Map(existingCategoriesRes.rows.map((row) => [normalizeCategoryName(row.name), row]));
  const usedCodes = new Set(existingCategoriesRes.rows.map((row) => String(row.code).toUpperCase()));

  for (const legacyCategory of legacyCategoriesRes.rows) {
    const rawName = legacyCategory.name?.trim();
    if (!rawName) continue;

    const normalizedName = normalizeCategoryName(rawName);
    if (existingByName.has(normalizedName)) continue;

    const code = buildAvailableCategoryCode(buildLegacyCategoryCode(rawName), usedCodes);
    const inserted = await db.query<{ id: number; code: string; name: string; direction: string; created_at: string }>(
      `INSERT INTO categories (owner_user_id, code, name, direction)
       VALUES ($1, $2, $3, 'BOTH')
       RETURNING id, code, name, direction, created_at`,
      [ownerUserId, code, rawName]
    );

    const row = inserted.rows[0];
    if (!row) continue;
    existingByName.set(normalizedName, row);
    usedCodes.add(String(row.code).toUpperCase());
  }

  const finalRows = await db.query<{ id: number; code: string; name: string; direction: string; created_at: string }>(
    `SELECT id, code, name, direction, created_at
       FROM categories
      WHERE owner_user_id = $1
      ORDER BY name ASC`,
    [ownerUserId]
  );
  return finalRows.rows;
}

function legacyAccountTypeToEnum(value: string | null | undefined): string {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("credito")) return "CREDIT_CARD";
  if (lower.includes("ahorro")) return "SAVINGS";
  if (lower.includes("corriente")) return "CHECKING";
  if (lower.includes("cash") || lower.includes("efectivo")) return "CASH";
  if (lower.includes("inver")) return "INVESTMENT";
  if (lower.includes("loan") || lower.includes("prest")) return "LOAN";
  return "OTHER";
}

type DbExecutor = {
  query: <T = any>(text: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>;
};

type BudgetEvaluation = {
  id: number;
  name: string;
  period: string;
  currency: string;
  start_date: string;
  end_date: string;
  created_at: string;
  lines: Array<{
    id: number;
    category_id: number;
    category_name: string;
    limit_amount: number;
    actual_amount: number;
    remaining_amount: number;
  }>;
  fundingAccounts: Array<{
    accountId: number;
    accountName: string;
    currency: string;
    balanceCurrent: number;
  }>;
  allocated_amount: number;
  actual_amount: number;
  remaining_budget_amount: number;
  funding_balance: number;
  funding_remaining_amount: number;
  funding_shortfall_amount: number;
  deficit_summary: {
    status: "healthy" | "warning" | "over_budget" | "underfunded";
    deficitAmount: number;
    incidentCount: number;
    latestEventType: string | null;
    lastCauseCode: string | null;
    lastCauseSummary: string | null;
    lastDetectedAt: string | null;
  };
};

async function loadBudgetEvaluationsForMonth(
  db: DbExecutor,
  month: string,
  ownerUserId?: string,
  accessScope?: { budgetIds?: string[]; transactionIds?: string[]; accountIds?: string[] }
) {
  const from = monthStartFromYYYYMM(month);
  const to = monthEndFromYYYYMM(month);
  const budgetValues: any[] = [from, to];
  const budgetWhere: string[] = ["b.start_date <= $2::date", "b.end_date >= $1::date"];
  if (ownerUserId) {
    budgetValues.push(ownerUserId);
    budgetWhere.push(`b.owner_user_id = $${budgetValues.length}`);
  }
  if (accessScope?.budgetIds) {
    budgetValues.push(accessScope.budgetIds.map(Number));
    budgetWhere.push(`b.id = ANY($${budgetValues.length}::bigint[])`);
  }

  const budgetsRes = await db.query<any>(
    `SELECT b.id, b.name, b.period, b.currency, b.start_date, b.end_date, b.created_at
       FROM budgets b
      WHERE ${budgetWhere.join(" AND ")}
      ORDER BY b.start_date DESC, b.id DESC`,
    budgetValues
  );

  const budgetIds = budgetsRes.rows.map((row) => Number(row.id));
  if (budgetIds.length === 0) return [];

  const [linesRes, spentRes, fundingRes, activeAccountsRes, deficitEventsRes] = await Promise.all([
    db.query<any>(
      `SELECT bl.id, bl.budget_id, bl.category_id, bl.limit_amount, c.name AS category_name
         FROM budget_lines bl
    LEFT JOIN categories c ON c.id = bl.category_id
        WHERE bl.budget_id = ANY($1::bigint[])
        ORDER BY bl.id ASC`,
      [budgetIds]
    ),
    db.query<any>(
      `SELECT t.category_id, SUM(t.amount)::numeric AS spent
         FROM transactions t
        WHERE t.transaction_date BETWEEN $1::date AND $2::date
          AND t.direction = 'OUTFLOW'
          AND t.status IN ('POSTED', 'RECONCILED')
          ${ownerUserId ? "AND t.owner_user_id = $3" : accessScope?.transactionIds ? "AND t.id = ANY($3::bigint[])" : ""}
        GROUP BY t.category_id`,
      ownerUserId ? [from, to, ownerUserId] : accessScope?.transactionIds ? [from, to, accessScope.transactionIds.map(Number)] : [from, to]
    ),
    db.query<any>(
      `SELECT bfa.budget_id,
              a.id AS account_id,
              a.name AS account_name,
              a.currency,
              a.balance_current,
              a.is_active
         FROM budget_funding_accounts bfa
         JOIN accounts a ON a.id = bfa.account_id
        WHERE bfa.budget_id = ANY($1::bigint[])
        ORDER BY a.name ASC`,
      [budgetIds]
    ),
    db.query<any>(
      `SELECT id, name, currency, balance_current
         FROM accounts
        WHERE is_active = TRUE
          ${ownerUserId ? "AND owner_user_id = $1" : accessScope?.accountIds ? "AND id = ANY($1::bigint[])" : ""}
        ORDER BY name ASC`
      ,
      ownerUserId ? [ownerUserId] : accessScope?.accountIds ? [accessScope.accountIds.map(Number)] : []
    ),
    db.query<any>(
      `SELECT id, budget_id, event_type, detected_at, deficit_amount, funding_shortfall_amount, cause_code, cause_summary
         FROM budget_deficit_events
        WHERE period_month = $1
          AND budget_id = ANY($2::bigint[])
        ORDER BY detected_at DESC, id DESC`,
      [month, budgetIds]
    ),
  ]);

  const spentByCategory = new Map<number, number>();
  for (const row of spentRes.rows) {
    spentByCategory.set(Number(row.category_id || 0), normalizeAmount(row.spent));
  }

  const linesByBudget = new Map<number, BudgetEvaluation["lines"]>();
  for (const row of linesRes.rows) {
    const budgetId = Number(row.budget_id);
    const lines = linesByBudget.get(budgetId) || [];
    const spent = spentByCategory.get(Number(row.category_id || 0)) || 0;
    const limitAmount = normalizeAmount(row.limit_amount);
    lines.push({
      id: Number(row.id),
      category_id: Number(row.category_id),
      category_name: row.category_name || "Sin categoria",
      limit_amount: limitAmount,
      actual_amount: spent,
      remaining_amount: normalizeAmount(limitAmount - spent),
    });
    linesByBudget.set(budgetId, lines);
  }

  const mappedFundingAccountsByBudget = new Map<number, BudgetEvaluation["fundingAccounts"]>();
  for (const row of fundingRes.rows) {
    const budgetId = Number(row.budget_id);
    const list = mappedFundingAccountsByBudget.get(budgetId) || [];
    list.push({
      accountId: Number(row.account_id),
      accountName: row.account_name,
      currency: row.currency || "COP",
      balanceCurrent: normalizeAmount(row.balance_current),
    });
    mappedFundingAccountsByBudget.set(budgetId, list);
  }

  const allActiveFundingAccounts = activeAccountsRes.rows.map((row) => ({
    accountId: Number(row.id),
    accountName: row.name,
    currency: row.currency || "COP",
    balanceCurrent: normalizeAmount(row.balance_current),
  }));

  const latestEventByBudget = new Map<number, any>();
  const incidentCountByBudget = new Map<number, number>();
  for (const row of deficitEventsRes.rows) {
    const budgetId = Number(row.budget_id);
    if (!latestEventByBudget.has(budgetId)) {
      latestEventByBudget.set(budgetId, row);
    }
    incidentCountByBudget.set(budgetId, (incidentCountByBudget.get(budgetId) || 0) + 1);
  }

  return budgetsRes.rows.map((budget) => {
    const budgetId = Number(budget.id);
    const lines = linesByBudget.get(budgetId) || [];
    const allocatedAmount = normalizeAmount(lines.reduce((acc, line) => acc + line.limit_amount, 0));
    const actualAmount = normalizeAmount(lines.reduce((acc, line) => acc + line.actual_amount, 0));
    const remainingBudgetAmount = normalizeAmount(allocatedAmount - actualAmount);
    const fundingAccounts = mappedFundingAccountsByBudget.get(budgetId) || allActiveFundingAccounts;
    const fundingBalance = normalizeAmount(fundingAccounts.reduce((acc, account) => acc + account.balanceCurrent, 0));
    const fundingRemainingAmount = normalizeAmount(fundingBalance - allocatedAmount);
    const fundingShortfallAmount = normalizeAmount(Math.max(0, allocatedAmount - fundingBalance));
    const overBudgetAmount = normalizeAmount(Math.max(0, -remainingBudgetAmount));
    const deficitAmount = normalizeAmount(Math.max(overBudgetAmount, fundingShortfallAmount));
    const latestEvent = latestEventByBudget.get(budgetId) || null;

    let status: BudgetEvaluation["deficit_summary"]["status"] = "healthy";
    if (overBudgetAmount > 0) status = "over_budget";
    else if (fundingShortfallAmount > 0) status = "underfunded";
    else if (allocatedAmount > 0 && actualAmount / allocatedAmount >= 0.85) status = "warning";

    return {
      id: budgetId,
      name: budget.name,
      period: budget.period,
      currency: budget.currency,
      start_date: budget.start_date,
      end_date: budget.end_date,
      created_at: budget.created_at,
      lines,
      fundingAccounts,
      allocated_amount: allocatedAmount,
      actual_amount: actualAmount,
      remaining_budget_amount: remainingBudgetAmount,
      funding_balance: fundingBalance,
      funding_remaining_amount: fundingRemainingAmount,
      funding_shortfall_amount: fundingShortfallAmount,
      deficit_summary: {
        status,
        deficitAmount,
        incidentCount: incidentCountByBudget.get(budgetId) || 0,
        latestEventType: latestEvent?.event_type || null,
        lastCauseCode: latestEvent?.cause_code || null,
        lastCauseSummary: latestEvent?.cause_summary || null,
        lastDetectedAt: latestEvent?.detected_at || null,
      },
    };
  });
}

async function syncBudgetDeficitEvents(db: DbExecutor, month: string, ownerUserId?: string) {
  const evaluations = await loadBudgetEvaluationsForMonth(db, month, ownerUserId);
  if (evaluations.length === 0) return evaluations;

  const budgetIds = evaluations.map((budget) => budget.id);
  const existingRes = await db.query<any>(
    `SELECT id,
            budget_id,
            budget_line_id,
            event_type,
            detected_at,
            deficit_amount,
            funding_shortfall_amount,
            budget_remaining_amount,
            funding_remaining_amount,
            cause_code,
            cause_summary,
            resolved_at
      FROM budget_deficit_events
      WHERE period_month = $1
        AND budget_id = ANY($2::bigint[])
        ${ownerUserId ? "AND owner_user_id = $3" : ""}
      ORDER BY detected_at ASC, id ASC`,
    ownerUserId ? [month, budgetIds, ownerUserId] : [month, budgetIds]
  );

  const existingByBudget = new Map<number, any[]>();
  for (const row of existingRes.rows) {
    const budgetId = Number(row.budget_id);
    const list = existingByBudget.get(budgetId) || [];
    list.push(row);
    existingByBudget.set(budgetId, list);
  }

  for (const budget of evaluations) {
    const overBudgetAmount = normalizeAmount(Math.max(0, -budget.remaining_budget_amount));
    const fundingShortfallAmount = normalizeAmount(Math.max(0, budget.funding_shortfall_amount));
    const deficitAmount = normalizeAmount(Math.max(overBudgetAmount, fundingShortfallAmount));
    const isDeficit = deficitAmount > 0;
    const cause = buildDeficitCause({
      overBudgetAmount,
      fundingShortfallAmount,
      hasFundingAccounts: budget.fundingAccounts.length > 0,
    });

    const history = existingByBudget.get(budget.id) || [];
    const openEvents = history.filter((event) => event.resolved_at == null && event.event_type !== "EXITED_DEFICIT");
    const latestOpenEvent = openEvents[openEvents.length - 1] || null;

    if (!isDeficit) {
      if (latestOpenEvent) {
        const openIds = openEvents.map((event) => Number(event.id));
        await db.query(`UPDATE budget_deficit_events SET resolved_at = NOW() WHERE id = ANY($1::bigint[])`, [openIds]);
        await db.query(
          `INSERT INTO budget_deficit_events (
             budget_id,
             budget_line_id,
             event_type,
             period_month,
             deficit_amount,
             funding_shortfall_amount,
             budget_remaining_amount,
             funding_remaining_amount,
             cause_code,
             cause_summary,
             metadata,
             resolved_at
           )
           VALUES ($1, NULL, 'EXITED_DEFICIT', $2, 0, 0, $3, $4, 'NONE', 'El presupuesto salio de deficit.', $5::jsonb, NOW())`,
          [
            budget.id,
            month,
            budget.remaining_budget_amount,
            budget.funding_remaining_amount,
            JSON.stringify({
              budgetName: budget.name,
              allocatedAmount: budget.allocated_amount,
              actualAmount: budget.actual_amount,
            }),
          ]
        );
      }
      continue;
    }

    if (!latestOpenEvent) {
      await db.query(
        `INSERT INTO budget_deficit_events (
           budget_id,
           budget_line_id,
           event_type,
           period_month,
           deficit_amount,
           funding_shortfall_amount,
           budget_remaining_amount,
           funding_remaining_amount,
           cause_code,
           cause_summary,
           metadata
         )
         VALUES ($1, NULL, 'ENTERED_DEFICIT', $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          budget.id,
          month,
          deficitAmount,
          fundingShortfallAmount,
          budget.remaining_budget_amount,
          budget.funding_remaining_amount,
          cause.code,
          cause.summary,
          JSON.stringify({
            budgetName: budget.name,
            allocatedAmount: budget.allocated_amount,
            actualAmount: budget.actual_amount,
          }),
        ]
      );
      continue;
    }

    const prevDeficitAmount = normalizeAmount(latestOpenEvent.deficit_amount);
    const prevFundingShortfall = normalizeAmount(latestOpenEvent.funding_shortfall_amount);
    const prevBudgetRemaining = normalizeAmount(latestOpenEvent.budget_remaining_amount);
    const prevCauseCode = String(latestOpenEvent.cause_code || "");
    const hasMeaningfulChange =
      materiallyChanged(deficitAmount, prevDeficitAmount) ||
      materiallyChanged(fundingShortfallAmount, prevFundingShortfall) ||
      materiallyChanged(budget.remaining_budget_amount, prevBudgetRemaining) ||
      prevCauseCode !== cause.code;

    if (!hasMeaningfulChange) continue;

    const eventType = deficitAmount > prevDeficitAmount ? "DEFICIT_WORSENED" : "DEFICIT_IMPROVED";
    await db.query(
      `INSERT INTO budget_deficit_events (
         budget_id,
         budget_line_id,
         event_type,
         period_month,
         deficit_amount,
         funding_shortfall_amount,
         budget_remaining_amount,
         funding_remaining_amount,
         cause_code,
         cause_summary,
         metadata
       )
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        budget.id,
        eventType,
        month,
        deficitAmount,
        fundingShortfallAmount,
        budget.remaining_budget_amount,
        budget.funding_remaining_amount,
        cause.code,
        cause.summary,
        JSON.stringify({
          budgetName: budget.name,
          allocatedAmount: budget.allocated_amount,
          actualAmount: budget.actual_amount,
        }),
      ]
    );
  }

  return loadBudgetEvaluationsForMonth(db, month, ownerUserId);
}

function enumAccountTypeToLegacy(value: string | null | undefined): string {
  const normalized = String(value || "OTHER").toUpperCase();
  if (normalized === "CREDIT_CARD") return "credito";
  if (normalized === "SAVINGS") return "ahorro";
  if (normalized === "CHECKING") return "corriente";
  if (normalized === "CASH") return "efectivo";
  if (normalized === "INVESTMENT") return "inversion";
  if (normalized === "LOAN") return "prestamo";
  return "otro";
}

function legacyTxTypeToDirection(value: string | null | undefined): "INFLOW" | "OUTFLOW" {
  const lower = String(value || "").toLowerCase();
  return lower === "ingreso" ? "INFLOW" : "OUTFLOW";
}

function legacyTxStatusToEnum(value: string | null | undefined): "PENDING" | "POSTED" | "RECONCILED" | "VOID" {
  const lower = String(value || "").toLowerCase();
  if (lower === "realizado") return "POSTED";
  if (lower === "reconciled") return "RECONCILED";
  if (lower === "void") return "VOID";
  return "PENDING";
}

async function getLegacyDefaultUserId() {
  const configured = (process.env.COPILOT_DEFAULT_USER_ID || "").trim();
  if (configured) return configured;
  const userResult = await query<{ id: string }>(`SELECT id::text AS id FROM "User" ORDER BY id LIMIT 1`);
  if (!userResult.rowCount) {
    throw new ApiError(503, "LEGACY_USER_MISSING", `No hay usuarios en tabla "User" para crear sesiones de Copilot.`);
  }
  return String(userResult.rows[0].id);
}

function isImageDataUrl(value: string) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

function isBase64DataUrl(value: string) {
  return /^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

function parseDataUrl(value: string): { mimeType: string; base64: string } | null {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

type CopilotAttachment = z.infer<typeof copilotAttachmentSchema>;

type CopilotProvider = "openai" | "google" | "nvidia";

type CopilotModelOption = {
  id: string;
  label: string;
  provider: CopilotProvider;
  enabled: boolean;
  reason?: string;
};

function getCopilotModelsConfig() {
  const openaiConfigured = Boolean((process.env.OPENAI_API_KEY || "").trim());
  const googleConfigured = Boolean((process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim());
  const nvidiaConfigured = Boolean((process.env.NVIDIA_API_KEY || "").trim());

  const catalog: Array<Omit<CopilotModelOption, "enabled" | "reason">> = [
    { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (Preview)", provider: "google" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "google" },
    { id: "glm-5.1", label: "GLM 5.1 (NVIDIA)", provider: "nvidia" },
    { id: "kimi-k2.5", label: "Kimi K2.5 (NVIDIA)", provider: "nvidia" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "google" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google" },
    { id: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
    { id: "gpt-5.2-pro", label: "GPT-5.2 Pro", provider: "openai" },
    { id: "gpt-5-mini", label: "GPT-5 Mini", provider: "openai" },
    { id: "gpt-5-nano", label: "GPT-5 Nano", provider: "openai" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "openai" },
    { id: "gpt-4.1", label: "GPT-4.1", provider: "openai" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  ];

  const options: CopilotModelOption[] = catalog.map((item) => {
    if (item.provider === "openai") {
      return { ...item, enabled: openaiConfigured, reason: openaiConfigured ? undefined : "OPENAI_API_KEY no configurada" };
    }
    if (item.provider === "google") {
      return { ...item, enabled: googleConfigured, reason: googleConfigured ? undefined : "GOOGLE_GENERATIVE_AI_API_KEY no configurada" };
    }
    return { ...item, enabled: nvidiaConfigured, reason: nvidiaConfigured ? undefined : "NVIDIA_API_KEY no configurada" };
  });

  const preferredDefault = (process.env.COPILOT_DEFAULT_MODEL || "glm-5.1").trim();
  const enabledOptions = options.filter((item) => item.enabled);
  const defaultModel = options.some((item) => item.id === preferredDefault)
    ? preferredDefault
    : enabledOptions[0]?.id || options[0]?.id || "gemini-2.5-flash-lite";

  const models = options.map((item) => item.id);

  return {
    options,
    models,
    defaultModel,
    providers: {
      openaiConfigured,
      googleConfigured,
      nvidiaConfigured,
    },
  };
}

function resolveNvidiaModelId(model: string) {
  const normalized = model.trim().toLowerCase();
  if (normalized === "glm-5.1") {
    return (process.env.GLM_MODEL_ID || "z-ai/glm-5.1").trim();
  }
  if (normalized === "kimi-k2.5") {
    return (process.env.KIMI_MODEL_ID || "moonshotai/kimi-k2.5").trim();
  }
  return model;
}

function resolveCopilotModel(selectedModel?: string) {
  const cfg = getCopilotModelsConfig();
  const requestedModel = (selectedModel || cfg.defaultModel).trim();
  const selected = cfg.options.find((item) => item.id === requestedModel);

  if (!selected) {
    return {
      requestedModel,
      resolvedModel: null,
      fallbackReason: "Modelo no reconocido.",
      error: new ApiError(400, "MODEL_NOT_FOUND", `Modelo no reconocido: ${requestedModel}`),
    };
  }

  if (selected.provider === "openai" && !cfg.providers.openaiConfigured) {
    return {
      requestedModel,
      resolvedModel: null,
      fallbackReason: "OPENAI_API_KEY no configurada.",
      error: new ApiError(503, "OPENAI_KEY_MISSING", "OPENAI_API_KEY no configurada."),
    };
  }

  if (selected.provider === "google" && !cfg.providers.googleConfigured) {
    return {
      requestedModel,
      resolvedModel: null,
      fallbackReason: "GOOGLE_GENERATIVE_AI_API_KEY no configurada.",
      error: new ApiError(503, "GOOGLE_KEY_MISSING", "GOOGLE_GENERATIVE_AI_API_KEY no configurada."),
    };
  }

  if (selected.provider === "nvidia" && !cfg.providers.nvidiaConfigured) {
    return {
      requestedModel,
      resolvedModel: null,
      fallbackReason: "NVIDIA_API_KEY no configurada.",
      error: new ApiError(503, "NVIDIA_KEY_MISSING", "NVIDIA_API_KEY no configurada."),
    };
  }

  return {
    requestedModel,
    resolvedModel: selected.id,
    provider: selected.provider,
    fallbackReason: undefined,
    error: null,
  };
}

class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  details?: unknown;

  constructor(statusCode: number, errorCode: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

async function getDefaultFinanceOwnerUserId() {
  const result = await query<{ id: string }>(`SELECT id FROM auth_users ORDER BY created_at ASC, id ASC LIMIT 1`);
  return result.rows[0]?.id || null;
}

async function getRequestOwnerUserId(req: any) {
  const auth = req.auth as { userId?: string } | undefined;
  if (auth?.userId) {
    return auth.userId;
  }

  if (isInternalFinanceRequest(req)) {
    const fallback = await getDefaultFinanceOwnerUserId();
    if (fallback) return fallback;
  }

  throw new ApiError(401, "AUTH_REQUIRED", "Autenticacion requerida.");
}

async function buildCopilotContext(ownerUserId?: string) {
  if (await isLegacyJournalSchema()) {
    const [summaryRes, accountsRes, txRes] = await Promise.all([
      query<{ total_balance: string; inflow: string; outflow: string }>(
        `SELECT
           COALESCE((SELECT SUM(saldo_actual) FROM cuentas), 0)::text AS total_balance,
           COALESCE((SELECT SUM(monto) FROM transacciones WHERE LOWER(tipo) = 'ingreso' AND fecha_transaccion >= date_trunc('month', CURRENT_DATE)), 0)::text AS inflow,
           COALESCE((SELECT SUM(monto) FROM transacciones WHERE LOWER(tipo) <> 'ingreso' AND fecha_transaccion >= date_trunc('month', CURRENT_DATE)), 0)::text AS outflow`
      ),
      query<{
        id: number;
        name: string;
        currency: string;
        balance_current: string;
        account_type: string;
      }>(
        `SELECT id,
                nombre AS name,
                COALESCE(moneda, 'COP') AS currency,
                COALESCE(saldo_actual, 0)::text AS balance_current,
                COALESCE(tipo, 'otro') AS account_type
           FROM cuentas
          ORDER BY saldo_actual DESC
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
        `SELECT t.fecha_transaccion::text AS transaction_date,
                t.descripcion AS description,
                t.monto::text AS amount,
                COALESCE(t.moneda, 'COP') AS currency,
                CASE WHEN LOWER(t.tipo) = 'ingreso' THEN 'INFLOW' ELSE 'OUTFLOW' END::text AS direction,
                COALESCE(c.nombre, 'Sin cuenta') AS account_name
           FROM transacciones t
      LEFT JOIN cuentas c ON c.id = t.cuenta_id
          ORDER BY t.fecha_transaccion DESC, t.id DESC
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

  const accessibleAccountIds = ownerUserId ? await getAccessibleAccountIds(ownerUserId, "READ") : [];
  const accessibleTransactionIds = ownerUserId ? await getAccessibleTransactionIds(ownerUserId, "READ") : [];
  const [summaryRes, accountsRes, txRes] = await Promise.all([
    query<{ total_balance: string; inflow: string; outflow: string }>(
      `SELECT
         COALESCE((SELECT SUM(balance_current) FROM accounts WHERE is_active = TRUE AND id = ANY($1::bigint[])), 0)::text AS total_balance,
         COALESCE((SELECT SUM(amount) FROM transactions WHERE direction = 'INFLOW' AND transaction_date >= date_trunc('month', CURRENT_DATE)::date AND id = ANY($2::bigint[])), 0)::text AS inflow,
         COALESCE((SELECT SUM(amount) FROM transactions WHERE direction = 'OUTFLOW' AND transaction_date >= date_trunc('month', CURRENT_DATE)::date AND id = ANY($2::bigint[])), 0)::text AS outflow`,
      [accessibleAccountIds.map(Number), accessibleTransactionIds.map(Number)]
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
          AND id = ANY($1::bigint[])
        ORDER BY balance_current DESC
        LIMIT 8`,
      [accessibleAccountIds.map(Number)]
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
        WHERE t.id = ANY($1::bigint[])
        ORDER BY t.transaction_date DESC, t.id DESC
        LIMIT 12`,
      [accessibleTransactionIds.map(Number)]
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
      lines.push("No hay cuentas activas registradas todavÃ­a.");
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
    lines.push("Puedo ayudarte con saldos, flujo mensual, cuentas, transacciones y organizaciÃ³n financiera.");
    lines.push(`Ahora mismo tu saldo consolidado es ${formatMoney(context.totalBalance, "COP")}.`);
    lines.push("Si quieres, pÃ­deme algo concreto como: 'muÃ©strame gastos del mes' o 'resumen de cuentas'.");
  }

  return lines.join("\n");
}

function buildAgentProposalsFromMessage(message: string) {
  const lower = message.toLowerCase();
  const proposals: Array<{
    proposalType: "CREATE_DASHBOARD" | "CREATE_REMINDER" | "CREATE_PROJECTION" | "CODE_CHANGE_REQUEST" | "WRITE_OPERATION";
    title: string;
    summary: string;
    payload: Record<string, unknown>;
  }> = [];

  if (lower.includes("dashboard") || lower.includes("tablero") || lower.includes("tab nuevo")) {
    const title = guessTitleFromMessage(message).replace(/\.\.\.$/, "");
    proposals.push({
      proposalType: "CREATE_DASHBOARD",
      title: `Dashboard IA: ${title}`,
      summary: "Crear dashboard dinamico con widgets financieros configurables.",
      payload: {
        layout: "GRID",
        source: "agent-chat",
        requestedBy: "user",
      },
    });
  }

  if (lower.includes("recordatorio") || lower.includes("recuerd") || lower.includes("cada mes") || lower.includes("correo")) {
    proposals.push({
      proposalType: "CREATE_REMINDER",
      title: "Recordatorio financiero recurrente",
      summary: "Crear recordatorio recurrente para seguimiento financiero y enviarlo por el canal solicitado.",
      payload: {
        cadence: "MONTHLY",
        channel: "EMAIL",
      },
    });
  }

  if (lower.includes("proyeccion") || lower.includes("interes") || lower.includes("deuda") || lower.includes("amortizacion")) {
    proposals.push({
      proposalType: "CREATE_PROJECTION",
      title: "Proyeccion financiera automatizada",
      summary: "Generar escenario de proyeccion para deuda/intereses y registrar supuestos.",
      payload: {
        scenarioType: "DEBT_PAYOFF",
      },
    });
  }

  if (lower.includes("grafico nuevo") || lower.includes("widget nuevo") || lower.includes("no existe")) {
    proposals.push({
      proposalType: "CODE_CHANGE_REQUEST",
      title: "Solicitud de componente nuevo",
      summary: "El usuario pidio un grafico/widget fuera del catalogo actual; requiere implementacion de codigo.",
      payload: {
        flow: "engineering-pr",
      },
    });
  }

  if (lower.includes("presupuesto") || lower.includes("budget") || lower.includes("tope por categoria") || lower.includes("gasto maximo")) {
    proposals.push({
      proposalType: "WRITE_OPERATION",
      title: "Crear o actualizar presupuesto mensual",
      summary: "Registrar presupuesto por categorias y objetivos de ahorro/inversion con aprobacion previa.",
      payload: {
        action: "UPSERT_BUDGET",
        period: "MONTHLY",
      },
    });
  }

  return proposals;
}

async function buildOpenAIReply(
  userMessage: string,
  context: Awaited<ReturnType<typeof buildCopilotContext>>,
  selectedModel?: string,
  attachments?: CopilotAttachment[]
) {
  const resolution = resolveCopilotModel(selectedModel);
  if (resolution.error) throw resolution.error;
  if (!resolution.resolvedModel) {
    throw new ApiError(400, "MODEL_RESOLUTION_FAILED", "No se pudo resolver el modelo solicitado.");
  }

  const provider = resolution.provider as CopilotProvider;
  const model = resolution.resolvedModel;

  const system = [
    "Eres un copiloto financiero en espaÃ±ol.",
    "Responde de forma concreta, tÃ©cnica y accionable.",
    "No inventes datos: usa exclusivamente el contexto provisto.",
    "Si faltan datos, dilo explÃ­citamente.",
  ].join(" ");

  const contextText = [
    `Saldo total: ${context.totalBalance}`,
    `Ingresos mes: ${context.monthInflow}`,
    `Egresos mes: ${context.monthOutflow}`,
    `Cuentas: ${context.accounts.map((a) => `${a.name}:${a.balance_current}${a.currency}`).join(" | ") || "ninguna"}`,
    `Transacciones recientes: ${context.recentTransactions.map((t) => `${t.transaction_date} ${t.description || "Sin descripcion"} ${t.direction} ${t.amount}${t.currency}`).join(" | ") || "ninguna"}`,
  ].join("\n");

  if (provider === "google") {
    const googleApiKey = (process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim();
    if (!googleApiKey) throw new ApiError(503, "GOOGLE_KEY_MISSING", "GOOGLE_GENERATIVE_AI_API_KEY no configurada.");

    const contents: any[] = [{ role: "user", parts: [{ text: `Contexto:\n${contextText}\n\nPregunta:\n${userMessage}` }] }];
    for (const attachment of attachments || []) {
      const parsed = parseDataUrl(attachment.dataUrl);
      if (!parsed) continue;
      if (attachment.kind === "image") {
        contents[0].parts.push({
          inline_data: {
            mime_type: parsed.mimeType,
            data: parsed.base64,
          },
        });
      }
    }

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(googleApiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
          }),
        }
      );
    } catch (error: any) {
      throw new ApiError(
        502,
        "GOOGLE_FETCH_FAILED",
        `No se pudo conectar con Gemini (${model}).`,
        { cause: error?.message || String(error) }
      );
    }
    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(502, "GOOGLE_UPSTREAM_ERROR", data?.error?.message || `Gemini error ${res.status}`);
    }
    const replyText = Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts
          .map((part: any) => String(part?.text || ""))
          .join("\n")
          .trim()
      : "";

    return {
      reply: replyText || null,
      requestedModel: resolution.requestedModel,
      resolvedModel: resolution.resolvedModel,
      fallbackReason: resolution.fallbackReason,
    };
  }

  if (provider === "nvidia") {
    const nvidiaApiKey = (process.env.NVIDIA_API_KEY || "").trim();
    const nvidiaBaseUrl = (process.env.NVIDIA_API_BASE_URL || "https://integrate.api.nvidia.com/v1").trim();
    if (!nvidiaApiKey) throw new ApiError(503, "NVIDIA_KEY_MISSING", "NVIDIA_API_KEY no configurada.");

    const nvidiaModelId = resolveNvidiaModelId(model);
    let res: Response;
    try {
      res = await fetch(`${nvidiaBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${nvidiaApiKey}`,
        },
        body: JSON.stringify({
          model: nvidiaModelId,
          messages: [
            { role: "system", content: system },
            { role: "user", content: `Contexto:\n${contextText}\n\nPregunta:\n${userMessage}` },
          ],
          temperature: 0.2,
        }),
      });
    } catch (error: any) {
      throw new ApiError(
        502,
        "NVIDIA_FETCH_FAILED",
        `No se pudo conectar con NVIDIA NIM (${nvidiaBaseUrl}).`,
        { cause: error?.message || String(error) }
      );
    }

    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(502, "NVIDIA_UPSTREAM_ERROR", data?.error?.message || `NVIDIA error ${res.status}`);
    }

    const replyText = String(data?.choices?.[0]?.message?.content || "").trim();
    return {
      reply: replyText || null,
      requestedModel: resolution.requestedModel,
      resolvedModel: nvidiaModelId,
      fallbackReason: resolution.fallbackReason,
    };
  }

  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new ApiError(503, "OPENAI_KEY_MISSING", "OPENAI_API_KEY no configurada.");

  const payload = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: system }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: `Contexto:\n${contextText}\n\nPregunta:\n${userMessage}` },
          ...((attachments || [])
            .filter((item) => isBase64DataUrl(item.dataUrl))
            .map((item) => {
              if (item.kind === "image" && isImageDataUrl(item.dataUrl)) {
                return {
                  type: "input_image",
                  image_url: item.dataUrl,
                };
              }
              return {
                type: "input_file",
                filename: item.name,
                file_data: item.dataUrl,
              };
            }) as any[]),
        ],
      },
    ],
    temperature: 0.2,
  };

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    throw new ApiError(502, "OPENAI_FETCH_FAILED", "No se pudo conectar con OpenAI.", {
      cause: error?.message || String(error),
    });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data: any = await res.json();

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return {
      reply: data.output_text.trim(),
      requestedModel: resolution.requestedModel,
      resolvedModel: resolution.resolvedModel,
      fallbackReason: resolution.fallbackReason,
    };
  }

  const chunks: string[] = [];
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return {
    reply: chunks.join("\n").trim() || null,
    requestedModel: resolution.requestedModel,
    resolvedModel: resolution.resolvedModel,
    fallbackReason: resolution.fallbackReason,
  };
}

app.get("/health", async () => ({
  ok: true,
  service: "finance-system-api",
  at: new Date().toISOString(),
}));

app.get("/", async () => ({
  message: "FinanceSystem API",
  health: "/health",
}));

app.get("/ready", async (_req, reply) => {
  try {
    await query("SELECT 1");
    return { ok: true, db: true };
  } catch (error: any) {
    return reply.code(503).send({ ok: false, db: false, error: error?.message || "db not ready" });
  }
});

app.get("/v1/auth/config", async (_req, reply) => {
  return reply.send({
    data: getAuthPublicConfig(),
  });
});

app.get("/v1/auth/me", async (req, reply) => {
  const session = await resolveFinanceSession(req);
  if (!session) {
    return reply.code(401).send({
      error: "Autenticacion requerida.",
      code: "AUTH_REQUIRED",
    });
  }

  return reply.send({
    data: session,
  });
});

app.post("/v1/auth/google/exchange", async (req, reply) => {
  const parsed = authGoogleExchangeSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const { tokens, profile } = await exchangeGoogleAuthorizationCode({
      code: parsed.data.code,
      codeVerifier: parsed.data.codeVerifier,
      redirectUri: parsed.data.redirectUri,
      state: parsed.data.state,
    });

    return reply.send({
      data: {
        tokens,
        profile,
      },
    });
  } catch (error: any) {
    const authFailure = classifyAuthFailure(error, "AUTH_GOOGLE_EXCHANGE_FAILED");
    app.log.warn(
      {
        code: authFailure.code,
        statusCode: authFailure.statusCode,
        message: authFailure.message,
      },
      "auth google exchange failed"
    );
    return reply.code(authFailure.statusCode).send({
      error: authFailure.message,
      code: authFailure.code,
    });
  }
});

app.post("/v1/auth/email/login", async (req, reply) => {
  const parsed = authEmailSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const { tokens, profile } = await loginWithEmailPassword(parsed.data);
    return reply.send({
      data: {
        tokens,
        profile,
      },
    });
  } catch (error: any) {
    const authFailure = classifyAuthFailure(error, "AUTH_EMAIL_LOGIN_FAILED");
    app.log.warn(
      {
        code: authFailure.code,
        statusCode: authFailure.statusCode,
        message: authFailure.message,
      },
      "auth email login failed"
    );
    return reply.code(authFailure.statusCode).send({
      error: authFailure.message,
      code: authFailure.code,
    });
  }
});

app.post("/v1/auth/email/register", async (req, reply) => {
  const parsed = authRegisterSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const { tokens, profile } = await registerWithEmailPassword(parsed.data);
    return reply.send({
      data: {
        tokens,
        profile,
      },
    });
  } catch (error: any) {
    const authFailure = classifyAuthFailure(error, "AUTH_EMAIL_REGISTER_FAILED");
    app.log.warn(
      {
        code: authFailure.code,
        statusCode: authFailure.statusCode,
        message: authFailure.message,
      },
      "auth email register failed"
    );
    return reply.code(authFailure.statusCode).send({
      error: authFailure.message,
      code: authFailure.code,
    });
  }
});

app.post("/v1/auth/refresh", async (req, reply) => {
  const parsed = authRefreshSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const { tokens, profile } = await refreshAuthTokens(parsed.data.refreshToken);
    return reply.send({
      data: {
        tokens,
        profile,
      },
    });
  } catch (error: any) {
    const authFailure = classifyAuthFailure(error, "AUTH_REFRESH_FAILED");
    app.log.warn(
      {
        code: authFailure.code,
        statusCode: authFailure.statusCode,
        message: authFailure.message,
      },
      "auth refresh failed"
    );
    return reply.code(authFailure.statusCode).send({
      error: authFailure.message,
      code: authFailure.code,
    });
  }
});

app.post("/v1/auth/logout", async (req, reply) => {
  const parsed = authRefreshSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    await revokeRefreshToken(parsed.data.refreshToken);
    return reply.send({
      data: {
        ok: true,
      },
    });
  } catch (error: any) {
    const authFailure = classifyAuthFailure(error, "AUTH_LOGOUT_FAILED");
    app.log.warn(
      {
        code: authFailure.code,
        statusCode: authFailure.statusCode,
        message: authFailure.message,
      },
      "auth logout failed"
    );
    return reply.code(authFailure.statusCode).send({
      error: authFailure.message,
      code: authFailure.code,
    });
  }
});

app.get("/v1/settings/profile", async (req, reply) => {
  const userId = await getRequestOwnerUserId(req);
  const result = await query(
    `SELECT id, email, username, name, picture, auth_provider, email_verified, created_at, updated_at
       FROM auth_users
      WHERE id = $1
      LIMIT 1`,
    [userId]
  );
  if (!result.rows[0]) return reply.code(404).send({ error: "Perfil no encontrado." });
  return { data: result.rows[0] };
});

app.patch("/v1/settings/profile", async (req, reply) => {
  const parsed = settingsProfileSchema.safeParse((req as any).body || {});
  if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  const userId = await getRequestOwnerUserId(req);
  const payload = parsed.data;
  if (!Object.keys(payload).length) return reply.code(400).send({ error: "Empty payload" });

  if (payload.username) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM auth_users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1`,
      [payload.username, userId]
    );
    if (existing.rowCount) return reply.code(409).send({ error: "Ese nombre de usuario ya esta en uso.", code: "USERNAME_TAKEN" });
  }

  const result = await query(
    `UPDATE auth_users
        SET name = COALESCE($2, name),
            username = COALESCE($3, username),
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, username, name, picture, auth_provider, email_verified, created_at, updated_at`,
    [userId, payload.name || null, payload.username || null]
  );
  return { data: result.rows[0] };
});

app.get("/v1/settings/preferences", async (req) => {
  const userId = await getRequestOwnerUserId(req);
  const result = await query<{ preferences: Record<string, unknown> }>(`SELECT preferences FROM auth_users WHERE id = $1`, [userId]);
  return { data: result.rows[0]?.preferences || {} };
});

app.patch("/v1/settings/preferences", async (req, reply) => {
  const parsed = settingsPreferencesSchema.safeParse((req as any).body || {});
  if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  const userId = await getRequestOwnerUserId(req);
  const result = await query<{ preferences: Record<string, unknown> }>(
    `UPDATE auth_users
        SET preferences = COALESCE(preferences, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
      WHERE id = $1
      RETURNING preferences`,
    [userId, JSON.stringify(parsed.data)]
  );
  return { data: result.rows[0]?.preferences || {} };
});

app.get("/v1/settings/integrations", async (_req) => {
  return {
    data: {
      mastra: {
        enabled: agentRuntimeEnabled,
        mode: "internal",
        capabilities: ["finance-analysis", "proposals", "dashboards", "projections"],
      },
      mcp: {
        ...getFinanceMcpStatus(),
        mode: "internal",
        capabilities: getFinanceMcpToolList(),
      },
      hermes: {
        enabled: Boolean(String(process.env.HERMES_API_URL || process.env.HERMES_MCP_URL || "").trim()),
        mode: "external",
        configured: Boolean(String(process.env.HERMES_API_URL || process.env.HERMES_MCP_URL || "").trim()),
        capabilities: ["telegram", "scheduled-automation", "email"],
      },
    },
  };
});

app.get("/v1/friends", async (req) => {
  const userId = await getRequestOwnerUserId(req);
  const result = await query(`
    SELECT f.id, f.created_at, f.updated_at,
           other.id AS user_id, other.username, other.name, other.picture
      FROM finance_friendships f
      JOIN auth_users other
        ON other.id = CASE WHEN f.user_a_id = $1::uuid THEN f.user_b_id ELSE f.user_a_id END
     WHERE (f.user_a_id = $1::uuid OR f.user_b_id = $1::uuid)
       AND f.status = 'ACTIVE'
       AND other.is_active = TRUE
     ORDER BY LOWER(other.username) ASC`,
    [userId]
  );
  return { data: result.rows };
});

app.get("/v1/friends/requests", async (req) => {
  const userId = await getRequestOwnerUserId(req);
  const [received, sent] = await Promise.all([
    query(`
      SELECT r.id, r.status, r.created_at, r.updated_at,
             u.id AS user_id, u.username, u.name, u.picture
        FROM finance_friend_requests r
        JOIN auth_users u ON u.id = r.requester_user_id
       WHERE r.addressee_user_id = $1
       ORDER BY r.created_at DESC`, [userId]),
    query(`
      SELECT r.id, r.status, r.created_at, r.updated_at,
             u.id AS user_id, u.username, u.name, u.picture
        FROM finance_friend_requests r
        JOIN auth_users u ON u.id = r.addressee_user_id
       WHERE r.requester_user_id = $1
       ORDER BY r.created_at DESC`, [userId]),
  ]);
  return { data: { received: received.rows, sent: sent.rows } };
});

app.get("/v1/friends/lookup", async (req) => {
  const userId = await getRequestOwnerUserId(req);
  const username = String((req as any).query?.username || "").trim();
  if (!username) return { data: [] };

  const result = await query(`
    SELECT u.id, u.username, u.name, u.picture
      FROM auth_users u
     WHERE u.id <> $1
       AND LOWER(u.username) = LOWER($2)
       AND u.is_active = TRUE
       AND NOT EXISTS (
         SELECT 1
           FROM finance_friendships f
          WHERE f.status = 'ACTIVE'
            AND f.user_a_id = LEAST($1::uuid, u.id)
            AND f.user_b_id = GREATEST($1::uuid, u.id)
       )
     LIMIT 1`,
    [userId, username]
  );
  return { data: result.rows };
});

app.post("/v1/friends/requests", async (req, reply) => {
  const parsed = friendRequestSchema.safeParse((req as any).body || {});
  if (!parsed.success) return reply.code(400).send({ error: "Username invalido.", details: parsed.error.flatten() });

  const requesterId = await getRequestOwnerUserId(req);
  const target = await query<{ id: string; username: string; name: string | null; picture: string | null }>(
    `SELECT id, username, name, picture
       FROM auth_users
      WHERE LOWER(username) = LOWER($1)
        AND is_active = TRUE
      LIMIT 1`,
    [parsed.data.username]
  );
  const addressee = target.rows[0];
  if (!addressee) return reply.code(404).send({ error: "No encontramos ese nombre de usuario." });
  if (addressee.id === requesterId) return reply.code(400).send({ error: "No puedes enviarte una solicitud a ti mismo." });

  const existingFriendship = await query<{ id: string; status: string }>(
    `SELECT id, status
       FROM finance_friendships
      WHERE user_a_id = LEAST($1::uuid, $2::uuid)
        AND user_b_id = GREATEST($1::uuid, $2::uuid)
      LIMIT 1`,
    [requesterId, addressee.id]
  );
  if (existingFriendship.rows[0]?.status === "ACTIVE") {
    return reply.code(409).send({ error: "Ya son amigos." });
  }

  const pending = await query(
    `SELECT id
       FROM finance_friend_requests
      WHERE status = 'PENDING'
        AND LEAST(requester_user_id, addressee_user_id) = LEAST($1::uuid, $2::uuid)
        AND GREATEST(requester_user_id, addressee_user_id) = GREATEST($1::uuid, $2::uuid)
      LIMIT 1`,
    [requesterId, addressee.id]
  );
  if (pending.rows[0]) return reply.code(409).send({ error: "Ya existe una solicitud pendiente entre ustedes." });

  const created = await withTransaction(async (client) => {
    const request = await client.query<{ id: string }>(
      `INSERT INTO finance_friend_requests (requester_user_id, addressee_user_id, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING id`,
      [requesterId, addressee.id]
    );
    await client.query(
      `INSERT INTO finance_share_audit_log (actor_user_id, owner_user_id, grantee_user_id, action, metadata)
       VALUES ($1, $1, $2, 'FRIEND_REQUEST_CREATED', $3::jsonb)`,
      [requesterId, addressee.id, JSON.stringify({ requestId: request.rows[0].id })]
    );
    return request.rows[0].id;
  });

  return reply.code(201).send({ data: { id: created, status: "PENDING", user: addressee } });
});

app.post("/v1/friends/requests/:id/accept", async (req, reply) => {
  const requestId = String((req.params as any)?.id || "");
  const userId = await getRequestOwnerUserId(req);
  const request = await query<{ requester_user_id: string; addressee_user_id: string; status: string }>(
    `SELECT requester_user_id, addressee_user_id, status
       FROM finance_friend_requests
      WHERE id = $1 AND addressee_user_id = $2
      LIMIT 1`,
    [requestId, userId]
  );
  if (!request.rows[0]) return reply.code(404).send({ error: "Solicitud no encontrada." });
  if (request.rows[0].status !== "PENDING") return reply.code(409).send({ error: "La solicitud ya no esta pendiente." });

  const friendshipId = await withTransaction(async (client) => {
    const friendship = await client.query<{ id: string }>(
      `INSERT INTO finance_friendships (user_a_id, user_b_id, status)
       VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid), 'ACTIVE')
       ON CONFLICT (user_a_id, user_b_id)
       DO UPDATE SET status = 'ACTIVE', removed_at = NULL, updated_at = NOW()
       RETURNING id`,
      [request.rows[0].requester_user_id, userId]
    );
    await client.query(
      `UPDATE finance_friend_requests
          SET status = 'ACCEPTED', responded_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [requestId]
    );
    await client.query(
      `INSERT INTO finance_share_audit_log (actor_user_id, owner_user_id, grantee_user_id, action, metadata)
       VALUES ($1, $2, $1, 'FRIEND_REQUEST_ACCEPTED', $3::jsonb)`,
      [userId, request.rows[0].requester_user_id, JSON.stringify({ requestId, friendshipId: friendship.rows[0].id })]
    );
    return friendship.rows[0].id;
  });

  return { data: { id: requestId, status: "ACCEPTED", friendshipId } };
});

app.post("/v1/friends/requests/:id/reject", async (req, reply) => {
  const requestId = String((req.params as any)?.id || "");
  const userId = await getRequestOwnerUserId(req);
  const result = await query(
    `UPDATE finance_friend_requests
        SET status = 'REJECTED', responded_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND addressee_user_id = $2 AND status = 'PENDING'
      RETURNING id`,
    [requestId, userId]
  );
  if (!result.rowCount) return reply.code(404).send({ error: "Solicitud pendiente no encontrada." });
  return { data: { id: requestId, status: "REJECTED" } };
});

app.post("/v1/friends/requests/:id/cancel", async (req, reply) => {
  const requestId = String((req.params as any)?.id || "");
  const userId = await getRequestOwnerUserId(req);
  const result = await query(
    `UPDATE finance_friend_requests
        SET status = 'CANCELLED', responded_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND requester_user_id = $2 AND status = 'PENDING'
      RETURNING id`,
    [requestId, userId]
  );
  if (!result.rowCount) return reply.code(404).send({ error: "Solicitud pendiente no encontrada." });
  return { data: { id: requestId, status: "CANCELLED" } };
});

app.delete("/v1/friends/:id", async (req, reply) => {
  const friendshipId = String((req.params as any)?.id || "");
  const userId = await getRequestOwnerUserId(req);

  await withTransaction(async (client) => {
    const friendship = await client.query<{ id: string; user_a_id: string; user_b_id: string }>(
      `SELECT id, user_a_id, user_b_id
         FROM finance_friendships
        WHERE id = $1
          AND (user_a_id = $2 OR user_b_id = $2)
          AND status = 'ACTIVE'
        FOR UPDATE`,
      [friendshipId, userId]
    );
    if (!friendship.rows[0]) throw new ApiError(404, "FRIENDSHIP_NOT_FOUND", "Amistad no encontrada.");
    const { user_a_id: userA, user_b_id: userB } = friendship.rows[0];

    await client.query(
      `UPDATE finance_share_invitations
          SET status = 'REVOKED', updated_at = NOW()
        WHERE status = 'PENDING'
          AND (
            friendship_id = $1
            OR (friendship_id IS NULL AND (
              (owner_user_id = $2 AND invitee_user_id = $3)
              OR (owner_user_id = $3 AND invitee_user_id = $2)
            ))
          )`,
      [friendshipId, userA, userB]
    );
    const grants = await client.query<{ id: string; owner_user_id: string; grantee_user_id: string; resource_type: string; resource_id: string }>(
      `UPDATE finance_share_grants
          SET status = 'REVOKED', updated_at = NOW()
        WHERE status = 'ACTIVE'
          AND ((owner_user_id = $1 AND grantee_user_id = $2) OR (owner_user_id = $2 AND grantee_user_id = $1))
        RETURNING id, owner_user_id, grantee_user_id, resource_type, resource_id`,
      [userA, userB]
    );
    for (const grant of grants.rows) {
      await client.query(
        `INSERT INTO finance_share_audit_log (actor_user_id, owner_user_id, grantee_user_id, grant_id, action, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, 'FRIENDSHIP_REMOVED', $5, $6)`,
        [userId, grant.owner_user_id, grant.grantee_user_id, grant.id, grant.resource_type, grant.resource_id]
      );
    }
    await client.query(
      `UPDATE finance_friendships SET status = 'REMOVED', removed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [friendshipId]
    );
  });

  return { data: { id: friendshipId, status: "REMOVED" } };
});

app.get("/v1/shares/users", async (req) => {
  const userId = await getRequestOwnerUserId(req);
  const username = String((req as any).query?.q || "").trim();
  if (!username) return { data: [] };
  const result = await query(
    `SELECT id, username, name, picture
       FROM auth_users
      WHERE id <> $1
        AND is_active = TRUE
        AND LOWER(username) = LOWER($2)
      LIMIT 1`,
    [userId, username]
  );
  return { data: result.rows };
});

app.get("/v1/shares/catalog", async (req) => {
  const userId = await getRequestOwnerUserId(req);
  const [accounts, budgets, commitments, projections, deficits, reports] = await Promise.all([
    query(`SELECT id, name, currency, balance_current FROM accounts WHERE owner_user_id = $1 ORDER BY name ASC`, [userId]),
    query(`SELECT id, name, period, currency, start_date, end_date FROM budgets WHERE owner_user_id = $1 ORDER BY start_date DESC, name ASC`, [userId]),
    query(`SELECT id, name, cadence, next_run_at, is_active FROM recurring_rules WHERE owner_user_id = $1 ORDER BY next_run_at ASC, name ASC`, [userId]),
    query(`SELECT id, title, scenario_type, created_at FROM projection_scenarios WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]),
    query(`
      SELECT e.id, e.budget_id, b.name AS budget_name, e.period_month, e.event_type, e.deficit_amount, e.cause_code, e.detected_at
        FROM budget_deficit_events e
        JOIN budgets b ON b.id = e.budget_id
       WHERE b.owner_user_id = $1
       ORDER BY e.detected_at DESC, e.id DESC
       LIMIT 100`, [userId]),
    query(`SELECT id, title, slug, status, created_at FROM generated_views WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]),
  ]);
  return {
    data: {
      accounts: accounts.rows,
      budgets: budgets.rows,
      commitments: commitments.rows,
      projections: projections.rows,
      deficits: deficits.rows,
      reports: reports.rows,
    },
  };
});

app.get("/v1/shares", async (req) => {
  const userId = await getRequestOwnerUserId(req);
  const [sent, received, grants] = await Promise.all([
    query(`
      SELECT i.id, i.status, i.message, i.expires_at, i.created_at, i.accepted_at,
             u.username AS invitee_username, u.name AS invitee_name, u.email AS invitee_email,
             COALESCE(json_agg(json_build_object('resourceType', ii.resource_type, 'resourceId', ii.resource_id, 'permissions', ii.permissions)) FILTER (WHERE ii.id IS NOT NULL), '[]'::json) AS items
        FROM finance_share_invitations i
        JOIN auth_users u ON u.id = i.invitee_user_id
        LEFT JOIN finance_share_invitation_items ii ON ii.invitation_id = i.id
       WHERE i.owner_user_id = $1
       GROUP BY i.id, u.username, u.name, u.email
       ORDER BY i.created_at DESC`, [userId]),
    query(`
      SELECT i.id, i.status, i.message, i.expires_at, i.created_at, i.accepted_at,
             u.username AS owner_username, u.name AS owner_name, u.email AS owner_email,
             COALESCE(json_agg(json_build_object('resourceType', ii.resource_type, 'resourceId', ii.resource_id, 'permissions', ii.permissions)) FILTER (WHERE ii.id IS NOT NULL), '[]'::json) AS items
        FROM finance_share_invitations i
        JOIN auth_users u ON u.id = i.owner_user_id
        LEFT JOIN finance_share_invitation_items ii ON ii.invitation_id = i.id
       WHERE i.invitee_user_id = $1
       GROUP BY i.id, u.username, u.name, u.email
       ORDER BY i.created_at DESC`, [userId]),
    query(`
      SELECT g.id, g.owner_user_id, g.grantee_user_id, g.resource_type, g.resource_id, g.permissions, g.status, g.created_at, g.updated_at,
             owner.username AS owner_username, owner.name AS owner_name,
             grantee.username AS grantee_username, grantee.name AS grantee_name
        FROM finance_share_grants g
        JOIN auth_users owner ON owner.id = g.owner_user_id
        JOIN auth_users grantee ON grantee.id = g.grantee_user_id
       WHERE (g.owner_user_id = $1 OR g.grantee_user_id = $1)
         AND g.resource_type <> 'TRANSACTION'
       ORDER BY g.updated_at DESC`, [userId]),
  ]);
  return { data: { sent: sent.rows, received: received.rows, grants: grants.rows } };
});

app.post("/v1/shares/invitations", async (req, reply) => {
  const parsed = shareInvitationSchema.safeParse((req as any).body || {});
  if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  const ownerUserId = await getRequestOwnerUserId(req);
  const payload = parsed.data;
  const invitee = await query<{ id: string; username: string; name: string | null; email: string }>(
    `SELECT id, username, name, email FROM auth_users WHERE LOWER(username) = LOWER($1) AND is_active = TRUE LIMIT 1`,
    [payload.username]
  );
  if (!invitee.rows[0]) return reply.code(404).send({ error: "No encontramos un usuario activo con ese nombre." });
  if (invitee.rows[0].id === ownerUserId) return reply.code(400).send({ error: "No puedes compartir contigo mismo." });

  const friendship = await query<{ id: string }>(
    `SELECT id
       FROM finance_friendships
      WHERE status = 'ACTIVE'
        AND user_a_id = LEAST($1::uuid, $2::uuid)
        AND user_b_id = GREATEST($1::uuid, $2::uuid)
      LIMIT 1`,
    [ownerUserId, invitee.rows[0].id]
  );
  if (!friendship.rows[0]) {
    return reply.code(403).send({
      error: "Solo puedes compartir finanzas con una amistad aceptada.",
      code: "FRIENDSHIP_REQUIRED",
    });
  }

  for (const item of payload.items) {
    if (!(await isResourceOwner(ownerUserId, item.resourceType, item.resourceId))) {
      return reply.code(404).send({ error: `No puedes compartir ${item.resourceType}:${item.resourceId}.` });
    }
  }

  const created = await withTransaction(async (client) => {
    const invitation = await client.query<{ id: string }>(
      `INSERT INTO finance_share_invitations (owner_user_id, invitee_user_id, friendship_id, message, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5::text || ' days')::interval)
       RETURNING id`,
      [ownerUserId, invitee.rows[0].id, friendship.rows[0].id, payload.message || null, payload.expiresInDays]
    );
    const invitationId = invitation.rows[0].id;
    for (const item of payload.items) {
      await client.query(
        `INSERT INTO finance_share_invitation_items (invitation_id, resource_type, resource_id, permissions)
         VALUES ($1, $2, $3, $4::text[])`,
        [invitationId, item.resourceType, item.resourceId, normalizeSharePermissions(item.permissions)]
      );
    }
    await client.query(
      `INSERT INTO finance_share_audit_log (actor_user_id, owner_user_id, grantee_user_id, invitation_id, action, metadata)
       VALUES ($1, $1, $2, $3, 'INVITATION_CREATED', $4::jsonb)`,
      [ownerUserId, invitee.rows[0].id, invitationId, JSON.stringify({ itemCount: payload.items.length })]
    );
    return invitationId;
  });
  return reply.code(201).send({ data: { id: created, status: "PENDING", invitee: invitee.rows[0] } });
});

app.post("/v1/shares/invitations/:id/accept", async (req, reply) => {
  const invitationId = String((req.params as any)?.id || "");
  const userId = await getRequestOwnerUserId(req);
  const invitation = await query<{ id: string; owner_user_id: string; friendship_id: string | null; status: string; expires_at: string }>(
    `SELECT id, owner_user_id, friendship_id, status, expires_at FROM finance_share_invitations WHERE id = $1 AND invitee_user_id = $2 LIMIT 1`,
    [invitationId, userId]
  );
  if (!invitation.rows[0]) return reply.code(404).send({ error: "Invitacion no encontrada." });
  if (invitation.rows[0].status !== "PENDING") return reply.code(409).send({ error: "La invitacion ya no esta pendiente." });
  if (new Date(invitation.rows[0].expires_at).getTime() <= Date.now()) {
    await query(`UPDATE finance_share_invitations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`, [invitationId]);
    return reply.code(410).send({ error: "La invitacion ha expirado." });
  }

  await withTransaction(async (client) => {
    let friendshipId = invitation.rows[0].friendship_id;
    if (friendshipId) {
      const friendship = await client.query<{ status: string }>(
        `SELECT status FROM finance_friendships WHERE id = $1 LIMIT 1`,
        [friendshipId]
      );
      if (friendship.rows[0]?.status !== "ACTIVE") {
        throw new ApiError(409, "FRIENDSHIP_REQUIRED", "La amistad ya no esta activa.");
      }
    } else {
      const friendship = await client.query<{ id: string }>(
        `INSERT INTO finance_friendships (user_a_id, user_b_id, status)
         VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid), 'ACTIVE')
         ON CONFLICT (user_a_id, user_b_id)
         DO UPDATE SET status = 'ACTIVE', removed_at = NULL, updated_at = NOW()
         RETURNING id`,
        [invitation.rows[0].owner_user_id, userId]
      );
      friendshipId = friendship.rows[0].id;
      await client.query(
        `UPDATE finance_share_invitations SET friendship_id = $1, updated_at = NOW() WHERE id = $2`,
        [friendshipId, invitationId]
      );
    }

    const items = await client.query(`SELECT resource_type, resource_id, permissions FROM finance_share_invitation_items WHERE invitation_id = $1`, [invitationId]);
    for (const item of items.rows as any[]) {
      await client.query(
        `INSERT INTO finance_share_grants (owner_user_id, grantee_user_id, resource_type, resource_id, permissions, source_invitation_id)
         VALUES ($1, $2, $3, $4, $5::text[], $6)
         ON CONFLICT (owner_user_id, grantee_user_id, resource_type, resource_id)
         DO UPDATE SET permissions = EXCLUDED.permissions, status = 'ACTIVE', updated_at = NOW(), source_invitation_id = EXCLUDED.source_invitation_id`,
        [invitation.rows[0].owner_user_id, userId, item.resource_type, item.resource_id, item.permissions, invitationId]
      );
    }
    await client.query(`UPDATE finance_share_invitations SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW() WHERE id = $1`, [invitationId]);
    await client.query(
      `INSERT INTO finance_share_audit_log (actor_user_id, owner_user_id, grantee_user_id, invitation_id, action)
       VALUES ($1, $2, $1, $3, 'INVITATION_ACCEPTED')`,
      [userId, invitation.rows[0].owner_user_id, invitationId]
    );
  });
  return { data: { id: invitationId, status: "ACCEPTED" } };
});

app.post("/v1/shares/invitations/:id/reject", async (req, reply) => {
  const invitationId = String((req.params as any)?.id || "");
  const userId = await getRequestOwnerUserId(req);
  const result = await query(
    `UPDATE finance_share_invitations SET status = 'REJECTED', updated_at = NOW()
      WHERE id = $1 AND invitee_user_id = $2 AND status = 'PENDING'
      RETURNING id`,
    [invitationId, userId]
  );
  if (!result.rowCount) return reply.code(404).send({ error: "Invitacion pendiente no encontrada." });
  return { data: { id: invitationId, status: "REJECTED" } };
});

app.post("/v1/shares/invitations/:id/revoke", async (req, reply) => {
  const invitationId = String((req.params as any)?.id || "");
  const userId = await getRequestOwnerUserId(req);
  const result = await query(
    `UPDATE finance_share_invitations
        SET status = 'REVOKED', updated_at = NOW()
      WHERE id = $1 AND owner_user_id = $2 AND status = 'PENDING'
      RETURNING id`,
    [invitationId, userId]
  );
  if (!result.rowCount) return reply.code(404).send({ error: "Invitacion pendiente no encontrada." });
  await query(
    `INSERT INTO finance_share_audit_log (actor_user_id, owner_user_id, invitation_id, action)
     VALUES ($1, $1, $2, 'INVITATION_REVOKED')`,
    [userId, invitationId]
  );
  return { data: { id: invitationId, status: "REVOKED" } };
});

app.patch("/v1/shares/grants/:id", async (req, reply) => {
  const parsed = shareGrantUpdateSchema.safeParse((req as any).body || {});
  if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  const userId = await getRequestOwnerUserId(req);
  const grantId = String((req.params as any)?.id || "");
  const result = await query(
    `UPDATE finance_share_grants SET permissions = $2::text[], status = 'ACTIVE', updated_at = NOW()
      WHERE id = $1 AND owner_user_id = $3
      RETURNING id, resource_type, resource_id, permissions, status, updated_at`,
    [grantId, normalizeSharePermissions(parsed.data.permissions), userId]
  );
  if (!result.rowCount) return reply.code(404).send({ error: "Permiso compartido no encontrado." });
  return { data: result.rows[0] };
});

app.delete("/v1/shares/grants/:id", async (req, reply) => {
  const userId = await getRequestOwnerUserId(req);
  const grantId = String((req.params as any)?.id || "");
  const result = await query(
    `UPDATE finance_share_grants SET status = 'REVOKED', updated_at = NOW()
      WHERE id = $1 AND owner_user_id = $2
      RETURNING id, resource_type, resource_id, status`,
    [grantId, userId]
  );
  if (!result.rowCount) return reply.code(404).send({ error: "Permiso compartido no encontrado." });
  await query(`INSERT INTO finance_share_audit_log (actor_user_id, owner_user_id, grant_id, action, resource_type, resource_id) SELECT $1, owner_user_id, id, 'GRANT_REVOKED', resource_type, resource_id FROM finance_share_grants WHERE id = $2`, [userId, grantId]);
  return { data: result.rows[0] };
});

app.get("/v1/meta", async (req) => {
  const ownerUserId = await getRequestOwnerUserId(req);
  if (await isLegacyJournalSchema()) {
    const [accounts, txs, investments, sessions] = await Promise.all([
      query<{ c: string }>("SELECT COUNT(*)::text AS c FROM cuentas"),
      query<{ c: string }>("SELECT COUNT(*)::text AS c FROM transacciones"),
      query<{ c: string }>("SELECT COUNT(*)::text AS c FROM trades_activos"),
      query<{ c: string }>("SELECT COUNT(*)::text AS c FROM react_chat_sessions"),
    ]);

    return {
      data: {
        accounts: Number(accounts.rows[0]?.c || 0),
        transactions: Number(txs.rows[0]?.c || 0),
        investments: Number(investments.rows[0]?.c || 0),
        copilotSessions: Number(sessions.rows[0]?.c || 0),
      },
    };
  }

  const [accounts, txs, investments, sessions] = await Promise.all([
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM accounts WHERE owner_user_id = $1", [ownerUserId]),
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM transactions WHERE owner_user_id = $1", [ownerUserId]),
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM investments WHERE owner_user_id = $1", [ownerUserId]),
    query<{ c: string }>("SELECT COUNT(*)::text AS c FROM copilot_sessions WHERE owner_user_id = $1", [ownerUserId]),
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

app.get("/v1/accounts", async (req, reply) => {
  if (await isLegacyJournalSchema()) {
    const result = await query(
      `SELECT id,
              ('CUENTA-' || id::text) AS code,
              nombre AS name,
              COALESCE(moneda, 'COP') AS currency,
              COALESCE(saldo_actual, 0) AS balance_current,
              COALESCE(tipo, 'otro') AS legacy_type
         FROM cuentas
        ORDER BY id ASC`
    );

    return {
      data: result.rows.map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        currency: row.currency,
        account_type: legacyAccountTypeToEnum(row.legacy_type),
        balance_current: row.balance_current,
        is_active: true,
        created_at: null,
        updated_at: null,
      })),
    };
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const accessibleAccountIds = await getAccessibleAccountIds(ownerUserId, "READ");
  const result = await query(
    `SELECT id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at
       FROM accounts
      WHERE id = ANY($1::bigint[])
      ORDER BY id ASC`
    ,
    [accessibleAccountIds.map(Number)]
  );

  return { data: result.rows };
});

app.post("/v1/accounts", async (req, reply) => {
  const parsed = createAccountSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const payload = parsed.data;

  if (await isLegacyJournalSchema()) {
    const result = await query(
      `INSERT INTO cuentas (nombre, moneda, tipo, saldo_actual)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, COALESCE(moneda, 'COP') AS moneda, COALESCE(tipo, 'otro') AS tipo, COALESCE(saldo_actual, 0) AS saldo_actual`,
      [payload.name, payload.currency.toUpperCase(), enumAccountTypeToLegacy(payload.accountType), payload.balanceCurrent]
    );

    const row: any = result.rows[0];
    return reply.code(201).send({
      data: {
        id: row.id,
        code: `CUENTA-${row.id}`,
        name: row.nombre,
        currency: row.moneda,
        account_type: legacyAccountTypeToEnum(row.tipo),
        balance_current: row.saldo_actual,
        is_active: true,
        created_at: null,
        updated_at: null,
      },
    });
  }

  const result = await query(
    `INSERT INTO accounts (owner_user_id, code, name, currency, account_type, balance_current)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at`,
    [ownerUserId, payload.code, payload.name, payload.currency.toUpperCase(), payload.accountType, payload.balanceCurrent]
  );

  if (await hasPlanningTables()) {
    await withTransaction((client) => syncBudgetDeficitEvents(client as unknown as DbExecutor, currentYYYYMM(), ownerUserId));
  }

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

  const ownerUserId = await getRequestOwnerUserId(req);

  if (await isLegacyJournalSchema()) {
    const fields: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      fields.push(`nombre = $${values.length + 1}`);
      values.push(payload.name);
    }
    if (payload.currency !== undefined) {
      fields.push(`moneda = $${values.length + 1}`);
      values.push(payload.currency.toUpperCase());
    }
    if (payload.accountType !== undefined) {
      fields.push(`tipo = $${values.length + 1}`);
      values.push(enumAccountTypeToLegacy(payload.accountType));
    }
    if (payload.balanceCurrent !== undefined) {
      fields.push(`saldo_actual = $${values.length + 1}`);
      values.push(payload.balanceCurrent);
    }

    if (fields.length === 0) {
      return reply.code(400).send({ error: "No fields to update in legacy schema." });
    }

    values.push(id);
    const result = await query(
      `UPDATE cuentas
          SET ${fields.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, nombre, COALESCE(moneda, 'COP') AS moneda, COALESCE(tipo, 'otro') AS tipo, COALESCE(saldo_actual, 0) AS saldo_actual`,
      values
    );

    if (!result.rows[0]) {
      return reply.code(404).send({ error: "Account not found" });
    }

    const row: any = result.rows[0];
    return {
      data: {
        id: row.id,
        code: `CUENTA-${row.id}`,
        name: row.nombre,
        currency: row.moneda,
        account_type: legacyAccountTypeToEnum(row.tipo),
        balance_current: row.saldo_actual,
        is_active: true,
        created_at: null,
        updated_at: null,
      },
    };
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
  values.push(ownerUserId);

  const result = await query(
    `UPDATE accounts
        SET ${fields.join(", ")}
      WHERE id = $${values.length - 1}
        AND owner_user_id = $${values.length}
      RETURNING id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at`,
    values
  );

  if (!result.rows[0]) {
    return reply.code(404).send({ error: "Account not found" });
  }

  if (await hasPlanningTables()) {
    await withTransaction((client) => syncBudgetDeficitEvents(client as unknown as DbExecutor, currentYYYYMM(), ownerUserId));
  }

  return { data: result.rows[0] };
});

app.get("/v1/categories", async (req) => {
  const ownerUserId = await getRequestOwnerUserId(req);
  if (await isLegacyJournalSchema()) {
    if (await hasPlanningTables()) {
      const categories = await withTransaction((client) => syncLegacyCategories(client as unknown as DbExecutor, ownerUserId));
      return { data: categories };
    }

    const result = await query(
      `SELECT ROW_NUMBER() OVER (ORDER BY categoria) AS id,
              UPPER(REGEXP_REPLACE(categoria, '\\s+', '_', 'g')) AS code,
              categoria AS name,
              'BOTH'::text AS direction,
              NOW() AS created_at
         FROM (SELECT DISTINCT categoria FROM transacciones WHERE categoria IS NOT NULL AND categoria <> '') t
        ORDER BY categoria`
    );
    return { data: result.rows };
  }

  await ensureOwnerCategories(ownerUserId);
  const [sharedAccountIds, sharedTransactionIds] = await Promise.all([
    getAccessibleAccountIds(ownerUserId, "READ"),
    getAccessibleTransactionIds(ownerUserId, "READ"),
  ]);
  const [accountOwners, transactionOwners] = await Promise.all([
    sharedAccountIds.length
      ? query<{ owner_user_id: string }>(`SELECT DISTINCT owner_user_id FROM accounts WHERE id = ANY($1::bigint[])`, [sharedAccountIds.map(Number)])
      : Promise.resolve({ rows: [] as Array<{ owner_user_id: string }> }),
    sharedTransactionIds.length
      ? query<{ owner_user_id: string }>(`SELECT DISTINCT owner_user_id FROM transactions WHERE id = ANY($1::bigint[])`, [sharedTransactionIds.map(Number)])
      : Promise.resolve({ rows: [] as Array<{ owner_user_id: string }> }),
  ]);
  const visibleCategoryOwners = [...new Set([
    ownerUserId,
    ...accountOwners.rows.map((row) => row.owner_user_id),
    ...transactionOwners.rows.map((row) => row.owner_user_id),
  ])];
  const result = await query(
    `SELECT id, code, name, direction, created_at
       FROM categories
      WHERE owner_user_id = ANY($1::uuid[])
      ORDER BY name ASC`,
    [visibleCategoryOwners]
  );

  return { data: result.rows };
});

app.post("/v1/categories", async (req, reply) => {
  const parsed = createCategorySchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;

  if (await isLegacyJournalSchema()) {
    if (await hasPlanningTables()) {
      const created = await withTransaction(async (client) => {
        const ownerUserId = await getRequestOwnerUserId(req);
        await syncLegacyCategories(client as unknown as DbExecutor, ownerUserId);

        const existingByName = await client.query<{ id: number; code: string; name: string; direction: string; created_at: string }>(
          `SELECT id, code, name, direction, created_at
             FROM categories
            WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
              AND owner_user_id = $2
            LIMIT 1`,
          [payload.name, ownerUserId]
        );

        if (existingByName.rows[0]) {
          const updated = await client.query<{ id: number; code: string; name: string; direction: string; created_at: string }>(
            `UPDATE categories
                SET direction = $2
              WHERE id = $1
              RETURNING id, code, name, direction, created_at`,
            [existingByName.rows[0].id, payload.direction]
          );
          return updated.rows[0];
        }

        const existingCodes = await client.query<{ code: string }>(`SELECT code FROM categories`);
        const code = buildAvailableCategoryCode(payload.code || payload.name, new Set(existingCodes.rows.map((row) => row.code.toUpperCase())));
        const inserted = await client.query<{ id: number; code: string; name: string; direction: string; created_at: string }>(
          `INSERT INTO categories (owner_user_id, code, name, direction)
           VALUES ($1, $2, $3, $4)
           RETURNING id, code, name, direction, created_at`,
          [ownerUserId, code, payload.name, payload.direction]
        );

        return inserted.rows[0];
      });

      return reply.code(201).send({ data: created });
    }

    return reply.code(201).send({
      data: {
        id: 0,
        code: normalizeCategoryCode(payload.code || payload.name),
        name: payload.name,
        direction: payload.direction,
        created_at: new Date().toISOString(),
      },
    });
  }

  const result = await query(
    `INSERT INTO categories (owner_user_id, code, name, direction)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (owner_user_id, code)
     DO UPDATE SET name = EXCLUDED.name, direction = EXCLUDED.direction
     RETURNING id, code, name, direction, created_at`,
    [await getRequestOwnerUserId(req), payload.code.toUpperCase(), payload.name, payload.direction]
  );

  return reply.code(201).send({ data: result.rows[0] });
});

app.get("/v1/counterparties", async (req) => {
  if (await isLegacyJournalSchema()) {
    return { data: [] };
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const result = await query(
    `SELECT id, name, type, email, phone, notes, is_active, created_at, updated_at
       FROM counterparties
      WHERE owner_user_id = $1
      ORDER BY name ASC`,
    [ownerUserId]
  );

  return { data: result.rows };
});

app.post("/v1/counterparties", async (req, reply) => {
  const parsed = createCounterpartySchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;

  if (await isLegacyJournalSchema()) {
    return reply.code(501).send({
      error: "Counterparties no disponible en esquema legacy journal.",
      code: "LEGACY_COUNTERPARTY_UNSUPPORTED",
      details: { requestedName: payload.name },
    });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const result = await query(
    `INSERT INTO counterparties (owner_user_id, name, type, email, phone, notes, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, type, email, phone, notes, is_active, created_at, updated_at`,
    [ownerUserId, payload.name, payload.type, payload.email || null, payload.phone || null, payload.notes || null, payload.isActive]
  );

  return reply.code(201).send({ data: result.rows[0] });
});

app.get("/v1/tags", async (req) => {
  if (await isLegacyJournalSchema()) {
    return { data: [] };
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const result = await query(
    `SELECT id, name, color, created_at
       FROM tags
      WHERE owner_user_id = $1
      ORDER BY name ASC`,
    [ownerUserId]
  );

  return { data: result.rows };
});

app.post("/v1/tags", async (req, reply) => {
  const parsed = createTagSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;

  if (await isLegacyJournalSchema()) {
    return reply.code(501).send({
      error: "Tags no disponible en esquema legacy journal.",
      code: "LEGACY_TAGS_UNSUPPORTED",
      details: { requestedName: payload.name },
    });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const result = await query(
    `INSERT INTO tags (owner_user_id, name, color)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id, name, color, created_at`,
    [ownerUserId, payload.name, payload.color || null]
  );

  if (result.rows[0]) {
    return reply.code(201).send({ data: result.rows[0] });
  }

  const existing = await query(`SELECT id, name, color, created_at FROM tags WHERE owner_user_id = $2 AND LOWER(name) = LOWER($1) LIMIT 1`, [payload.name, ownerUserId]);
  return reply.code(200).send({ data: existing.rows[0] });
});

app.get("/v1/budgets", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Budgets no disponible en esquema legacy journal.",
      code: "LEGACY_BUDGETS_UNSUPPORTED",
    });
  }

  const parsed = listBudgetsQuerySchema.parse((req as any).query || {});
  const month = parsed.month || currentYYYYMM();
  const ownerUserId = await getRequestOwnerUserId(req);
  const [budgetIds, transactionIds, accountIds] = await Promise.all([
    getAccessibleIds(ownerUserId, "BUDGET", "READ"),
    getAccessibleTransactionIds(ownerUserId, "READ"),
    getAccessibleAccountIds(ownerUserId, "READ"),
  ]);
  await withTransaction((client) => syncBudgetDeficitEvents(client as unknown as DbExecutor, month, ownerUserId));
  const data = await loadBudgetEvaluationsForMonth({ query } as unknown as DbExecutor, month, undefined, {
    budgetIds,
    transactionIds,
    accountIds,
  });
  return { data };
});

app.post("/v1/budgets", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Budgets no disponible en esquema legacy journal.",
      code: "LEGACY_BUDGETS_UNSUPPORTED",
    });
  }

  const parsed = upsertBudgetSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const payload = parsed.data;
  if (new Date(payload.endDate) < new Date(payload.startDate)) {
    return reply.code(400).send({ error: "endDate must be >= startDate" });
  }

  const created = await withTransaction(async (client) => {
    if (await isLegacyJournalSchema()) {
      await syncLegacyCategories(client as unknown as DbExecutor, ownerUserId);
    } else {
      await ensureOwnerCategories(ownerUserId);
    }

    const categoryIds = [...new Set(payload.lines.map((line) => line.categoryId))];
    const categoryCheck = await client.query<{ id: number }>(
      `SELECT id
         FROM categories
        WHERE id = ANY($1::bigint[])
          AND owner_user_id = $2`,
      [categoryIds, ownerUserId]
    );

    if (categoryCheck.rows.length !== categoryIds.length) {
      throw new ApiError(400, "CATEGORY_NOT_FOUND", "Selecciona una categoria valida para este presupuesto.");
    }

    const budgetRes = await client.query(
      `INSERT INTO budgets (owner_user_id, name, period, currency, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, period, currency, start_date, end_date, created_at`,
      [ownerUserId, payload.name, payload.period, payload.currency.toUpperCase(), payload.startDate, payload.endDate]
    );
    const budget = budgetRes.rows[0] as any;

    for (const line of payload.lines) {
      await client.query(
        `INSERT INTO budget_lines (owner_user_id, budget_id, category_id, limit_amount) VALUES ($1, $2, $3, $4)`,
        [ownerUserId, budget.id, line.categoryId, line.limitAmount]
      );
    }

    const fundingAccountIds =
      payload.fundingAccountIds && payload.fundingAccountIds.length > 0
        ? [...new Set(payload.fundingAccountIds)]
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

    if (fundingAccountIds.length > 0) {
      for (const accountId of fundingAccountIds) {
        await client.query(
          `INSERT INTO budget_funding_accounts (owner_user_id, budget_id, account_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [ownerUserId, budget.id, accountId]
        );
      }
    }

    const lines = await client.query(
      `SELECT bl.id, bl.category_id, bl.limit_amount, c.name AS category_name
         FROM budget_lines bl
    LEFT JOIN categories c ON c.id = bl.category_id
        WHERE bl.budget_id = $1
        ORDER BY bl.id ASC`,
      [budget.id]
    );

    await syncBudgetDeficitEvents(client as unknown as DbExecutor, monthFromDateString(payload.startDate), ownerUserId);
    return { ...budget, lines: lines.rows, fundingAccountIds };
  });

  return reply.code(201).send({ data: created });
});

app.patch("/v1/budgets/:id", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Budgets no disponible en esquema legacy journal.",
      code: "LEGACY_BUDGETS_UNSUPPORTED",
    });
  }

  const budgetId = Number((req.params as any)?.id);
  if (!Number.isInteger(budgetId) || budgetId <= 0) {
    return reply.code(400).send({ error: "Invalid budget id" });
  }

  const parsed = upsertBudgetSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const payload = parsed.data;
  if (new Date(payload.endDate) < new Date(payload.startDate)) {
    return reply.code(400).send({ error: "endDate must be >= startDate" });
  }

  const updated = await withTransaction(async (client) => {
    if (await isLegacyJournalSchema()) {
      await syncLegacyCategories(client as unknown as DbExecutor, ownerUserId);
    } else {
      await ensureOwnerCategories(ownerUserId);
    }

    const existingBudget = await client.query<{ id: number }>(
      `SELECT id FROM budgets WHERE id = $1 AND owner_user_id = $2 LIMIT 1`,
      [budgetId, ownerUserId]
    );
    if (!existingBudget.rows[0]) {
      throw new ApiError(404, "BUDGET_NOT_FOUND", "El presupuesto no existe.");
    }

    const categoryIds = [...new Set(payload.lines.map((line) => line.categoryId))];
    const categoryCheck = await client.query<{ id: number }>(
      `SELECT id
         FROM categories
        WHERE id = ANY($1::bigint[])
          AND owner_user_id = $2`,
      [categoryIds, ownerUserId]
    );

    if (categoryCheck.rows.length !== categoryIds.length) {
      throw new ApiError(400, "CATEGORY_NOT_FOUND", "Selecciona una categoria valida para este presupuesto.");
    }

    const budgetRes = await client.query(
      `UPDATE budgets
          SET name = $2,
              period = $3,
              currency = $4,
              start_date = $5,
              end_date = $6
        WHERE id = $1
          AND owner_user_id = $7
        RETURNING id, name, period, currency, start_date, end_date, created_at`,
      [budgetId, payload.name, payload.period, payload.currency.toUpperCase(), payload.startDate, payload.endDate, ownerUserId]
    );
    const budget = budgetRes.rows[0] as any;

    await client.query(`DELETE FROM budget_lines WHERE budget_id = $1 AND owner_user_id = $2`, [budgetId, ownerUserId]);
    for (const line of payload.lines) {
      await client.query(
        `INSERT INTO budget_lines (owner_user_id, budget_id, category_id, limit_amount) VALUES ($1, $2, $3, $4)`,
        [ownerUserId, budgetId, line.categoryId, line.limitAmount]
      );
    }

    if (payload.fundingAccountIds !== undefined) {
      await client.query(`DELETE FROM budget_funding_accounts WHERE budget_id = $1 AND owner_user_id = $2`, [budgetId, ownerUserId]);

      const fundingAccountIds = [...new Set(payload.fundingAccountIds)];
      for (const accountId of fundingAccountIds) {
        await client.query(
          `INSERT INTO budget_funding_accounts (owner_user_id, budget_id, account_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [ownerUserId, budgetId, accountId]
        );
      }
    }

    const lines = await client.query(
      `SELECT bl.id, bl.category_id, bl.limit_amount, c.name AS category_name
         FROM budget_lines bl
    LEFT JOIN categories c ON c.id = bl.category_id
        WHERE bl.budget_id = $1
        ORDER BY bl.id ASC`,
      [budgetId]
    );

    const fundingAccountIdsRes = await client.query<{ account_id: number }>(
      `SELECT account_id
         FROM budget_funding_accounts
        WHERE budget_id = $1
        ORDER BY account_id ASC`,
      [budgetId]
    );

    await syncBudgetDeficitEvents(client as unknown as DbExecutor, monthFromDateString(payload.startDate), ownerUserId);
    return {
      ...budget,
      lines: lines.rows,
      fundingAccountIds: fundingAccountIdsRes.rows.map((row) => Number(row.account_id)),
    };
  });

  return reply.code(200).send({ data: updated });
});

app.get("/v1/budget-deficits", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Budget deficits no disponible en esquema legacy journal.",
      code: "LEGACY_BUDGET_DEFICITS_UNSUPPORTED",
    });
  }

  const parsed = listBudgetDeficitsQuerySchema.parse((req as any).query || {});
  const month = parsed.month || currentYYYYMM();
  const ownerUserId = await getRequestOwnerUserId(req);
  const accessibleBudgetIds = await getAccessibleIds(ownerUserId, "BUDGET", "READ");
  await withTransaction((client) => syncBudgetDeficitEvents(client as unknown as DbExecutor, month, ownerUserId));

  const result = await query(
    `SELECT e.id,
            e.budget_id,
            e.budget_line_id,
            b.name AS budget_name,
            e.event_type,
            e.detected_at,
            e.period_month,
            e.deficit_amount,
            e.funding_shortfall_amount,
            e.budget_remaining_amount,
            e.funding_remaining_amount,
            e.cause_code,
            e.cause_summary,
            e.metadata,
            e.resolved_at
      FROM budget_deficit_events e
      JOIN budgets b ON b.id = e.budget_id
      WHERE e.period_month = $1
        AND e.budget_id = ANY($2::bigint[])
      ORDER BY e.detected_at DESC, e.id DESC`,
    [month, accessibleBudgetIds.map(Number)]
  );

  return { data: result.rows };
});

app.patch("/v1/budget-deficits/:id", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Budget deficits no disponible en esquema legacy journal.",
      code: "LEGACY_BUDGET_DEFICITS_UNSUPPORTED",
    });
  }

  const id = Number((req.params as any)?.id || 0);
  if (!Number.isInteger(id) || id <= 0) {
    return reply.code(400).send({ error: "Invalid deficit event id" });
  }

  const parsed = updateBudgetDeficitEventSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;
  if (Object.keys(payload).length === 0) {
    return reply.code(400).send({ error: "Empty payload" });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const fields: string[] = [];
  const values: unknown[] = [];

  if (payload.causeSummary !== undefined) {
    fields.push(`cause_summary = $${values.length + 1}`);
    values.push(payload.causeSummary);
  }

  if (payload.metadata !== undefined) {
    fields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${values.length + 1}::jsonb`);
    values.push(JSON.stringify(payload.metadata));
  }

  values.push(id);
  values.push(ownerUserId);
  const result = await query(
    `UPDATE budget_deficit_events
        SET ${fields.join(", ")}
      WHERE id = $${values.length - 1}
        AND owner_user_id = $${values.length}
      RETURNING id,
                budget_id,
                budget_line_id,
                event_type,
                detected_at,
                period_month,
                deficit_amount,
                funding_shortfall_amount,
                budget_remaining_amount,
                funding_remaining_amount,
                cause_code,
                cause_summary,
                metadata,
                resolved_at`,
    values
  );

  if (!result.rowCount) {
    return reply.code(404).send({ error: "Deficit event not found" });
  }

  return { data: result.rows[0] };
});

export function buildCommitmentsQuery(from: string, to: string, accessibleIds: Array<string | number>, activeOnly: boolean) {
  if (!accessibleIds.length) return null;
  const where: string[] = ["r.id = ANY($3::bigint[])"];
  if (activeOnly) where.push("r.is_active = TRUE");
  return {
    text: `SELECT r.id, r.name, r.cadence, r.next_run_at, r.is_active, r.payload, r.created_at
       FROM recurring_rules r
      WHERE r.next_run_at <= $2::date
        AND r.next_run_at >= $1::date
        AND ${where.join(" AND ")}
      ORDER BY r.next_run_at ASC, r.id ASC`,
    values: [from, to, accessibleIds.map(Number)],
  };
}

app.get("/v1/commitments", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Commitments no disponible en esquema legacy journal.",
      code: "LEGACY_COMMITMENTS_UNSUPPORTED",
    });
  }

  const parsed = listCommitmentsQuerySchema.parse((req as any).query || {});
  const month = parsed.month || currentYYYYMM();
  const from = monthStartFromYYYYMM(month);
  const to = monthEndFromYYYYMM(month);
  const ownerUserId = await getRequestOwnerUserId(req);

  const accessibleCommitmentIds = await getAccessibleIds(ownerUserId, "COMMITMENT", "READ");
  const commitmentQuery = buildCommitmentsQuery(from, to, accessibleCommitmentIds, parsed.activeOnly);
  // No commitment IDs means no SQL query and no unused third bind parameter.
  if (!commitmentQuery) {
    return { data: [] };
  }

  const result = await query(commitmentQuery.text, commitmentQuery.values);

  return { data: result.rows };
});

app.post("/v1/commitments", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Commitments no disponible en esquema legacy journal.",
      code: "LEGACY_COMMITMENTS_UNSUPPORTED",
    });
  }

  const parsed = upsertCommitmentSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  const payload = parsed.data;
  const nextRunAt = payload.nextRunAt || new Date().toISOString().slice(0, 10);
  const ownerUserId = await getRequestOwnerUserId(req);

  if (payload.accountId !== undefined && payload.accountId !== null) {
    const accountCheck = await query(`SELECT id FROM accounts WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [
      payload.accountId,
      ownerUserId,
    ]);
    if (!accountCheck.rowCount) {
      return reply.code(400).send({ error: "La cuenta seleccionada no existe o no pertenece al usuario." });
    }
  }
  if (payload.categoryId !== undefined && payload.categoryId !== null) {
    const categoryCheck = await query(`SELECT id FROM categories WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [
      payload.categoryId,
      ownerUserId,
    ]);
    if (!categoryCheck.rowCount) {
      return reply.code(400).send({ error: "La categoria seleccionada no existe o no pertenece al usuario." });
    }
  }

  const result = await query(
    `INSERT INTO recurring_rules (owner_user_id, name, cadence, next_run_at, is_active, payload)
     VALUES ($1, $2, $3, $4, TRUE, $5::jsonb)
     RETURNING id, name, cadence, next_run_at, is_active, payload, created_at`,
    [
      ownerUserId,
      payload.name,
      payload.cadence,
      nextRunAt,
      JSON.stringify({
        amount: payload.amount,
        currency: payload.currency.toUpperCase(),
        direction: payload.direction,
        categoryId: payload.categoryId || null,
        accountId: payload.accountId || null,
        dayOfMonth: payload.dayOfMonth || null,
        notes: payload.notes || null,
      }),
    ]
  );

  return reply.code(201).send({ data: result.rows[0] });
});

app.post("/v1/commitments/:id/pause", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Commitments no disponible en esquema legacy journal.",
      code: "LEGACY_COMMITMENTS_UNSUPPORTED",
    });
  }

  const id = Number((req.params as any)?.id || 0);
  if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: "Invalid commitment id" });
  const ownerUserId = await getRequestOwnerUserId(req);

  const result = await query(
    `UPDATE recurring_rules
        SET is_active = FALSE
      WHERE id = $1
        AND owner_user_id = $2
      RETURNING id, name, cadence, next_run_at, is_active, payload, created_at`,
    [id, ownerUserId]
  );
  if (!result.rowCount) return reply.code(404).send({ error: "Commitment not found" });
  return { data: result.rows[0] };
});

app.post("/v1/projections/run", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Projections no disponible en esquema legacy journal.",
      code: "LEGACY_PROJECTIONS_UNSUPPORTED",
    });
  }

  const parsed = runProjectionSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  const payload = parsed.data;
  const ownerUserId = await getRequestOwnerUserId(req);

  const summary = await query<{ total_balance: string; inflow: string; outflow: string }>(
    `SELECT
        COALESCE((SELECT SUM(balance_current)::numeric FROM accounts WHERE is_active = TRUE AND owner_user_id = $1), 0)::text AS total_balance,
        COALESCE((SELECT SUM(amount)::numeric FROM transactions WHERE direction = 'INFLOW' AND status IN ('POSTED', 'RECONCILED') AND transaction_date >= date_trunc('month', CURRENT_DATE) AND owner_user_id = $1), 0)::text AS inflow,
        COALESCE((SELECT SUM(amount)::numeric FROM transactions WHERE direction = 'OUTFLOW' AND status IN ('POSTED', 'RECONCILED') AND transaction_date >= date_trunc('month', CURRENT_DATE) AND owner_user_id = $1), 0)::text AS outflow`,
    [ownerUserId]
  );

  const commitments = payload.includeCommitments
    ? await query<{ payload: any; is_active: boolean }>(`SELECT payload, is_active FROM recurring_rules WHERE is_active = TRUE AND owner_user_id = $1`, [
        ownerUserId,
      ])
    : { rows: [] as any[] };

  const monthlyCommitments = (commitments.rows as any[]).reduce((acc, row) => {
    const p = row.payload || {};
    const amount = Number(p.amount || 0);
    const direction = String(p.direction || "OUTFLOW").toUpperCase();
    return acc + (direction === "OUTFLOW" ? amount : -amount);
  }, 0);

  const monthlyIncome = payload.monthlyIncome ?? Number(summary.rows[0]?.inflow || 0);
  const monthlyFixedOutflow = payload.monthlyFixedOutflow ?? Number(summary.rows[0]?.outflow || 0);
  const openingBalance = Number(summary.rows[0]?.total_balance || 0);

  const months: Array<{ month: string; income: number; outflow: number; savings: number; investing: number; net: number; closingBalance: number }> = [];
  let rollingBalance = openingBalance;
  const startMonth = currentYYYYMM();

  for (let i = 0; i < payload.horizonMonths; i++) {
    const month = addMonths(startMonth, i);
    const income = monthlyIncome;
    const outflow = monthlyFixedOutflow + monthlyCommitments;
    const savings = payload.monthlySavingsGoal;
    const investing = payload.monthlyInvestmentGoal;
    const net = income - outflow - savings - investing;
    rollingBalance += net;
    months.push({
      month,
      income,
      outflow,
      savings,
      investing,
      net,
      closingBalance: rollingBalance,
    });
  }

  const resultPayload = {
    openingBalance,
    monthlyIncome,
    monthlyFixedOutflow,
    monthlyCommitments,
    horizonMonths: payload.horizonMonths,
    months,
    minClosingBalance: Math.min(...months.map((m) => m.closingBalance)),
    finalClosingBalance: months[months.length - 1]?.closingBalance ?? openingBalance,
  };

  const scenario = await query(
    `INSERT INTO projection_scenarios (owner_user_id, scenario_type, title, assumptions, result)
     VALUES ($1, 'CASHFLOW', $2, $3::jsonb, $4::jsonb)
     RETURNING id, scenario_type, title, assumptions, result, created_at, updated_at`,
    [
      ownerUserId,
      payload.scenarioTitle || `Proyeccion ${new Date().toISOString().slice(0, 10)}`,
      JSON.stringify(payload),
      JSON.stringify(resultPayload),
    ]
  );

  return reply.code(201).send({ data: scenario.rows[0] });
});

app.get("/v1/projections/scenarios", async (req, reply) => {
  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Projections no disponible en esquema legacy journal.",
      code: "LEGACY_PROJECTIONS_UNSUPPORTED",
    });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const accessibleProjectionIds = await getAccessibleIds(ownerUserId, "PROJECTION", "READ");
  const result = await query(
    `SELECT id, proposal_id, scenario_type, title, assumptions, result, created_at, updated_at
       FROM projection_scenarios
      WHERE id = ANY($1::uuid[])
      ORDER BY created_at DESC
      LIMIT 50`,
    [accessibleProjectionIds]
  );
  return { data: result.rows };
});

app.get("/v1/transactions", async (req) => {
  const parsed = listTransactionQuerySchema.parse((req as any).query || {});
  const ownerUserId = await getRequestOwnerUserId(req);

  if (await isLegacyJournalSchema()) {
    const where: string[] = [];
    const values: any[] = [];

    if (parsed.accountId) {
      values.push(parsed.accountId);
      where.push(`t.cuenta_id = $${values.length}`);
    }
    if (parsed.direction) {
      if (parsed.direction === "INFLOW") {
        where.push(`LOWER(t.tipo) = 'ingreso'`);
      } else {
        where.push(`LOWER(t.tipo) <> 'ingreso'`);
      }
    }
    if (parsed.status) {
      if (parsed.status === "POSTED") {
        where.push(`LOWER(COALESCE(t.estado, '')) = 'realizado'`);
      } else if (parsed.status === "PENDING") {
        where.push(`LOWER(COALESCE(t.estado, '')) <> 'realizado'`);
      }
    }
    if (parsed.q) {
      values.push(`%${parsed.q.toLowerCase()}%`);
      where.push(
        `(LOWER(COALESCE(t.descripcion, '')) LIKE $${values.length} OR LOWER(COALESCE(t.categoria, '')) LIKE $${values.length} OR LOWER(COALESCE(c.nombre, '')) LIKE $${values.length})`
      );
    }

    values.push(parsed.limit);
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query(
      `SELECT t.id,
              t.fecha_transaccion::date AS transaction_date,
              t.descripcion AS description,
              t.monto AS amount,
              COALESCE(t.moneda, 'COP') AS currency,
              CASE WHEN LOWER(t.tipo) = 'ingreso' THEN 'INFLOW' ELSE 'OUTFLOW' END::text AS direction,
              CASE WHEN LOWER(COALESCE(t.estado, '')) = 'realizado' THEN 'POSTED' ELSE 'PENDING' END::text AS status,
              t.cuenta_id AS account_id,
              NULL::bigint AS category_id,
              NULL::bigint AS counterparty_id,
              NULL::text AS notes,
              NULL::text AS external_ref,
              t.created_at,
              t.created_at AS updated_at,
              COALESCE(c.nombre, 'Sin cuenta') AS account_name,
              CASE
                WHEN LOWER(COALESCE(c.tipo, '')) LIKE '%credito%' THEN 'CREDIT_CARD'
                WHEN LOWER(COALESCE(c.tipo, '')) LIKE '%ahorro%' THEN 'SAVINGS'
                WHEN LOWER(COALESCE(c.tipo, '')) LIKE '%corriente%' THEN 'CHECKING'
                ELSE 'OTHER'
              END::text AS account_type,
              t.categoria AS category_name,
              NULL::text AS counterparty_name,
              '[]'::json AS tags,
              '[]'::json AS splits,
              '[]'::json AS attachments
         FROM transacciones t
    LEFT JOIN cuentas c ON c.id = t.cuenta_id
         ${whereClause}
        ORDER BY t.fecha_transaccion DESC, t.id DESC
        LIMIT $${values.length}`,
      values
    );

    return { data: result.rows };
  }

  const accessibleTransactionIds = await getAccessibleTransactionIds(ownerUserId, "READ");
  const where: string[] = [accessibleTransactionIds.length ? `t.id = ANY($1::bigint[])` : "FALSE"];
  const values: any[] = accessibleTransactionIds.length ? [accessibleTransactionIds.map(Number)] : [];

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

  if (parsed.categoryId) {
    values.push(parsed.categoryId);
    where.push(`t.category_id = $${values.length}`);
  }

  if (parsed.counterpartyId) {
    values.push(parsed.counterpartyId);
    where.push(`t.counterparty_id = $${values.length}`);
  }

  if (parsed.tagId) {
    values.push(parsed.tagId);
    where.push(`EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = t.id AND tt.tag_id = $${values.length})`);
  }

  if (parsed.q) {
    values.push(`%${parsed.q.toLowerCase()}%`);
    where.push(
      `(LOWER(COALESCE(t.description, '')) LIKE $${values.length} OR LOWER(a.name) LIKE $${values.length} OR LOWER(COALESCE(cp.name, '')) LIKE $${values.length})`
    );
  }

  values.push(parsed.limit);
  const whereClause = `WHERE ${where.join(" AND ")}`;

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
            t.counterparty_id,
            t.notes,
            t.external_ref,
            t.created_at,
            t.updated_at,
            a.name AS account_name,
            a.account_type AS account_type,
            c.name AS category_name,
            cp.name AS counterparty_name,
            COALESCE(tag_data.tags, '[]'::json) AS tags,
            COALESCE(split_data.splits, '[]'::json) AS splits,
            COALESCE(att_data.attachments, '[]'::json) AS attachments
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN counterparties cp ON cp.id = t.counterparty_id
  LEFT JOIN LATERAL (
         SELECT json_agg(
                  json_build_object(
                    'id', tg.id,
                    'name', tg.name,
                    'color', tg.color
                  )
                  ORDER BY tg.name ASC
                ) AS tags
           FROM transaction_tags tt
           JOIN tags tg ON tg.id = tt.tag_id
          WHERE tt.transaction_id = t.id
       ) AS tag_data ON TRUE
  LEFT JOIN LATERAL (
         SELECT json_agg(
                  json_build_object(
                    'id', ts.id,
                    'lineNo', ts.line_no,
                    'description', ts.description,
                    'amount', ts.amount,
                    'categoryId', ts.category_id,
                    'categoryName', c2.name,
                    'counterpartyId', ts.counterparty_id,
                    'counterpartyName', cp2.name
                  )
                  ORDER BY ts.line_no ASC
                ) AS splits
           FROM transaction_splits ts
      LEFT JOIN categories c2 ON c2.id = ts.category_id
      LEFT JOIN counterparties cp2 ON cp2.id = ts.counterparty_id
          WHERE ts.transaction_id = t.id
       ) AS split_data ON TRUE
  LEFT JOIN LATERAL (
         SELECT json_agg(
                  json_build_object(
                    'id', at.id,
                    'fileName', at.file_name,
                    'fileUrl', at.file_url,
                    'mimeType', at.mime_type,
                    'fileSize', at.file_size,
                    'createdAt', at.created_at
                  )
                  ORDER BY at.id ASC
                ) AS attachments
           FROM attachments at
          WHERE at.transaction_id = t.id
       ) AS att_data ON TRUE
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
  const ownerUserId = await getRequestOwnerUserId(req);

  if (await isLegacyJournalSchema()) {
    const inserted = await query(
      `INSERT INTO transacciones (
         descripcion,
         monto,
         categoria,
         tipo,
         estado,
         fecha_transaccion,
         cuenta_id,
         cuenta_destino_id,
         moneda
       )
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, NULL, $8)
       RETURNING id, descripcion, monto, categoria, tipo, estado, fecha_transaccion, cuenta_id, moneda, created_at`,
      [
        payload.description || null,
        payload.amount,
        null,
        payload.direction === "INFLOW" ? "ingreso" : "gasto",
        payload.status === "POSTED" ? "realizado" : "pendiente",
        `${payload.transactionDate}T12:00:00Z`,
        payload.accountId,
        payload.currency.toUpperCase(),
      ]
    );

    const account = await query(
      `SELECT id, nombre, COALESCE(moneda, 'COP') AS moneda, COALESCE(tipo, 'otro') AS tipo, COALESCE(saldo_actual, 0) AS saldo_actual
         FROM cuentas
        WHERE id = $1
        LIMIT 1`,
      [payload.accountId]
    );

    const tx: any = inserted.rows[0];
    const acc: any = account.rows[0] || null;
    return reply.code(201).send({
      data: {
        transaction: {
          id: tx.id,
          transaction_date: tx.fecha_transaccion,
          description: tx.descripcion,
          amount: tx.monto,
          currency: tx.moneda,
          direction: legacyTxTypeToDirection(tx.tipo),
          status: legacyTxStatusToEnum(tx.estado),
          account_id: tx.cuenta_id,
          category_id: null,
          counterparty_id: null,
          notes: null,
          external_ref: null,
          created_at: tx.created_at,
          updated_at: tx.created_at,
        },
        account: acc
          ? {
              id: acc.id,
              code: `CUENTA-${acc.id}`,
              name: acc.nombre,
              currency: acc.moneda,
              account_type: legacyAccountTypeToEnum(acc.tipo),
              balance_current: acc.saldo_actual,
              is_active: true,
              created_at: null,
              updated_at: null,
            }
          : null,
      },
    });
  }

  const uniqueTagIds = [...new Set(payload.tags || [])];
  const splits = payload.splits || [];
  const attachments = payload.attachments || [];

  if (!(await canAccessResource(ownerUserId, "ACCOUNT", payload.accountId, "WRITE"))) {
    return reply.code(403).send({
      error: "No tienes permiso para registrar movimientos en esta cuenta.",
      code: "SHARED_ACCOUNT_WRITE_REQUIRED",
    });
  }

  if (splits.length > 0) {
    const splitTotal = splits.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    if (!closeAmountDiff(payload.amount, splitTotal)) {
      return reply.code(400).send({
        error: "Split total must equal transaction amount",
        details: {
          transactionAmount: payload.amount,
          splitTotal,
        },
      });
    }
  }

  const data = await withTransaction(async (client) => {
    const account = await client.query(
      `SELECT id, owner_user_id, code, name, currency, account_type, balance_current, is_active
         FROM accounts
        WHERE id = $1
        LIMIT 1`,
      [payload.accountId]
    );

    if (!account.rows[0]) {
      throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Account not found");
    }

    const dataOwnerUserId = String(account.rows[0].owner_user_id);

    if (!account.rows[0].is_active) {
      throw new ApiError(409, "ACCOUNT_INACTIVE", "Account is inactive");
    }

    if (payload.categoryId) {
      const category = await client.query(`SELECT id FROM categories WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [
        payload.categoryId,
        dataOwnerUserId,
      ]);
      if (!category.rowCount) {
        throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found");
      }
    }

    if (payload.counterpartyId) {
      const counterparty = await client.query(`SELECT id FROM counterparties WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [
        payload.counterpartyId,
        dataOwnerUserId,
      ]);
      if (!counterparty.rowCount) {
        throw new ApiError(404, "COUNTERPARTY_NOT_FOUND", "Counterparty not found");
      }
    }

    if (uniqueTagIds.length > 0) {
      const tags = await client.query(`SELECT id FROM tags WHERE id = ANY($1::bigint[]) AND owner_user_id = $2`, [uniqueTagIds, dataOwnerUserId]);
      if (tags.rowCount !== uniqueTagIds.length) {
        throw new ApiError(404, "TAG_NOT_FOUND", "One or more tags do not exist");
      }
    }

    const inserted = await client.query(
        `INSERT INTO transactions (
         owner_user_id,
         created_by_user_id,
         transaction_date,
         description,
         amount,
         currency,
         direction,
         status,
         account_id,
         category_id,
         counterparty_id,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id,
                 transaction_date,
                 description,
                 amount,
                 currency,
                 direction,
                 status,
                 account_id,
                 category_id,
                 counterparty_id,
                 notes,
                 external_ref,
                 created_at,
                 updated_at`,
      [
        dataOwnerUserId,
        ownerUserId,
        payload.transactionDate,
        payload.description || null,
        payload.amount,
        payload.currency.toUpperCase(),
        payload.direction,
        payload.status,
        payload.accountId,
        payload.categoryId || null,
        payload.counterpartyId || null,
        payload.notes || null,
      ]
    );

    const transactionId = inserted.rows[0]?.id as number;

    if (uniqueTagIds.length > 0) {
      await client.query(
        `INSERT INTO transaction_tags (owner_user_id, transaction_id, tag_id)
         SELECT $1, $2, t.tag_id
           FROM unnest($3::bigint[]) AS t(tag_id)
         ON CONFLICT DO NOTHING`,
        [dataOwnerUserId, transactionId, uniqueTagIds]
      );
    }

    if (splits.length > 0) {
      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        await client.query(
          `INSERT INTO transaction_splits (owner_user_id, transaction_id, line_no, description, category_id, counterparty_id, amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            dataOwnerUserId,
            transactionId,
            i + 1,
            split.description || null,
            split.categoryId || null,
            split.counterpartyId || null,
            split.amount,
          ]
        );
      }
    }

    if (attachments.length > 0) {
      for (const attachment of attachments) {
        await client.query(
          `INSERT INTO attachments (owner_user_id, transaction_id, file_name, file_url, mime_type, file_size)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            dataOwnerUserId,
            transactionId,
            attachment.fileName,
            attachment.fileUrl,
            attachment.mimeType || null,
            attachment.fileSize ?? null,
          ]
        );
      }
    }

    const balanceDelta = payload.direction === "INFLOW" ? payload.amount : -payload.amount;

    const accountUpdated = await client.query(
      `UPDATE accounts
          SET balance_current = balance_current + $1,
              updated_at = NOW()
        WHERE id = $2
          AND owner_user_id = $3
      RETURNING id, code, name, currency, account_type, balance_current, is_active, created_at, updated_at`,
      [balanceDelta, payload.accountId, dataOwnerUserId]
    );

    return {
      ownerUserId: dataOwnerUserId,
      transaction: inserted.rows[0],
      account: accountUpdated.rows[0],
    };
  });

  if (await hasPlanningTables()) {
    await withTransaction((client) => syncBudgetDeficitEvents(client as unknown as DbExecutor, monthFromDateString(payload.transactionDate), data.ownerUserId || ownerUserId));
  }

  return reply.code(201).send({ data });
});

app.get("/v1/investments", async (req) => {
  if (await isLegacyJournalSchema()) {
    const result = await query(
      `SELECT t.id,
              t.simbolo AS symbol,
              COALESCE(NULLIF(t.nombre_jugada, ''), t.simbolo) AS name,
              'OTHER'::text AS asset_type,
              CASE WHEN COALESCE(t.precio_entrada, 0) > 0 THEN (t.monto_margin / t.precio_entrada) ELSE 0 END AS quantity,
              COALESCE(t.precio_entrada, 0) AS avg_cost,
              'USD'::text AS currency,
              t.cuenta_id AS account_id,
              c.nombre AS account_name,
              t.notas_aprendizaje AS notes,
              (COALESCE(t.estado, 'OPEN') = 'OPEN') AS is_active,
              t.fecha_apertura AS created_at,
              COALESCE(t.fecha_cierre, t.fecha_apertura) AS updated_at,
              COALESCE(t.monto_margin, 0) AS invested_amount
         FROM trades_activos t
    LEFT JOIN cuentas c ON c.id = t.cuenta_id
        WHERE UPPER(COALESCE(t.tipo_estrategia, 'TRADING')) = 'HOLDING'
        ORDER BY t.fecha_apertura DESC, t.id DESC`
    );

    return { data: result.rows };
  }

  const ownerUserId = await getRequestOwnerUserId(req);
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
      WHERE i.owner_user_id = $1
      ORDER BY i.updated_at DESC, i.id DESC`
    ,
    [ownerUserId]
  );

  return { data: result.rows };
});

app.post("/v1/investments", async (req, reply) => {
  const parsed = createInvestmentSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;

  if (await isLegacyJournalSchema()) {
    return reply.code(501).send({
      error: "Tags no disponible en esquema legacy journal.",
      code: "LEGACY_TAGS_UNSUPPORTED",
      details: { requestedName: payload.name },
    });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  if (payload.accountId !== undefined && payload.accountId !== null) {
    const accountCheck = await query(`SELECT id FROM accounts WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [
      payload.accountId,
      ownerUserId,
    ]);
    if (!accountCheck.rowCount) {
      return reply.code(400).send({ error: "La cuenta seleccionada no existe o no pertenece al usuario." });
    }
  }

  const result = await query(
    `INSERT INTO investments (
       owner_user_id,
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
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      ownerUserId,
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

  const ownerUserId = await getRequestOwnerUserId(req);
  const currentInvestment = await query(`SELECT id FROM investments WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [id, ownerUserId]);
  if (!currentInvestment.rowCount) {
    return reply.code(404).send({ error: "Investment not found" });
  }
  if (payload.accountId !== undefined && payload.accountId !== null) {
    const accountCheck = await query(`SELECT id FROM accounts WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [
      payload.accountId,
      ownerUserId,
    ]);
    if (!accountCheck.rowCount) {
      return reply.code(400).send({ error: "La cuenta seleccionada no existe o no pertenece al usuario." });
    }
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
        AND owner_user_id = $${values.length + 1}
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

app.get("/v1/investments/summary", async (req) => {
  if (await isLegacyJournalSchema()) {
    const result = await query<{
      positions: string;
      invested_total: string;
      active_positions: string;
    }>(
      `SELECT
         COUNT(*)::text AS positions,
         COALESCE(SUM(COALESCE(monto_margin, 0)), 0)::text AS invested_total,
         COALESCE(SUM(CASE WHEN COALESCE(estado, 'OPEN') = 'OPEN' THEN 1 ELSE 0 END), 0)::text AS active_positions
       FROM trades_activos
       WHERE UPPER(COALESCE(tipo_estrategia, 'TRADING')) = 'HOLDING'`
    );

    return {
      data: {
        positions: Number(result.rows[0]?.positions || 0),
        activePositions: Number(result.rows[0]?.active_positions || 0),
        investedTotal: Number(result.rows[0]?.invested_total || 0),
      },
    };
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const result = await query<{
    positions: string;
    invested_total: string;
    active_positions: string;
  }>(
    `SELECT
       COUNT(*)::text AS positions,
       COALESCE(SUM(quantity * avg_cost), 0)::text AS invested_total,
       COALESCE(SUM(CASE WHEN is_active THEN 1 ELSE 0 END), 0)::text AS active_positions
     FROM investments
     WHERE owner_user_id = $1`,
    [ownerUserId]
  );

  return {
    data: {
      positions: Number(result.rows[0]?.positions || 0),
      activePositions: Number(result.rows[0]?.active_positions || 0),
      investedTotal: Number(result.rows[0]?.invested_total || 0),
    },
  };
});

app.get("/v1/copilot/sessions", async (req) => {
  if (await isLegacyJournalSchema()) {
    const result = await query(
      `SELECT s.id,
              s.title,
              CASE WHEN UPPER(COALESCE(s.agent_type, 'TRADER')) = 'ACCOUNTANT' THEN 'ACCOUNTANT' ELSE 'ANALYST' END AS mode,
              s.created_at,
              s.updated_at,
              COUNT(m.id)::int AS message_count
         FROM react_chat_sessions s
    LEFT JOIN react_chat_messages m ON m.session_id = s.id
        GROUP BY s.id
        ORDER BY s.updated_at DESC`
    );
    return { data: result.rows };
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const result = await query(
    `SELECT s.id,
            s.title,
            s.mode,
            s.created_at,
            s.updated_at,
            COUNT(m.id)::int AS message_count
       FROM copilot_sessions s
  LEFT JOIN copilot_messages m ON m.session_id = s.id
      WHERE s.owner_user_id = $1
      GROUP BY s.id
      ORDER BY s.updated_at DESC`,
    [ownerUserId]
  );

  return { data: result.rows };
});

app.post("/v1/copilot/sessions", async (req, reply) => {
  const parsed = createCopilotSessionSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const ownerUserId = await getRequestOwnerUserId(req);

  const title = payload.title || "Nueva sesiÃ³n";

  if (await isLegacyJournalSchema()) {
    const userId = await getLegacyDefaultUserId();
    const result = await query(
      `INSERT INTO react_chat_sessions (user_id, title, agent_type)
       VALUES ($1, $2, $3)
       RETURNING id,
                 title,
                 CASE WHEN UPPER(COALESCE(agent_type, 'TRADER')) = 'ACCOUNTANT' THEN 'ACCOUNTANT' ELSE 'ANALYST' END AS mode,
                 created_at,
                 updated_at`,
      [userId, title, payload.mode === "ACCOUNTANT" ? "ACCOUNTANT" : "TRADER"]
    );

    return reply.code(201).send({ data: result.rows[0] });
  }

  const result = await query(
    `INSERT INTO copilot_sessions (owner_user_id, title, mode)
     VALUES ($1, $2, $3)
     RETURNING id, title, mode, created_at, updated_at`,
    [ownerUserId, title, payload.mode]
  );

  return reply.code(201).send({ data: result.rows[0] });
});

app.get("/v1/copilot/models", async () => {
  const cfg = getCopilotModelsConfig();
  return {
    data: {
      provider: "multi",
      configured: cfg.providers.openaiConfigured || cfg.providers.googleConfigured || cfg.providers.nvidiaConfigured,
      models: cfg.models,
      options: cfg.options,
      defaultModel: cfg.defaultModel,
      capabilities: {
        attachments: {
          enabled: cfg.providers.openaiConfigured || cfg.providers.googleConfigured || cfg.providers.nvidiaConfigured,
          kinds: ["image", "file"],
          maxFiles: COPILOT_MAX_ATTACHMENTS,
          maxDataUrlCharsPerFile: COPILOT_MAX_ATTACHMENT_DATA_URL_CHARS,
          maxDataUrlCharsTotal: COPILOT_MAX_TOTAL_ATTACHMENT_DATA_URL_CHARS,
        },
      },
      providers: cfg.providers,
    },
  };
});

app.get("/v1/copilot/sessions/:id/messages", async (req, reply) => {
  const sessionId = String((req.params as any)?.id || "");

  if (await isLegacyJournalSchema()) {
    const exists = await query(`SELECT id FROM react_chat_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
    if (!exists.rowCount) {
      return reply.code(404).send({ error: "Session not found" });
    }

    const result = await query(
      `SELECT id::text AS id, role, content, created_at
         FROM react_chat_messages
        WHERE session_id = $1
        ORDER BY created_at ASC, id ASC`,
      [sessionId]
    );

    return { data: result.rows };
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const exists = await query(`SELECT id FROM copilot_sessions WHERE id = $1 AND owner_user_id = $2 LIMIT 1`, [sessionId, ownerUserId]);
  if (!exists.rowCount) {
    return reply.code(404).send({ error: "Session not found" });
  }

  const result = await query(
    `SELECT id, role, content, created_at
       FROM copilot_messages
      WHERE session_id = $1
        AND owner_user_id = $2
      ORDER BY created_at ASC, id ASC`,
    [sessionId, ownerUserId]
  );

  return { data: result.rows };
});

app.post("/v1/copilot/chat", async (req, reply) => {
  const parsed = chatMessageSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { sessionId, message, model, attachments } = parsed.data;
  const ownerUserId = await getRequestOwnerUserId(req);
  const totalAttachmentChars = (attachments || []).reduce((acc, item) => acc + item.dataUrl.length, 0);
  if (totalAttachmentChars > COPILOT_MAX_TOTAL_ATTACHMENT_DATA_URL_CHARS) {
    return reply.code(413).send({
      error: `Adjuntos demasiado grandes. Reduce el tamaÃ±o total por debajo de ${COPILOT_MAX_TOTAL_ATTACHMENT_DATA_URL_CHARS} caracteres base64.`,
    });
  }
  for (const attachment of attachments || []) {
    if (!isBase64DataUrl(attachment.dataUrl)) {
      return reply.code(400).send({ error: `Adjunto invÃ¡lido (${attachment.name}). Debe venir como data URL base64.` });
    }
    if (attachment.kind === "image" && !isImageDataUrl(attachment.dataUrl)) {
      return reply.code(400).send({ error: `Adjunto invÃ¡lido (${attachment.name}). kind=image requiere data URL de imagen.` });
    }
  }

  if (await isLegacyJournalSchema()) {
    const sessionRes = await query<{ id: string; title: string | null; mode: "ACCOUNTANT" | "ANALYST" }>(
      `SELECT id,
              title,
              CASE WHEN UPPER(COALESCE(agent_type, 'TRADER')) = 'ACCOUNTANT' THEN 'ACCOUNTANT' ELSE 'ANALYST' END AS mode
         FROM react_chat_sessions
        WHERE id = $1
        LIMIT 1`,
      [sessionId]
    );

    if (!sessionRes.rowCount) {
      return reply.code(404).send({ error: "Session not found" });
    }

    const session = sessionRes.rows[0];
    await query(
      `INSERT INTO react_chat_messages (session_id, role, content)
       VALUES ($1, 'user', $2)`,
      [sessionId, message]
    );

    const context = await buildCopilotContext(ownerUserId);
    let assistantReply: string | null = null;
    let modelRequested = model || getCopilotModelsConfig().defaultModel;
    let modelResolved: string | null = null;
    let modelFallbackReason: string | undefined;
    try {
      const llmResult = await buildOpenAIReply(message, context, model, attachments);
      assistantReply = llmResult.reply;
      modelRequested = llmResult.requestedModel;
      modelResolved = llmResult.resolvedModel;
      modelFallbackReason = llmResult.fallbackReason;
    } catch (error: any) {
      app.log.warn({ error: error?.message || error }, "copilot llm reply failed");
      if (error instanceof ApiError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.errorCode,
          details: error.details,
        });
      }
      return reply.code(502).send({
        error: error?.message || "Error de conexion con el proveedor de IA.",
        code: "COPILOT_UPSTREAM_ERROR",
      });
    }

    if (!assistantReply) {
      return reply.code(502).send({
        error: "El proveedor de IA no devolvio contenido util.",
        code: "COPILOT_EMPTY_RESPONSE",
      });
    }

    const assistantInsert = await query(
      `INSERT INTO react_chat_messages (session_id, role, content)
       VALUES ($1, 'assistant', $2)
       RETURNING id::text AS id, role, content, created_at`,
      [sessionId, assistantReply]
    );

    const currentTitle = (session.title || "").trim();
    if (!currentTitle || currentTitle.toLowerCase().includes("nueva sesi")) {
      await query(`UPDATE react_chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2`, [guessTitleFromMessage(message), sessionId]);
    } else {
      await query(`UPDATE react_chat_sessions SET updated_at = NOW() WHERE id = $1`, [sessionId]);
    }

    return reply.code(201).send({
      data: {
        sessionId,
        mode: session.mode,
        modelRequested,
        modelResolved,
        modelFallbackReason,
        assistantMessage: assistantInsert.rows[0],
        context: {
          totalBalance: context.totalBalance,
          monthInflow: context.monthInflow,
          monthOutflow: context.monthOutflow,
        },
      },
    });
  }

  const sessionRes = await query<{ id: string; title: string; mode: "ACCOUNTANT" | "ANALYST" }>(
    `SELECT id, title, mode
       FROM copilot_sessions
      WHERE id = $1
        AND owner_user_id = $2
      LIMIT 1`,
    [sessionId, ownerUserId]
  );

  if (!sessionRes.rowCount) {
    return reply.code(404).send({ error: "Session not found" });
  }

  const session = sessionRes.rows[0];

  await query(
    `INSERT INTO copilot_messages (owner_user_id, session_id, role, content)
     VALUES ($1, $2, 'user', $3)`,
    [ownerUserId, sessionId, message]
  );

  const context = await buildCopilotContext(ownerUserId);

  let assistantReply: string | null = null;
  let modelRequested = model || getCopilotModelsConfig().defaultModel;
  let modelResolved: string | null = null;
  let modelFallbackReason: string | undefined;
  try {
    const llmResult = await buildOpenAIReply(message, context, model, attachments);
    assistantReply = llmResult.reply;
    modelRequested = llmResult.requestedModel;
    modelResolved = llmResult.resolvedModel;
    modelFallbackReason = llmResult.fallbackReason;
  } catch (error: any) {
    app.log.warn({ error: error?.message || error }, "copilot llm reply failed");
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: error.message,
        code: error.errorCode,
        details: error.details,
      });
    }
    return reply.code(502).send({
      error: error?.message || "Error de conexion con el proveedor de IA.",
      code: "COPILOT_UPSTREAM_ERROR",
    });
  }

  if (!assistantReply) {
    return reply.code(502).send({
      error: "El proveedor de IA no devolvio contenido util.",
      code: "COPILOT_EMPTY_RESPONSE",
    });
  }

  const assistantInsert = await query(
    `INSERT INTO copilot_messages (owner_user_id, session_id, role, content)
     VALUES ($1, $2, 'assistant', $3)
     RETURNING id, role, content, created_at`,
    [ownerUserId, sessionId, assistantReply]
  );

  const currentTitle = (session.title || "").trim();
  if (currentTitle === "Nueva sesiÃ³n") {
    await query(`UPDATE copilot_sessions SET title = $1, updated_at = NOW() WHERE id = $2 AND owner_user_id = $3`, [
      guessTitleFromMessage(message),
      sessionId,
      ownerUserId,
    ]);
  } else {
    await query(`UPDATE copilot_sessions SET updated_at = NOW() WHERE id = $1 AND owner_user_id = $2`, [sessionId, ownerUserId]);
  }

  return reply.code(201).send({
    data: {
      sessionId,
      mode: session.mode,
      modelRequested,
      modelResolved,
      modelFallbackReason,
      assistantMessage: assistantInsert.rows[0],
      context: {
        totalBalance: context.totalBalance,
        monthInflow: context.monthInflow,
        monthOutflow: context.monthOutflow,
      },
    },
  });
});

app.get("/v1/summary", async (req) => {
  if (await isLegacyJournalSchema()) {
    const [balances, flow, portfolio] = await Promise.all([
      query<{ total_balance: string }>(`SELECT COALESCE(SUM(saldo_actual), 0)::text AS total_balance FROM cuentas`),
      query<{ inflow: string; outflow: string }>(
        `SELECT
           COALESCE(SUM(CASE WHEN LOWER(tipo) = 'ingreso' THEN monto ELSE 0 END), 0)::text AS inflow,
           COALESCE(SUM(CASE WHEN LOWER(tipo) <> 'ingreso' THEN monto ELSE 0 END), 0)::text AS outflow
         FROM transacciones
         WHERE fecha_transaccion >= date_trunc('month', CURRENT_DATE)`
      ),
      query<{ invested_total: string; positions: string }>(
        `SELECT
           COALESCE(SUM(COALESCE(monto_margin, 0)), 0)::text AS invested_total,
           COUNT(*)::text AS positions
         FROM trades_activos
         WHERE UPPER(COALESCE(tipo_estrategia, 'TRADING')) = 'HOLDING'`
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
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const accessibleAccountIds = await getAccessibleAccountIds(ownerUserId, "READ");
  const accessibleTransactionIds = await getAccessibleTransactionIds(ownerUserId, "READ");
  const accountIdFilter = accessibleAccountIds.length ? `id = ANY($1::bigint[])` : "FALSE";
  const transactionIdFilter = accessibleTransactionIds.length ? `id = ANY($1::bigint[])` : "FALSE";
  const [balances, flow, portfolio] = await Promise.all([
    query<{ total_balance: string }>(
      `SELECT COALESCE(SUM(balance_current), 0)::text AS total_balance
         FROM accounts
        WHERE is_active = TRUE
          AND ${accountIdFilter}`,
      accessibleAccountIds.length ? [accessibleAccountIds.map(Number)] : []
    ),
    query<{ inflow: string; outflow: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount ELSE 0 END), 0)::text AS inflow,
         COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END), 0)::text AS outflow
       FROM transactions
       WHERE transaction_date >= date_trunc('month', CURRENT_DATE)::date
         AND ${transactionIdFilter}`,
      accessibleTransactionIds.length ? [accessibleTransactionIds.map(Number)] : []
    ),
    query<{ invested_total: string; positions: string }>(
      `SELECT
         COALESCE(SUM(quantity * avg_cost), 0)::text AS invested_total,
         COUNT(*)::text AS positions
       FROM investments
       WHERE is_active = TRUE
         AND owner_user_id = $1`,
      [ownerUserId]
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

app.get("/v1/reports/cashflow", async (req) => {
  const parsed = reportRangeSchema.parse((req as any).query || {});
  const ownerUserId = await getRequestOwnerUserId(req);
  let values: any[] = [ownerUserId];
  const where: string[] = [`owner_user_id = $1`];

  if (await isLegacyJournalSchema()) {
    if (parsed.from) {
      values.push(parsed.from);
      where.push(`fecha_transaccion >= $${values.length}::date`);
    }
    if (parsed.to) {
      values.push(parsed.to);
      where.push(`fecha_transaccion <= $${values.length}::date`);
    }

    const whereClauseLegacy = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query<{
      period: string;
      inflow: string;
      outflow: string;
      net: string;
    }>(
      `SELECT to_char(date_trunc('month', fecha_transaccion), 'YYYY-MM') AS period,
              COALESCE(SUM(CASE WHEN LOWER(tipo) = 'ingreso' THEN monto ELSE 0 END), 0)::text AS inflow,
              COALESCE(SUM(CASE WHEN LOWER(tipo) <> 'ingreso' THEN monto ELSE 0 END), 0)::text AS outflow,
              COALESCE(SUM(CASE WHEN LOWER(tipo) = 'ingreso' THEN monto ELSE -monto END), 0)::text AS net
         FROM transacciones
         ${whereClauseLegacy}
        GROUP BY date_trunc('month', fecha_transaccion)
        ORDER BY date_trunc('month', fecha_transaccion) ASC`,
      values
    );

    return {
      data: result.rows.map((row) => ({
        period: row.period,
        inflow: Number(row.inflow || 0),
        outflow: Number(row.outflow || 0),
        net: Number(row.net || 0),
      })),
    };
  }

  if (parsed.from) {
    values.push(parsed.from);
    where.push(`transaction_date >= $${values.length}::date`);
  }

  if (parsed.to) {
    values.push(parsed.to);
    where.push(`transaction_date <= $${values.length}::date`);
  }

  const accessibleTransactionIds = await getAccessibleTransactionIds(ownerUserId, "READ");
  if (!accessibleTransactionIds.length) return { data: [] };
  values = [accessibleTransactionIds.map(Number), ...values.slice(1)];
  where[0] = `id = ANY($1::bigint[])`;

  const whereClause = `WHERE ${where.join(" AND ")}`;

  const result = await query<{
    period: string;
    inflow: string;
    outflow: string;
    net: string;
  }>(
    `SELECT to_char(date_trunc('month', transaction_date), 'YYYY-MM') AS period,
            COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount ELSE 0 END), 0)::text AS inflow,
            COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END), 0)::text AS outflow,
            COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount ELSE -amount END), 0)::text AS net
       FROM transactions
       ${whereClause}
      GROUP BY date_trunc('month', transaction_date)
      ORDER BY date_trunc('month', transaction_date) ASC`,
    values
  );

  return {
    data: result.rows.map((row) => ({
      period: row.period,
      inflow: Number(row.inflow || 0),
      outflow: Number(row.outflow || 0),
      net: Number(row.net || 0),
    })),
  };
});

app.get("/v1/reports/category-breakdown", async (req) => {
  const parsed = categoryBreakdownQuerySchema.parse((req as any).query || {});
  const ownerUserId = await getRequestOwnerUserId(req);
  let values: any[] = [ownerUserId, parsed.direction];
  const where: string[] = [`t.owner_user_id = $1`, `t.direction = $2`];

  if (await isLegacyJournalSchema()) {
    const legacyValues: any[] = [];
    const legacyWhere: string[] = [];
    if (parsed.direction === "INFLOW") {
      legacyWhere.push(`LOWER(t.tipo) = 'ingreso'`);
    } else {
      legacyWhere.push(`LOWER(t.tipo) <> 'ingreso'`);
    }
    if (parsed.from) {
      legacyValues.push(parsed.from);
      legacyWhere.push(`t.fecha_transaccion >= $${legacyValues.length}::date`);
    }
    if (parsed.to) {
      legacyValues.push(parsed.to);
      legacyWhere.push(`t.fecha_transaccion <= $${legacyValues.length}::date`);
    }
    legacyValues.push(parsed.limit);

    const result = await query<{
      category_name: string | null;
      total_amount: string;
      tx_count: string;
    }>(
      `SELECT t.categoria AS category_name,
              COALESCE(SUM(t.monto), 0)::text AS total_amount,
              COUNT(*)::text AS tx_count
         FROM transacciones t
        WHERE ${legacyWhere.join(" AND ")}
        GROUP BY t.categoria
        ORDER BY SUM(t.monto) DESC
        LIMIT $${legacyValues.length}`,
      legacyValues
    );

    return {
      data: result.rows.map((row, idx) => ({
        categoryId: idx + 1,
        categoryName: row.category_name || "Sin categoria",
        totalAmount: Number(row.total_amount || 0),
        txCount: Number(row.tx_count || 0),
      })),
    };
  }

  if (parsed.from) {
    values.push(parsed.from);
    where.push(`t.transaction_date >= $${values.length}::date`);
  }

  if (parsed.to) {
    values.push(parsed.to);
    where.push(`t.transaction_date <= $${values.length}::date`);
  }

  const accessibleTransactionIds = await getAccessibleTransactionIds(ownerUserId, "READ");
  if (!accessibleTransactionIds.length) return { data: [] };
  values = [accessibleTransactionIds.map(Number), ...values.slice(1)];
  where[0] = `t.id = ANY($1::bigint[])`;
  where[1] = `t.direction = $2`;

  values.push(parsed.limit);

  const result = await query<{
    category_id: string | null;
    category_name: string | null;
    total_amount: string;
    tx_count: string;
  }>(
    `SELECT c.id::text AS category_id,
            c.name AS category_name,
            COALESCE(SUM(t.amount), 0)::text AS total_amount,
            COUNT(*)::text AS tx_count
       FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
      WHERE ${where.join(" AND ")}
      GROUP BY c.id, c.name
      ORDER BY SUM(t.amount) DESC
      LIMIT $${values.length}`,
    values
  );

  return {
    data: result.rows.map((row) => ({
      categoryId: row.category_id ? Number(row.category_id) : null,
      categoryName: row.category_name || "Sin categoria",
      totalAmount: Number(row.total_amount || 0),
      txCount: Number(row.tx_count || 0),
    })),
  };
});

app.get("/v1/reports/monthly-finance-summary", async (req, reply) => {
  const parsed = listBudgetDeficitsQuerySchema.parse((req as any).query || {});
  const ownerUserId = await getRequestOwnerUserId(req);

  if ((await isLegacyJournalSchema()) && !(await hasPlanningTables())) {
    return reply.code(501).send({
      error: "Monthly finance summary no disponible en esquema legacy journal.",
      code: "LEGACY_MONTHLY_SUMMARY_UNSUPPORTED",
    });
  }

  const month = parsed.month || currentYYYYMM();
  await withTransaction((client) => syncBudgetDeficitEvents(client as unknown as DbExecutor, month, ownerUserId));
  const [accessibleBudgetIds, accessibleAccountIds] = await Promise.all([
    getAccessibleIds(ownerUserId, "BUDGET", "READ"),
    getAccessibleAccountIds(ownerUserId, "READ"),
  ]);

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
          AND e.budget_id = ANY($2::bigint[])
        ORDER BY e.detected_at DESC, e.id DESC`,
      [month, accessibleBudgetIds.map(Number)]
    ),
    query<{ total_balance: string }>(
      `SELECT COALESCE(SUM(balance_current), 0)::text AS total_balance
        FROM accounts
        WHERE is_active = TRUE
          AND id = ANY($1::bigint[])`,
      [accessibleAccountIds.map(Number)]
    ),
  ]);

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
    data: {
      month,
      totalBalance: Number(balancesRes.rows[0]?.total_balance || 0),
      deficitEntryCount: enteredCount,
      totalIncidentCount: events.length,
      maxDeficitAmount,
      totalRecordedDeficitAmount: normalizeAmount(totalRecordedDeficitAmount),
      topProblemBudgets: [...budgetAgg.values()].sort((a, b) => b.incidents - a.incidents || b.maxDeficitAmount - a.maxDeficitAmount).slice(0, 5),
      frequentCauses: [...causeAgg.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    },
  };
});

app.post("/v1/agents/chat", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({
      error: "AGENT_RUNTIME_ENABLED=false. Activa el runtime en variables de entorno.",
      code: "AGENT_RUNTIME_DISABLED",
    });
  }

  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({
      error: "Tablas agÃ©nticas no encontradas. Ejecuta migraciones (006_agentic_foundation.sql).",
      code: "AGENT_TABLES_MISSING",
    });
  }

  const parsed = agentChatSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const ownerUserId = await getRequestOwnerUserId(req);

  const runInsert = await query<{ id: string }>(
    `INSERT INTO agent_runs (owner_user_id, channel, agent_name, status, user_message, model_requested)
     VALUES ($1, $2, $3, 'RUNNING', $4, $5)
     RETURNING id`,
    [ownerUserId, payload.channel, agentDefaultName, payload.message, payload.model || null]
  );
  const runId = runInsert.rows[0].id;

  await query(
    `INSERT INTO agent_steps (owner_user_id, run_id, step_name, status, notes)
     VALUES ($1, $2, 'context-build', 'RUNNING', 'Construyendo contexto financiero')`,
    [ownerUserId, runId]
  );

  try {
    const context = await buildCopilotContext(ownerUserId);

    await query(
      `INSERT INTO agent_steps (owner_user_id, run_id, step_name, status, notes)
       VALUES ($1, $2, 'response-generation', 'RUNNING', 'Generando respuesta del agente')`,
      [ownerUserId, runId]
    );

    let assistantReply = "";
    let modelRequested = payload.model || getCopilotModelsConfig().defaultModel;
    let modelResolved: string | null = null;
    let modelFallbackReason: string | undefined;
    let mastraToolResults: unknown[] = [];

    const resolution = resolveCopilotModel(payload.model);
    if (resolution.error) {
      throw resolution.error;
    }
    if (!resolution.resolvedModel || !resolution.provider) {
      throw new ApiError(400, "MODEL_RESOLUTION_FAILED", "No se pudo resolver el modelo para runtime agÃ©ntico.");
    }

    const mastraResult = await runMastraAgentChat({
      message: payload.message,
      requestedModel: resolution.requestedModel,
      resolvedModel: resolution.resolvedModel,
      provider: resolution.provider,
      ownerUserId,
      context,
      buildProposalsFromMessage: buildAgentProposalsFromMessage,
    });

    assistantReply = mastraResult.text;
    modelRequested = resolution.requestedModel;
    modelResolved = mastraResult.modelUsed;
    modelFallbackReason = resolution.fallbackReason;
    mastraToolResults = mastraResult.toolResults || [];

    const detectedProposals = buildAgentProposalsFromMessage(payload.message);
    const createdProposalIds: string[] = [];
    const createdViewIds: string[] = [];

    for (const proposal of detectedProposals) {
      const proposalInsert = await query<{ id: string }>(
        `INSERT INTO agent_proposals (owner_user_id, run_id, proposal_type, title, summary, payload, status)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'PENDING')
         RETURNING id`,
        [ownerUserId, runId, proposal.proposalType, proposal.title, proposal.summary, JSON.stringify(proposal.payload || {})]
      );
      const proposalId = proposalInsert.rows[0].id;
      createdProposalIds.push(proposalId);

      if (proposal.proposalType === "CREATE_DASHBOARD") {
        const baseSlug = slugify(proposal.title);
        const viewInsert = await query<{ id: string }>(
          `INSERT INTO generated_views (owner_user_id, source_proposal_id, slug, title, description, layout, status, config)
           VALUES ($1, $2, $3, $4, $5, 'GRID', 'DRAFT', $6::jsonb)
           ON CONFLICT (owner_user_id, slug) DO UPDATE SET
             source_proposal_id = EXCLUDED.source_proposal_id,
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             updated_at = NOW()
           RETURNING id`,
          [
            ownerUserId,
            proposalId,
            baseSlug,
            proposal.title,
            proposal.summary,
            JSON.stringify({
              widgetsCatalog: ["metric", "table", "line_chart", "bar_chart", "pie_chart", "timeline", "monthly_cashflow", "debt_projection", "investment_return", "portfolio_performance"],
              source: "agent-chat",
            }),
          ]
        );
        createdViewIds.push(viewInsert.rows[0].id);
      }

      if (proposal.proposalType === "CREATE_PROJECTION") {
        await query(
          `INSERT INTO projection_scenarios (owner_user_id, proposal_id, scenario_type, title, assumptions, result)
           VALUES ($1, $2, 'DEBT_PAYOFF', $3, $4::jsonb, '{}'::jsonb)`,
          [ownerUserId, proposalId, proposal.title, JSON.stringify(proposal.payload || {})]
        );
      }
    }

    await query(
      `INSERT INTO agent_tool_calls (owner_user_id, run_id, tool_name, status, input_payload, output_payload)
       VALUES ($1, $2, 'buildCopilotContext', 'SUCCESS', $3::jsonb, $4::jsonb)`,
      [
        ownerUserId,
        runId,
        JSON.stringify({ messageLength: payload.message.length }),
        JSON.stringify({
          accounts: context.accounts.length,
          recentTransactions: context.recentTransactions.length,
          monthInflow: context.monthInflow,
          monthOutflow: context.monthOutflow,
        }),
      ]
    );

    await query(
      `INSERT INTO agent_tool_calls (owner_user_id, run_id, tool_name, status, input_payload, output_payload)
       VALUES ($1, $2, 'mastra.runtime.generate', 'SUCCESS', $3::jsonb, $4::jsonb)`,
      [
        ownerUserId,
        runId,
        JSON.stringify({ requestedModel: modelRequested, resolvedModel: modelResolved }),
        JSON.stringify({ toolResults: mastraToolResults }),
      ]
    );

    await query(
      `UPDATE agent_runs
          SET status = 'COMPLETED',
              assistant_message = $2,
              model_requested = $3,
              model_resolved = $4,
              metadata = $5::jsonb,
              finished_at = NOW()
        WHERE id = $1
          AND owner_user_id = $6`,
      [
        runId,
        assistantReply,
        modelRequested,
        modelResolved,
        JSON.stringify({
          proposalsCreated: createdProposalIds.length,
          generatedViewsCreated: createdViewIds.length,
          modelFallbackReason: modelFallbackReason || null,
        }),
        ownerUserId,
      ]
    );

    return reply.code(201).send({
      data: {
        runId,
        agentName: agentDefaultName,
        channel: payload.channel,
        assistantMessage: assistantReply,
        modelRequested,
        modelResolved,
        modelFallbackReason,
        proposalIds: createdProposalIds,
        generatedViewIds: createdViewIds,
      },
    });
  } catch (error: any) {
    await query(
      `UPDATE agent_runs
          SET status = 'FAILED',
              error_code = 'AGENT_RUNTIME_ERROR',
              error_message = $2,
              finished_at = NOW()
        WHERE id = $1
          AND owner_user_id = $3`,
      [runId, error?.message || "Runtime failure", ownerUserId]
    );
    throw error;
  }
});

app.get("/v1/agent-runs", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const parsed = listAgentRunsQuerySchema.parse((req as any).query || {});
  const ownerUserId = await getRequestOwnerUserId(req);
  const values: any[] = [ownerUserId];
  const where: string[] = [`owner_user_id = $1`];
  if (parsed.status) {
    values.push(parsed.status);
    where.push(`status = $${values.length}`);
  }
  values.push(parsed.limit);
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query(
    `SELECT id, channel, agent_name, status, user_message, assistant_message, model_requested, model_resolved, started_at, finished_at, metadata
       FROM agent_runs
       ${whereClause}
      ORDER BY started_at DESC
      LIMIT $${values.length}`,
    values
  );

  return { data: result.rows };
});

app.get("/v1/agent-proposals", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const parsed = listProposalsQuerySchema.parse((req as any).query || {});
  const ownerUserId = await getRequestOwnerUserId(req);
  const values: any[] = [ownerUserId];
  const where: string[] = [`owner_user_id = $1`];
  if (parsed.status) {
    values.push(parsed.status);
    where.push(`status = $${values.length}`);
  }
  values.push(parsed.limit);
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query(
    `SELECT id, run_id, proposal_type, title, summary, payload, status, created_at, resolved_at
       FROM agent_proposals
       ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length}`,
    values
  );

  return { data: result.rows };
});

app.post("/v1/agent-proposals/:id/approve", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const proposalId = String((req.params as any)?.id || "");
  if (!proposalId) {
    return reply.code(400).send({ error: "proposal id is required" });
  }

  const parsed = agentProposalDecisionSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const proposal = await query<{ id: string; status: string; proposal_type: string; title: string; payload: any }>(
    `SELECT ap.id, ap.status, ap.proposal_type, ap.title, ap.payload
       FROM agent_proposals ap
       JOIN agent_runs ar ON ar.id = ap.run_id
      WHERE ap.id = $1
        AND ap.owner_user_id = $2
        AND ar.owner_user_id = $2
      LIMIT 1`,
    [proposalId, ownerUserId]
  );
  if (!proposal.rowCount) return reply.code(404).send({ error: "Proposal not found" });
  if (proposal.rows[0].status !== "PENDING") {
    return reply.code(409).send({ error: `Proposal is ${proposal.rows[0].status}, expected PENDING.` });
  }

  await withTransaction(async (client) => {
    const ownerId = ownerUserId;
    const proposalType = String(proposal.rows[0].proposal_type || "");
    const proposalPayload = (proposal.rows[0].payload || {}) as Record<string, any>;

    if (proposalType === "WRITE_OPERATION" && proposalPayload.action === "UPSERT_BUDGET") {
      const name = String(proposalPayload.name || "Presupuesto desde propuesta");
      const period = String(proposalPayload.period || "MONTHLY");
      const currency = String(proposalPayload.currency || "COP");
      const lines = Array.isArray(proposalPayload.lines) ? proposalPayload.lines : [];
      const month = currentYYYYMM();
      const startDate = String(proposalPayload.startDate || monthStartFromYYYYMM(month));
      const endDate = String(proposalPayload.endDate || monthEndFromYYYYMM(month));

      const budgetRes = await client.query<{ id: number }>(
        `INSERT INTO budgets (owner_user_id, name, period, currency, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [ownerId, name, period === "YEARLY" ? "YEARLY" : "MONTHLY", currency.toUpperCase(), startDate, endDate]
      );
      const budgetId = budgetRes.rows[0].id;

      for (const line of lines) {
        const categoryId = Number(line?.categoryId || 0);
        const limitAmount = Number(line?.limitAmount || 0);
        if (Number.isInteger(categoryId) && categoryId > 0 && limitAmount >= 0) {
          await client.query(`INSERT INTO budget_lines (owner_user_id, budget_id, category_id, limit_amount) VALUES ($1, $2, $3, $4)`, [
            ownerId,
            budgetId,
            categoryId,
            limitAmount,
          ]);
        }
      }
    }

    if (proposalType === "CREATE_REMINDER") {
      const title = String(proposalPayload.title || proposal.rows[0].title || "Recordatorio financiero");
      const channel = String(proposalPayload.channel || "IN_APP");
      const cadence = String(proposalPayload.cadence || "MONTHLY");
      const messageTemplate = String(proposalPayload.messageTemplate || "Recordatorio financiero mensual");
      const timezone = String(proposalPayload.timezone || "America/Bogota");
      const nextRunAt = String(proposalPayload.nextRunAt || new Date().toISOString());

      const scheduleRes = await client.query<{ id: string }>(
        `INSERT INTO agent_schedules (owner_user_id, name, cadence, timezone, is_active, payload)
         VALUES ($1, $2, $3, $4, TRUE, '{}'::jsonb)
         RETURNING id`,
        [ownerId, title, cadence, timezone]
      );
      await client.query(
        `INSERT INTO agent_reminders (owner_user_id, schedule_id, title, channel, target, message_template, next_run_at, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', '{}'::jsonb)`,
        [ownerId, scheduleRes.rows[0].id, title, ["IN_APP", "EMAIL", "WEBHOOK", "N8N"].includes(channel) ? channel : "IN_APP", proposalPayload.target || null, messageTemplate, nextRunAt]
      );
    }

    if (proposalType === "CREATE_PROJECTION") {
      const scenarioType = String(proposalPayload.scenarioType || "DEBT_PAYOFF");
      await client.query(
        `INSERT INTO projection_scenarios (owner_user_id, proposal_id, scenario_type, title, assumptions, result)
         VALUES ($1, $2, $3, $4, $5::jsonb, '{}'::jsonb)`,
        [ownerId, proposalId, ["DEBT_PAYOFF", "CASHFLOW", "INVESTMENT"].includes(scenarioType) ? scenarioType : "DEBT_PAYOFF", proposal.rows[0].title, JSON.stringify(proposalPayload)]
      );
    }

    await client.query(
      `UPDATE agent_proposals
          SET status = 'APPROVED',
              resolved_at = NOW()
        WHERE id = $1
          AND owner_user_id = $2`,
      [proposalId, ownerId]
    );
    await client.query(
      `INSERT INTO agent_approvals (owner_user_id, proposal_id, decision, reason, actor)
       VALUES ($1, $2, 'APPROVE', $3, 'user')`,
      [ownerId, proposalId, parsed.data.reason || null]
    );
  });

  return {
    data: {
      id: proposalId,
      status: "APPROVED",
    },
  };
});

app.post("/v1/agent-proposals/:id/reject", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const proposalId = String((req.params as any)?.id || "");
  if (!proposalId) {
    return reply.code(400).send({ error: "proposal id is required" });
  }

  const parsed = agentProposalDecisionSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const proposal = await query<{ id: string; status: string }>(
    `SELECT ap.id, ap.status
       FROM agent_proposals ap
       JOIN agent_runs ar ON ar.id = ap.run_id
      WHERE ap.id = $1
        AND ap.owner_user_id = $2
        AND ar.owner_user_id = $2
      LIMIT 1`,
    [proposalId, ownerUserId]
  );
  if (!proposal.rowCount) return reply.code(404).send({ error: "Proposal not found" });
  if (proposal.rows[0].status !== "PENDING") {
    return reply.code(409).send({ error: `Proposal is ${proposal.rows[0].status}, expected PENDING.` });
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE agent_proposals
          SET status = 'REJECTED',
              resolved_at = NOW()
        WHERE id = $1
          AND owner_user_id = $2`,
      [proposalId, ownerUserId]
    );
    await client.query(
      `INSERT INTO agent_approvals (owner_user_id, proposal_id, decision, reason, actor)
       VALUES ($1, $2, 'REJECT', $3, 'user')`,
      [ownerUserId, proposalId, parsed.data.reason || null]
    );
  });

  return {
    data: {
      id: proposalId,
      status: "REJECTED",
    },
  };
});

app.get("/v1/generated-views", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const parsed = listGeneratedViewsQuerySchema.parse((req as any).query || {});
  const ownerUserId = await getRequestOwnerUserId(req);
  const views = await listGeneratedViewsData(ownerUserId, parsed.status);
  return { data: views };
});

app.post("/v1/generated-views", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const parsed = generatedViewCreateSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const view = await createGeneratedViewData(ownerUserId, {
    ...parsed.data,
    sourceProposalId: parsed.data.sourceProposalId || null,
  });
  return reply.code(201).send({ data: view });
});

app.get("/v1/generated-views/:id", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const viewId = String((req.params as any)?.id || "");
  if (!viewId) return reply.code(400).send({ error: "view id is required" });

  const ownerUserId = await getRequestOwnerUserId(req);
  const view = await getGeneratedViewData(ownerUserId, viewId);
  if (!view) {
    return reply.code(404).send({ error: "Generated view not found" });
  }

  return { data: view };
});

app.patch("/v1/generated-views/:id", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const viewId = String((req.params as any)?.id || "");
  if (!viewId) return reply.code(400).send({ error: "view id is required" });
  const parsed = generatedViewUpdateSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const current = await getGeneratedViewData(ownerUserId, viewId);
  if (!current) {
    return reply.code(404).send({ error: "Generated view not found" });
  }

  const view = await createGeneratedViewData(ownerUserId, {
    slug: current.slug,
    title: parsed.data.title || current.title,
    description: parsed.data.description !== undefined ? parsed.data.description : current.description,
    layout: parsed.data.layout || current.layout,
    status: parsed.data.status || current.status,
    sourceProposalId: parsed.data.sourceProposalId || current.source_proposal_id || null,
    tabs: parsed.data.tabs || current.tabs || [],
    widgets: parsed.data.widgets || current.widgets || [],
    config: parsed.data.config || current.config || {},
  });

  return { data: view };
});

app.get("/v1/mcp/status", async (_req, reply) => {
  return reply.send({
    data: {
      ...getFinanceMcpStatus(),
      available: financeMcpEnabled,
    },
  });
});

app.get("/v1/mcp/tools", async (_req, reply) => {
  return reply.send({
    data: getFinanceMcpToolList(),
  });
});

app.get("/v1/tooling/manifest", async (_req, reply) => {
  const contract = getFinanceToolingContract();
  return reply.send({
    data: {
      product: contract.product,
      version: contract.version,
      apiBaseUrl: `http://${host}:${port}`,
      mcp: {
        enabled: financeMcpEnabled,
        path: financeMcpPath,
        statusEndpoint: "/v1/mcp/status",
        toolsEndpoint: "/v1/mcp/tools",
      },
      capabilities: {
        dashboards: true,
        declarativeViews: true,
        schedules: true,
        reminders: true,
        projections: true,
        budgets: true,
        transactions: true,
        accounts: true,
        monthlyReports: true,
        agentChat: true,
        telegramRemote: true,
      },
      rest: {
        chat: "/v1/agents/chat",
        schedules: "/v1/agent-schedules",
        reminders: "/v1/reminders",
        generatedViews: "/v1/generated-views",
        generatedViewCreate: "POST /v1/generated-views",
        generatedViewById: "/v1/generated-views/:id",
        generatedViewUpdate: "PATCH /v1/generated-views/:id",
        budgets: "/v1/budgets",
        projections: "/v1/projections/run",
        monthlySummary: "/v1/reports/monthly-finance-summary",
        telegramStatus: "/v1/integrations/telegram/status",
        telegramWebhook: "/v1/integrations/telegram/webhook",
        telegramTestMessage: "/v1/integrations/telegram/test-message",
        toolingSchema: "/v1/tooling/schema",
        openapi: "/v1/tooling/openapi",
      },
      recommendedExternalAgents: [
        {
          name: "Hermes",
          role: "Telegram front door and personal remote operator",
          transport: ["REST", "MCP"],
        },
        {
          name: "Mastra",
          role: "Internal finance copilot and dashboard creator",
          transport: ["REST", "MCP"],
        },
        {
          name: "Claude Code / Codex / other clients",
          role: "Tool-consuming assistant or builder",
          transport: ["REST", "MCP"],
        },
      ],
      publicToolIds: getFinanceMcpStatus().toolIds,
    },
  });
});

app.get("/v1/tooling/examples", async (_req, reply) => {
  const contract = getFinanceToolingContract();
  return reply.send({
    data: contract.examples,
  });
});

app.get("/v1/tooling/schema", async (_req, reply) => {
  const contract = getFinanceToolingContract();
  return reply.send({
    data: contract.schemas,
  });
});

app.get("/v1/tooling/openapi", async (_req, reply) => {
  return reply.send({
    data: getFinanceOpenApiSpec(),
  });
});

app.all(financeMcpPath, handleFinanceMcpRequest);
app.all(`${financeMcpPath}/*`, handleFinanceMcpRequest);

app.get("/v1/agent-schedules", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const parsed = listSchedulesQuerySchema.safeParse((req as any).query || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const data = await listSchedulesData(ownerUserId, parsed.data.status);
  return { data };
});

app.post("/v1/agent-schedules", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const parsed = createScheduleSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const data = await createScheduleData(ownerUserId, {
    name: parsed.data.name,
    cadence: parsed.data.cadence,
    timezone: parsed.data.timezone,
    isActive: parsed.data.isActive,
    payload: parsed.data.payload,
  });
  return reply.code(201).send({ data });
});

app.patch("/v1/agent-schedules/:id", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const scheduleId = String((req.params as any)?.id || "");
  if (!scheduleId) return reply.code(400).send({ error: "schedule id is required" });
  const parsed = updateScheduleSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const ownerUserId = await getRequestOwnerUserId(req);
  const data = await updateScheduleData(ownerUserId, scheduleId, {
    name: parsed.data.name,
    cadence: parsed.data.cadence,
    timezone: parsed.data.timezone,
    isActive: parsed.data.isActive,
    payload: parsed.data.payload,
  });
  if (!data) return reply.code(404).send({ error: "Schedule not found" });
  return { data };
});

app.get("/v1/integrations/telegram/status", async (_req, reply) => {
  return reply.send({
    data: getTelegramStatus(),
  });
});

app.post("/v1/integrations/telegram/test-message", async (req, reply) => {
  const config = getTelegramStatus();
  if (!config.configured) {
    return reply.code(503).send({
      error: "Telegram no esta configurado.",
      code: "TELEGRAM_NOT_CONFIGURED",
      details: config,
    });
  }

  const payload = (req as any).body || {};
  const chatId = String(payload.chatId || config.defaultChatId || "");
  const text = String(payload.text || "Finance System Telegram bridge test.");
  if (!chatId) {
    return reply.code(400).send({ error: "chatId is required" });
  }

  const delivered = await sendTelegramTextMessage(chatId, text);
  return {
    data: {
      chatId,
      delivered: true,
      upstream: delivered,
    },
  };
});

app.post("/v1/integrations/telegram/webhook", async (req, reply) => {
  const config = getTelegramStatus();
  if (!config.configured) {
    return reply.code(503).send({
      error: "Telegram no esta configurado.",
      code: "TELEGRAM_NOT_CONFIGURED",
      details: config,
    });
  }

  const incomingSecret = String((req.headers["x-telegram-bot-api-secret-token"] as string | undefined) || "");
  const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (expectedSecret && incomingSecret !== expectedSecret) {
    return reply.code(401).send({
      error: "Telegram secret token no valido.",
      code: "TELEGRAM_SECRET_INVALID",
    });
  }

  const incoming = extractTelegramWebhookMessage((req as any).body || {});
  if (!incoming) {
    return reply.send({ ok: true, ignored: true });
  }

  if (!isTelegramChatAllowed(incoming.chatId)) {
    return reply.code(403).send({
      error: "Telegram chat no autorizado.",
      code: "TELEGRAM_CHAT_NOT_ALLOWED",
    });
  }

  const normalizedText = incoming.text.trim();
  const lowerText = normalizedText.toLowerCase();

  if (lowerText === "/start" || lowerText === "start") {
    await sendTelegramTextMessage(
      incoming.chatId,
      "Finance System listo. Puedes pedirme resumenes financieros, dashboards, recordatorios, schedules y proyecciones."
    );
    return { ok: true, handled: "start" };
  }

  if (lowerText === "/help" || lowerText === "help") {
    await sendTelegramTextMessage(
      incoming.chatId,
      "Comandos: /start, /help, /status, /reminders. Tambien puedes escribir peticiones libres como 'crea un dashboard de deudas'."
    );
    return { ok: true, handled: "help" };
  }

  if (lowerText === "/status" || lowerText === "status") {
    const status = getTelegramStatus();
    await sendTelegramTextMessage(
      incoming.chatId,
      [
        "Telegram bridge status:",
        `- enabled: ${status.enabled ? "yes" : "no"}`,
        `- configured: ${status.configured ? "yes" : "no"}`,
        `- default chat: ${status.defaultChatId || "none"}`,
        `- allowed chats: ${status.allowedChatIds.length}`,
      ].join("\n")
    );
    return { ok: true, handled: "status" };
  }

  if (lowerText === "/reminders" || lowerText === "reminders") {
    const remindersRes = await app.inject({
      method: "GET",
      url: "/v1/reminders?status=ACTIVE",
      headers: {
        [INTERNAL_REQUEST_HEADER]: "telegram-webhook",
      },
    });
    if (remindersRes.statusCode !== 200) {
      await sendTelegramTextMessage(incoming.chatId, "No pude consultar los recordatorios activos en este momento.");
      return { ok: true, handled: "reminders", upstreamStatus: remindersRes.statusCode };
    }
    const remindersBody = remindersRes.json() as { data?: Array<{ title?: string; next_run_at?: string }> };
    const reminders = Array.isArray(remindersBody.data) ? remindersBody.data : [];
    const summary = reminders.length
      ? reminders
          .slice(0, 5)
          .map((item, index) => `${index + 1}. ${item.title || "Sin titulo"}${item.next_run_at ? ` | ${item.next_run_at}` : ""}`)
          .join("\n")
      : "No hay recordatorios activos.";
    await sendTelegramTextMessage(incoming.chatId, `Recordatorios activos:\n${summary}`);
    return { ok: true, handled: "reminders", count: reminders.length };
  }

  const agentRes = await app.inject({
    method: "POST",
    url: "/v1/agents/chat",
    headers: {
      [INTERNAL_REQUEST_HEADER]: "telegram-webhook",
    },
    payload: {
      message: normalizedText,
      channel: "API",
    },
  });

  if (agentRes.statusCode !== 201) {
    await sendTelegramTextMessage(
      incoming.chatId,
      `No pude procesar tu solicitud en este momento. Estado del backend: ${agentRes.statusCode}.`
    );
    return reply.code(200).send({
      ok: true,
      handled: "agent-failed",
      upstreamStatus: agentRes.statusCode,
    });
  }

  const agentBody = agentRes.json() as {
    data?: {
      runId?: string;
      assistantMessage?: string;
      proposalIds?: string[];
      generatedViewIds?: string[];
    };
  };
  const assistantMessage = agentBody.data?.assistantMessage || "Listo.";

  await sendTelegramTextMessage(incoming.chatId, assistantMessage);
  return {
    ok: true,
    handled: "agent",
    runId: agentBody.data?.runId || null,
    proposalIds: agentBody.data?.proposalIds || [],
    generatedViewIds: agentBody.data?.generatedViewIds || [],
  };
});

app.get("/v1/reminders", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const parsed = listRemindersQuerySchema.parse((req as any).query || {});
  const ownerUserId = await getRequestOwnerUserId(req);
  const values: any[] = [ownerUserId];
  const where: string[] = [`owner_user_id = $1`];
  if (parsed.status) {
    values.push(parsed.status);
    where.push(`status = $${values.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query(
    `SELECT id, schedule_id, title, channel, target, message_template, next_run_at, status, metadata, created_at, updated_at
       FROM agent_reminders
       ${whereClause}
      ORDER BY created_at DESC`,
    values
  );
  return { data: result.rows };
});

app.post("/v1/reminders", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const parsed = createReminderSchema.safeParse((req as any).body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const ownerUserId = await getRequestOwnerUserId(req);

  const created = await withTransaction(async (client) => {
    const scheduleRes = await client.query<{ id: string }>(
      `INSERT INTO agent_schedules (owner_user_id, name, cadence, timezone, is_active, payload)
       VALUES ($1, $2, $3, $4, TRUE, '{}'::jsonb)
       RETURNING id`,
      [ownerUserId, payload.title, payload.cadence, payload.timezone]
    );
    const scheduleId = scheduleRes.rows[0].id;

    const reminderRes = await client.query(
      `INSERT INTO agent_reminders (owner_user_id, schedule_id, title, channel, target, message_template, next_run_at, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', '{}'::jsonb)
       RETURNING id, schedule_id, title, channel, target, message_template, next_run_at, status, metadata, created_at, updated_at`,
      [ownerUserId, scheduleId, payload.title, payload.channel, payload.target || null, payload.messageTemplate, payload.nextRunAt || null]
    );

    return reminderRes.rows[0];
  });

  return reply.code(201).send({ data: created });
});

app.post("/v1/reminders/:id/pause", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const reminderId = String((req.params as any)?.id || "");
  if (!reminderId) return reply.code(400).send({ error: "reminder id is required" });
  const ownerUserId = await getRequestOwnerUserId(req);

  const updated = await query(
    `UPDATE agent_reminders
        SET status = 'PAUSED',
            updated_at = NOW()
      WHERE id = $1
        AND owner_user_id = $2
      RETURNING id, status, updated_at`,
    [reminderId, ownerUserId]
  );

  if (!updated.rowCount) return reply.code(404).send({ error: "Reminder not found" });
  return { data: updated.rows[0] };
});

app.post("/v1/reminders/:id/trigger", async (req, reply) => {
  if (!agentRuntimeEnabled) {
    return reply.code(503).send({ error: "AGENT_RUNTIME_ENABLED=false", code: "AGENT_RUNTIME_DISABLED" });
  }
  if (!(await hasAgentFoundationTables())) {
    return reply.code(503).send({ error: "Tablas agÃ©nticas no encontradas.", code: "AGENT_TABLES_MISSING" });
  }

  const reminderId = String((req.params as any)?.id || "");
  if (!reminderId) return reply.code(400).send({ error: "reminder id is required" });
  const ownerUserId = await getRequestOwnerUserId(req);

  const reminderRes = await query<{
    id: string;
    title: string;
    channel: string;
    target: string | null;
    message_template: string;
    status: string;
  }>(
    `SELECT id, title, channel, target, message_template, status
       FROM agent_reminders
      WHERE id = $1
        AND owner_user_id = $2
      LIMIT 1`,
    [reminderId, ownerUserId]
  );
  if (!reminderRes.rowCount) return reply.code(404).send({ error: "Reminder not found" });

  const reminder = reminderRes.rows[0];
  if (reminder.status !== "ACTIVE") {
    return reply.code(409).send({ error: `Reminder is ${reminder.status}, expected ACTIVE.` });
  }

  if (reminder.channel === "TELEGRAM") {
    return reply.code(410).send({
      error: "Telegram channel retired. Use Hermes as the only Telegram front door.",
      code: "TELEGRAM_CHANNEL_RETIRED",
    });
  }

  const webhookUrl = (process.env.N8N_WEBHOOK_URL || "").trim();
  const webhookToken = (process.env.N8N_WEBHOOK_TOKEN || "").trim();
  if (!webhookUrl) {
    return reply.code(503).send({
      error: "N8N_WEBHOOK_URL no configurada.",
      code: "N8N_WEBHOOK_MISSING",
    });
  }

  const payload = {
    source: "finance-system",
    event: "agent_reminder_triggered",
    reminder: {
      id: reminder.id,
      title: reminder.title,
      channel: reminder.channel,
      target: reminder.target,
      messageTemplate: reminder.message_template,
    },
    triggeredAt: new Date().toISOString(),
  };

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    return reply.code(502).send({
      error: `No se pudo conectar con n8n webhook (${webhookUrl}).`,
      code: "N8N_WEBHOOK_FETCH_FAILED",
      details: { cause: error?.message || String(error) },
    });
  }

  const responseBody = await upstream.text().catch(() => "");
  if (!upstream.ok) {
    return reply.code(502).send({
      error: `n8n webhook respondio ${upstream.status}.`,
      code: "N8N_WEBHOOK_UPSTREAM_ERROR",
      details: responseBody ? { body: responseBody.slice(0, 2000) } : undefined,
    });
  }

  await query(
    `UPDATE agent_reminders
        SET updated_at = NOW()
      WHERE id = $1
        AND owner_user_id = $2`,
    [reminder.id, ownerUserId]
  );

  return {
    data: {
      reminderId: reminder.id,
      webhookUrl,
      status: "DELIVERED",
      upstreamStatus: upstream.status,
      upstreamBody: responseBody ? responseBody.slice(0, 2000) : null,
    },
  };
});

app.setErrorHandler((error: any, _request, reply) => {
  app.log.error(error);

  if (error instanceof ApiError) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.errorCode,
      details: error.details,
    });
  }

  return reply.code(500).send({
    error: error?.message || "Internal server error",
    code: "INTERNAL_ERROR",
  });
});

export async function startApiServer() {
  await app.listen({ host, port });
}

if (process.env.NODE_ENV !== "test") {
  await startApiServer();
}

