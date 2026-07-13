export type FinanceSystemClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: HeadersInit;
};

type HttpMethod = "GET" | "POST" | "PATCH";

function trimUrl(value: string | undefined) {
  return (value || "http://localhost:4100").trim().replace(/\/+$/, "");
}

function joinPath(baseUrl: string, path: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export class FinanceSystemClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: HeadersInit;

  constructor(options: FinanceSystemClientOptions = {}) {
    this.baseUrl = trimUrl(options.baseUrl);
    this.fetchImpl = options.fetchImpl || fetch;
    this.headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
  }

  async request<T = unknown>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
    const response = await this.fetchImpl(joinPath(this.baseUrl, path), {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = await parseJsonResponse(response);
      throw new Error(
        `finance-system request failed (${method} ${path}) -> ${response.status}${errorBody ? `: ${JSON.stringify(errorBody)}` : ""}`
      );
    }
    return (await parseJsonResponse(response)) as T;
  }

  getManifest() {
    return this.request<{ data: unknown }>("/v1/tooling/manifest");
  }

  getExamples() {
    return this.request<{ data: unknown }>("/v1/tooling/examples");
  }

  getSchema() {
    return this.request<{ data: unknown }>("/v1/tooling/schema");
  }

  getOpenApi() {
    return this.request<{ data: unknown }>("/v1/tooling/openapi");
  }

  getMcpStatus() {
    return this.request<{ data: unknown }>("/v1/mcp/status");
  }

  getMcpTools() {
    return this.request<{ data: unknown }>("/v1/mcp/tools");
  }

  getToolingManifest() {
    return this.getManifest();
  }

  getGeneratedViews(query?: { status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ data: unknown[] }>(`/v1/generated-views${suffix}`);
  }

  getGeneratedViewById(id: string) {
    return this.request<{ data: unknown }>(`/v1/generated-views/${encodeURIComponent(id)}`);
  }

  createGeneratedView(payload: Record<string, unknown>) {
    return this.request<{ data: unknown }>("/v1/generated-views", "POST", payload);
  }

  updateGeneratedView(id: string, payload: Record<string, unknown>) {
    return this.request<{ data: unknown }>(`/v1/generated-views/${encodeURIComponent(id)}`, "PATCH", payload);
  }

  listSchedules(query?: { status?: "ACTIVE" | "INACTIVE" }) {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ data: unknown[] }>(`/v1/agent-schedules${suffix}`);
  }

  createSchedule(payload: Record<string, unknown>) {
    return this.request<{ data: unknown }>("/v1/agent-schedules", "POST", payload);
  }

  updateSchedule(id: string, payload: Record<string, unknown>) {
    return this.request<{ data: unknown }>(`/v1/agent-schedules/${encodeURIComponent(id)}`, "PATCH", payload);
  }

  listReminders(query?: { status?: "ACTIVE" | "PAUSED" | "CANCELLED" }) {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ data: unknown[] }>(`/v1/reminders${suffix}`);
  }

  createReminder(payload: Record<string, unknown>) {
    return this.request<{ data: unknown }>("/v1/reminders", "POST", payload);
  }

  getTelegramStatus() {
    return this.request<{ data: unknown }>("/v1/integrations/telegram/status");
  }

  testTelegramMessage(payload?: { chatId?: string; text?: string }) {
    return this.request<{ data: unknown }>("/v1/integrations/telegram/test-message", "POST", payload || {});
  }

  sendTelegramWebhook(update: Record<string, unknown>) {
    return this.request<{ ok: boolean }>("/v1/integrations/telegram/webhook", "POST", update);
  }
}

export function createFinanceSystemClient(options?: FinanceSystemClientOptions) {
  return new FinanceSystemClient(options);
}

export async function fetchFinanceSystemManifest(baseUrl?: string) {
  return createFinanceSystemClient({ baseUrl }).getManifest();
}
