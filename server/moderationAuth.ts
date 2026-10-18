import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * @file moderationAuth.ts
 * Authentification de la console de modération de Goat Chèvre The King.
 *
 * - Mot de passe unique fourni par la variable d'environnement MODERATION_PASSWORD.
 * - Session conservée dans un cookie httpOnly signé (HMAC-SHA256), sans dépendance externe.
 * - Protection anti-force brute en mémoire (5 tentatives / 15 minutes par IP).
 *
 * Si MODERATION_PASSWORD n'est pas défini, la console reste totalement fermée (fail-closed) :
 * la galerie publique continue de fonctionner normalement.
 */

export const MODERATION_COOKIE_NAME = "goat_moderation";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 heures
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  firstAt: number;
}

const loginAttempts = new Map<string, AttemptRecord>();

function getModerationPassword(): string | null {
  const value = process.env.MODERATION_PASSWORD;
  return value && value.trim() ? value : null;
}

export function isModerationConfigured(): boolean {
  return getModerationPassword() !== null;
}

function getSigningSecret(): string {
  if (process.env.MODERATION_SESSION_SECRET && process.env.MODERATION_SESSION_SECRET.trim()) {
    return process.env.MODERATION_SESSION_SECRET;
  }
  // Secours : secret dérivé du mot de passe (changer le mot de passe invalide les sessions).
  return crypto
    .createHash("sha256")
    .update(`goatchevretheking:moderation-session:${getModerationPassword() ?? "unconfigured"}`)
    .digest("hex");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(crypto.createHash("sha256").update(a).digest());
  const bufB = Buffer.from(crypto.createHash("sha256").update(b).digest());
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Compare le mot de passe soumis à MODERATION_PASSWORD en temps constant. */
export function verifyPassword(candidate: unknown): boolean {
  const expected = getModerationPassword();
  if (!expected) return false;
  if (typeof candidate !== "string" || !candidate) return false;
  return safeEqual(candidate, expected);
}

/** Crée un jeton de session signé, valable 8 heures. */
export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Vérifie la signature et l'expiration d'un jeton de session. */
export function verifySessionToken(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expiresAt, signature] = parts;
  const payload = `${version}.${expiresAt}`;
  if (!safeEqual(signature, sign(payload))) return false;
  const expiry = Number(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const chunk of header.split(";")) {
    const index = chunk.indexOf("=");
    if (index === -1) continue;
    const key = chunk.slice(0, index).trim();
    const value = chunk.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function isHttpsRequest(req: Request): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return req.secure || proto === "https";
}

/** Options du cookie de session (httpOnly, sameSite lax, secure sous HTTPS). */
export function sessionCookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttpsRequest(req),
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

export function isAuthenticated(req: Request): boolean {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[MODERATION_COOKIE_NAME]);
}

/** Middleware : refuse l'accès aux routes de modération sans session valide. */
export function requireModerator(req: Request, res: Response, next: NextFunction): void {
  if (!isModerationConfigured()) {
    res.status(503).json({
      error: "Modération non configurée : définissez la variable MODERATION_PASSWORD.",
    });
    return;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Session de modération requise.", authenticated: false });
    return;
  }
  next();
}

export type LoginResult = { ok: true } | { ok: false; status: number; error: string };

/** Vérifie le mot de passe avec limitation du nombre de tentatives par IP. */
export function attemptLogin(ip: string, password: unknown): LoginResult {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    if (now - record.firstAt > ATTEMPT_WINDOW_MS) {
      loginAttempts.delete(ip);
    } else if (record.count >= MAX_ATTEMPTS) {
      const minutes = Math.ceil((ATTEMPT_WINDOW_MS - (now - record.firstAt)) / 60000);
      return {
        ok: false,
        status: 429,
        error: `Trop de tentatives échouées. Réessayez dans ${minutes} minute(s).`,
      };
    }
  }

  if (!isModerationConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "Modération non configurée : définissez la variable MODERATION_PASSWORD.",
    };
  }

  if (!verifyPassword(password)) {
    const current = loginAttempts.get(ip);
    loginAttempts.set(ip, {
      count: (current?.count ?? 0) + 1,
      firstAt: current?.firstAt ?? now,
    });
    return { ok: false, status: 401, error: "Mot de passe de modération incorrect." };
  }

  loginAttempts.delete(ip);
  return { ok: true };
}
