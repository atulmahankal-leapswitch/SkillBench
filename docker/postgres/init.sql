-- Runs once on first database initialization (empty data volume).
-- Schema/tables are owned by Alembic migrations, not this file. Keep this to
-- database-level setup only (extensions, etc.).

-- UUID generation (gen_random_uuid) for primary keys.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Case-insensitive text (useful for emails).
CREATE EXTENSION IF NOT EXISTS "citext";
