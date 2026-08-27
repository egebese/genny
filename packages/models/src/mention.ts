/**
 * Where the caret is, and whether it is inside a mention being typed.
 *
 * Deliberately a pure function over (text, caret): the input component owns a
 * textarea, not a contenteditable, because a contenteditable's behaviour with an
 * IME or a phone keyboard is unpredictable in ways this is not.
 */
export type ActiveMention = {
  /** What has been typed after the `@`, used to filter candidates. */
  query: string
  /** Index of the `@` itself, so a selection can replace from there. */
  start: number
  /** Index just past the caret, the end of what gets replaced. */
  end: number
}

/**
 * A mention starts at the beginning of the text or after whitespace, so an email
 * address or a handle inside a word does not open the list.
 */
const AT_WORD = /(?:^|\s)@([\w-]*)$/

export function findActiveMention(text: string, caret: number): ActiveMention | null {
  const clamped = Math.max(0, Math.min(caret, text.length))
  const match = AT_WORD.exec(text.slice(0, clamped))
  if (!match) return null

  const query = match[1] ?? ''
  return { query, start: clamped - query.length - 1, end: clamped }
}

/**
 * Replaces the mention being typed with the chosen label. The trailing space is
 * what lets someone keep writing without deleting anything, and it also closes
 * the list, since a mention cannot contain whitespace.
 */
export function applyMention(
  text: string,
  mention: ActiveMention,
  label: string,
): { text: string; caret: number } {
  const inserted = `@${label} `
  const next = text.slice(0, mention.start) + inserted + text.slice(mention.end)
  return { text: next, caret: mention.start + inserted.length }
}

/** Labels actually referenced by a prompt, in the order they appear. */
export function mentionedLabels(text: string): string[] {
  const found = text.match(/(?:^|\s)@([\w-]+)/g) ?? []
  return [...new Set(found.map((token) => token.trim().slice(1)))]
}

/**
 * Takes one handle back out of the prompt.
 *
 * Removing a mention is editing the sentence, because that is where it lives:
 * there is no second list to delete it from, which is what keeps the two from
 * disagreeing about what this generation references.
 *
 * The space before the handle goes with it and the one after stays, so a prompt
 * that ended in a mention still ends somewhere you can keep typing.
 */
export function unmention(text: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(^|\\s)@${escaped}(?![\\w-])\\s?`, 'g'), '$1').trimStart()
}

export type PromptSegment = {
  text: string
  /** The handle without its `@`, on the segments that are mentions. */
  label?: string
}

/**
 * The prompt split into plain runs and mention tokens.
 *
 * What the dock draws behind the textarea to mark the mentions. A textarea holds
 * one string and cannot contain elements, so the highlight is a second copy of
 * the same text rendered underneath it; that copy has to agree with this
 * function about exactly which characters are a token, or the marks land beside
 * the words instead of on them.
 *
 * Same rule as `mentionedLabels`, and deliberately the same regex source: a
 * highlight that disagrees with what actually gets sent is worse than none.
 */
export function splitMentions(text: string): PromptSegment[] {
  const segments: PromptSegment[] = []
  let taken = 0

  for (const match of text.matchAll(/(^|\s)@([\w-]+)/g)) {
    const lead = match[1] ?? ''
    const label = match[2] ?? ''
    const start = (match.index ?? 0) + lead.length
    if (start > taken) segments.push({ text: text.slice(taken, start) })
    segments.push({ text: `@${label}`, label })
    taken = start + label.length + 1
  }

  if (taken < text.length) segments.push({ text: text.slice(taken) })
  return segments
}
