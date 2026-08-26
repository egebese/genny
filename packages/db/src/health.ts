import { sql } from 'drizzle-orm'
import { createClient } from './client.ts'

/**
 * Lives here rather than in the health route because SQL belongs to this package
 * and nowhere else. The app asks "is the database reachable", not "run this
 * query for me".
 */
export async function pingDatabase(url: string): Promise<void> {
  const client = createClient({ url, max: 1 })
  try {
    await client.db.execute(sql`select 1`)
  } finally {
    await client.sql.end()
  }
}
