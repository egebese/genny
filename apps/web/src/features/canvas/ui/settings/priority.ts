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

export function isPrimary(input: { name: string; type: string; required: boolean }): boolean {
  /*
   * A control the generation cannot run without is always in front, whatever
   * the list says. H3's LoRA endpoints refuse to run with an empty `loras`, and
   * the dock says so and points at the control; putting that control behind the
   * adjust button makes the instruction a small puzzle.
   *
   * Only lists, because only a list can be required and still absent: every
   * other required control carries a default, which `required-inputs-can-arrive`
   * insists on.
   */
  if (input.type === 'object-array' && input.required) return true
  return PRIMARY.has(input.name)
}
