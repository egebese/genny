/**
 * Which controls earn a place in the dock, and which wait behind the adjust
 * button.
 *
 * Quality, length, shape and how many. Those four are what someone changes
 * between one generation and the next; format and seed and guidance are what
 * they set once, if ever. Eight chips in a row meant the four that matter were
 * as hard to find as the four that do not.
 *
 * By field name rather than by a flag in the catalog: this is a decision about
 * our dock, and a catalog entry should describe the endpoint rather than our
 * layout.
 */
const PRIMARY = new Set([
  'resolution',
  'image_size',
  'aspect_ratio',
  'ratio',
  'duration',
  'seconds_total',
  'num_images',
  'rendering_speed',
  'voice',
])

export function isPrimary(name: string): boolean {
  return PRIMARY.has(name)
}
