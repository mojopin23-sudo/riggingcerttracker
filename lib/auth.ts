import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, safeEqual, SESSION_COOKIE, signSession, usingDefaultSecret } from "@/lib/session";

const DEV_PASSWORD = "terminal331";

export function loginConfig() {
  const user = process.env.APP_USER || "terminal";
  const configured = process.env.APP_PASSWORD;
  const production = process.env.NODE_ENV === "production";
  if (configured) {
    return { user, password: configured, usingDefault: configured === DEV_PASSWORD, locked: false };
  }
  if (production) {
    return { user, password: null, usingDefault: false, locked: true };
  }
  return { user, password: DEV_PASSWORD, usingDefault: true, locked: false };
}

export async function getSessionUser() {
  const jar = await cookies();
  const session = readSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  if (session.u !== loginConfig().user) return null;
  return session.u;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export function credentialsMatch(username: string, password: string) {
  const config = loginConfig();
  if (!config.password) return false;
  return safeEqual(username.trim(), config.user) && safeEqual(password, config.password);
}

export async function setSessionCookie(username: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export function secretWarning() {
  return process.env.NODE_ENV === "production" && usingDefaultSecret();
}
