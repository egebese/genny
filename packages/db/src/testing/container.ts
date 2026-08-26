import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { createClient, type Database } from '../client.ts'
import { runMigrations } from '../migrate.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

export type TestDatabase = {
  container: StartedPostgreSqlContainer
  /** Connected as genny_app: no BYPASSRLS, policies apply. What the app sees. */
  app: Database
  /** Connected as genny_migrator: owns the tables, so RLS does not apply. */
  owner: Database
  stop: () => Promise<void>
}

/**
 * A real Postgres with the real migrations and the real roles. Mocking this
 * would prove that the mock works, which is not the claim the RLS tests need to
 * make.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('genny')
    .withUsername('postgres')
    .withPassword('postgres')
    .withCopyFilesToContainer([
      {
        source: join(repoRoot, 'docker/init/01-roles.sql'),
        target: '/docker-entrypoint-initdb.d/01-roles.sql',
      },
    ])
    .start()

  const base = `${container.getHost()}:${container.getMappedPort(5432)}/genny`
  await runMigrations(`postgresql://genny_migrator:genny@${base}`)

  const app = createClient({ url: `postgresql://genny_app:genny@${base}`, max: 4 })
  const owner = createClient({ url: `postgresql://genny_migrator:genny@${base}`, max: 2 })

  return {
    container,
    app: app.db,
    owner: owner.db,
    stop: async () => {
      await app.sql.end()
      await owner.sql.end()
      await container.stop()
    },
  }
}
