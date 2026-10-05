// Postgres schema, applied idempotently on first connection. The advisory lock
// stops several Cloud Run instances from racing to create the same tables.
export const SCHEMA = `
BEGIN;
SELECT pg_advisory_xact_lock(72310);
CREATE TABLE IF NOT EXISTS offices (
  id text PRIMARY KEY,
  owner text NOT NULL,
  code text NOT NULL,
  data text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS office_owner_code ON offices (owner, code);
CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  owner text NOT NULL,
  office_id text REFERENCES offices (id),
  data text NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_owner ON payments (owner);
CREATE INDEX IF NOT EXISTS payment_office ON payments (office_id);
CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  owner text NOT NULL,
  office_id text NOT NULL REFERENCES offices (id),
  payment_id text REFERENCES payments (id),
  name text NOT NULL,
  category text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL,
  key text NOT NULL,
  created text NOT NULL
);
CREATE INDEX IF NOT EXISTS document_owner ON documents (owner);
CREATE INDEX IF NOT EXISTS document_office ON documents (office_id);
COMMIT;
`;
