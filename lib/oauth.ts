import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@/db";
import type { Access } from "./access";
import { accessFor } from "./auth";

// OAuth 2.1 for Claude's connectors (claude.ai, Claude Desktop and mobile, Claude Code) to reach the MCP
// endpoint as the person who signs in. Claude registers itself (RFC 7591), the person signs in and allows it
// on /api/oauth/authorize, and Claude swaps the code (PKCE S256) for a one-hour access token and a refresh
// token that is replaced on every refresh. Only token hashes are stored. Registration accepts Claude's own
// callback addresses only, so no other application can obtain a token.
export const ACCESS_SECONDS = 60 * 60;
const REFRESH_SECONDS = 30 * 24 * 60 * 60;
const CODE_SECONDS = 5 * 60;
export const SCOPE = "dashboard.read";
const HOSTED = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"];
const LOOPBACK = new Set(["localhost", "127.0.0.1"]);
export type Client = { id: string; name: string; redirectUris: string[] };
type Code = { clientId: string; redirectUri: string; challenge: string; userId: string; resource: string };

const digest = (value: string) => createHash("sha256").update(value).digest("base64url");
const secret = () => randomBytes(32).toString("base64url");
const later = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

/** The MCP endpoint's canonical address, which is also the token audience (RFC 8707). */
export const resourceFor = (origin: string) => `${origin}/api/mcp`;

// Claude Code redirects to http://localhost:<any port>/callback, so loopback addresses match without the port.
function loopback(uri: string) {
  try {
    const u = new URL(uri);
    return u.protocol === "http:" && LOOPBACK.has(u.hostname) && u.pathname === "/callback" && !u.search && !u.hash ? u : null;
  } catch {
    return null;
  }
}
export const allowedRedirect = (uri: string) => HOSTED.includes(uri) || !!loopback(uri);
export function redirectMatches(client: Client, uri: string) {
  if (client.redirectUris.includes(uri)) return true;
  const asked = loopback(uri);
  return !!asked && client.redirectUris.some((r) => {
    const known = loopback(r);
    return !!known && known.hostname === asked.hostname && known.pathname === asked.pathname;
  });
}
/** Where the code goes, in words for the consent screen. */
export const destination = (uri: string) => (loopback(uri) ? "Claude Code on this computer (" + new URL(uri).host + ")" : "Claude (" + new URL(uri).host + ")");

export async function registerClient(db: Database, name: string, redirectUris: string[]): Promise<Client> {
  const client = { id: randomUUID(), name: name.slice(0, 80) || "Claude", redirectUris };
  await db.prepare("INSERT INTO oauth_clients (id,data,created) VALUES (?,?,?)").bind(client.id, JSON.stringify({ name: client.name, redirectUris }), new Date().toISOString()).run();
  return client;
}

export async function getClient(db: Database, id: string): Promise<Client | null> {
  const row = await db.prepare("SELECT data FROM oauth_clients WHERE id=?").bind(id).first<{ data: string }>();
  return row ? { id, ...JSON.parse(row.data) } : null;
}

export async function createCode(db: Database, code: Code) {
  const value = secret();
  await db.prepare("DELETE FROM oauth_codes WHERE expires<?").bind(new Date().toISOString()).run();
  await db.prepare("INSERT INTO oauth_codes (hash,data,expires) VALUES (?,?,?)").bind(digest(value), JSON.stringify(code), later(CODE_SECONDS)).run();
  return value;
}

async function issue(db: Database, userId: string, clientId: string, grantId?: string) {
  const access = secret(), refresh = secret(), now = new Date().toISOString();
  if (grantId) {
    await db.prepare("UPDATE oauth_grants SET access_hash=?,access_expires=?,refresh_hash=?,refresh_expires=? WHERE id=?").bind(digest(access), later(ACCESS_SECONDS), digest(refresh), later(REFRESH_SECONDS), grantId).run();
  } else {
    await db.prepare("INSERT INTO oauth_grants (id,user_id,client_id,access_hash,access_expires,refresh_hash,refresh_expires,created,last_used) VALUES (?,?,?,?,?,?,?,?,?)").bind(randomUUID(), userId, clientId, digest(access), later(ACCESS_SECONDS), digest(refresh), later(REFRESH_SECONDS), now, "").run();
  }
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_SECONDS, refresh_token: refresh, scope: SCOPE };
}

