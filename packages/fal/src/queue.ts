import { createFalClient } from '@fal-ai/client'
import type { FalCredentials } from './credentials.ts'
import { classifyFalError, type FalFailure } from './errors.ts'
import { collectMediaUrls } from './outputs.ts'

export type QueueJobState = 'queued' | 'running' | 'completed' | 'failed'

export type QueueSnapshot = {
  state: QueueJobState
  /** Position in the queue when fal reports one. Null once it starts running. */
  queuePosition: number | null
}

export type QueueOutputs = {
  /** Media urls exactly as fal returned them, before ingestion into our bucket. */
  urls: string[]
  /** The raw payload, kept so a new modality does not need a schema change. */
  raw: unknown
}

function clientFor(credentials: FalCredentials) {
  // A client per call rather than a module-level singleton: in byok mode the key
  // belongs to the visitor, and a shared client would leak one visitor's
  // credentials into another's request.
  return createFalClient({ credentials: credentials.key })
}

export async function submitJob(
  credentials: FalCredentials,
  endpointId: string,
  input: Record<string, unknown>,
): Promise<{ requestId: string }> {
  try {
    const queued = await clientFor(credentials).queue.submit(endpointId, { input })
    return { requestId: queued.request_id }
  } catch (error) {
    throw classifyFalError(error)
  }
}

export async function readJobStatus(
  credentials: FalCredentials,
  endpointId: string,
  requestId: string,
): Promise<QueueSnapshot> {
  try {
    const status = await clientFor(credentials).queue.status(endpointId, { requestId })
    return {
      state: normalizeState(status.status),
      queuePosition: 'queue_position' in status ? (status.queue_position ?? null) : null,
    }
  } catch (error) {
    throw classifyFalError(error)
  }
}

export async function readJobResult(
  credentials: FalCredentials,
  endpointId: string,
  requestId: string,
): Promise<QueueOutputs> {
  try {
    const result = await clientFor(credentials).queue.result(endpointId, { requestId })
    return { urls: collectMediaUrls(result.data), raw: result.data }
  } catch (error) {
    throw classifyFalError(error)
  }
}

export async function cancelJob(
  credentials: FalCredentials,
  endpointId: string,
  requestId: string,
): Promise<void> {
  try {
    await clientFor(credentials).queue.cancel(endpointId, { requestId })
  } catch (error) {
    throw classifyFalError(error)
  }
}

/** fal's vocabulary is IN_QUEUE / IN_PROGRESS / COMPLETED; ours is four states. */
function normalizeState(status: string): QueueJobState {
  switch (status) {
    case 'IN_QUEUE':
      return 'queued'
    case 'IN_PROGRESS':
      return 'running'
    case 'COMPLETED':
      return 'completed'
    default:
      return 'failed'
  }
}

export type { FalFailure }
