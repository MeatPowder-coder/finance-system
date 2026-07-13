import { getFinanceToolingContract } from "./agent-contract.js";

export function getFinanceOpenApiSpec() {
  const contract = getFinanceToolingContract();

  return {
    openapi: "3.1.0",
    info: {
      title: "finance-system public API",
      version: contract.version,
      description:
        "Public contract for finance-system. Use REST for direct operations, MCP for agent tool discovery, and Telegram only as an optional remote front door.",
    },
    servers: [
      {
        url: contract.product === "finance-system" ? "http://localhost:4100" : "http://localhost:4100",
      },
    ],
    paths: {
      "/health": { get: { summary: "Health check", responses: { 200: { description: "OK" } } } },
      "/ready": { get: { summary: "Readiness check", responses: { 200: { description: "Ready" } } } },
      "/v1/tooling/manifest": { get: { summary: "Public tooling manifest", responses: { 200: { description: "Manifest" } } } },
      "/v1/tooling/examples": { get: { summary: "Tooling examples", responses: { 200: { description: "Examples" } } } },
      "/v1/tooling/schema": { get: { summary: "Tooling schema", responses: { 200: { description: "Schema" } } } },
      "/v1/mcp/status": { get: { summary: "MCP status", responses: { 200: { description: "Status" } } } },
      "/v1/mcp/tools": { get: { summary: "MCP tools", responses: { 200: { description: "Tools" } } } },
      "/mcp": {
        post: { summary: "MCP HTTP endpoint", responses: { 200: { description: "MCP response" } } },
        get: { summary: "MCP HTTP endpoint", responses: { 200: { description: "MCP response" } } },
      },
      "/v1/agents/chat": {
        post: {
          summary: "Agent chat runtime",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentChatRequest" },
              },
            },
          },
          responses: { 201: { description: "Agent response" } },
        },
      },
      "/v1/generated-views": {
        get: { summary: "List generated views", responses: { 200: { description: "Views list" } } },
        post: {
          summary: "Create a generated view",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/GeneratedView" } },
            },
          },
          responses: { 201: { description: "Generated view created" } },
        },
      },
      "/v1/generated-views/{id}": {
        get: { summary: "Get generated view by id", responses: { 200: { description: "Generated view" } } },
        patch: {
          summary: "Update generated view",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GeneratedView" },
              },
            },
          },
          responses: { 200: { description: "Generated view updated" } },
        },
      },
      "/v1/agent-schedules": {
        get: { summary: "List agent schedules", responses: { 200: { description: "Schedules list" } } },
        post: {
          summary: "Create a schedule",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Schedule" } },
            },
          },
          responses: { 201: { description: "Schedule created" } },
        },
      },
      "/v1/agent-schedules/{id}": {
        patch: {
          summary: "Update a schedule",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Schedule" },
              },
            },
          },
          responses: { 200: { description: "Schedule updated" } },
        },
      },
      "/v1/reminders": {
        get: { summary: "List reminders", responses: { 200: { description: "Reminders list" } } },
        post: {
          summary: "Create reminder",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Reminder" } },
            },
          },
          responses: { 201: { description: "Reminder created" } },
        },
      },
      "/v1/integrations/telegram/status": {
        get: { summary: "Telegram status", responses: { 200: { description: "Telegram status" } } },
      },
      "/v1/integrations/telegram/test-message": {
        post: { summary: "Send a Telegram test message", responses: { 200: { description: "Sent" } } },
      },
      "/v1/integrations/telegram/webhook": {
        post: { summary: "Telegram webhook", responses: { 200: { description: "Webhook accepted" } } },
      },
      "/v1/settings/profile": {
        get: { summary: "Get authenticated profile", responses: { 200: { description: "Profile" } } },
        patch: { summary: "Update authenticated profile", responses: { 200: { description: "Profile updated" } } },
      },
      "/v1/settings/preferences": {
        get: { summary: "Get authenticated preferences", responses: { 200: { description: "Preferences" } } },
        patch: { summary: "Update authenticated preferences", responses: { 200: { description: "Preferences updated" } } },
      },
      "/v1/settings/integrations": {
        get: { summary: "Integration status", responses: { 200: { description: "Integration status" } } },
      },
      "/v1/shares": {
        get: { summary: "List sent, received and active shares", responses: { 200: { description: "Sharing state" } } },
      },
      "/v1/shares/catalog": {
        get: { summary: "List resources owned by the authenticated user", responses: { 200: { description: "Share catalog" } } },
      },
      "/v1/shares/invitations": {
        post: { summary: "Invite a user to selected finance resources", responses: { 201: { description: "Invitation created" } } },
      },
      "/v1/shares/invitations/{id}/accept": {
        post: { summary: "Accept a finance sharing invitation", responses: { 200: { description: "Invitation accepted" } } },
      },
      "/v1/shares/invitations/{id}/revoke": {
        post: { summary: "Revoke a pending finance sharing invitation", responses: { 200: { description: "Invitation revoked" } } },
      },
      "/v1/shares/grants/{id}": {
        patch: { summary: "Update a sharing grant", responses: { 200: { description: "Grant updated" } } },
        delete: { summary: "Revoke a sharing grant", responses: { 200: { description: "Grant revoked" } } },
      },
    },
    components: {
      schemas: {
        AgentChatRequest: {
          type: "object",
          required: ["message", "channel"],
          properties: {
            message: { type: "string" },
            channel: { type: "string", enum: ["WEB", "DESKTOP", "API", "SYSTEM"] },
            model: { type: "string" },
          },
        },
        GeneratedView: contract.schemas.generatedView,
        Schedule: contract.schemas.schedule,
        Reminder: contract.schemas.reminder,
      },
    },
  } as const;
}
