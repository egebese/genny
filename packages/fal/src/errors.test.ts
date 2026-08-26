import { describe, expect, it } from 'vitest'
import { classifyFalError, FalFailure } from './errors.ts'

const withStatus = (status: number, body?: unknown) =>
  Object.assign(new Error('request failed'), { status, body })

describe('classifyFalError', () => {
  it('reads a rejected key as something the user can fix, not a retry', () => {
    const failure = classifyFalError(withStatus(401))
    expect(failure.kind).toBe('invalid-key')
    expect(failure.retryable).toBe(false)
    expect(failure.userMessage).toMatch(/fal key/i)
  })

  it('never suggests retrying a content refusal', () => {
    const failure = classifyFalError(withStatus(422, { detail: 'content_policy_violation' }))
    expect(failure.kind).toBe('content-policy')
    expect(failure.retryable).toBe(false)
    expect(failure.userMessage).toMatch(/rewording/i)
  })

  it('recognises an exhausted fal balance', () => {
    const failure = classifyFalError(withStatus(400, { detail: 'Exhausted balance' }))
    expect(failure.kind).toBe('out-of-credit')
    expect(failure.retryable).toBe(false)
  })

  it('treats plain validation errors as settings the user should change', () => {
    const failure = classifyFalError(withStatus(422, { detail: 'num_images too large' }))
    expect(failure.kind).toBe('invalid-input')
    expect(failure.retryable).toBe(false)
  })

  it('offers a retry for throttling and for fal-side failures', () => {
    expect(classifyFalError(withStatus(429)).retryable).toBe(true)
    expect(classifyFalError(withStatus(503)).retryable).toBe(true)
    expect(classifyFalError(withStatus(500)).kind).toBe('upstream')
  })

  it('falls back to retryable rather than declaring a permanent failure it cannot see', () => {
    const failure = classifyFalError(new Error('socket hang up'))
    expect(failure.kind).toBe('unknown')
    expect(failure.retryable).toBe(true)
  })

  it('never leaks the request payload into the user message', () => {
    const failure = classifyFalError(withStatus(422, { input: { prompt: 'a secret prompt' } }))
    expect(failure.userMessage).not.toContain('secret prompt')
  })

  it('survives a non-error being thrown at it', () => {
    for (const value of [undefined, null, 'boom', 42, {}]) {
      expect(classifyFalError(value)).toBeInstanceOf(FalFailure)
    }
  })
})
