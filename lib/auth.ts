import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { headers } from "next/headers";
import { getDb, type Database } from "@/db";
import { BRANCHES, SUPER_ADMIN, defaultRoles, normaliseRole, type Access, type Role } from "./access";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

// Each person signs in with their own email and password. The session cookie carries their user id and an
// expiry, signed with SESSION_SECRET (falling back to APP_PASSWORD). Until the first super admin account
// exists, the shared APP_PASSWORD signs in a temporary setup account so the owner can create it.
const SESSION_COOKIE = "bhb_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const SETUP_ID = "setup";

export async function getUser(): Promise<Access | null> {
  const session = readCookie((await headers()).get("cookie"), SESSION_COOKIE);
  const userId = session ? verifySession(session) : null;
  if (userId) return accessFor(userId);
  // Local development without a password: signed in automatically until the first super admin exists.
  if (!process.env.APP_PASSWORD && import.meta.env.DEV && (await needsSetup())) return setupAccess("Local developer");
  return null;
}

/** True while no active super admin account exists; the shared password only works in that state. */
export async function needsSetup() {
  return (await superAdmins(await getDb())) === 0;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const db = await getDb();
  if (!email.trim()) {
    const shared = process.env.APP_PASSWORD;
    return shared && safeEqual(hash(password), hash(shared)) && (await superAdmins(db)) === 0 ? SETUP_ID : null;
  }
  const row = await db.prepare("SELECT id,password,data FROM users WHERE email=?").bind(email.trim().toLowerCase()).first<{ id: string; password: string; data: string }>();
  // Check a password even for unknown emails so the answer takes the same time either way.
  const ok = await verifyPassword(password, row?.password ?? (await dummyHash()));
  return row && ok && JSON.parse(row.data).active ? row.id : null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await scrypt(password, salt, 64)).toString("base64url")}`;
}

export async function loadRoles(db: Database): Promise<Role[]> {
  const rows = await db.prepare("SELECT id,data FROM roles").all<{ id: string; data: string }>();
  const stored = new Map(rows.results.map((r) => [r.id, JSON.parse(r.data)]));
  const ids = [...new Set([...defaultRoles.map((r) => r.id), ...stored.keys()])];
  return ids.map((id) => normaliseRole({ ...(stored.get(id) ?? defaultRoles.find((r) => r.id === id)), id }));
}

export function sessionCookie(request: Request, userId: string) {
  const value = `${userId}.${Date.now() + SESSION_SECONDS * 1000}`;
  return cookieHeader(request, `${value}.${sign(value)}`, SESSION_SECONDS);
}

export function clearedSessionCookie(request: Request) {
  return cookieHeader(request, "", 0);
}

/** The access of an active user, or null; also used for personal Claude keys (lib/claude-keys.ts). */
export async function accessFor(userId: string): Promise<Access | null> {
  let db: Database;
  try {
    db = await getDb();
  } catch (error) {
    console.error("Database connection failed", error instanceof Error ? error.message : error);
    throw new Error("Record storage is unavailable. Please try again.");
  }
  if (userId === SETUP_ID) return (await superAdmins(db)) === 0 ? setupAccess("Setup (shared password)") : null;
  const row = await db.prepare("SELECT id,email,data FROM users WHERE id=?").bind(userId).first<{ id: string; email: string; data: string }>();
  if (!row) return null;
  const user = JSON.parse(row.data);
  if (!user.active) return null;
  const role = (await loadRoles(db)).find((r) => r.id === user.roleId) ?? normaliseRole({ id: "sales" });
  const branches = role.id === SUPER_ADMIN ? [...BRANCHES] : (user.branches ?? []).filter((b: string) => (BRANCHES as readonly string[]).includes(b));
  return { userId: row.id, name: user.name, email: row.email, roleId: role.id, roleName: role.name, branches, pages: role.pages, components: role.components, employeeId: user.employeeId || "" };
}

function setupAccess(name: string): Access {
  const role = defaultRoles[0];
  return { userId: SETUP_ID, name, email: "", roleId: role.id, roleName: role.name, branches: [...BRANCHES], pages: role.pages, components: role.components, bootstrap: true };
}

async function superAdmins(db: Database) {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE data::jsonb->>'roleId'=? AND (data::jsonb->>'active')::boolean").bind(SUPER_ADMIN).first<{ n: string | number }>();
  return Number(row?.n ?? 0);
}

async function verifyPassword(password: string, stored: string) {
  const [kind, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | undefined;
function dummyHash() {
  dummy ??= hashPassword(randomBytes(12).toString("base64url"));
  return dummy;
}

function secret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || (import.meta.env.DEV ? "local-development" : "");
}

function verifySession(session: string) {
  const [userId, expires, signature] = session.split(".");
  if (!userId || !signature || !secret() || !(Number(expires) > Date.now())) return null;
  return safeEqual(signature, sign(`${userId}.${expires}`)) ? userId : null;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(`bhb-session:${value}`).digest("base64url");
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
