/**
 * fal's errors are accurate and unhelpful: a 422 with a validation body, or a
 * content policy code. The studio has to say what went wrong in terms of what
 * the person did, and it has to know whether retrying is worth offering.
 */
export type FalFailureKind =
  | 'invalid-key'
  | 'out-of-credit'
  | 'content-policy'
  | 'invalid-input'
  | 'rate-limited'
  | 'upstream'
  | 'unknown'

export class FalFailure extends Error {
  constructor(
    readonly kind: FalFailureKind,
    /** Shown to the user. No fal jargon, no stack, no request payload. */
    readonly userMessage: string,
    /** Whether offering a retry makes sense. A content refusal never does. */
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(`${kind}: ${userMessage}`)
    this.name = 'FalFailure'
  }
}

export function classifyFalError(error: unknown): FalFailure {
  const status = extractStatus(error)
  const body = extractBody(error).toLowerCase()

  if (status === 401 || status === 403) {
    return new FalFailure(
      'invalid-key',
      'That fal key was rejected. Check it and try again.',
      false,
      status,
    )
  }
  if (body.includes('content_policy') || body.includes('content policy')) {
    return new FalFailure(
      'content-policy',
      'The model refused this prompt on content grounds. Rewording usually helps more than retrying.',
      false,
      status,
    )
  }
  if (body.includes('exhausted balance') || body.includes('insufficient') || status === 402) {
    return new FalFailure(
      'out-of-credit',
      'The fal account behind this key is out of balance. Top it up at fal.ai and try again.',
      false,
      status,
    )
  }
  if (status === 422) {
    return new FalFailure(
      'invalid-input',
      'The model rejected these settings. Adjust them and try again.',
      false,
      status,
    )
  }
  if (status === 429) {
    return new FalFailure(
      'rate-limited',
      'fal is throttling this key. Wait a moment and try again.',
      true,
      status,
    )
  }
  if (status !== undefined && status >= 500) {
    // fal does not charge for 5xx, so a retry costs nothing.
    return new FalFailure(
      'upstream',
      'fal had a problem on its side. This one is free to retry.',
      true,
      status,
    )
  }
  return new FalFailure(
    'unknown',
    'The generation failed. Trying again is usually worth one attempt.',
    true,
    status,
  )
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const candidate = error as { status?: unknown; statusCode?: unknown }
  for (const value of [candidate.status, candidate.statusCode]) {
    if (typeof value === 'number') return value
  }
  return undefined
}

function extractBody(error: unknown): string {
  if (error instanceof Error)
    return `${error.message} ${safeJson((error as { body?: unknown }).body)}`
  return safeJson(error)
}

function safeJson(value: unknown): string {
  if (value === undefined) return ''
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    return ''
  }
}
