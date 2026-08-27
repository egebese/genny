import type { ModelInput } from './schema.ts'

export type ReadableSetting = { label: string; value: string }

/** Human labels come from the catalog; a field with no entry keeps its own name. */
function labelFor(inputs: readonly ModelInput[], name: string): string {
  return inputs.find((input) => input.name === name)?.label ?? name
}

function display(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

/**
 * The payload as a person would describe it.
 *
 * The panel used to print the payload itself: `num_images 1`, `output_format
 * png`, `enable_safety_checker true`, and the prompt again underneath the
 * prompt. That is what was sent, which is worth being able to copy and is not
 * worth reading. This keeps the fields the model actually offers, under the
 * names the dock calls them, and the copy button still carries the whole thing.
 */
export function readableSettings(
  payload: Record<string, unknown>,
  inputs: readonly ModelInput[],
  promptField: string,
): ReadableSetting[] {
  const offered = new Set(inputs.filter((input) => !input.hidden).map((input) => input.name))

  return Object.entries(payload)
    .filter(([name, value]) => {
      if (name === promptField || !offered.has(name)) return false
      // A reference url is shown as its own chip; an empty control is not news.
      return value !== null && value !== undefined && value !== ''
    })
    .map(([name, value]) => ({ label: labelFor(inputs, name), value: display(value) }))
}
