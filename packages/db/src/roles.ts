import { pgRole } from 'drizzle-orm/pg-core'

/**
 * The role the application connects as. It has no BYPASSRLS, so every policy in
 * this package is a real boundary rather than documentation. Created by
 * migrations/0000_roles.sql, marked `.existing()` so drizzle-kit never tries to
 * own it.
 */
export const appRole = pgRole('genny_app').existing()

/** Migration-only role. Owns the tables, therefore bypasses RLS by ownership. */
export const migratorRole = pgRole('genny_migrator').existing()
