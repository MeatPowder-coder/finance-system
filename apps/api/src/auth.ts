import type { FastifyRequest } from "fastify";
import { createHash, createSecretKey, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { query } from "./db.js";

export type AuthPublicConfig = {
  enabled: boolean;
  appName: string;
  emailPasswordEnabled: boolean;
  googleEnabled: boolean;
  googleClientId: string | null;
  googleAuthUrl: string;
};

export type AuthSession = {
  userId: string;
  email: string | null;
  username: string;
  name: string | null;
  picture: string | null;
  provider: "LOCAL" | "GOOGLE";
  roles: string[];
  token: string;
  expiresAt: number;
  sessionId: string;
};

export type AuthTokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  token_type?: string;
};

type AuthUserRow = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  picture: string | null;
  auth_provider: "LOCAL" | "GOOGLE";
  google_sub: string | null;
  password_hash: string | null;
  email_verified: boolean;
  is_active: boolean;
  roles: string[] | null;
};

type AuthSessionRow = {
  id: string;
  refresh_token_hash: string;
  refresh_token_expires_at: Date | string;
  revoked_at: Date | string | null;
};

const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS || 15 * 60);
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.AUTH_REFRESH_TOKEN_TTL_DAYS || 30);
const AUTH_AUDIENCE = "finance-system-web";
const AUTH_ISSUER = process.env.AUTH_ISSUER || "finance-system";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const AUTH_FLOW_STORAGE_KEY = "finance-system.authFlow";
const AUTH_REFRESH_TOKEN_HASH_ALGORITHM = "sha256";
export const INTERNAL_REQUEST_HEADER = "x-finance-internal-request";

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalizeEmail(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function normalizeName(value: string | null | undefined) {
  return normalizeText(value).slice(0, 160) || null;
}

function normalizeUsername(value: string | null | undefined) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function createAvailableUsername(email: string, preferred?: string | null) {
  const base = normalizeUsername(preferred) || normalizeUsername(email.split("@")[0]) || "usuario";
  let candidate = base;
  let suffix = 1;
  while (true) {
    const existing = await query<{ id: string }>(`SELECT id FROM auth_users WHERE LOWER(username) = LOWER($1) LIMIT 1`, [candidate]);
    if (!existing.rowCount) return candidate;
    candidate = `${base.slice(0, Math.max(1, 42 - String(suffix).length))}-${suffix}`;
    suffix += 1;
  }
}

function getAuthSecret() {
  return normalizeText(process.env.AUTH_JWT_SECRET || process.env.NEXTAUTH_SECRET);
}

function getGoogleClientId() {
  return normalizeText(process.env.GOOGLE_CLIENT_ID);
}

function getGoogleClientSecret() {
  return normalizeText(process.env.GOOGLE_CLIENT_SECRET);
}

function getAuthKey() {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET o NEXTAUTH_SECRET no configurado.");
  }
  return createSecretKey(new TextEncoder().encode(secret));
}

function randomBase64Url(bytes = 32) {
  const buffer = randomBytes(bytes);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function hashToken(value: string) {
  return createHash(AUTH_REFRESH_TOKEN_HASH_ALGORITHM).update(value).digest("hex");
}

function hashPassword(password: string, salt = randomBytes(16).toString("base64url")) {
  const derived = pbkdf2Sync(password, salt, 210_000, 64, "sha512").toString("base64url");
  return `pbkdf2$210000$${salt}$${derived}`;
}

function verifyPassword(password: string, storedHash: string) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = parts[3];
  if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expected) return false;

  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("base64url");
  const expectedBuffer = Buffer.from(expected);
  const derivedBuffer = Buffer.from(derived);
  if (expectedBuffer.length !== derivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, derivedBuffer);
}

