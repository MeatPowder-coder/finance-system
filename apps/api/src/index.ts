import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { query } from "./db.js";

const app = Fastify({ logger: true });

const port = Number(process.env.API_PORT || 4100);
const host = process.env.API_HOST || "0.0.0.0";
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3005")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

await app.register(cors, {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (corsOrigins.includes(origin)) return cb(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
});

app.get("/health", async () => ({ ok: true, service: "finance-system-api", at: new Date().toISOString() }));

app.get("/v1/accounts", async () => {
  const result = await query(
    `SELECT id, code, name, currency, account_type, balance_current, created_at, updated_at
     FROM accounts
     ORDER BY id ASC`
  );
  return { data: result.rows };
});

app.get("/v1/transactions", async (req) => {
  const schema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
  const { limit } = schema.parse((req as any).query || {});

  const result = await query(
    `SELECT id, transaction_date, description, amount, currency, direction, status, account_id, category_id, created_at
     FROM transactions
     ORDER BY transaction_date DESC, id DESC
     LIMIT $1`,
    [limit]
  );

  return { data: result.rows };
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  return reply.code(500).send({ error: error.message || "Internal server error" });
});

await app.listen({ host, port });
