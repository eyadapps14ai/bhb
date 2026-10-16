import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@/db";
import type { Access } from "./access";
import { accessFor } from "./auth";

// Personal Claude keys for the MCP endpoint (app/api/mcp). A key is shown to its owner once; only its
// SHA-256 hash is stored. Every call made with it runs as that person, with their current role and
// branches, so revoking the key, changing the role or deactivating the user takes effect at once.
const PREFIX = "bhb_";
export const MAX_KEYS = 5;
export type ClaudeKey = { id: string; label: string; created: string; lastUsed: string };

const digest = (key: string) => createHash("sha256").update(key).digest("base64url");

export async function listKeys(db: Database, userId: string): Promise<ClaudeKey[]> {
  const rows = await db.prepare("SELECT id,label,created,last_used FROM claude_keys WHERE user_id=? ORDER BY created DESC").bind(userId).all<{ id: string; label: string; created: string; last_used: string }>();
  return rows.results.map((r) => ({ id: r.id, label: r.label, created: r.created, lastUsed: r.last_used }));
}

export async function createKey(db: Database, userId: string, label: string) {
  if ((await listKeys(db, userId)).length >= MAX_KEYS) throw new Error(`You can have up to ${MAX_KEYS} Claude keys. Revoke one first.`);
  const key = PREFIX + randomBytes(32).toString("base64url"), id = randomUUID();
  await db.prepare("INSERT INTO claude_keys (id,user_id,hash,label,created,last_used) VALUES (?,?,?,?,?,?)").bind(id, userId, digest(key), label, new Date().toISOString(), "").run();
  return { id, key };
}

export async function revokeKey(db: Database, userId: string, id: string) {
  if (!(await db.prepare("DELETE FROM claude_keys WHERE id=? AND user_id=? RETURNING id").bind(id, userId).first())) throw new Error("Key not found.");
}

/** The person a key belongs to, as they are now; null for an unknown or revoked key or an inactive user. */
export async function accessForKey(db: Database, key: string): Promise<Access | null> {
  if (!key.startsWith(PREFIX) || key.length > 100) return null;
  const row = await db.prepare("UPDATE claude_keys SET last_used=? WHERE hash=? RETURNING user_id").bind(new Date().toISOString(), digest(key)).first<{ user_id: string }>();
  return row ? accessFor(row.user_id) : null;
}
