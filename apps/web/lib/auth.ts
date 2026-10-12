"use client";

import { readFinanceRefreshToken, requestFinanceApi, resolveFinanceApiBaseUrl, setFinanceAuthToken, setFinanceRefreshToken } from "./runtime-config";

export type AuthPublicConfig = {
  enabled: boolean;
  appName: string;
  emailPasswordEnabled: boolean;
  googleEnabled: boolean;
  googleClientId: string | null;
  googleAuthUrl: string;
};

export type AuthFlow = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  returnTo: string;
};

export type AuthExchangeRequest = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  state?: string;
};

export type AuthTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  token_type?: string;
};

export type AuthProfile = {
  userId: string;
  email: string | null;
  username: string | null;
  name: string | null;
  picture: string | null;
  provider: "LOCAL" | "GOOGLE";
  roles: string[];
  token: string;
  expiresAt: number;
  sessionId: string;
};

const FLOW_STORAGE_KEY = "finance-system.authFlow";
const FLOW_STORAGE_MAP_KEY = "finance-system.authFlows";
const FLOW_MAX_AGE_MS = 30 * 60 * 1000;
const FLOW_MAX_ENTRIES = 8;

type StoredFlowEntry = { flow: AuthFlow; savedAt: number };

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

async function readResponsePayload(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function randomBase64Url(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256Base64Url(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function isAuthFlow(value: unknown): value is AuthFlow {
  if (!value || typeof value !== "object") return false;
  const flow = value as Partial<AuthFlow>;
  return Boolean(flow.state && flow.codeVerifier && flow.redirectUri && flow.returnTo);
}

function readStoredFlows(storage: Storage) {
  const entries = new Map<string, StoredFlowEntry>();
  try {
    const rawMap = storage.getItem(FLOW_STORAGE_MAP_KEY);
    if (rawMap) {
      const parsed = JSON.parse(rawMap) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [state, value] of Object.entries(parsed)) {
          if (!value || typeof value !== "object") continue;
          const record = value as { flow?: unknown; savedAt?: unknown };
          const flow = isAuthFlow(record.flow) ? record.flow : isAuthFlow(value) ? value : null;
          if (!flow || flow.state !== state) continue;
          const savedAt = typeof record.savedAt === "number" ? record.savedAt : Date.now();
          if (Date.now() - savedAt > FLOW_MAX_AGE_MS) continue;
          entries.set(state, { flow, savedAt });
        }
      }
    }
  } catch {
    // A damaged map should not prevent reading the legacy single-flow value.
  }

  try {
    const rawLegacyFlow = storage.getItem(FLOW_STORAGE_KEY);
    if (rawLegacyFlow) {
      const legacyFlow: unknown = JSON.parse(rawLegacyFlow);
      if (isAuthFlow(legacyFlow) && !entries.has(legacyFlow.state)) {
        entries.set(legacyFlow.state, { flow: legacyFlow, savedAt: Date.now() });
      }
    }
  } catch {
    // Ignore malformed legacy state and keep any valid map entries.
  }

  return entries;
}

function readStoredFlow(state?: string): AuthFlow | null {
  if (typeof window === "undefined") return null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const entries = readStoredFlows(storage);
      const match = state ? entries.get(state) : [...entries.values()].sort((a, b) => b.savedAt - a.savedAt)[0];
      if (match) return match.flow;
    } catch {
      // Try the other store; browsers can disable storage independently.
    }
  }
  return null;
}

function saveStoredFlow(flow: AuthFlow) {
  if (typeof window === "undefined") return;
  const entries = new Map<string, StoredFlowEntry>();
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      for (const [state, entry] of readStoredFlows(storage)) entries.set(state, entry);
    } catch {
      // Continue with whichever browser store remains available.
    }
  }
  entries.set(flow.state, { flow, savedAt: Date.now() });
  const serialized = JSON.stringify(Object.fromEntries(
    [...entries.entries()]
      .sort((a, b) => a[1].savedAt - b[1].savedAt)
      .slice(-FLOW_MAX_ENTRIES)
  ));
  // Keep the PKCE verifier available if Google returns to a separate tab or
  // browser context on the same origin. Keep concurrent attempts by state so
  // an older Google tab cannot overwrite the verifier needed by a newer one.
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      storage.setItem(FLOW_STORAGE_MAP_KEY, serialized);
    } catch {
      // Keep the flow in whichever browser store remains available.
    }
  }
}

