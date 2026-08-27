import { STORABLE_MIMES } from '@genny/assets/media.ts'
import { findAssetsByIds } from '@genny/assets/repository.ts'
import { withActor } from '@genny/db/actor.ts'
import { appDb } from '@genny/db/connection.ts'
import { env } from '@genny/env/env.ts'
import { readActorId } from '@/features/session/actor.ts'
import { storage } from '@/features/studio/server/storage.ts'

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
