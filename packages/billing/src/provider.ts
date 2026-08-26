import { withActor } from '@genny/db/actor.ts'
import type { Database } from '@genny/db/client.ts'
import { captureHold, holdCredits, readBalance, releaseHold } from './ledger.ts'

export type HoldOutcome =
  | { ok: true; held: string }
  | { ok: false; reason: string; shortfall: string }

/**
 * What the generation pipeline needs from billing, and the only place the two
 * modes differ.
 *
 * byok gets a no-op: the visitor is spending their own fal balance, so there is
 * nothing of ours to reserve and nothing to charge. Every caller works through
 * this interface, which is why no route or component has to know which mode it
 * is serving.
 */
export type Billing = {
  hold: (actorId: string, credits: string) => Promise<HoldOutcome>
  capture: (input: {
    actorId: string
    held: string
    actual: string
    jobId: string
  }) => Promise<void>
  release: (actorId: string, held: string) => Promise<void>
  balance: (actorId: string) => Promise<{ balance: string; holdBalance: string } | null>
  /** True when credits are real, so the studio can show them instead of dollars. */
  readonly tracksCredits: boolean
}

export function createBilling(mode: 'byok' | 'saas', db: Database): Billing {
  return mode === 'saas' ? creditBilling(db) : noopBilling()
}

function noopBilling(): Billing {
  return {
    tracksCredits: false,
    async hold() {
      return { ok: true, held: '0' }
    },
    async capture() {},
    async release() {},
    async balance() {
      return null
    },
  }
}

function creditBilling(db: Database): Billing {
  return {
    tracksCredits: true,

    async hold(actorId, credits) {
      const result = await withActor(db, actorId, (tx) => holdCredits(tx, actorId, credits))
      if (result.ok) return { ok: true, held: credits }
      return {
        ok: false,
        reason: `Not enough credits. You need ${result.shortfall} more.`,
        shortfall: result.shortfall,
      }
    },

    async capture({ actorId, held, actual, jobId }) {
      await withActor(db, actorId, (tx) =>
        captureHold(tx, {
          ownerId: actorId,
          held,
          actual,
          jobId,
          // Derived from the job, so a replayed completion settles once.
          idempotencyKey: `capture:${jobId}`,
        }),
      )
    },

    async release(actorId, held) {
      await withActor(db, actorId, (tx) => releaseHold(tx, actorId, held))
    },

    async balance(actorId) {
      return withActor(db, actorId, (tx) => readBalance(tx, actorId))
    },
  }
}
