import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseAgentOutput } from './parse.ts'
import { variantOutput } from './variants.ts'

const schema = z.object({ name: z.string(), count: z.number() })

describe('parseAgentOutput', () => {
  it('reads a bare object, which is what the model is asked for', () => {
    const parsed = parseAgentOutput('{"name":"a","count":2}', schema)
    expect(parsed).toEqual({ ok: true, value: { name: 'a', count: 2 } })
  })

  it('reads the same object through a code fence', () => {
    /*
     * Not hypothetical. Given one prompt, gemini-3.1-flash-lite answered bare
     * and gemini-2.5-flash-lite fenced it, and the model name is a string in a
     * config file that anyone can change.
     */
    const parsed = parseAgentOutput('```json\n{"name":"a","count":2}\n```', schema)
    expect(parsed).toEqual({ ok: true, value: { name: 'a', count: 2 } })
  })

  it('reads it through a sentence of preamble', () => {
    const parsed = parseAgentOutput('Sure! Here you go:\n{"name":"a","count":2}', schema)
    expect(parsed).toEqual({ ok: true, value: { name: 'a', count: 2 } })
  })

  it('refuses an answer with no object in it at all', () => {
    const parsed = parseAgentOutput('I would rather not.', schema)
    expect(parsed.ok).toBe(false)
  })

  it('refuses broken JSON rather than guessing at it', () => {
    const parsed = parseAgentOutput('{"name":"a","count":}', schema)
    expect(parsed.ok).toBe(false)
  })

  it('names the field that was wrong, since the reason reaches a person', () => {
    const parsed = parseAgentOutput('{"name":"a","count":"two"}', schema)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toContain('count')
  })

  it('refuses a variant list that came back empty', () => {
    // An agent that answers `{"variants":[]}` has failed; spending on zero
    // generations and reporting success is the version nobody notices.
    const parsed = parseAgentOutput('{"variants":[]}', variantOutput)
    expect(parsed.ok).toBe(false)
  })

  it('accepts a real variant answer', () => {
    const answer = `{"variants":[
      {"prompt":"relight it with hard side light","change":"hard side light"},
      {"prompt":"shoot it from directly overhead","change":"overhead"}
    ]}`
    const parsed = parseAgentOutput(answer, variantOutput)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.variants).toHaveLength(2)
  })
})