async function signAccessToken(user: AuthUserRow, sessionId: string) {
  const secret = getAuthKey();
  const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : ["user"];
  return new SignJWT({
    email: user.email,
    name: user.name,
    picture: user.picture,
    provider: user.auth_provider,
    roles,
    sid: sessionId,
    tokenType: "finance_access",
    "https://hasura.io/jwt/claims": {
      "x-hasura-default-role": roles[0] || "user",
      "x-hasura-allowed-roles": roles,
      "x-hasura-role": roles[0] || "user",
      "x-hasura-user-id": user.id,
    },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(AUTH_ISSUER)
    .setAudience(AUTH_AUDIENCE)
    .setIssuedAt()
    .setJti(randomBase64Url(24))
    .setExpirationTime(`${Math.max(5, ACCESS_TOKEN_TTL_SECONDS)}s`)
    .sign(secret);
}

function extractBearerToken(req: FastifyRequest) {
  const header = String(req.headers.authorization || "");
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return "";
}

export function isInternalFinanceRequest(req: FastifyRequest) {
  const marker = String((req.headers[INTERNAL_REQUEST_HEADER] as string | undefined) || "").trim().toLowerCase();
  return marker === "1" || marker === "true" || marker === "yes" || marker === "telegram-webhook" || marker === "internal";
}

function buildProfile(user: AuthUserRow, token: string, expiresAt: number): AuthSession {
  return {
    userId: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    picture: user.picture,
    provider: user.auth_provider,
    roles: Array.isArray(user.roles) && user.roles.length ? user.roles : ["user"],
    token,
    expiresAt,
    sessionId: "",
  };
}

async function createAuthSession(user: AuthUserRow) {
  const refreshToken = randomBase64Url(48);
  const refreshTokenHash = hashToken(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const sessionRes = await query<AuthSessionRow>(
    `INSERT INTO auth_sessions (
       user_id,
       refresh_token_hash,
       refresh_token_expires_at,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id, refresh_token_hash, refresh_token_expires_at, revoked_at`,
    [user.id, refreshTokenHash, refreshExpiresAt]
  );

  const session = sessionRes.rows[0];
  const accessToken = await signAccessToken(user, session.id);
  const expiresAt = Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000;

  await query(
    `UPDATE auth_users
        SET last_login_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [user.id]
  );

  return {
    tokens: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_expires_in: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      token_type: "Bearer",
    } satisfies AuthTokenSet,
    profile: {
      ...buildProfile(user, accessToken, expiresAt),
      sessionId: session.id,
    },
  };
}

async function getUserByEmail(email: string) {
  const res = await query<AuthUserRow>(
    `SELECT id, email, username, name, picture, auth_provider, google_sub, password_hash, email_verified, is_active, roles
       FROM auth_users
      WHERE email = $1
      LIMIT 1`,
    [normalizeEmail(email)]
  );
  return res.rows[0] || null;
}

async function getUserByGoogleSub(googleSub: string) {
  const res = await query<AuthUserRow>(
    `SELECT id, email, username, name, picture, auth_provider, google_sub, password_hash, email_verified, is_active, roles
       FROM auth_users
      WHERE google_sub = $1
      LIMIT 1`,
    [normalizeText(googleSub)]
  );
  return res.rows[0] || null;
}

async function saveGoogleUser(profile: { sub: string; email: string; name: string | null; picture: string | null; email_verified: boolean }) {
  const normalizedEmail = normalizeEmail(profile.email);
  if (!normalizedEmail) {
    throw new Error("Google no devolvio un correo valido.");
  }

  const normalizedSub = normalizeText(profile.sub);
  const existingBySub = await getUserByGoogleSub(normalizedSub);
  const existingByEmail = existingBySub || (await getUserByEmail(normalizedEmail));
  if (existingByEmail) {
    const updated = await query<AuthUserRow>(
      `UPDATE auth_users
          SET email = $2,
              name = COALESCE($3, name),
              picture = COALESCE($4, picture),
              google_sub = COALESCE(google_sub, $1),
              auth_provider = 'GOOGLE',
              email_verified = TRUE,
              is_active = TRUE,
              updated_at = NOW()
        WHERE id = $5
        RETURNING id, email, username, name, picture, auth_provider, google_sub, password_hash, email_verified, is_active, roles`,
      [normalizedSub, normalizedEmail, normalizeName(profile.name), normalizeText(profile.picture) || null, existingByEmail.id]
    );
    return updated.rows[0];
  }

  const username = await createAvailableUsername(normalizedEmail, profile.name);
  const inserted = await query<AuthUserRow>(
    `INSERT INTO auth_users (
       email,
       username,
       name,
       picture,
       auth_provider,
       google_sub,
       email_verified,
       is_active,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, 'GOOGLE', $5, $6, TRUE, NOW(), NOW())
     RETURNING id, email, username, name, picture, auth_provider, google_sub, password_hash, email_verified, is_active, roles`,
    [normalizedEmail, username, normalizeName(profile.name), normalizeText(profile.picture) || null, normalizedSub, Boolean(profile.email_verified)]
  );
  return inserted.rows[0];
}

async function saveEmailPasswordUser(payload: { email: string; name?: string | null; password: string }) {
  const normalizedEmail = normalizeEmail(payload.email);
  const passwordHash = hashPassword(payload.password);
  const existing = await getUserByEmail(normalizedEmail);

  if (existing && existing.password_hash) {
    throw new Error("Ese correo ya tiene una cuenta. Inicia sesion o usa Google.");
  }

  if (existing) {
    const updated = await query<AuthUserRow>(
      `UPDATE auth_users
          SET name = COALESCE($2, name),
              password_hash = $3,
              auth_provider = 'LOCAL',
              email_verified = TRUE,
              is_active = TRUE,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, username, name, picture, auth_provider, google_sub, password_hash, email_verified, is_active, roles`,
      [existing.id, normalizeName(payload.name), passwordHash]
    );
    return updated.rows[0];
  }

  const inserted = await query<AuthUserRow>(
      `INSERT INTO auth_users (
       email,
       username,
       name,
       password_hash,
       auth_provider,
       email_verified,
       is_active,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, 'LOCAL', TRUE, TRUE, NOW(), NOW())
     RETURNING id, email, username, name, picture, auth_provider, google_sub, password_hash, email_verified, is_active, roles`,
    [normalizedEmail, await createAvailableUsername(normalizedEmail, payload.name), normalizeName(payload.name), passwordHash]
  );
  return inserted.rows[0];
}

function toPublicProfile(user: AuthUserRow, sessionId: string, token: string, expiresAt: number): AuthSession {
  return {
    userId: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    picture: user.picture,
    provider: user.auth_provider,
    roles: Array.isArray(user.roles) && user.roles.length ? user.roles : ["user"],
    token,
    expiresAt,
    sessionId,
  };
}

export function getAuthPublicConfig(): AuthPublicConfig {
  const enabled = Boolean(getAuthSecret());
  const googleClientId = getGoogleClientId();

  return {
    enabled,
    appName: "FinanceSystem",
    emailPasswordEnabled: enabled,
    googleEnabled: enabled && Boolean(googleClientId),
    googleClientId: googleClientId || null,
    googleAuthUrl: GOOGLE_AUTH_URL,
  };
}

export function isAuthEnabled() {
  return Boolean(getAuthSecret());
}

export async function resolveFinanceSession(req: FastifyRequest): Promise<AuthSession | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAuthKey(), {
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
    });

    const userId = typeof payload.sub === "string" ? payload.sub : "";
    if (!userId) return null;

    const email = typeof payload.email === "string" ? payload.email : null;
    const name = typeof payload.name === "string" ? payload.name : null;
    const picture = typeof payload.picture === "string" ? payload.picture : null;
    const provider = payload.provider === "GOOGLE" ? "GOOGLE" : "LOCAL";
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : ["user"];
    const expiresAt = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
    const sessionId = typeof payload.sid === "string" ? payload.sid : "";
    if (!sessionId) return null;

    const sessionRes = await query<
      AuthSessionRow & {
        user_id: string;
        email: string;
        username: string;
        name: string | null;
        picture: string | null;
        auth_provider: "LOCAL" | "GOOGLE";
        roles: string[] | null;
        email_verified: boolean;
        is_active: boolean;
      }
    >(
      `SELECT
         s.id,
         s.refresh_token_hash,
         s.refresh_token_expires_at,
         s.revoked_at,
         u.id AS user_id,
         u.email,
         u.username,
         u.name,
         u.picture,
         u.auth_provider,
         u.roles,
         u.email_verified,
         u.is_active
       FROM auth_sessions s
       INNER JOIN auth_users u ON u.id = s.user_id
       WHERE s.id = $1
       LIMIT 1`,
      [sessionId]
    );

    const sessionRow = sessionRes.rows[0];
    if (!sessionRow || sessionRow.revoked_at || !sessionRow.is_active) {
      return null;
    }

    return {
      userId: sessionRow.user_id || userId,
      email: sessionRow.email || email,
      username: sessionRow.username || normalizeUsername(email || "usuario"),
      name: sessionRow.name ?? name,
      picture: sessionRow.picture ?? picture,
      provider: sessionRow.auth_provider || provider,
      roles: Array.isArray(sessionRow.roles) && sessionRow.roles.length ? sessionRow.roles : roles.length ? roles : ["user"],
      token,
      expiresAt,
      sessionId,
    };
  } catch {
    return null;
  }
}

export async function loginWithEmailPassword(payload: { email: string; password: string }) {
  const user = await getUserByEmail(payload.email);
  if (!user || !user.is_active) {
    throw new Error("Credenciales invalidas.");
  }

  if (!user.password_hash) {
    throw new Error("Esta cuenta no tiene contraseña. Entra con Google o crea una contraseña.");
  }

  if (!verifyPassword(payload.password, user.password_hash)) {
    throw new Error("Credenciales invalidas.");
  }

  const session = await createAuthSession(user);
  return {
    tokens: session.tokens,
    profile: session.profile,
  };
}

export async function registerWithEmailPassword(payload: { email: string; password: string; name?: string | null }) {
  const user = await saveEmailPasswordUser(payload);
  const session = await createAuthSession(user);
  return {
    tokens: session.tokens,
    profile: session.profile,
  };
}

export async function exchangeGoogleAuthorizationCode(payload: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  state?: string;
}) {
  const googleClientId = getGoogleClientId();
  if (!googleClientId) {
    throw new Error("Google no esta configurado.");
  }

  const form = new URLSearchParams({
    client_id: googleClientId,
    code: payload.code,
    code_verifier: payload.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: payload.redirectUri,
  });

  const googleClientSecret = getGoogleClientSecret();
  if (googleClientSecret) {
    form.set("client_secret", googleClientSecret);
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const tokenJson = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok) {
    throw new Error(tokenJson?.error_description || tokenJson?.error || `Google token exchange failed (${tokenRes.status})`);
  }

  const accessToken = String(tokenJson?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("Google no devolvio un access_token valido.");
  }

  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const profileJson = await profileRes.json().catch(() => null);
  if (!profileRes.ok) {
    throw new Error(profileJson?.error?.message || profileJson?.error || `Google userinfo failed (${profileRes.status})`);
  }

  const user = await saveGoogleUser({
    sub: String(profileJson?.sub || "").trim(),
    email: String(profileJson?.email || "").trim(),
    name: profileJson?.name ? String(profileJson.name) : null,
    picture: profileJson?.picture ? String(profileJson.picture) : null,
    email_verified: Boolean(profileJson?.email_verified),
  });

  const session = await createAuthSession(user);
  return {
    tokens: session.tokens,
    profile: session.profile,
  };
}

export async function refreshAuthTokens(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const sessionRes = await query<
    AuthSessionRow & {
      user_id: string;
      email: string;
      username: string;
      name: string | null;
      picture: string | null;
      auth_provider: "LOCAL" | "GOOGLE";
      password_hash: string | null;
      roles: string[] | null;
      email_verified: boolean;
      is_active: boolean;
    }
  >(
    `SELECT
       s.id,
       s.refresh_token_hash,
       s.refresh_token_expires_at,
       s.revoked_at,
       u.id AS user_id,
       u.email,
       u.username,
       u.name,
       u.picture,
       u.auth_provider,
       u.password_hash,
       u.roles,
       u.email_verified,
       u.is_active
     FROM auth_sessions s
     INNER JOIN auth_users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  const session = sessionRes.rows[0];
  if (!session || session.revoked_at) {
    throw new Error("Sesion invalida.");
  }

  const expiresAt = new Date(session.refresh_token_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new Error("La sesion ha expirado.");
  }

  if (!session.is_active) {
    throw new Error("La cuenta esta desactivada.");
  }

  const newRefreshToken = randomBase64Url(48);
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const newRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const accessToken = await signAccessToken(
    {
      id: session.user_id,
      email: session.email,
      username: session.username,
      name: session.name,
      picture: session.picture,
      auth_provider: session.auth_provider,
      google_sub: null,
      password_hash: session.password_hash,
      email_verified: session.email_verified,
      is_active: session.is_active,
      roles: session.roles,
    },
    session.id
  );

  await query(
    `UPDATE auth_sessions
        SET refresh_token_hash = $1,
            refresh_token_expires_at = $2,
            updated_at = NOW()
      WHERE id = $3`,
    [newRefreshTokenHash, newRefreshExpiresAt, session.id]
  );

  return {
    tokens: {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_expires_in: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      token_type: "Bearer",
    } satisfies AuthTokenSet,
    profile: toPublicProfile(
      {
        id: session.user_id,
        email: session.email,
        username: session.username,
        name: session.name,
        picture: session.picture,
        auth_provider: session.auth_provider,
        google_sub: null,
        password_hash: session.password_hash,
        email_verified: session.email_verified,
        is_active: session.is_active,
        roles: session.roles,
      },
      session.id,
      accessToken,
      Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000
    ),
  };
}

export async function revokeRefreshToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await query(
    `UPDATE auth_sessions
        SET revoked_at = NOW(),
            updated_at = NOW()
      WHERE refresh_token_hash = $1
         OR id IN (
            SELECT id FROM auth_sessions WHERE refresh_token_hash = $1 LIMIT 1
         )`,
    [tokenHash]
  );
}
