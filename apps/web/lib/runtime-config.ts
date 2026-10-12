const API_BASE_URL_STORAGE_KEY = "finance-system.apiBaseUrl";
const AUTH_TOKEN_STORAGE_KEY = "finance-system.authToken";
const AUTH_REFRESH_TOKEN_STORAGE_KEY = "finance-system.authRefreshToken";

export function financeErrorMessage(error: unknown, fallback = "No se pudo completar la solicitud.") {
  const message = getErrorMessage(error);
  if (containsRequestTimeout(error) || isRequestTimeout(message)) {
    return "La conexión con FinanceSystem tardó más de lo esperado. Revisa la API e inténtalo de nuevo.";
  }
  if (containsNetworkFetchFailure(error) || isNetworkFetchFailure(message)) {
    return "El servicio de datos no respondió. La interfaz sigue disponible; revisa la conexión e inténtalo de nuevo.";
  }
  return message.trim() || fallback;
}

function isRequestTimeout(message: string) {
  return /timed?\s*out|timeout|time\s*limit|operation was aborted due to timeout|signal is aborted/i.test(message);
}

function containsRequestTimeout(error: unknown, depth = 0): boolean {
  if (depth > 3 || !error || typeof error !== "object") return false;
  const nested = error as { cause?: unknown; message?: unknown; name?: unknown; error?: unknown };
  if (nested.name === "TimeoutError" || nested.name === "AbortError") return true;
  if (typeof nested.message === "string" && isRequestTimeout(nested.message)) return true;
  return containsRequestTimeout(nested.cause, depth + 1) || containsRequestTimeout(nested.error, depth + 1);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function isNetworkFetchFailure(message: string) {
  return /failed to fetch|fetch failed|networkerror|network request failed|err_network|load failed|socket hang up|econnrefused/i.test(message);
}

function containsNetworkFetchFailure(error: unknown, depth = 0): boolean {
  if (depth > 3 || !error || typeof error !== "object") return false;
  const nested = error as { cause?: unknown; message?: unknown; error?: unknown };
  if (typeof nested.message === "string" && isNetworkFetchFailure(nested.message)) return true;
  return containsNetworkFetchFailure(nested.cause, depth + 1) || containsNetworkFetchFailure(nested.error, depth + 1);
}

export async function requestFinanceApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError || isNetworkFetchFailure(getErrorMessage(error))) {
      throw new Error(financeErrorMessage(error));
    }
    throw error;
  }
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isRelativeApiBaseUrl(value: string) {
  return normalizeBaseUrl(value).startsWith("/");
}

function readLocalStorageValue(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function isLocalhostUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.includes("0.0.0.0")
  );
}

function inferBrowserApiBaseUrl() {
  if (typeof window === "undefined") return null;

  const { hostname, protocol } = window.location;
  if (!hostname || isLocalhostUrl(hostname)) return null;

  if (hostname === "finance.agentame.xyz") {
    return "https://finance-api.agentame.xyz";
  }

  if (hostname.startsWith("finance.")) {
    return `${protocol}//${hostname.replace(/^finance\./, "finance-api.")}`;
  }

  return null;
}

export function resolveFinanceApiBaseUrl(fallback = "http://localhost:4100") {
  const normalizedFallback = normalizeBaseUrl(fallback || "http://localhost:4100");
  const stored = readLocalStorageValue(API_BASE_URL_STORAGE_KEY);
  const inferredBrowserBaseUrl = inferBrowserApiBaseUrl();
  const fallbackIsExplicitRemote = Boolean(normalizedFallback && !normalizedFallback.startsWith("/") && !isLocalhostUrl(normalizedFallback));

  // Local web/desktop previews have same-origin proxies for /health and /v1.
  // Prefer those routes over a direct remote call so browser CORS does not
  // turn a healthy configured API into a misleading "Failed to fetch" error.
  if (typeof window !== "undefined" && /^(https?):$/.test(window.location.protocol) && isLocalhostUrl(window.location.hostname)) {
    return "";
  }

  // The current deployment's explicit or host-inferred API is authoritative.
  // This also recovers from an obsolete remote URL left in browser storage.
  if (fallbackIsExplicitRemote) {
    return normalizedFallback;
  }

  if (inferredBrowserBaseUrl) {
    return normalizeBaseUrl(inferredBrowserBaseUrl);
  }

  if (stored && !isRelativeApiBaseUrl(stored) && !isLocalhostUrl(stored)) {
    return normalizeBaseUrl(stored);
  }

  if ((stored && isRelativeApiBaseUrl(stored)) || normalizedFallback.startsWith("/")) {
    return "";
  }

  return normalizeBaseUrl(stored || normalizedFallback || "http://localhost:4100");
}

export function readFinanceAuthToken() {
  return readLocalStorageValue(AUTH_TOKEN_STORAGE_KEY)?.trim() || "";
}

export function buildFinanceHeaders(baseHeaders: HeadersInit = {}) {
  const headers = new Headers(baseHeaders);
  const authToken = readFinanceAuthToken();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  return headers;
}

export function setFinanceApiBaseUrl(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalizeBaseUrl(value));
}

export function setFinanceAuthToken(value: string) {
  if (typeof window === "undefined") return;
  const nextValue = value.trim();
  if (!nextValue) {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextValue);
}

export function readFinanceRefreshToken() {
  return readLocalStorageValue(AUTH_REFRESH_TOKEN_STORAGE_KEY)?.trim() || "";
}

export function setFinanceRefreshToken(value: string) {
  if (typeof window === "undefined") return;
  const nextValue = value.trim();
  if (!nextValue) {
    window.localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, nextValue);
}

export function clearFinanceRuntimeConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
}

export const FINANCE_RUNTIME_KEYS = {
  apiBaseUrl: API_BASE_URL_STORAGE_KEY,
  authToken: AUTH_TOKEN_STORAGE_KEY,
  authRefreshToken: AUTH_REFRESH_TOKEN_STORAGE_KEY,
} as const;
