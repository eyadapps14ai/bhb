import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@/db";
import type { Access } from "./access";
import { accessFor } from "./auth";

// Personal Claude keys for the MCP endpoint (app/api/mcp). A key is shown to its owner once; only its
// SHA-256 hash is stored. Every call made with it runs as that person, with their current role and
// branches. Keys stop working after 90 days, and all of a person's keys and Claude connections are removed
// when their password changes or their account is deactivated (revokeAllClaudeAccess).
const PREFIX = "bhb_";
const KEY_DAYS = 90;
export const MAX_KEYS = 5;
export type ClaudeKey = { id: string; label: string; created: string; lastUsed: string; expires: string };
type Row = { id: string; label: string; created: string; last_used: string };

const digest = (key: string) => createHash("sha256").update(key).digest("base64url");
const expiry = (created: string) => new Date(Date.parse(created) + KEY_DAYS * 864e5).toISOString();
const cutoff = () => new Date(Date.now() - KEY_DAYS * 864e5).toISOString();
const shape = (r: Row): ClaudeKey => ({ id: r.id, label: r.label, created: r.created, lastUsed: r.last_used, expires: expiry(r.created) });

export async function listKeys(db: Database, userId: string): Promise<ClaudeKey[]> {
  const rows = await db.prepare("SELECT id,label,created,last_used FROM claude_keys WHERE user_id=? AND created>? ORDER BY created DESC").bind(userId, cutoff()).all<Row>();
  return rows.results.map(shape);
}

export async function createKey(db: Database, userId: string, label: string) {
  await db.prepare("DELETE FROM claude_keys WHERE user_id=? AND created<=?").bind(userId, cutoff()).run();
  if ((await listKeys(db, userId)).length >= MAX_KEYS) throw new Error(`You can have up to ${MAX_KEYS} Claude keys. Revoke one first.`);
  const key = PREFIX + randomBytes(32).toString("base64url"), id = randomUUID();
  await db.prepare("INSERT INTO claude_keys (id,user_id,hash,label,created,last_used) VALUES (?,?,?,?,?,?)").bind(id, userId, digest(key), label, new Date().toISOString(), "").run();
  return { id, key };
}

/** Removes one key: the owner's own, or anyone's when ownerId is null (checked by the caller). */
export async function revokeKey(db: Database, ownerId: string | null, id: string) {
  const row = ownerId === null
    ? await db.prepare("DELETE FROM claude_keys WHERE id=? RETURNING id").bind(id).first()
    : await db.prepare("DELETE FROM claude_keys WHERE id=? AND user_id=? RETURNING id").bind(id, ownerId).first();
  if (!row) throw new Error("Key not found.");
}

/** Every key with its owner, for people who manage Users & roles. */
export async function listAllKeys(db: Database) {
  const rows = await db.prepare("SELECT k.id,k.label,k.created,k.last_used,k.user_id,u.email,u.data FROM claude_keys k LEFT JOIN users u ON u.id=k.user_id WHERE k.created>? ORDER BY k.created DESC").bind(cutoff()).all<Row & { user_id: string; email: string | null; data: string | null }>();
  return rows.results.map((r) => ({ ...shape(r), userId: r.user_id, owner: r.data ? JSON.parse(r.data).name : r.email || "Removed user", roleId: r.data ? JSON.parse(r.data).roleId : "" }));
}

/** Cuts off all Claude access for a person: keys and Claude connections (OAuth grants). */
export async function revokeAllClaudeAccess(db: Database, userId: string) {
  await db.batch([db.prepare("DELETE FROM claude_keys WHERE user_id=?").bind(userId), db.prepare("DELETE FROM oauth_grants WHERE user_id=?").bind(userId)]);
}

/** The person a key belongs to, as they are now; null for an unknown, expired or revoked key or an inactive user. */
export async function accessForKey(db: Database, key: string): Promise<Access | null> {
  if (!key.startsWith(PREFIX) || key.length > 100) return null;
  const row = await db.prepare("UPDATE claude_keys SET last_used=? WHERE hash=? AND created>? RETURNING user_id").bind(new Date().toISOString(), digest(key), cutoff()).first<{ user_id: string }>();
  return row ? accessFor(row.user_id) : null;
}
