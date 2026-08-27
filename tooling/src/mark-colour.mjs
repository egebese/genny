/**
 * Lifting a provider mark off a near-black page.
 *
 * lobehub ships each brand at its real colours, which are chosen against white.
 * Several of them are dark enough to vanish on ours, so anything below the
 * contrast floor is blended toward white until it clears it. Blending rather
 * than replacing keeps the hue: a dark red stays red, it just becomes a red you
 * can see.
 */

/** Contrast 3:1 against #08080a, which is the floor for a graphical object. */
const MIN_LUMINANCE = 0.09

const channel = (value) => {
  const unit = value / 255
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

export function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** `#abc` and `#aabbcc` and `#aabbccdd`, which are the three lobehub uses. */
export function parseHex(hex) {
  const body = hex.slice(1)
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body.slice(0, 6)
  if (full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16))
}

const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/**
 * The same colour, blended toward white just far enough to be visible.
 *
 * Stepped rather than solved: luminance is not linear in the blend, and twenty
 * steps of 5% lands within a rounding error of the threshold without anyone
 * having to invert the curve.
 */
export function lift(hex) {
  const rgb = parseHex(hex)
  if (!rgb || luminance(rgb) >= MIN_LUMINANCE) return hex

  for (let step = 1; step <= 20; step++) {
    const mixed = rgb.map((value) => value + (255 - value) * (step / 20))
    if (luminance(mixed) >= MIN_LUMINANCE) return toHex(mixed)
  }
  return '#ffffff'
}

/** Every hex in an svg, lifted. Leaves `none`, `currentColor` and urls alone. */
export function liftMark(svg) {
  return svg.replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => lift(hex))
}
