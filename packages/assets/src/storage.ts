import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export type StorageConfig = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

export type Storage = {
  /** Uploads bytes we already have and trust, such as an ingested generation. */
  put: (key: string, body: Uint8Array, mime: string) => Promise<void>
  /** Reads an object back, for handing a reference to a model provider. */
  get: (key: string) => Promise<Uint8Array>
  /**
   * Streams an object, optionally a byte range of it. Serving media to a browser
   * goes through here rather than through `get`: a video may be half a gigabyte
   * and buffering that to answer one request is how a self-hosted studio runs out
   * of memory.
   */
  getStream: (
    key: string,
    range?: string | undefined,
  ) => Promise<{
    body: ReadableStream<Uint8Array>
    contentType: string | undefined
    contentLength: number | undefined
    contentRange: string | undefined
  }>
  /** A url the browser can PUT to directly, so large files skip our server. */
  presignUpload: (key: string, mime: string, expiresIn?: number) => Promise<string>
  presignDownload: (key: string, expiresIn?: number) => Promise<string>
  remove: (key: string) => Promise<void>
}

let cached: { config: StorageConfig; client: S3Client } | undefined

/**
 * One client per configuration, reused. Any S3-compatible endpoint works: MinIO
 * locally, S3, R2, or Supabase Storage. Nothing here is provider-specific, which
 * is what keeps self-hosting honest.
 */
export function createStorage(config: StorageConfig): Storage {
  if (
    !cached ||
    cached.config.endpoint !== config.endpoint ||
    cached.config.bucket !== config.bucket
  ) {
    cached = {
      config,
      client: new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        // MinIO and R2 need path-style addressing; S3 does not care.
        forcePathStyle: config.forcePathStyle,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      }),
    }
  }
  const { client } = cached
  const Bucket = config.bucket

  return {
    async put(key, body, mime) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: mime }))
    },
    async get(key) {
      const response = await client.send(new GetObjectCommand({ Bucket, Key: key }))
      const body = await response.Body?.transformToByteArray()
      if (!body) throw new Error(`storage object ${key} had no body`)
      return body
    },
    async getStream(key, range) {
      const response = await client.send(
        new GetObjectCommand({ Bucket, Key: key, ...(range ? { Range: range } : {}) }),
      )
      if (!response.Body) throw new Error(`storage object ${key} had no body`)
      return {
        body: response.Body.transformToWebStream(),
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        contentRange: response.ContentRange,
      }
    },
    presignUpload(key, mime, expiresIn = 600) {
      // ContentType is part of the signature, so the browser cannot upload a
      // different type than the one we verified and allowed.
      return getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: mime }), {
        expiresIn,
      })
    },
    presignDownload(key, expiresIn = 3600) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), { expiresIn })
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }))
    },
  }
}
