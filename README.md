<div align="center">

# genny

**Open source generative media studio built on [fal](https://fal.ai).**

Image, video and audio generation over the whole fal catalog, on one infinite
canvas. Everything you make stays on the board and the next prompt can point at
it. Run it with your own fal key for free, or self-host it as a white-label SaaS
with credits and billing.

[Quick start](#quick-start) · [Architecture](docs/architecture.md) ·
[Contributing](CONTRIBUTING.md) · [Roadmap](docs/phases/)

</div>

---

## Two products, one codebase

`GENNY_MODE` decides which one you are running.

|  | `byok` | `saas` |
|---|---|---|
| fal key | the visitor's own, sealed in a cookie, never stored | yours, server side |
| Credits | none | append-only ledger, holds and refunds |
| Accounts | anonymous, signed cookie | Auth.js, Google sign-in |
| Billing | none | Stripe subscriptions and top-ups |
| Admin | off | model catalog, users, jobs |

The demo you can link from a README is `byok`. The thing you sell is `saas`.
Same routes, same components, one branch in three factory functions.

## Quick start

Requires Node 22+, pnpm 11+ and Docker.

```bash
git clone https://github.com/egebese/genny.git
cd genny
cp .env.example .env          # generate the two secrets it asks for
pnpm install                  # also links .env into apps/web
pnpm up                       # postgres on :55432, minio on :9100
pnpm db:migrate
pnpm db:seed:models
pnpm dev                      # http://localhost:3000
```

Then open `http://localhost:3000/c`, start a canvas and paste a fal key from
[fal.ai/dashboard/keys](https://fal.ai/dashboard/keys).

Generate the two required secrets with:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # GENNY_ENCRYPTION_KEY
```

> Ports are deliberately high. `5432` and `9000` are usually already taken on a
> developer machine, and colliding there fails in the worst way: by silently
> connecting to the wrong server.

Check everything is wired up:

```bash
curl -s localhost:3000/api/health | jq
```

## Stack

| | |
|---|---|
| Next.js 16.3 | App Router, Turbopack, React Compiler |
| Postgres 17 | via Drizzle. Row-level security on every tenant table |
| Supabase | optional: it is just a `DATABASE_URL` |
| Auth.js v5 | anonymous actors in byok, Google in saas |
| S3 API | MinIO locally, S3/R2/Supabase Storage in production |
| shadcn/ui + Tailwind 4 | on a token layer you can rebrand from one file |
| Stripe | subscriptions plus credit top-ups |
| Vitest + Playwright | unit, real-Postgres integration, two-mode e2e |

## Why not just use the fal playground

The playground runs one model at a time. genny is the layer a team actually needs
around it: a curated catalog with prices you control, an asset library you can
`@mention` in a prompt, credits that survive a failed generation, and a database
you own.

## Self-hosting

See [docs/self-hosting.md](docs/self-hosting.md). Short version: it is a Next app
and a Postgres. Nothing here requires Vercel, Supabase or Redis, and every one of
them works if you want it.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). The
second one is the house style, enforced by `pnpm check` rather than by review
comments. Issues labelled `good first issue` are genuinely small.

The repo ships agent instructions rather than assuming you have your own:
`skills/` holds them, and `AGENTS.md`, `CLAUDE.md`, `.claude/skills` and
`.agents/skills` are all symlinks into one source. Clone and your assistant knows
the house rules.

## License

MIT. Including the billing code.
