# Phase 5: landing, blog, SEO

**Milestone:** M5

The job: people find the project, and a white-label buyer inherits content they
can publish to.

## Scope

- Landing page that explains the two modes and converts to the demo
- Blog from the database: markdown body, server-rendered, cached
- Admin editor with draft and publish
- `generateMetadata`, `sitemap.ts`, `robots.ts` from the database
- JSON-LD from server components: Article, Breadcrumb, Organization, SoftwareApplication
- Generated OG images per post
- Pricing page driven by the plan configuration
- Lighthouse CI with a budget

## Exit criteria

| # | Criterion |
|---|---|
| 5.1 | A post renders fully with JavaScript disabled |
| 5.2 | JSON-LD is present in the initial HTML, validated against Google's tool |
| 5.3 | Publishing revalidates the post, the index and the sitemap |
| 5.4 | Drafts are unreachable and unindexed without a session |
| 5.5 | Core Web Vitals green at p75 for landing, blog and studio, in Lighthouse CI |
| 5.6 | Markdown rendering passes an XSS test suite |

## Out of scope

Comments, newsletter, i18n, tag taxonomy.
