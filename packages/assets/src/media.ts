export type MediaKind = 'image' | 'video' | 'audio'

export type MediaType = {
  mime: string
  kind: MediaKind
  extension: string
}

/**
 * What we accept, by what the bytes actually say rather than by what the upload
 * claims. A content-type header is a hint from whoever is uploading; the first
 * bytes are not.
 */
const SIGNATURES: { type: MediaType; matches: (bytes: Uint8Array) => boolean }[] = [
  {
    type: { mime: 'image/png', kind: 'image', extension: 'png' },
    matches: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    type: { mime: 'image/jpeg', kind: 'image', extension: 'jpg' },
    matches: (b) => starts(b, [0xff, 0xd8, 0xff]),
  },
  {
    type: { mime: 'image/webp', kind: 'image', extension: 'webp' },
    matches: (b) => starts(b, [0x52, 0x49, 0x46, 0x46]) && ascii(b, 8, 'WEBP'),
  },
  {
    type: { mime: 'image/gif', kind: 'image', extension: 'gif' },
    matches: (b) => ascii(b, 0, 'GIF8'),
  },
  {
    type: { mime: 'video/mp4', kind: 'video', extension: 'mp4' },
    matches: (b) => ascii(b, 4, 'ftyp'),
  },
  {
    type: { mime: 'video/webm', kind: 'video', extension: 'webm' },
    matches: (b) => starts(b, [0x1a, 0x45, 0xdf, 0xa3]),
  },
  {
    type: { mime: 'audio/mpeg', kind: 'audio', extension: 'mp3' },
    matches: (b) => starts(b, [0xff, 0xfb]) || ascii(b, 0, 'ID3'),
  },
  {
    type: { mime: 'audio/wav', kind: 'audio', extension: 'wav' },
    matches: (b) => starts(b, [0x52, 0x49, 0x46, 0x46]) && ascii(b, 8, 'WAVE'),
  },
]

/** How many bytes the checks above need. Read only this much before deciding. */
export const SNIFF_BYTES = 16

export function sniffMediaType(bytes: Uint8Array): MediaType | null {
  return SIGNATURES.find((entry) => entry.matches(bytes))?.type ?? null
}

/** Size ceilings per kind. Generous enough for real work, small enough to bound cost. */
export const MAX_BYTES: Record<MediaKind, number> = {
  image: 32 * 1024 * 1024,
  video: 512 * 1024 * 1024,
  audio: 64 * 1024 * 1024,
}

export function isWithinSizeLimit(kind: MediaKind, bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_BYTES[kind]
}

function starts(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value)
}

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  return [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0))
}
