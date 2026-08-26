# 0006: App Router metadata, not `next-seo`

**Status:** accepted (2026-08-26)

## Context

The blog and landing have to rank in Google and be citable by AI answer engines.
`next-seo` was the obvious choice for years.

## Decision

Use the App Router's own Metadata API, `sitemap.ts`, `robots.ts`, and JSON-LD
printed by a server component. No `next-seo`.

## Consequences

- No dependency for something the framework does natively.
- JSON-LD is in the server-rendered HTML. GPTBot, ClaudeBot and PerplexityBot do
  not execute JavaScript, so structured data injected after hydration is
  invisible to precisely the crawlers that now matter most.
- Metadata is typed and colocated with the route it describes.

## Rejected

**`next-seo`.** Built for the Pages Router and React Helmet. In App Router it
adds a dependency and a client-side path to do worse.
