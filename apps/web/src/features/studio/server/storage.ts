import { createStorage, type Storage } from '@genny/assets/storage.ts'
import { env } from '@genny/env/env.ts'

/** One place that turns validated configuration into a storage client. */
export function storage(): Storage {
  const config = env()
  return createStorage({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    bucket: config.S3_BUCKET,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
  })
}
