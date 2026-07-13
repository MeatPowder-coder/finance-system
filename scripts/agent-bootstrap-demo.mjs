import process from "node:process";

const args = new Set(process.argv.slice(2));
const baseUrlArgIndex = process.argv.findIndex((arg) => arg === "--base-url" || arg === "--baseUrl");
const baseUrl = (baseUrlArgIndex >= 0 ? process.argv[baseUrlArgIndex + 1] : process.env.FINANCE_SYSTEM_BASE_URL || "http://localhost:4100").replace(/\/+$/, "");
const publishDemo = args.has("--create-demo");

async function fetchJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { response, json };
}

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

logSection("Finance system bootstrap");
console.log(`Base URL: ${baseUrl}`);
console.log(`Mode: ${publishDemo ? "create-demo" : "inspect-only"}`);

const manifest = await fetchJson("/v1/tooling/manifest");
logSection("Manifest");
console.log(JSON.stringify(manifest.json, null, 2));

const schema = await fetchJson("/v1/tooling/schema");
logSection("Schema");
console.log(JSON.stringify(schema.json, null, 2));

const examples = await fetchJson("/v1/tooling/examples");
logSection("Examples");
console.log(JSON.stringify(examples.json, null, 2));

if (!publishDemo) {
  console.log("\nRun with --create-demo to create a sample dashboard and schedule.");
  process.exit(0);
}

const demoViewPayload = {
  title: "Demo: salida de deudas",
  layout: "GRID",
  status: "DRAFT",
  tabs: [
    { key: "overview", title: "Resumen", order: 1, widgetKeys: ["debt_kpi", "monthly_payments"] },
    { key: "timeline", title: "Cronograma", order: 2, widgetKeys: ["debt_timeline"] },
  ],
  widgets: [
    {
      widgetKey: "debt_kpi",
      widgetType: "metric",
      title: "Deuda total",
      position: 1,
      dataSource: "monthly_finance_snapshot",
    },
    {
      widgetKey: "monthly_payments",
      widgetType: "bar_chart",
      title: "Pagos mensuales",
      position: 2,
      dataSource: "transactions_by_category",
    },
    {
      widgetKey: "debt_timeline",
      widgetType: "timeline",
      title: "Ruta de salida",
      position: 3,
      dataSource: "projection_scenarios",
    },
  ],
};

const demoSchedulePayload = {
  name: "Demo: revisar deuda cada viernes",
  cadence: "FREQ=WEEKLY;BYDAY=FR",
  timezone: "America/Bogota",
  isActive: true,
  payload: {
    purpose: "debt_review",
    reminderChannel: "N8N",
  },
};

const viewCreate = await fetchJson("/v1/generated-views", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(demoViewPayload),
});
logSection("Created view");
console.log(`Status: ${viewCreate.response.status}`);
console.log(JSON.stringify(viewCreate.json, null, 2));

const scheduleCreate = await fetchJson("/v1/agent-schedules", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(demoSchedulePayload),
});
logSection("Created schedule");
console.log(`Status: ${scheduleCreate.response.status}`);
console.log(JSON.stringify(scheduleCreate.json, null, 2));

console.log("\nBootstrap complete.");
