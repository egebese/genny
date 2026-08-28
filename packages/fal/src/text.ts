import type { FalCredentials } from './credentials.ts'
import { classifyFalError } from './errors.ts'

/**
 * The one fal endpoint that answers in the same breath.
 *
 * Everything else here goes through the queue, because an image takes seconds
 * and a video takes minutes, and a request that waits that long dies to a proxy
 * timeout. A language model answers in about two, so queueing one would mean a
 * webhook, a settlement claim and a stream for something the caller could have
 * awaited.
 *
 * `openrouter/router` rather than `fal-ai/any-llm`: any-llm keeps a closed enum
 * of model names and does not know the one we want. The router passes the name
 * through, which is the whole reason to use it.
 *
 * Plain `fetch` rather than `@fal-ai/client`, unlike every other call in this
 * package. The client types each endpoint's input from a generated union, and a
 * passthrough endpoint does not fit one; making it fit needs an `as`, which
 * this repo does not allow outside tests. The wire format is four fields.
 */
const TEXT = 'https://fal.run/openrouter/router'
const VISION = 'https://fal.run/openrouter/router/vision'

export type TextRequest = {
  model: string
  systemPrompt: string
  prompt: string
  temperature: number
  maxTokens?: number | undefined
  /** Images the model should look at. Their presence picks the endpoint. */
  imageUrls?: readonly string[] | undefined
}

export type TextResponse = {
  /** What the model said, verbatim. Parsing is the caller's problem. */
  output: string
  /**
   * What it cost, after the fact.
   *
   * Tokens are not knowable before the call, so this is never an estimate and
   * never the number we hold against. It is recorded so the flat price we do
   * charge can be checked against reality later.
   */
  costUsd: number
  tokens: number
}

export async function runText(
  credentials: FalCredentials,
  request: TextRequest,
): Promise<TextResponse> {
  const images = request.imageUrls ?? []
  const response = await fetch(images.length > 0 ? VISION : TEXT, {
    method: 'POST',
    headers: { authorization: `Key ${credentials.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      prompt: request.prompt,
      system_prompt: request.systemPrompt,
      temperature: request.temperature,
      ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
      ...(images.length > 0 ? { image_urls: [...images] } : {}),
    }),
  }).catch((error: unknown) => {
    throw classifyFalError(error)
  })

  const body: unknown = await response.json().catch(() => null)
  // `classifyFalError` reads `status` and `body` off whatever it is handed, so
  // a plain object carries a failed request into the same vocabulary the queue
  // path produces. A caller cannot tell which transport failed, which is right.
  if (!response.ok) throw classifyFalError({ status: response.status, body })

  return read(body)
}

/**
 * An error in the body is still an error.
 *
 * The router answers 200 and puts a refusal in a field, so a caller that only
 * checks the status code reads an empty string and treats it as an answer the
 * model chose to give.
 */
function read(body: unknown): TextResponse {
  const stated = stringAt(body, 'error')
  if (stated !== null && stated.trim() !== '') throw classifyFalError({ body: stated })

  const output = stringAt(body, 'output') ?? ''
  if (output.trim() === '') throw classifyFalError(new Error('the model returned nothing'))

  const usage = fieldAt(body, 'usage')
  return {
    output,
    costUsd: numberAt(usage, 'cost') ?? 0,
    tokens: numberAt(usage, 'total_tokens') ?? 0,
  }
}

function fieldAt(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  return Object.hasOwn(value, key) ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined
}

function stringAt(value: unknown, key: string): string | null {
  const found = fieldAt(value, key)
  return typeof found === 'string' ? found : null
}

function numberAt(value: unknown, key: string): number | null {
  const found = fieldAt(value, key)
  return typeof found === 'number' && Number.isFinite(found) ? found : null
}
