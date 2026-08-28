import { z } from 'zod'

/** How fal bills the endpoint. Drives both the estimate and the final charge. */
export const pricingUnit = z.enum([
  'images',
  'seconds',
  'megapixels',
  'requests',
  'minutes',
  'characters',
])

const rateScale = z.object({
  field: z.string().min(1),
  factors: z.record(z.string(), z.number().positive()),
})

export const modelPricing = z.object({
  unit: pricingUnit,
  unitPriceUsd: z.number().nonnegative(),
  /**
   * Why this number is right when fal's published prose says something else.
   * Printed next to the drift report, so a recurring false alarm is answered
   * in the file rather than rediscovered every week.
   */
  note: z.string().optional(),
  /**
   * Set when this entry disagrees with `genmedia pricing` on purpose.
   *
   * It used to be inferred from the note containing the word "genmedia", which
   * is not a decision anybody made. That silence hid an endpoint resold at a
   * two hundredth of its cost for as long as it shipped, so the waiver is now
   * something a person has to write down and mean.
   */
  waiveDriftCheck: z.boolean().optional(),
  /**
   * Options that bill at a different rate from the rest.
   *
   * Some endpoints have one price and one exception: nano-banana charges per
   * image and then charges double for 4K. Without this the estimate is right
   * for three of four settings and half of what it should be for the fourth,
   * and because `settle` captures held × produced ÷ expected, it never catches
   * up. A permanent discount nobody chose.
   *
   * A list, because more than one option can do it and they multiply: GPT
   * Image 2 charges by quality and by size, PixVerse by resolution and by
   * whether it makes sound.
   */
  scale: z.array(rateScale).optional(),
  /**
   * A flat fee for turning something on, rather than a rate on what comes out.
   * Nano Banana Pro adds $0.015 for a web search whatever it ends up drawing.
   *
   * Converted into units by the estimator rather than added in dollars, so the
   * whole calculation stays one number: what is held, what is captured and what
   * the button says are all units times price times margin, and they cannot
   * drift apart if there is only one of them.
   */
  surcharges: z
    .array(
      z.object({
        field: z.string().min(1),
        /** Values of that field the fee applies to. */
        when: z.array(z.union([z.string(), z.number(), z.boolean()])).nonempty(),
        addUsd: z.number().positive(),
      }),
    )
    .optional(),
  /**
   * Where the length of the output is declared, for a model billed by it.
   *
   * Reading a field called `duration` was enough while every endpoint had one.
   * ElevenLabs Music calls it `music_length_ms`, Seed Audio has no such field
   * at all and bills per minute anyway, and FLUX 3 and Seedance default theirs
   * to "auto", which is not a number: the estimate fell back to five seconds,
   * so a thirty second Seedance clip was held at a sixth of its price and
   * `settle` never captures more than it held.
   */
  duration: z
    .object({
      /** Defaults to `duration` and then `duration_seconds`, as before. */
      field: z.string().min(1).optional(),
      unit: z.enum(['seconds', 'milliseconds', 'minutes']).default('seconds'),
      /**
       * What to hold when the field says "auto", or is absent, or the model
       * decides for itself. The ceiling rather than the typical value: holding
       * under costs us the difference permanently, holding over is refunded.
       */
      assume: z.number().positive(),
    })
    .optional(),
})

export type ModelPricing = z.infer<typeof modelPricing>
