import test from "node:test";
import assert from "node:assert/strict";
import { app } from "./index.js";

test("api integration smoke", async (t) => {
  t.after(async () => {
    await app.close();
  });

  const healthRes = await app.inject({ method: "GET", url: "/health" });
  assert.equal(healthRes.statusCode, 200);
  const healthBody = healthRes.json();
  assert.equal(healthBody.ok, true);

  const manifestRes = await app.inject({
    method: "GET",
    url: "/v1/tooling/manifest",
  });
  assert.equal(manifestRes.statusCode, 200);
  const manifestBody = manifestRes.json() as { data: { capabilities: Record<string, boolean>; rest: Record<string, string> } };
  assert.equal(manifestBody.data.capabilities.dashboards, true);
  assert.equal(manifestBody.data.capabilities.schedules, true);
  assert.equal(manifestBody.data.capabilities.telegramRemote, true);
  assert.equal(manifestBody.data.capabilities.notifications, true);
  assert.equal(manifestBody.data.rest.generatedViews, "/v1/generated-views");
  assert.equal(manifestBody.data.rest.generatedViewCreate, "POST /v1/generated-views");
  assert.equal(manifestBody.data.rest.generatedViewUpdate, "PATCH /v1/generated-views/:id");
  assert.equal(manifestBody.data.rest.toolingSchema, "/v1/tooling/schema");
  assert.equal(manifestBody.data.rest.notifications, "/v1/notifications");

  const examplesRes = await app.inject({
    method: "GET",
    url: "/v1/tooling/examples",
  });
  assert.equal(examplesRes.statusCode, 200);
  const examplesBody = examplesRes.json() as { data: { generatedView: unknown; schedule: unknown } };
  assert.ok(examplesBody.data.generatedView);
  assert.ok(examplesBody.data.schedule);

  const schemaRes = await app.inject({
    method: "GET",
    url: "/v1/tooling/schema",
  });
  assert.equal(schemaRes.statusCode, 200);
  const schemaBody = schemaRes.json() as { data: { generatedView: unknown; schedule: unknown; reminder: unknown } };
  assert.ok(schemaBody.data.generatedView);
  assert.ok(schemaBody.data.schedule);
  assert.ok(schemaBody.data.reminder);

  const openApiRes = await app.inject({
    method: "GET",
    url: "/v1/tooling/openapi",
  });
  assert.equal(openApiRes.statusCode, 200);
  const openApiBody = openApiRes.json() as { data: { openapi: string; paths: Record<string, unknown> } };
  assert.equal(openApiBody.data.openapi, "3.1.0");
  assert.ok(openApiBody.data.paths["/v1/generated-views"]);
  assert.ok(openApiBody.data.paths["/v1/tooling/manifest"]);

  const telegramStatusRes = await app.inject({
    method: "GET",
    url: "/v1/integrations/telegram/status",
  });
  assert.equal(telegramStatusRes.statusCode, 200);
  const telegramStatusBody = telegramStatusRes.json() as { data: { enabled: boolean; configured: boolean } };
  assert.equal(typeof telegramStatusBody.data.enabled, "boolean");
  assert.equal(typeof telegramStatusBody.data.configured, "boolean");

  const readyRes = await app.inject({ method: "GET", url: "/ready" });
  if (readyRes.statusCode !== 200) {
    t.skip("database is not ready in this environment");
    return;
  }

  const code = `CAT${Date.now().toString().slice(-8)}`;
  const createCategoryRes = await app.inject({
    method: "POST",
    url: "/v1/categories",
    payload: {
      code,
      name: `Categoria ${code}`,
      direction: "OUTFLOW",
    },
  });
  assert.equal(createCategoryRes.statusCode, 201);

  const reportsRes = await app.inject({
    method: "GET",
    url: "/v1/reports/cashflow",
  });
  assert.equal(reportsRes.statusCode, 200);
  const reportsBody = reportsRes.json() as { data: unknown[] };
  assert.ok(Array.isArray(reportsBody.data));

  const agentRunsRes = await app.inject({
    method: "GET",
    url: "/v1/agent-runs",
  });
  assert.ok([200, 503].includes(agentRunsRes.statusCode));

  const agentChatRes = await app.inject({
    method: "POST",
    url: "/v1/agents/chat",
    payload: {
      message: "Quiero una proyeccion de deuda y un dashboard",
      channel: "WEB",
    },
  });
  assert.ok([201, 500, 502, 503].includes(agentChatRes.statusCode));

  const proposalsRes = await app.inject({
    method: "GET",
    url: "/v1/agent-proposals",
  });
  assert.ok([200, 503].includes(proposalsRes.statusCode));

  const remindersRes = await app.inject({
    method: "GET",
    url: "/v1/reminders",
  });
  assert.ok([200, 503].includes(remindersRes.statusCode));

  const createReminderRes = await app.inject({
    method: "POST",
    url: "/v1/reminders",
    payload: {
      title: "Resumen mensual deuda",
      cadence: "MONTHLY",
      channel: "EMAIL",
      messageTemplate: "Revisa intereses y progreso de deuda",
      timezone: "America/Bogota",
    },
  });
  assert.ok([201, 503].includes(createReminderRes.statusCode));
});


