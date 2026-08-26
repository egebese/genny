import { createBilling } from '@genny/billing/provider.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import type { Metadata } from 'next'
import { listMentionablesFor } from '@/features/assets/server/list.ts'
import { readActorId } from '@/features/session/actor.ts'
import { hasUsableCredentials } from '@/features/session/fal-key.ts'
import { toPickable } from '@/features/studio/model-list.ts'
import { historyPage } from '@/features/studio/server/history.ts'
import { Studio } from '@/features/studio/ui/studio.tsx'

export const metadata: Metadata = { title: 'Image' }

/**
 * Loads what the studio needs on the server: the catalog, whether a key is
 * usable, the actor's recent jobs and what they can mention. History comes from
 * the job rows, so a refresh mid-generation resumes rather than losing the work.
 */
export default async function ImageStudioPage() {
  const models = (await loadCatalog())
    .filter((entry) => entry.definition.modality === 'image')
    .map((entry) => toPickable(entry.definition))

  const actorId = await readActorId()
  const billing = createBilling(env().GENNY_MODE, appDb(env().DATABASE_URL))

  const [ready, history, mentionables, balance] = await Promise.all([
    hasUsableCredentials(),
    actorId ? historyPage(actorId) : Promise.resolve({ items: [], nextCursor: null }),
    actorId ? listMentionablesFor(actorId) : Promise.resolve([]),
    actorId ? billing.balance(actorId) : Promise.resolve(null),
  ])

  return (
    <Studio
      models={models}
      history={history.items}
      historyCursor={history.nextCursor}
      mentionables={mentionables}
      credits={balance ? { ...balance, perUsd: env().CREDIT_PER_USD } : null}
      hasCredentials={ready}
    />
  )
}
