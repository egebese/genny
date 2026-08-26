import { createBilling } from '@genny/billing/provider.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { loadCatalog } from '@genny/models/catalog.ts'
import type { ModelDefinition } from '@genny/models/schema.ts'
import { listMentionablesFor } from '@/features/assets/server/list.ts'
import { readActorId } from '@/features/session/actor.ts'
import { hasUsableCredentials } from '@/features/session/fal-key.ts'
import { toPickable } from '@/features/studio/model-list.ts'
import { historyPage } from './history.ts'

type Modality = ModelDefinition['modality']

/**
 * Everything a studio route needs, for whichever modality it serves.
 *
 * The three studios differ by the models they offer and the work they show;
 * nothing else about them is different, which is why there is one loader and
 * three files that call it.
 */
export async function studioProps(modality: Modality) {
  const models = (await loadCatalog())
    .filter((entry) => entry.definition.modality === modality)
    .map((entry) => toPickable(entry.definition))

  const actorId = await readActorId()
  const billing = createBilling(env().GENNY_MODE, appDb(env().DATABASE_URL))

  const [ready, history, mentionables, balance] = await Promise.all([
    hasUsableCredentials(),
    actorId ? historyPage(actorId, { modality }) : Promise.resolve({ items: [], nextCursor: null }),
    actorId ? listMentionablesFor(actorId) : Promise.resolve([]),
    actorId ? billing.balance(actorId) : Promise.resolve(null),
  ])

  return {
    modality,
    models,
    history: history.items,
    historyCursor: history.nextCursor,
    mentionables,
    credits: balance ? { ...balance, perUsd: env().CREDIT_PER_USD } : null,
    hasCredentials: ready,
  }
}
