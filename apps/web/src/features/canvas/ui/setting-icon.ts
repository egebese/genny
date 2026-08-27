import type { IconName } from '@genny/ui/icon.tsx'

/**
 * Which icon a model control gets, by the field's own name.
 *
 * By name and not by label, because the label is prose the catalog author picks
 * ("Length (seconds)", "Guidance") while the name is the endpoint's own field
 * and is shared between models that mean the same thing. A field nobody has
 * mapped yet gets sliders, which is honest: it is a knob.
 */
const BY_NAME: Record<string, IconName> = {
  seed: 'hash',
  num_images: 'copies',
  aspect_ratio: 'frame',
  image_size: 'frame',
  resolution: 'frame',
  duration: 'clock',
  seconds_total: 'clock',
  output_format: 'file',
  negative_prompt: 'ban',
  num_inference_steps: 'steps',
  cfg_scale: 'sliders',
  guidance_scale: 'sliders',
  stability: 'sliders',
  similarity_boost: 'sliders',
  speed: 'gauge',
  rendering_speed: 'gauge',
  voice: 'waveform',
  audio_setting: 'speaker',
  multi_shots: 'copies',
}

export function settingIcon(name: string): IconName {
  return BY_NAME[name] ?? 'sliders'
}
