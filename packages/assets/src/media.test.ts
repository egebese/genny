import { describe, expect, it } from 'vitest'
import { isWithinSizeLimit, MAX_BYTES, sniffMediaType } from './media.ts'

const bytes = (...values: number[]) => new Uint8Array([...values, ...Array(16).fill(0)])
const withAscii = (offset: number, text: string, prefix: number[] = []) => {
  const buffer = new Uint8Array(20)
  prefix.forEach((value, index) => {
    buffer[index] = value
  })
  ;[...text].forEach((char, index) => {
    buffer[offset + index] = char.charCodeAt(0)
  })
  return buffer
}

describe('sniffMediaType', () => {
  it('recognises png, jpeg, gif', () => {
    expect(sniffMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe(
      'image/png',
    )
    expect(sniffMediaType(bytes(0xff, 0xd8, 0xff))?.mime).toBe('image/jpeg')
    expect(sniffMediaType(withAscii(0, 'GIF89a'))?.mime).toBe('image/gif')
  })

  it('distinguishes webp from wav, which share the RIFF header', () => {
    const riff = [0x52, 0x49, 0x46, 0x46]
    expect(sniffMediaType(withAscii(8, 'WEBP', riff))?.mime).toBe('image/webp')
    expect(sniffMediaType(withAscii(8, 'WAVE', riff))?.mime).toBe('audio/wav')
  })

  it('recognises mp4 and webm', () => {
    expect(sniffMediaType(withAscii(4, 'ftyp'))?.mime).toBe('video/mp4')
    expect(sniffMediaType(bytes(0x1a, 0x45, 0xdf, 0xa3))?.mime).toBe('video/webm')
  })

  it('recognises mp3 with and without an id3 tag', () => {
    expect(sniffMediaType(bytes(0xff, 0xfb))?.mime).toBe('audio/mpeg')
    expect(sniffMediaType(withAscii(0, 'ID3'))?.mime).toBe('audio/mpeg')
  })

  it('reports the right kind for each type', () => {
    expect(sniffMediaType(bytes(0xff, 0xd8, 0xff))?.kind).toBe('image')
    expect(sniffMediaType(withAscii(4, 'ftyp'))?.kind).toBe('video')
    expect(sniffMediaType(bytes(0xff, 0xfb))?.kind).toBe('audio')
  })

  it('refuses anything it does not recognise, including things that claim to be media', () => {
    expect(sniffMediaType(withAscii(0, '<?php echo 1;'))).toBeNull()
    expect(sniffMediaType(withAscii(0, '<!DOCTYPE html>'))).toBeNull()
    expect(sniffMediaType(withAscii(0, '#!/bin/sh'))).toBeNull()
    expect(sniffMediaType(new Uint8Array(16))).toBeNull()
  })

  it('does not read past the end of a short buffer', () => {
    expect(() => sniffMediaType(new Uint8Array([0x52, 0x49]))).not.toThrow()
  })
})

describe('isWithinSizeLimit', () => {
  it('accepts a plausible file and refuses an absurd one', () => {
    expect(isWithinSizeLimit('image', 2 * 1024 * 1024)).toBe(true)
    expect(isWithinSizeLimit('image', MAX_BYTES.image + 1)).toBe(false)
  })

  it('refuses an empty file, which is never a real upload', () => {
    expect(isWithinSizeLimit('image', 0)).toBe(false)
    expect(isWithinSizeLimit('video', -1)).toBe(false)
  })

  it('allows video to be far larger than an image', () => {
    expect(MAX_BYTES.video).toBeGreaterThan(MAX_BYTES.image)
  })
})
