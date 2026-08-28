import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { catalogueOutput } from './catalogue.ts'
import { memoryOutput } from './memory.ts'
import { parseAgentOutput } from './parse.ts'
import { shapeOf, systemPromptFor } from './registry.ts'
import { variantAgent, variantOutput } from './variants.ts'

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

describe('catalogueOutput', () => {
  it('adds the hash the model leaves off a colour', () => {
    /*
     * Measured, not imagined: told "six-digit hex", gemini-3.1-flash-lite
     * answered `"3d4348"`. One reading, so the answer is kept rather than
     * refused and charged for twice.
     */
    const answer = `{"shortName":"Red Leaf Rain","kind":"scene",
      "subject":"A red leaf on wet stone.","palette":["3d4348","#e30b15"],
      "tags":["leaf"],"groupKey":"red-leaf-on-stone"}`
    const parsed = parseAgentOutput(answer, catalogueOutput)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.palette).toEqual(['#3d4348', '#e30b15'])
  })

  it('still refuses a missing kind, which is a fact and not a format', () => {
    const answer = `{"shortName":"Red Leaf","subject":"A leaf.","palette":[],
      "tags":[],"groupKey":"red-leaf"}`
    expect(parseAgentOutput(answer, catalogueOutput).ok).toBe(false)
  })

  it('refuses a group key that only this one image could match', () => {
    const answer = `{"shortName":"Red Leaf","kind":"scene","subject":"A leaf.",
      "palette":[],"tags":[],"groupKey":"Red Leaf 2026-08-28"}`
    expect(parseAgentOutput(answer, catalogueOutput).ok).toBe(false)
  })
})

describe('shapeOf', () => {
  it('names every field the schema will accept', () => {
    /*
     * The bug this replaces: told in prose to summarise a board and never told
     * what to call it, gemini-3.1-flash-lite answered `{"theme": ...}`. A
     * correct answer to the question and unusable, and no amount of describing
     * the meaning fixes it. Generated, so a schema change updates the prompt.
     */
    const shape = shapeOf(memoryOutput)
    for (const field of ['summary', 'subjects', 'preferences', 'avoid']) {
      expect(shape).toContain(field)
    }
    expect(shape).not.toContain('$schema')
  })

  it('is appended to what the agent was told, not instead of it', () => {
    const whole = systemPromptFor(variantAgent)
    // The instructions survive...
    expect(whole).toContain('imperative')
    // ...and the shape is there too, naming the fields it will be judged on.
    expect(whole).toContain('"variants"')
    expect(whole).toContain('"change"')
  })
})
