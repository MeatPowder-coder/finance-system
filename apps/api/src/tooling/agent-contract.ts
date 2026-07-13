export function getFinanceToolingContract() {
  return {
    product: "finance-system",
    version: "0.1.0",
    schemas: {
      generatedView: {
        type: "object",
        required: ["title", "layout", "status"],
        properties: {
          slug: { type: "string", description: "Stable URL-safe identifier for the generated view." },
          title: { type: "string", description: "Human readable dashboard title." },
          description: { type: "string" },
          layout: { type: "string", enum: ["GRID", "STACK"] },
          status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
          sourceProposalId: { type: "string", format: "uuid" },
          tabs: {
            type: "array",
            items: {
              type: "object",
              required: ["key", "title"],
              properties: {
                key: { type: "string" },
                title: { type: "string" },
                order: { type: "integer" },
                description: { type: "string" },
                widgetKeys: { type: "array", items: { type: "string" } },
              },
            },
          },
          widgets: {
            type: "array",
            items: {
              type: "object",
              required: ["widgetKey", "widgetType", "title", "position", "dataSource"],
              properties: {
                widgetKey: { type: "string" },
                widgetType: {
                  type: "string",
                  enum: ["metric", "table", "line_chart", "bar_chart", "pie_chart", "timeline", "monthly_cashflow", "debt_projection", "investment_return", "portfolio_performance"],
                },
                title: { type: "string" },
                position: { type: "integer", minimum: 1 },
                dataSource: { type: "string" },
                config: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      schedule: {
        type: "object",
        required: ["name", "cadence"],
        properties: {
          name: { type: "string" },
          cadence: { type: "string", description: "Cron or RFC5545-style cadence string." },
          timezone: { type: "string", default: "America/Bogota" },
          isActive: { type: "boolean", default: true },
          payload: { type: "object", additionalProperties: true },
        },
      },
      reminder: {
        type: "object",
        required: ["title", "cadence", "channel", "messageTemplate"],
        properties: {
          title: { type: "string" },
          cadence: { type: "string" },
          channel: { type: "string", enum: ["IN_APP", "EMAIL", "WEBHOOK", "N8N", "TELEGRAM"] },
          target: { type: "string" },
          messageTemplate: { type: "string" },
          timezone: { type: "string", default: "America/Bogota" },
          nextRunAt: { type: "string", format: "date-time" },
          scheduleId: { type: "string", format: "uuid" },
        },
      },
    },
    examples: {
      generatedView: {
        title: "Plan de salida de deudas",
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
      },
      schedule: {
        name: "Revisar deuda cada viernes",
        cadence: "FREQ=WEEKLY;BYDAY=FR",
        timezone: "America/Bogota",
        isActive: true,
        payload: {
          purpose: "debt_review",
          reminderChannel: "N8N",
        },
      },
    },
  };
}

export type FinanceToolingContract = ReturnType<typeof getFinanceToolingContract>;