export class GrantError extends Error {}

/** Swaps a one-time code for tokens; the code is deleted on first use, whatever the outcome. */
export async function exchangeCode(db: Database, input: { code: string; clientId: string; redirectUri: string; verifier: string; resource?: string }) {
  const row = await db.prepare("DELETE FROM oauth_codes WHERE hash=? RETURNING data,expires").bind(digest(input.code)).first<{ data: string; expires: string }>();
  if (!row || row.expires < new Date().toISOString()) throw new GrantError("The sign-in code is invalid or has expired.");
  const code: Code = JSON.parse(row.data);
  if (code.clientId !== input.clientId || code.redirectUri !== input.redirectUri) throw new GrantError("The sign-in code was issued to another client.");
  if (digest(input.verifier) !== code.challenge) throw new GrantError("The PKCE code verifier does not match.");
  if (input.resource && input.resource !== code.resource) throw new GrantError("The token is for another resource.");
  if (!(await accessFor(code.userId))) throw new GrantError("This account is no longer active.");
  return issue(db, code.userId, code.clientId);
}

export async function refresh(db: Database, token: string, clientId: string) {
  const row = await db.prepare("SELECT id,user_id FROM oauth_grants WHERE refresh_hash=? AND client_id=? AND refresh_expires>?").bind(digest(token), clientId, new Date().toISOString()).first<{ id: string; user_id: string }>();
  if (!row || !(await accessFor(row.user_id))) throw new GrantError("The refresh token is invalid or has expired.");
  return issue(db, row.user_id, clientId, row.id);
}

/** The person behind a valid, unexpired access token, as they are now. */
export async function accessForToken(db: Database, token: string): Promise<Access | null> {
  if (token.length > 100) return null;
  const now = new Date().toISOString();
  const row = await db.prepare("UPDATE oauth_grants SET last_used=? WHERE access_hash=? AND access_expires>? RETURNING user_id").bind(now, digest(token), now).first<{ user_id: string }>();
  return row ? accessFor(row.user_id) : null;
}

export async function listGrants(db: Database, userId: string) {
  const rows = await db.prepare("SELECT g.id,g.created,g.last_used,c.data FROM oauth_grants g LEFT JOIN oauth_clients c ON c.id=g.client_id WHERE g.user_id=? ORDER BY g.created DESC").bind(userId).all<{ id: string; created: string; last_used: string; data: string | null }>();
  return rows.results.map((r) => ({ id: r.id, name: r.data ? JSON.parse(r.data).name : "Claude", created: r.created, lastUsed: r.last_used }));
}

export async function revokeGrant(db: Database, userId: string, id: string) {
  if (!(await db.prepare("DELETE FROM oauth_grants WHERE id=? AND user_id=? RETURNING id").bind(id, userId).first())) throw new Error("Connection not found.");
}

// Discovery documents: protected resource metadata (RFC 9728) and authorization server metadata (RFC 8414).
// The dashboard is both the MCP server and its own authorization server, so both live on this origin.
export const resourceMetadata = (origin: string) => ({ resource: resourceFor(origin), authorization_servers: [origin], scopes_supported: [SCOPE], bearer_methods_supported: ["header"], resource_name: "BHB Business Centre dashboard" });
export const serverMetadata = (origin: string) => ({
  issuer: origin,
  authorization_endpoint: `${origin}/api/oauth/authorize`,
  token_endpoint: `${origin}/api/oauth/token`,
  registration_endpoint: `${origin}/api/oauth/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: [SCOPE, "offline_access"],
});
