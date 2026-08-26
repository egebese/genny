import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/*.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? '',
  },
  // RLS policies live in the schema files, so let drizzle-kit manage them.
  entities: { roles: { provider: '', exclude: ['genny_app', 'genny_migrator'] } },
  strict: true,
  verbose: true,
})
