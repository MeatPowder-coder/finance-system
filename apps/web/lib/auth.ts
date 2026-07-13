"use client";

import { readFinanceRefreshToken, resolveFinanceApiBaseUrl, setFinanceAuthToken, setFinanceRefreshToken } from "./runtime-config";

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

function readStoredFlow(): AuthFlow | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FLOW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthFlow>;
    if (!parsed.state || !parsed.codeVerifier || !parsed.redirectUri || !parsed.returnTo) {
      return null;
    }
    return {
      state: parsed.state,
      codeVerifier: parsed.codeVerifier,
      redirectUri: parsed.redirectUri,
      returnTo: parsed.returnTo,
    };
  } catch {
    return null;
  }
}

function saveStoredFlow(flow: AuthFlow) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(flow));
}

export function clearStoredAuthFlow() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(FLOW_STORAGE_KEY);
}

export function getStoredAuthFlow() {
  return readStoredFlow();
}

async function apiGet<T>(path: string) {
  const apiBaseUrl = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
  const res = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  const json = await readResponsePayload(res);
  if (!res.ok) {
    const errorMessage = typeof json.error === "string" ? json.error : typeof json.message === "string" ? json.message : typeof json.raw === "string" ? json.raw : `HTTP ${res.status}`;
    throw new Error(errorMessage);
  }
  return json.data as T;
}

async function apiPost<T>(path: string, body: unknown) {
  const apiBaseUrl = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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

export async function exchangeGoogleAuthorizationCode(payload: AuthExchangeRequest) {
  const result = await apiPost<{ tokens: AuthTokenPayload; profile: AuthProfile }>("/v1/auth/google/exchange", {
    code: payload.code,
    codeVerifier: payload.codeVerifier,
    redirectUri: payload.redirectUri,
    state: payload.state,
  });
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
