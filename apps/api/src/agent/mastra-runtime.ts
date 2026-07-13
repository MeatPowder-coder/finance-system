import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { buildFinanceToolkit } from "./finance-toolkit.js";

type CopilotProvider = "openai" | "google" | "nvidia";

export type FinanceCopilotContext = {
  totalBalance: number;
  monthInflow: number;
  monthOutflow: number;
  accounts: Array<{ name: string; currency: string; balance_current: string | number; account_type: string }>;
  recentTransactions: Array<{
    transaction_date: string;
    description: string | null;
    amount: string | number;
    currency: string;
    direction: "INFLOW" | "OUTFLOW";
    account_name: string;
  }>;
};

type AgentProposal = {
  proposalType: "CREATE_DASHBOARD" | "CREATE_REMINDER" | "CREATE_PROJECTION" | "CODE_CHANGE_REQUEST" | "WRITE_OPERATION";
  title: string;
  summary: string;
  payload: Record<string, unknown>;
};

type RunMastraAgentInput = {
  message: string;
  requestedModel: string;
  resolvedModel: string;
  provider: CopilotProvider;
  ownerUserId: string;
  context: FinanceCopilotContext;
  buildProposalsFromMessage: (message: string) => AgentProposal[];
};

type RunMastraAgentResult = {
  text: string;
  modelUsed: string;
  toolResults: unknown[];
};

function ensureProviderEnvAliases(provider: CopilotProvider) {
  if (provider === "google") {
    if (!process.env.GOOGLE_API_KEY && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      process.env.GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    }
  }
}

function normalizeMastraModel(
  provider: CopilotProvider,
  resolvedModel: string
): string | { id: `${string}/${string}`; url?: string; apiKey?: string; headers?: Record<string, string> } {
  if (provider === "google") {
    const known: Record<string, string> = {
      "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite-preview-06-17",
      "gemini-2.5-flash": "google/gemini-2.5-flash",
      "gemini-2.5-pro": "google/gemini-2.5-pro",
      "gemini-3-flash-preview": "google/gemini-2.5-flash",
      "gemini-3.1-flash-lite-preview": "google/gemini-2.5-flash-lite-preview-06-17",
    };
    return known[resolvedModel] || `google/${resolvedModel}`;
  }

  if (provider === "openai") {
    return `openai/${resolvedModel}`;
  }

  const nvidiaBase = (process.env.NVIDIA_API_BASE_URL || "https://integrate.api.nvidia.com/v1").trim().replace(/\/+$/, "");
  const nvidiaApiKey = (process.env.NVIDIA_API_KEY || "").trim();
  if (!nvidiaApiKey) {
    throw new Error("NVIDIA_API_KEY no configurada para runtime Mastra.");
  }

  let nvidiaModelId = resolvedModel;
  if (resolvedModel === "glm-5.1") {
    nvidiaModelId = (process.env.GLM_MODEL_ID || "z-ai/glm-5.1").trim();
  } else if (resolvedModel === "kimi-k2.5") {
    nvidiaModelId = (process.env.KIMI_MODEL_ID || "moonshotai/kimi-k2.5").trim();
  }

  return {
    id: `openai/${nvidiaModelId}` as `${string}/${string}`,
    url: nvidiaBase,
    apiKey: nvidiaApiKey,
  };
}

export async function runMastraAgentChat(input: RunMastraAgentInput): Promise<RunMastraAgentResult> {
  ensureProviderEnvAliases(input.provider);

  const mastraModel = normalizeMastraModel(input.provider, input.resolvedModel);
  const proposals = input.buildProposalsFromMessage(input.message);
  const financeToolkit = buildFinanceToolkit(input.ownerUserId);

  const contextTool = createTool({
    id: "finance_context_tool",
    description: "Devuelve resumen financiero y muestras de cuentas/transacciones del usuario.",
    execute: async () => ({
      totalBalance: input.context.totalBalance,
      monthInflow: input.context.monthInflow,
      monthOutflow: input.context.monthOutflow,
      topAccounts: input.context.accounts.slice(0, 8),
      recentTransactions: input.context.recentTransactions.slice(0, 12),
    }),
  });

  const proposalTool = createTool({
    id: "proposal_builder_tool",
    description: "Genera propuestas accionables para dashboards, recordatorios y proyecciones financieras.",
    inputSchema: z.object({
      message: z.string().min(1),
    }),
    execute: async ({ message }) => {
      const text = String(message || "");
      return {
        proposals: input.buildProposalsFromMessage(text),
      };
    },
  });

  const financeAgent = new Agent({
    id: "finance-supervisor-agent",
    name: "FinanceSupervisorAgent",
    model: mastraModel,
    instructions: [
      "Eres un agente financiero senior para contabilidad personal/empresarial.",
      "Siempre responde en espanol con recomendaciones concretas y priorizadas.",
      "Nunca propongas ni ejecutes acciones de trading.",
      "Debes usar finance_context_tool antes de responder si el usuario pregunta por estado financiero.",
      "Si el usuario pide automatizaciones, dashboards o recordatorios, usa proposal_builder_tool.",
      "Si faltan datos, dilo claramente y sugiere el siguiente dato minimo para avanzar.",
    ].join(" "),
    tools: {
      ...financeToolkit,
      finance_context_tool: contextTool,
      proposal_builder_tool: proposalTool,
    },
  });

  const mastra = new Mastra({
    agents: {
      financeSupervisor: financeAgent,
    },
  });

  void mastra;

  const prompt = [
    `Mensaje del usuario: ${input.message}`,
    "Contexto financiero base:",
    `- Balance total: ${input.context.totalBalance}`,
    `- Ingresos mes: ${input.context.monthInflow}`,
    `- Egresos mes: ${input.context.monthOutflow}`,
    `- Cuentas visibles: ${input.context.accounts.length}`,
    `- Transacciones recientes: ${input.context.recentTransactions.length}`,
    proposals.length > 0 ? `- Propuestas detectadas preliminarmente: ${JSON.stringify(proposals)}` : "- Sin propuestas preliminares detectadas.",
  ].join("\n");

  const result = await financeAgent.generate(prompt, { model: mastraModel });
  const text = (await result.text)?.trim();
  const toolResults = await result.toolResults;

  if (!text) {
    throw new Error("Mastra no devolvio contenido util para la respuesta.");
  }

  return {
    text,
    modelUsed: typeof mastraModel === "string" ? mastraModel : mastraModel.id,
    toolResults,
  };
}
