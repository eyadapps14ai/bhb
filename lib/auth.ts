import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

export type User = {
  userId: string;
};

// Staff sign in with one shared password (APP_PASSWORD). The session cookie is
// an expiry time signed with that password, so changing the password signs
// everyone out.
const SESSION_COOKIE = "bhb_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const STAFF_USER: User = { userId: "staff" };
const LOCAL_USER: User = { userId: "local-dev" };

export async function getUser(): Promise<User | null> {
  if (!process.env.APP_PASSWORD) return import.meta.env.DEV ? LOCAL_USER : null;
  const session = readCookie((await headers()).get("cookie"), SESSION_COOKIE);
  return session && verifySession(session) ? STAFF_USER : null;
}

export function checkPassword(attempt: string) {
  const password = process.env.APP_PASSWORD;
  return !!password && safeEqual(hash(attempt), hash(password));
}

export function sessionCookie(request: Request) {
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  return cookieHeader(request, `${expires}.${sign(expires)}`, SESSION_SECONDS);
}

export function clearedSessionCookie(request: Request) {
  return cookieHeader(request, "", 0);
}

function verifySession(session: string) {
  const [expires, signature] = session.split(".");
  return Number(expires) > Date.now() && !!signature && safeEqual(signature, sign(expires));
}

function sign(value: string) {
  return createHmac("sha256", process.env.APP_PASSWORD ?? "")
    .update(`bhb-session:${value}`)
    .digest("base64url");
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function cookieHeader(request: Request, value: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function readCookie(header: string | null, name: string) {
  for (const part of header?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}
