import { z } from 'zod'

/*
 * Deliberately loose. A real fal key turned out to be 134 characters across three
 * colon-separated parts including base64 padding, not the `id:secret` pair the
 * examples suggest, and a shape check rejected valid keys. The only checks here
 * are the ones that cannot be wrong: some length, no whitespace. Whether the key
 * works is decided by asking fal.
 */
export const falKeyInput = z.object({
  key: z
    .string()
    .trim()
    .min(20)
    .max(500)
    .refine((value) => !/\s/.test(value), 'A fal key contains no spaces.'),
})

export type FalKeyInput = z.infer<typeof falKeyInput>
