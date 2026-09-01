import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger, reason } from './log.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

function capture(level: 'warn' | 'error') {
  const lines: string[] = []
  vi.spyOn(console, level).mockImplementation((line: unknown) => {
    lines.push(String(line))
  })
  return lines
}

describe('logger', () => {
  it('writes one line of parseable json carrying the scope and event', () => {
    const lines = capture('warn')
    logger('jobs').info('sweep finished', { checked: 3 })

    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0] ?? '') as Record<string, unknown>
    expect(parsed.level).toBe('info')
    expect(parsed.scope).toBe('jobs')
    expect(parsed.event).toBe('sweep finished')
    expect(parsed.checked).toBe(3)
    expect(typeof parsed.at).toBe('string')
  })

  it('sends warnings and errors to stderr, where alerting looks', () => {
    const errors = capture('error')
    logger('fal').warn('slow', {})
    logger('fal').error('broke', {})
    expect(errors).toHaveLength(2)
  })

  /*
   * The reason this file exists. A fal key in a log line is someone else's money
   * sitting in a place nobody audits, and remembering to redact at every call
   * site is the kind of discipline that holds until it does not.
   */
  it('redacts a secret by field name without the caller asking', () => {
    const lines = capture('error')
    logger('fal').error('rejected', { falKey: 'whatever', endpoint: 'fal-ai/flux' })

    const parsed = JSON.parse(lines[0] ?? '') as Record<string, unknown>
    expect(parsed.falKey).toBe('[redacted]')
    expect(parsed.endpoint).toBe('fal-ai/flux')
  })

  it('redacts a key-shaped string even under an innocent field name', () => {
    const lines = capture('error')
    const key = '3f2504e0-4f89-11d3-9a0c-0305e82c3301:0123456789abcdef0123'
    logger('fal').error('rejected', { detail: `bad credentials ${key}` })

    const parsed = JSON.parse(lines[0] ?? '') as Record<string, unknown>
    expect(parsed.detail).not.toContain('0123456789abcdef')
    expect(parsed.detail).toContain('[redacted]')
  })
})

describe('reason', () => {
  it('takes the first line so one event stays one line', () => {
    expect(reason(new Error('broke\n  at somewhere'))).toBe('broke')
  })

  it('has an answer for something that is not an error', () => {
    expect(reason('a string')).toBe('unknown error')
  })
})
