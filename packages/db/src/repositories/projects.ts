import { desc, eq, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { canvases, projects } from '../schema/canvas.ts'

export type ProjectRecord = {
  id: string
  title: string
  /** What this project is, in the owner's own words. Null until they say. */
  brief: string | null
  /** Brand colours as `['#rrggbb']`. */
  palette: string[]
  createdAt: Date
  updatedAt: Date
}

export type ProjectSummary = ProjectRecord & { canvasCount: number }

const columns = {
  id: projects.id,
  title: projects.title,
  brief: projects.brief,
  palette: projects.palette,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
}

export async function createProject(
  tx: Database,
  input: { ownerId: string; title: string },
): Promise<ProjectRecord> {
  const [row] = await tx
    .insert(projects)
    .values({ ownerId: input.ownerId, title: input.title })
    .returning(columns)
  if (!row) throw new Error('project insert returned no row')
  return row as ProjectRecord
}

export async function findProject(tx: Database, id: string): Promise<ProjectRecord | null> {
  const [row] = await tx.select(columns).from(projects).where(eq(projects.id, id)).limit(1)
  return (row as ProjectRecord | undefined) ?? null
}

export async function listProjects(tx: Database, limit = 60): Promise<ProjectSummary[]> {
  const rows = await tx
    .select({
      ...columns,
      canvasCount: sql<number>`(
        select count(*)::int from ${canvases} where ${canvases.projectId} = ${projects.id}
      )`,
    })
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .limit(Math.min(limit, 100))
  return rows as ProjectSummary[]
}

/**
 * The project a new canvas belongs to when nobody has said which.
 *
 * Most work starts as one board and only later turns out to be a project, so
 * asking which project first would be a question about a structure that does
 * not exist yet. The newest one is almost always the one being worked on.
 */
export async function defaultProject(tx: Database, ownerId: string): Promise<ProjectRecord> {
  const [existing] = await tx
    .select(columns)
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .limit(1)
  return (
    (existing as ProjectRecord | undefined) ??
    (await createProject(tx, { ownerId, title: 'Untitled project' }))
  )
}

export async function updateProject(
  tx: Database,
  id: string,
  fields: { title?: string; brief?: string | null; palette?: string[] },
): Promise<void> {
  await tx
    .update(projects)
    .set({
      ...(fields.title === undefined ? {} : { title: fields.title }),
      ...(fields.brief === undefined ? {} : { brief: fields.brief }),
      ...(fields.palette === undefined ? {} : { palette: fields.palette }),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
}

export async function deleteProject(tx: Database, id: string): Promise<boolean> {
  const rows = await tx.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id })
  return rows.length > 0
}