export function clearStoredAuthFlow(state?: string) {
  if (typeof window === "undefined") return;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      if (!state) {
        storage.removeItem(FLOW_STORAGE_MAP_KEY);
        storage.removeItem(FLOW_STORAGE_KEY);
        continue;
      }

      const entries = readStoredFlows(storage);
      entries.delete(state);
      const serialized = JSON.stringify(Object.fromEntries(entries));
      if (entries.size) storage.setItem(FLOW_STORAGE_MAP_KEY, serialized);
      else storage.removeItem(FLOW_STORAGE_MAP_KEY);

      const rawLegacyFlow = storage.getItem(FLOW_STORAGE_KEY);
      if (rawLegacyFlow) {
        try {
          const parsed: unknown = JSON.parse(rawLegacyFlow);
          if (isAuthFlow(parsed) && parsed.state === state) storage.removeItem(FLOW_STORAGE_KEY);
        } catch {
          // Leave unrelated malformed state untouched.
        }
      }
    } catch {
      // Cleanup should continue even if a browser store is unavailable.
    }
  }
}

export function getStoredAuthFlow(state?: string) {
  return readStoredFlow(state);
}

async function apiGet<T>(path: string) {
  const apiBaseUrl = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
  const res = await requestFinanceApi(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const json = await readResponsePayload(res);
  if (!res.ok) {
    const errorMessage = typeof json.error === "string" ? json.error : typeof json.message === "string" ? json.message : typeof json.raw === "string" ? json.raw : `HTTP ${res.status}`;
    throw new Error(errorMessage);
  }
  return json.data as T;
}

async function apiPost<T>(path: string, body: unknown, options?: { signal?: AbortSignal }) {
  const apiBaseUrl = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
  const res = await requestFinanceApi(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: options?.signal || AbortSignal.timeout(20000),
  });
  const json = await readResponsePayload(res);
  if (!res.ok) {
    const errorMessage = typeof json.error === "string" ? json.error : typeof json.message === "string" ? json.message : typeof json.raw === "string" ? json.raw : `HTTP ${res.status}`;
    throw new Error(errorMessage);
  }
  return json.data as {
    tokens: AuthTokenPayload;
    profile: AuthProfile;
  };
}

export async function fetchAuthConfig() {
  return apiGet<AuthPublicConfig>("/v1/auth/config");
}

export function isAuthConfigured(config?: AuthPublicConfig | null) {
  return Boolean(config?.enabled);
}

export async function createGoogleLoginFlow(options?: { returnTo?: string }) {
  const config = await fetchAuthConfig();
  if (!config.enabled || !config.googleEnabled || !config.googleClientId) {
    throw new Error("Google no esta configurado.");
  }

  const redirectUri = `${window.location.origin}/auth/callback`;
  const returnTo = options?.returnTo || window.location.pathname + window.location.search + window.location.hash;
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const flow: AuthFlow = { state, codeVerifier, redirectUri, returnTo };
  saveStoredFlow(flow);

  const authUrl = new URL(config.googleAuthUrl || "https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.googleClientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent select_account");

  return authUrl.toString();
}

export async function exchangeGoogleAuthorizationCode(payload: AuthExchangeRequest, options?: { signal?: AbortSignal }) {
  const result = await apiPost<{ tokens: AuthTokenPayload; profile: AuthProfile }>("/v1/auth/google/exchange", {
    code: payload.code,
    codeVerifier: payload.codeVerifier,
    redirectUri: payload.redirectUri,
    state: payload.state,
  }, options);
  return result;
}

export async function loginWithEmailPassword(payload: { email: string; password: string }) {
  return apiPost<{ tokens: AuthTokenPayload; profile: AuthProfile }>("/v1/auth/email/login", payload);
}

export async function registerWithEmailPassword(payload: { name?: string; email: string; password: string }) {
  return apiPost<{ tokens: AuthTokenPayload; profile: AuthProfile }>("/v1/auth/email/register", payload);
}

export async function refreshAuthSession() {
  const refreshToken = readFinanceRefreshToken();
  if (!refreshToken) {
    throw new Error("No hay refresh token guardado.");
  }

  return apiPost<{ tokens: AuthTokenPayload; profile: AuthProfile }>("/v1/auth/refresh", {
    refreshToken,
  });
}

/** Try rotating a rejected access token before treating the user as signed out. */
export async function recoverAuthSession() {
  try {
    const result = await refreshAuthSession();
    persistAuthTokens(result.tokens);
    return true;
  } catch {
    return false;
  }
}

export async function revokeAuthSession() {
  const refreshToken = readFinanceRefreshToken();
  if (!refreshToken) return;

  try {
    await apiPost<{ ok: boolean }>("/v1/auth/logout", { refreshToken });
  } catch {
    // Logout local still succeeds if the server is temporarily unavailable.
  }
}

export function persistAuthTokens(tokens: AuthTokenPayload) {
  setFinanceAuthToken(tokens.access_token || "");
  setFinanceRefreshToken(tokens.refresh_token || "");
}

export function clearAuthSession() {
  setFinanceAuthToken("");
  setFinanceRefreshToken("");
  clearStoredAuthFlow();
}
