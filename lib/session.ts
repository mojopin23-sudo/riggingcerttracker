import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "rr_session";
const DEV_SECRET = "dev-only-change-me-terminal-331";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionPayload = {
  u: string;
  exp: number;
};

export function authSecret() {
  return process.env.AUTH_SECRET || DEV_SECRET;
}

export function usingDefaultSecret() {
  return !process.env.AUTH_SECRET || process.env.AUTH_SECRET === DEV_SECRET;
}

export function signSession(username: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: now + MAX_AGE_MS } satisfies SessionPayload),
  ).toString("base64url");
  const sig = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(token: string | undefined, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!data || typeof data.u !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < now) return null;
    return data;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}
