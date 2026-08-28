import { describe, expect, it } from 'vitest'
import type { PickableFamily } from './family-list.ts'
import { matching } from './model-search.ts'

const family = (name: string, keywords: string[]): PickableFamily =>
  ({ id: name, name, keywords }) as unknown as PickableFamily

const models = [
  family('FLUX.1 [schnell]', ['text to image', 'image', 'fal ai flux schnell']),
  family('Ideogram V4', ['text to image', 'editing', 'image', 'ideogram v4']),
  family('SeedVR Upscale', ['upscale', 'image', 'fal ai seedvr upscale image']),
  family('Recraft Upscale', ['upscale', 'image', 'fal ai recraft upscale crisp']),
  family('Google Veo 3.1', ['text to video', 'video', 'fal ai veo3 1']),
]

const names = (search: string) => matching(models, search).map((model) => model.name)

describe('what a search in the picker shows', () => {
  it('shows everything when nothing is typed', () => {
    expect(names('')).toHaveLength(models.length)
  })

  it('finds a model by what it does, not only by its name', () => {
    // cmdk's own scorer matched a search's letters found scattered in order,
    // so "upscale" put FLUX.1 [schnell] above the two with the word in them.
    expect(names('upscale')).toEqual(['SeedVR Upscale', 'Recraft Upscale'])
  })

  it('finds a model by the lab that made it', () => {
    expect(names('veo')).toEqual(['Google Veo 3.1'])
  })

  it('puts a name that starts with the search above one that merely contains it', () => {
    expect(names('recraft')).toEqual(['Recraft Upscale'])
  })

  it('puts a name match above a keyword match', () => {
    expect(names('ideogram')).toEqual(['Ideogram V4'])
  })

  it('keeps catalog order between equally good matches', () => {
    expect(names('image')).toEqual(models.map((model) => model.name).slice(0, 4))
  })

  it('shows nothing rather than everything when nothing matches', () => {
    expect(names('harpsichord')).toEqual([])
  })
})
