-- Roles exist before any migration runs, because role management is
-- infrastructure, not schema. Testcontainers mounts this same file, so the test
-- database and the dev database have identical privilege shapes.
--
-- genny_migrator owns the tables and therefore bypasses RLS by ownership.
-- genny_app owns nothing and has no BYPASSRLS, so every policy in
-- packages/db/src/schema is a real boundary for the application.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genny_migrator') THEN
    CREATE ROLE genny_migrator LOGIN PASSWORD 'genny';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genny_app') THEN
    CREATE ROLE genny_app LOGIN PASSWORD 'genny';
  END IF;
END
$$;

GRANT ALL ON SCHEMA public TO genny_migrator;
GRANT USAGE ON SCHEMA public TO genny_app;

-- genny_migrator needs CREATE at the database level too: the migration runner
-- creates its own bookkeeping schema before it touches any table.
DO $$
DECLARE db text := current_database();
BEGIN
  EXECUTE format('GRANT CONNECT, CREATE, TEMPORARY ON DATABASE %I TO genny_migrator', db);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO genny_app', db);
END
$$;
