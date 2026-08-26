import { describe, expect, it } from 'vitest'
import { issueAnonymousActor, verifyAnonymousActor } from './anonymous.ts'

const SECRET = 'a-test-secret'

describe('anonymous actors', () => {
  it('issues a verifiable actor', () => {
    const { actorId, cookieValue } = issueAnonymousActor(SECRET)
    expect(verifyAnonymousActor(cookieValue, SECRET)).toBe(actorId)
  })

  it('issues a distinct actor every time', () => {
    expect(issueAnonymousActor(SECRET).actorId).not.toBe(issueAnonymousActor(SECRET).actorId)
  })

  it('refuses an unsigned id, which is the whole point of signing it', () => {
    expect(verifyAnonymousActor('11111111-2222-3333-4444-555555555555', SECRET)).toBeNull()
  })

  it('refuses another actor id pasted in with a stolen signature', () => {
    const mine = issueAnonymousActor(SECRET)
    const theirs = issueAnonymousActor(SECRET)
    const signature = mine.cookieValue.split('.').pop()
    expect(verifyAnonymousActor(`${theirs.actorId}.${signature}`, SECRET)).toBeNull()
  })

  it('refuses a cookie signed with a different secret', () => {
    const { cookieValue } = issueAnonymousActor('other-secret')
    expect(verifyAnonymousActor(cookieValue, SECRET)).toBeNull()
  })

  it('refuses a value that is not shaped like a uuid', () => {
    expect(verifyAnonymousActor('not-a-uuid.signature', SECRET)).toBeNull()
  })

  it('treats a missing or empty cookie as no actor', () => {
    expect(verifyAnonymousActor(undefined, SECRET)).toBeNull()
    expect(verifyAnonymousActor('', SECRET)).toBeNull()
    expect(verifyAnonymousActor('.', SECRET)).toBeNull()
  })

  it('refuses to sign without a secret rather than signing with an empty one', () => {
    expect(() => issueAnonymousActor('')).toThrow(/secret/)
  })
})
