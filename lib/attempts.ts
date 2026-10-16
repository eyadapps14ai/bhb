import { createHash } from "node:crypto";
import type { Database } from "@/db";

// Wrong-password limits, kept in the database so every Cloud Run instance shares them. Keys are hashes of
// "email:..." and "ip:...", so neither addresses nor emails are stored. Used by the Claude sign-in page.
const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { email: 5, ip: 20 };
export const TOO_MANY = "Too many wrong passwords. Wait 15 minutes and try again.";
const key = (kind: "email" | "ip", value: string) => createHash("sha256").update(`${kind}:${value.trim().toLowerCase()}`).digest("base64url");

/** Cloud Run appends the real client address as the last X-Forwarded-For entry; earlier ones come from the client. */
export const clientAddress = (req: Request) => req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "local";

export async function blocked(db: Database, email: string, ip: string) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const count = async (k: string) => Number((await db.prepare("SELECT COUNT(*) AS n FROM sign_in_failures WHERE key=? AND at>?").bind(k, since).first<{ n: string | number }>())?.n ?? 0);
  return (await count(key("email", email))) >= LIMITS.email || (await count(key("ip", ip))) >= LIMITS.ip;
}

export async function recordFailure(db: Database, email: string, ip: string) {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("DELETE FROM sign_in_failures WHERE at<?").bind(new Date(Date.now() - WINDOW_MS).toISOString()),
    db.prepare("INSERT INTO sign_in_failures (key,at) VALUES (?,?)").bind(key("email", email), now),
    db.prepare("INSERT INTO sign_in_failures (key,at) VALUES (?,?)").bind(key("ip", ip), now),
  ]);
}

export async function clearFailures(db: Database, email: string) {
  await db.prepare("DELETE FROM sign_in_failures WHERE key=?").bind(key("email", email)).run();
}
