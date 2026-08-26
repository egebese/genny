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
