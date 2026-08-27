import { describe, expect, it } from 'vitest'
import {
  applyMention,
  findActiveMention,
  mentionedLabels,
  splitMentions,
  unmention,
} from './mention.ts'

describe('findActiveMention', () => {
  it('opens on a bare @ at the start', () => {
    expect(findActiveMention('@', 1)).toEqual({ query: '', start: 0, end: 1 })
  })

  it('opens after whitespace and captures what is typed', () => {
    expect(findActiveMention('a cat with @ay', 14)).toEqual({ query: 'ay', start: 11, end: 14 })
  })

  it('does not open inside a word, so an email is not a mention', () => {
    expect(findActiveMention('ege@fal.ai', 10)).toBeNull()
    expect(findActiveMention('a@b', 3)).toBeNull()
  })

  it('closes once there is whitespace after the mention', () => {
    expect(findActiveMention('@ayse ', 6)).toBeNull()
  })

  it('reads the mention at the caret, not the last one in the text', () => {
    const text = '@ayse in @roo'
    expect(findActiveMention(text, text.length)?.query).toBe('roo')
    expect(findActiveMention(text, 5)?.query).toBe('ayse')
  })

  it('handles a caret outside the text without throwing', () => {
    expect(findActiveMention('@a', 99)?.query).toBe('a')
    expect(findActiveMention('@a', -5)).toBeNull()
  })

  it('accepts hyphens, since labels are slugs', () => {
    expect(findActiveMention('use @hero-shot', 14)?.query).toBe('hero-shot')
  })
})

describe('applyMention', () => {
  it('replaces what was typed and leaves the caret ready to keep writing', () => {
    const mention = findActiveMention('a cat with @ay', 14)
    expect(mention).not.toBeNull()
    const result = applyMention('a cat with @ay', mention as never, 'ayse')
    expect(result.text).toBe('a cat with @ayse ')
    expect(result.caret).toBe(result.text.length)
  })

  it('keeps the text that came after the caret', () => {
    const text = 'a @ay in a room'
    const mention = findActiveMention(text, 5)
    const result = applyMention(text, mention as never, 'ayse')
    expect(result.text).toBe('a @ayse  in a room')
  })

  it('works from a bare @', () => {
    const result = applyMention('@', findActiveMention('@', 1) as never, 'room1')
    expect(result.text).toBe('@room1 ')
  })
})

describe('mentionedLabels', () => {
  it('lists the labels a prompt refers to, once each, in order', () => {
    expect(mentionedLabels('@ayse in @room1 with @ayse')).toEqual(['ayse', 'room1'])
  })

  it('ignores an email address', () => {
    expect(mentionedLabels('write to ege@fal.ai about @ayse')).toEqual(['ayse'])
  })

  it('returns nothing for a prompt without mentions', () => {
    expect(mentionedLabels('a quiet street at dawn')).toEqual([])
  })
})

describe('splitMentions', () => {
  const rebuilt = (text: string) =>
    splitMentions(text)
      .map((segment) => segment.text)
      .join('')

  it('marks the token and leaves the rest alone', () => {
    expect(splitMentions('make @ayse cinematic')).toEqual([
      { text: 'make ' },
      { text: '@ayse', label: 'ayse' },
      { text: ' cinematic' },
    ])
  })

  it('handles a mention at either end', () => {
    expect(splitMentions('@ayse')).toEqual([{ text: '@ayse', label: 'ayse' }])
    expect(splitMentions('with @ayse')).toEqual([
      { text: 'with ' },
      { text: '@ayse', label: 'ayse' },
    ])
  })

  it('agrees with mentionedLabels about what is a mention', () => {
    for (const text of ['a@b is an email', 'hey@there', 'plain text', '@a and @b', '@a-b_c']) {
      const marked = splitMentions(text)
        .filter((segment) => segment.label !== undefined)
        .map((segment) => segment.label)
      expect([...new Set(marked)]).toEqual(mentionedLabels(text))
    }
  })

  it('never loses or invents a character', () => {
    for (const text of ['', '@a', ' @a ', 'x @a @b y', '@@a', 'a@b @c']) {
      expect(rebuilt(text)).toBe(text)
    }
  })
})

describe('unmention', () => {
  it('takes the handle and the space it left behind', () => {
    expect(unmention('make @ayse cinematic', 'ayse')).toBe('make cinematic')
    expect(unmention('@ayse', 'ayse')).toBe('')
    // Trailing space kept: the caret lands there and typing continues without
    // first having to press it again.
    expect(unmention('with @ayse', 'ayse')).toBe('with ')
  })

  it('removes every occurrence, since they are all the same reference', () => {
    expect(unmention('@a then @a again', 'a')).toBe('then again')
  })

  it('leaves a longer handle that merely starts the same', () => {
    expect(unmention('@ayse and @ayse-2', 'ayse')).toBe('and @ayse-2')
  })

  it('leaves something that was never a mention', () => {
    expect(unmention('mail me at a@ayse now', 'ayse')).toBe('mail me at a@ayse now')
  })

  it('leaves nothing mentionedLabels would still find', () => {
    const text = 'a @one b @two c'
    expect(mentionedLabels(unmention(text, 'one'))).toEqual(['two'])
  })
})
