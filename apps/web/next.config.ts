import type { NextConfig } from 'next'

/**
 * Content-Security-Policy is the one header worth reading closely. The studio
 * displays media from fal's CDN and from our own bucket, so those two hosts are
 * allowed and nothing else is. Anything not listed here cannot be fetched,
 * embedded or connected to, which is what keeps an injected script from
 * exfiltrating a prompt or a BYOK key.
 */
const isDev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  // React's development build needs eval(); the production build does not, and
  // shipping 'unsafe-eval' to production would hand an injected script the one
  // primitive the rest of this policy exists to deny.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.fal.media https://v3b.fal.media http://localhost:9100",
  "media-src 'self' blob: https://*.fal.media http://localhost:9100",
  // ws: is the dev server's hot-reload socket, absent from production.
  `connect-src 'self' https://fal.run https://queue.fal.run https://rest.fal.ai http://localhost:9100${isDev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const config: NextConfig = {
  // Internal packages ship TypeScript source rather than a build step, so there
  // is one compile per app and no stale dist to debug.
  transpilePackages: [
    '@genny/ui',
    '@genny/models',
    '@genny/fal',
    '@genny/db',
    '@genny/auth',
    '@genny/env',
    '@genny/ratelimit',
  ],
  poweredByHeader: false,
  // The e2e suite drives the dev server over 127.0.0.1 rather than localhost.
  allowedDevOrigins: ['127.0.0.1'],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default config
