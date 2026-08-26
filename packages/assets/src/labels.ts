/**
 * The handle a prompt refers to with `@`. Kept short, lowercase and unambiguous:
 * a mention has to be typeable and it has to be unique per owner, or `@hero`
 * silently picks one of two things.
 */
export function toLabelSlug(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,5}$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'asset'
}

/**
 * Resolves a collision by suffixing, so uploading `cat.png` twice gives `cat` and
 * `cat-2` rather than failing. Takes the labels already in use.
 */
export function uniqueLabel(desired: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base = toLabelSlug(desired)
  if (!used.has(base)) return base

  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${base}-${suffix}`
    if (!used.has(candidate)) return candidate
  }
  throw new Error(`cannot find a free label for "${desired}"`)
}
