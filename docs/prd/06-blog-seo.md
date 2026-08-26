# PRD: blog and SEO

## Why a blog at all

Two reasons, both concrete: an open-source project is found through search and
through AI answers, and a white-label buyer needs content the product can carry.

## Content lives in the database

Not MDX files. A post is a row: markdown body, rendered on the server, cached.
That means an operator publishes from the admin panel, a white-label deployment
has its own content without forking, and translation is a row rather than a file
tree.

## SEO approach

No `next-seo`. App Router's own Metadata API plus server-rendered JSON-LD does
the same job with no dependency, and correctly: GPTBot, ClaudeBot and
PerplexityBot do not execute JavaScript, so a script injected after hydration is
invisible to exactly the crawlers that matter most now.

| Surface | Implementation |
|---|---|
| Titles, descriptions, canonicals | `generateMetadata` from the row |
| Sitemap | `sitemap.ts` from the database |
| Robots | `robots.ts` |
| Structured data | server component: `Article`, `BreadcrumbList`, `Organization`, `SoftwareApplication` |
| Social images | `opengraph-image.tsx`, generated per post |
| Freshness | ISR, plus `revalidatePath` on publish |

## Requirements

| # | Requirement |
|---|---|
| B1 | A post is server-rendered HTML: readable with JavaScript disabled |
| B2 | JSON-LD comes from a server component, never a client effect |
| B3 | Publishing revalidates the post, the index and the sitemap |
| B4 | Drafts are unreachable and unindexed without a session |
| B5 | Every post has a canonical url and a unique title and description |
| B6 | Core Web Vitals stay green at the 75th percentile, enforced by Lighthouse CI |
| B7 | Markdown is rendered safely: no raw HTML passthrough |

## Out of scope

Comments, newsletter, tags taxonomy, multi-author workflows, i18n.
