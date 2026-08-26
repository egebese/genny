-- Applied after every migration. Idempotent on purpose: a new table added by a
-- migration is invisible to genny_app until it is granted, and a forgotten grant
-- shows up as a confusing "permission denied" long after the deploy.
--
-- No GRANT here weakens RLS. The app role gets DML on the tables and the
-- policies decide which rows that DML can actually touch.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO genny_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO genny_app;

-- Future tables created by genny_migrator are granted automatically.
ALTER DEFAULT PRIVILEGES FOR ROLE genny_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO genny_app;
ALTER DEFAULT PRIVILEGES FOR ROLE genny_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO genny_app;

-- The ledger is append-only. Taking UPDATE and DELETE away from the app role
-- means a bug cannot quietly rewrite financial history, only add to it.
REVOKE UPDATE, DELETE ON TABLE credit_ledger FROM genny_app;
