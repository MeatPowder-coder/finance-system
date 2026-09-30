const API_BASE_URL_STORAGE_KEY = "finance-system.apiBaseUrl";
const AUTH_TOKEN_STORAGE_KEY = "finance-system.authToken";
const AUTH_REFRESH_TOKEN_STORAGE_KEY = "finance-system.authRefreshToken";

export async function requestFinanceApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("No se pudo conectar con Finance System. Revisa tu conexión e inténtalo de nuevo.");
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

  if (stored && isRelativeApiBaseUrl(stored)) {
    return "";
  }

  if (normalizedFallback.startsWith("/")) {
    return "";
  }

  if (stored && !isLocalhostUrl(stored)) {
    return normalizeBaseUrl(stored);
  }

  if (normalizedFallback && !isLocalhostUrl(normalizedFallback)) {
    return normalizedFallback;
  }

  if (inferredBrowserBaseUrl) {
    return normalizeBaseUrl(inferredBrowserBaseUrl);
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
