import { mkdir } from "node:fs/promises";
import pg from "pg";
import { SCHEMA } from "./schema";

type Row = Record<string, unknown>;
type Query = (sql: string, params: unknown[]) => Promise<{ rows: Row[] }>;
type Driver = {
  query: Query;
  exec(sql: string): Promise<void>;
  transaction<T>(run: (query: Query) => Promise<T>): Promise<T>;
};

// Keeps the D1-style statement API (prepare/bind/first/all/run/batch) that the
// route handlers were written against, on top of Postgres.
export class Statement {
  constructor(
    private readonly db: Database,
    readonly sql: string,
    readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new Statement(this.db, this.sql, params);
  }

  async first<T = Row>(): Promise<T | null> {
    return (await this.all<T>()).results[0] ?? null;
  }

  all<T = Row>(): Promise<{ results: T[] }> {
    return this.db.execute<T>(this);
  }

  async run() {
    await this.db.execute(this);
    return { success: true };
  }
}

export class Database {
  constructor(private readonly driver: Driver) {}

  prepare(sql: string) {
    return new Statement(this, toPostgresParams(sql));
  }

  async execute<T = Row>(statement: Statement, query = this.driver.query) {
    const { rows } = await query(statement.sql, statement.params);
    return { results: rows as T[] };
  }

  /** Like D1, a batch runs in one transaction and returns each statement's rows. */
  batch(statements: Statement[]) {
    return this.driver.transaction(async (query) => {
      const results = [];
      for (const statement of statements) {
        results.push(await this.execute(statement, query));
      }
      return results;
    });
  }
}

let ready: Promise<Driver> | undefined;

export async function getDb() {
  ready ??= connect().catch((error) => {
    ready = undefined;
    throw error;
  });
  return new Database(await ready);
}

async function connect() {
  const driver =
    process.env.PGHOST || process.env.DATABASE_URL
      ? postgres()
      : await embeddedPostgres();
  await driver.exec(SCHEMA);
  return driver;
}

/** Neon (or any Postgres), configured through DATABASE_URL or the standard PG* variables. */
function postgres(): Driver {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
  pool.on("error", (error) => console.error("Postgres pool error", error.message));

  return {
    query: (sql, params) => pool.query(sql, params),
    exec: async (sql) => {
      await pool.query(sql);
    },
    async transaction(run) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await run((sql, params) => client.query(sql, params));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/** Local development only: Postgres in-process, stored under .data/. */
async function embeddedPostgres(): Promise<Driver> {
  if (!import.meta.env.DEV) {
    throw new Error("Set PGHOST or DATABASE_URL to connect to Postgres.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  await mkdir(".data", { recursive: true });
  const db = new PGlite(".data/postgres");

  return {
    query: (sql, params) => db.query<Row>(sql, params),
    exec: async (sql) => {
      await db.exec(sql);
    },
    transaction: (run) =>
      db.transaction((tx) => run((sql, params) => tx.query<Row>(sql, params))),
  };
}

/** Rewrites SQLite-style `?` placeholders to Postgres `$1, $2, ...`. */
function toPostgresParams(sql: string) {
  let index = 0;
  let quoted = false;
  let result = "";
  for (const char of sql) {
    if (char === "'") quoted = !quoted;
    result += char === "?" && !quoted ? `$${++index}` : char;
  }
  return result;
}
