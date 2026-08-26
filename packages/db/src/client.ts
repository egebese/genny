import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export type Database = ReturnType<typeof drizzle>

type ClientOptions = {
  url: string
  /** Keep this small in serverless runtimes; one connection per instance is plenty. */
  max?: number
}

export function createClient({ url, max = 10 }: ClientOptions) {
  const sql = postgres(url, {
    max,
    // A stuck generation must not hold a connection hostage forever.
    idle_timeout: 20,
    connect_timeout: 10,
    // Postgres NOTICEs are noise in application logs.
    onnotice: () => {},
  })
  return { sql, db: drizzle(sql) }
}
