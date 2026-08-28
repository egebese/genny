import { STORABLE_MIMES } from '@genny/assets/media.ts'
import { findAssetsByIds } from '@genny/assets/repository.ts'
import {
  isThumbWidth,
  resizeTo,
  type ThumbWidth,
  thumbKeyFor,
  thumbWidth,
} from '@genny/assets/thumbnail.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { readActorId } from '@/features/session/actor.ts'
import { storage } from '@/features/storage.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Media, served from the app's own origin rather than from the bucket's.
 *
 * A url pointing straight at storage only works when the browser can reach that
 * host, which rules out opening the studio over a LAN address or a tunnel, and
 * rules out any bucket that is not world-readable. Chrome refuses it outright:
 * a page on a public address may not fetch subresources from loopback.
 *
 * Going through here also means RLS decides who may read a file, rather than a
 * bucket policy nobody remembers configuring.
 *
 * The filename in the path is what `download` saves as. It is not trusted for
 * anything: the id is the lookup, and the id is scoped by the actor.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; filename: string }> },
): Promise<Response> {
  const { id, filename } = await params
  if (!UUID.test(id)) return new Response('bad id', { status: 400 })

  const actorId = await readActorId()
  if (!actorId) return new Response('not found', { status: 404 })

  const [asset] = await withActor(appDb(env().DATABASE_URL), actorId, (tx) =>
    findAssetsByIds(tx, [id]),
  )
  // RLS already scoped that read, so a miss means "not yours or not real". Both
  // answer 404: telling them apart tells a stranger what exists.
  if (!asset) return new Response('not found', { status: 404 })

  /*
   * A board-sized copy, when the board asks for one.
   *
   * A node is three hundred and sixty pixels across and a generated picture is
   * not: one canvas of thirty-one of them was two hundred and twenty-seven
   * megabytes, each decoded to a full bitmap and re-rastered on every zoom.
   * Made on the first request and stored, so it is paid for once.
   */
  const width = new URL(request.url).searchParams.get('w')
  if (width !== null && isThumbWidth(width) && asset.kind === 'image') {
    const thumb = await servedThumb(asset, thumbWidth(width), filename)
    if (thumb) return thumb
  }

  // Passed through so a video can seek. Without it the browser can only play
  // from the start, which for a ten second clip is merely annoying and for
  // anything longer is unusable.
  const range = request.headers.get('range') ?? undefined
  const object = await storage().getStream(asset.storageKey, range)

  /*
   * Our own record, not the bucket's header, and only a type the sniffer can
   * actually produce. Nothing script-executable reaches storage in the first
   * place, because uploads are typed by their magic bytes and svg and html are
   * not among the signatures; this makes that a property of the response rather
   * than something inferred three files away.
   */
  const mime = STORABLE_MIMES.has(asset.mime) ? asset.mime : 'application/octet-stream'

  const headers = new Headers({
    'content-type': mime,
    // The id is a uuid and the bytes behind it never change, so this is safe to
    // keep forever. Private, because the url is only meaningful to its owner.
    'cache-control': 'private, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
    // Authoritative filename, rather than leaving the browser to guess from the
    // url. Inline: these are pictures and clips, meant to be looked at. The
    // sandbox policy for this path is in next.config.ts, with the other headers.
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
  })
  if (object.contentLength !== undefined) {
    headers.set('content-length', String(object.contentLength))
  }
  if (object.contentRange) headers.set('content-range', object.contentRange)

  return new Response(object.body, { status: object.contentRange ? 206 : 200, headers })
}

/**
 * The resized copy, made if it is not there yet.
 *
 * Asked of storage rather than of a column. A flag saying "this asset has a
 * thumbnail" answers the wrong question, because each width is its own file:
 * with the flag set by the first size, the second was looked up, missed, and
 * silently served the original at eighteen megabytes.
 *
 * Returns null rather than throwing when anything goes wrong, so the caller
 * falls through to the original: a picture that is slow to draw beats a
 * picture that is not there, and a format sharp cannot read is not a 500.
 */
async function servedThumb(
  asset: { storageKey: string },
  width: ThumbWidth,
  filename: string,
): Promise<Response | null> {
  const key = thumbKeyFor(asset.storageKey, width)
  const store = storage()
  try {
    const bytes = await store.get(key).catch(() => make(store, asset.storageKey, key, width))
    return new Response(new Uint8Array(bytes), { headers: thumbHeaders(filename) })
  } catch {
    return null
  }
}

async function make(
  store: ReturnType<typeof storage>,
  storageKey: string,
  key: string,
  width: ThumbWidth,
): Promise<Uint8Array> {
  const bytes = await resizeTo(await store.get(storageKey), width)
  await store.put(key, bytes, 'image/webp')
  return bytes
}

function thumbHeaders(filename: string): Headers {
  return new Headers({
    'content-type': 'image/webp',
    // Derived from bytes that never change, under a url that names the size.
    'cache-control': 'private, max-age=31536000, immutable',
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}.webp`,
  })
}
