import { describe, expect, it } from 'vitest'
import { toLabelSlug, uniqueLabel } from './labels.ts'

describe('toLabelSlug', () => {
  it('makes a typeable handle out of a prompt', () => {
    expect(toLabelSlug('A shiba inu chef, cinematic!')).toBe('a-shiba-inu-chef-cinematic')
  })

  it('drops a file extension', () => {
    expect(toLabelSlug('hero-shot.PNG')).toBe('hero-shot')
  })

  it('folds accents rather than dropping the word', () => {
    expect(toLabelSlug('Ayşe Şahin')).toBe('ayse-sahin')
  })

  it('never produces leading, trailing or repeated separators', () => {
    expect(toLabelSlug('  ...hello   world!!  ')).toBe('hello-world')
  })

  it('caps the length so a mention stays typeable', () => {
    expect(toLabelSlug('x'.repeat(200)).length).toBeLessThanOrEqual(40)
  })

  it('falls back rather than returning an empty handle', () => {
    expect(toLabelSlug('!!!')).toBe('asset')
    expect(toLabelSlug('')).toBe('asset')
  })
})

describe('uniqueLabel', () => {
  it('keeps the desired handle when it is free', () => {
    expect(uniqueLabel('hero', [])).toBe('hero')
  })

  it('suffixes rather than failing on a collision', () => {
    expect(uniqueLabel('hero', ['hero'])).toBe('hero-2')
    expect(uniqueLabel('hero', ['hero', 'hero-2'])).toBe('hero-3')
  })

  it('slugifies before checking, so a collision is not missed on punctuation', () => {
    expect(uniqueLabel('Hero!', ['hero'])).toBe('hero-2')
  })

  it('gives up loudly instead of looping forever', () => {
    const taken = ['hero', ...Array.from({ length: 998 }, (_, i) => `hero-${i + 2}`)]
    expect(() => uniqueLabel('hero', taken)).toThrow(/free label/)
  })
})
