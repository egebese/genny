import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createClient } from './client.ts'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, '..')

/**
 * Migrations run as genny_migrator so the tables end up owned by a role the
 * application never connects as. Grants are re-applied afterwards because a new
 * table is invisible to genny_app until it is granted.
 */
export async function runMigrations(url: string): Promise<void> {
  const { sql, db } = createClient({ url, max: 1 })
  try {
    await migrate(db, { migrationsFolder: join(packageRoot, 'migrations') })
    const grants = await readFile(join(packageRoot, 'sql/grants.sql'), 'utf8')
    // .simple() matters: the default prepared-statement protocol silently runs
    // only the first command of a multi-statement string, which quietly skipped
    // every REVOKE in this file.
    await sql.unsafe(grants).simple()
  } finally {
    await sql.end()
  }
}

const isEntrypoint =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')

if (isEntrypoint) {
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_MIGRATION_URL or DATABASE_URL must be set')
    process.exit(1)
  }
  await runMigrations(url)
  console.warn('migrations applied')
}
