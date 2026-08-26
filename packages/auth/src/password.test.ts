import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password.ts'

describe('password hashing', () => {
  it('accepts the password it was given', async () => {
    const stored = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true)
  })

  it('refuses anything else', async () => {
    const stored = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery stapl', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('salts, so the same password twice is not the same hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')])
    expect(a).not.toBe(b)
    expect(await verifyPassword('same', a)).toBe(true)
    expect(await verifyPassword('same', b)).toBe(true)
  })

  it('stores the cost, so an old hash keeps verifying after the cost is raised', async () => {
    const stored = await hashPassword('x')
    expect(stored.split('$')[1]).toBe(String(2 ** 15))
  })

  it('never throws on a hash it cannot read', async () => {
    for (const bad of ['', 'not-a-hash', 'scrypt$$$$', 'bcrypt$1$2$3$4$5', 'scrypt$8$8$1$aa$bb']) {
      expect(await verifyPassword('x', bad)).toBe(false)
    }
    expect(await verifyPassword('x', null)).toBe(false)
  })

  it('treats the same password typed in different unicode forms as the same', async () => {
    // "şifre" with a combining cedilla versus the precomposed character.
    const composed = 'şifre'
    const decomposed = 'şifre'
    const stored = await hashPassword(composed)
    expect(await verifyPassword(decomposed.normalize('NFD'), stored)).toBe(true)
  })
})
