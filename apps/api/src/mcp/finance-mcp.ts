import { MCPServer } from "@mastra/mcp";
import { buildFinanceToolkit } from "../agent/finance-toolkit.js";

function normalizePath(value: string | undefined) {
  const trimmed = (value || "/mcp").trim();
  if (!trimmed) return "/mcp";
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") || "/mcp" : `/${trimmed.replace(/\/+$/, "")}`;
}

export const financeMcpPath = normalizePath(process.env.MCP_FINANCE_PATH);
export const financeMcpEnabled = (process.env.MCP_FINANCE_ENABLED || "true").trim().toLowerCase() !== "false";
export const financeMcpToolIds = Object.keys(buildFinanceToolkit("mcp-tool-list"));

export function getFinanceMcpServer(ownerUserId: string) {
  return new MCPServer({
    name: "finance-system",
    version: "0.1.0",
    tools: buildFinanceToolkit(ownerUserId),
  });
}

export function getFinanceMcpStatus() {
  return {
    enabled: financeMcpEnabled,
    path: financeMcpPath,
    toolCount: financeMcpToolIds.length,
    toolIds: financeMcpToolIds,
    serverName: "finance-system",
    serverVersion: "0.1.0",
  };
}

export function getFinanceMcpToolList() {
  return getFinanceMcpServer("mcp-tool-list").getToolListInfo();
}
