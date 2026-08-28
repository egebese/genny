import type { ZodType } from 'zod'

/**
 * A model's answer, turned into the object we asked for.
 *
 * The endpoint has no structured-output mode, so "reply with only JSON" is a
 * request rather than a guarantee. What actually comes back, measured across
 * two models on the same prompt: one obeyed exactly, the other wrapped the same
 * object in a ```json fence. A stricter parser would have worked in testing and
 * failed the first time someone changed the model name.
 *
 * So: strip a fence if there is one, and otherwise take the outermost braces.
 * A sentence of preamble before the object is the other thing models do, and it
 * costs nothing to survive.
 */
export type ParseFailure = { ok: false; reason: string }
export type ParseSuccess<T> = { ok: true; value: T }

export function parseAgentOutput<T>(
  raw: string,
  schema: ZodType<T>,
): ParseSuccess<T> | ParseFailure {
  const json = extractJson(raw)
  if (json === null) return { ok: false, reason: 'the model did not answer with an object' }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'the model answered with something that is not valid JSON' }
  }

  const checked = schema.safeParse(parsed)
  return checked.success
    ? { ok: true, value: checked.data }
    : { ok: false, reason: firstIssue(checked.error) }
}

/** The fenced form, the bare form, and the one with a sentence in front of it. */
function extractJson(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)
  const body = (fenced?.[1] ?? raw).trim()

  const open = body.indexOf('{')
  const close = body.lastIndexOf('}')
  if (open === -1 || close <= open) return null
  return body.slice(open, close + 1)
}

/**
 * One reason, not all of them.
 *
 * This ends up in front of a person who asked for variants and got nothing, and
 * a zod issue list reads like a stack trace to everyone who did not write the
 * schema.
 */
function firstIssue(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0]
  if (!issue) return 'the model answered in the wrong shape'
  const where = issue.path.length > 0 ? issue.path.join('.') : 'the answer'
  return `${where}: ${issue.message}`
}
