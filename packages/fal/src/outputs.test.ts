import { describe, expect, it } from 'vitest'
import { collectMediaUrls } from './outputs.ts'

describe('output url collection', () => {
  it('finds urls in an image payload', () => {
    expect(collectMediaUrls({ images: [{ url: 'https://cdn/a.png', width: 1 }] })).toEqual([
      'https://cdn/a.png',
    ])
  })

  it('finds a single video url', () => {
    expect(collectMediaUrls({ video: { url: 'https://cdn/v.mp4' } })).toEqual(['https://cdn/v.mp4'])
  })

  it('finds several urls across a mixed payload', () => {
    const urls = collectMediaUrls({
      images: [{ url: 'https://cdn/a.png' }, { url: 'https://cdn/b.png' }],
      audio: { url: 'https://cdn/c.mp3' },
    })
    expect(urls).toHaveLength(3)
  })

  it('ignores metadata that merely looks like a link', () => {
    expect(
      collectMediaUrls({
        images: [{ url: 'https://cdn/a.png' }],
        seed: 42,
        schema: 'https://x/s.json',
      }),
    ).toEqual(['https://cdn/a.png'])
  })

  it('ignores non-https values', () => {
    expect(collectMediaUrls({ url: 'data:image/png;base64,AAA' })).toEqual([])
  })

  it('returns nothing for an empty or unexpected payload', () => {
    expect(collectMediaUrls({})).toEqual([])
    expect(collectMediaUrls(null)).toEqual([])
    expect(collectMediaUrls('done')).toEqual([])
  })

  it('does not recurse forever on a deeply nested payload', () => {
    let nested: unknown = { url: 'https://cdn/deep.png' }
    for (let i = 0; i < 20; i++) nested = { inner: nested }
    expect(() => collectMediaUrls(nested)).not.toThrow()
  })
})
