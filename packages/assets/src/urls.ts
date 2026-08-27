/**
 * Where the browser fetches a stored asset from.
 *
 * Our own origin, always. A url pointing at the bucket only works when the
 * browser can reach that host, which excludes opening the studio over a LAN
 * address or a tunnel, and excludes any bucket that is not world-readable.
 * Relative, so it is correct whatever host the page was served from.
 *
 * The label and extension are part of the path, not decoration: `download`
 * takes the filename from the url, and the player decides between an image and
 * a video by looking at it.
 */
export function assetUrl(asset: { id: string; label: string; storageKey: string }): string {
  const extension = asset.storageKey.split('.').pop() ?? 'bin'
  return `/api/assets/${asset.id}/${asset.label}.${extension}`
}
