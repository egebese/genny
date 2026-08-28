/**
 * Who drew each model, and what colour its card is.
 *
 * Split out of model-cards.mjs because it is the part that changes: a new lab on
 * fal is one line here and nothing in the drawing code.
 */
/**
 * Endpoint prefix to lobehub icon id. First match wins, so order longest first.
 *
 * By prefix rather than by an entry in each catalog file: fal names endpoints
 * after the lab that trained the model, so one rule covers every future
 * endpoint from the same lab and a new one only lands here when it is a lab we
 * have never seen.
 */
export const PROVIDERS = [
  ['fal-ai/nano-banana', 'gemini'],
  ['fal-ai/elevenlabs', 'elevenlabs'],
  ['fal-ai/kling-video', 'kling'],
  ['fal-ai/ideogram', 'ideogram'],
  ['fal-ai/stable-audio', 'stability'],
  ['fal-ai/bytedance', 'bytedance'],
  ['fal-ai/pixverse', 'pixverse'],
  ['fal-ai/flux', 'flux'],
  ['fal-ai/gemini', 'gemini'],
  ['fal-ai/veo', 'gemini'],
  ['fal-ai/wan', 'alibaba'],
  ['fal-ai/minimax', 'minimax'],
  ['fal-ai/luma', 'luma'],
  ['fal-ai/recraft', 'recraft'],
  ['fal-ai/topaz', 'topazlabs'],
  ['fal-ai/openai', 'openai'],
  ['fal-ai/gpt-image', 'openai'],
  ['fal-ai/seedvr', 'bytedance'],
  ['fal-ai/clarity', 'clarityai'],
  ['fal-ai/seedream', 'bytedance'],
  ['fal-ai/seedance', 'bytedance'],
  ['fal-ai/krea', 'krea'],
  ['fal-ai/muse', 'meta'],
  ['fal-ai/lyria', 'gemini'],
  ['fal-ai/sonilo', 'sonilo'],
  // Labs that publish under their own namespace rather than fal-ai/.
  ['blackforestlabs/', 'flux'],
  ['bytedance/', 'bytedance'],
  ['clarityai/', 'clarityai'],
  ['ideogram/', 'ideogram'],
  ['minimax/', 'minimax'],
  ['bria/', 'briaai'],
  ['alibaba/', 'alibaba'],
  ['openai/', 'openai'],
  ['google/', 'gemini'],
  ['topaz/', 'topazlabs'],
  ['krea/', 'krea'],
  ['meta/', 'meta'],
  ['sonilo/', 'sonilo'],
]

/** One hue per modality, so a glance at the grid separates stills from clips. */
export const TINTS = {
  image: { from: '#1b1524', to: '#0b0b0f', mark: '#d0b7f9' },
  video: { from: '#101d24', to: '#0b0b0f', mark: '#99edff' },
  audio: { from: '#141f12', to: '#0b0b0f', mark: '#adff00' },
}
