/**
 * How long a url on fal's CDN is trusted before the bytes are sent again.
 *
 * fal's guidance is to upload once and reuse the url across as many requests as
 * you need, and it neither states a lifetime nor offers a way to ask. Observed
 * behaviour is about a week, which is why generated media is copied into our
 * own bucket at all.
 *
 * A day is well inside that and still covers any working session, so almost
 * every re-upload disappears and a stale url never reaches a model. The two
 * errors are not equal: too short costs one upload, too long costs a generation
 * that fails inside fal where nobody can see why.
 */
export const TRUSTED_FOR_MS = 24 * 60 * 60 * 1000

/** Whether a cached fal url can still be handed to a model. */
export function stillOnFal(
  cached: { falUrl: string | null; falUrlAt: Date | null },
  now = new Date(),
): cached is { falUrl: string; falUrlAt: Date } {
  if (!cached.falUrl || !cached.falUrlAt) return false
  const age = now.getTime() - cached.falUrlAt.getTime()
  // A date in the future is a clock that moved, not a fresher file.
  return age >= 0 && age < TRUSTED_FOR_MS
}
