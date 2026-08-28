# genny: product overview

## The problem

fal has over 1300 models. Using them well means writing code: a proxy, a queue
poller, an asset store, prompt plumbing per model. Every team that wants a
studio over fal builds the same layer, badly, twice.

The existing open-source attempts are single-user toys: an API key in
localStorage, a flat list of models, no assets, no accounts, no billing. They
demo well and collapse the moment two people use one.

## What genny is

One studio over the whole fal catalog, in two shapes from one codebase:

- **BYOK demo.** Paste your fal key, generate, leave. No account. This is the
  link in the README, and the reason people trust the project enough to run the
  other shape.
- **White-label SaaS.** Accounts, a credit ledger, Stripe, an admin panel over
  the model catalog. What an agency or a team actually deploys.

## Who it is for

| | Wants | Gets |
|---|---|---|
| A creative using fal daily | Fewer tabs, reusable references | One studio, an asset library, `@mentions` |
| A team lead | Cost control, no per-seat model chaos | A curated catalog with prices they set |
| A developer | To not build the same layer again | MIT, self-hostable, no vendor lock |
| An agency | To sell this to clients | White-label from one token file |

## What makes it better than the alternatives

1. **Assets are first-class.** Every image, video, clip and character has a
   handle you can `@mention` in a prompt. Reference reuse is the difference
   between a demo and a tool.
2. **Money is a ledger, not a counter.** A failed generation refunds. A replayed
   webhook does not double charge.
3. **Tenant isolation is in the database.** Row-level security, proven by tests
   against a real Postgres, not by careful query writing.
4. **The catalog is data.** Adding a model is one JSON file and touches no UI.
5. **Mobile is a target, not a courtesy.** No sidebar, no modals, prompt under
   your thumb.

## What it is not

- Not a node editor. Workflows come after the studio is good (phase 7+).
- Not a model host. fal runs the models.
- Not a general AI chat product.

## Success, phase by phase

| Phase | Done when |
|---|---|
| 0 | A fresh clone reaches a running studio in five commands, with RLS proven |
| 1 | Someone generates an image with their own key, reuses a reference, downloads it |
| 2 | Someone pays, spends credits, and a failed generation refunds correctly |
| 3 | The same flows work for video and audio |
| 4 | An operator changes a price without a deploy |
| 5 | The blog ranks and the landing converts |
| 6 | It passes an accessibility and performance audit |

## Non-goals for v1

Teams and sharing, a node editor, on-prem inference, mobile native apps, i18n.
Each has room in the architecture and none is in the first six phases.

Agents were on this list and are not any more. What moved is not ambition but
cost: a language model that answers in two seconds for a fraction of a cent
makes "what four variants of this would be" and "what is this asset" ordinary
questions rather than a research project. See
[ADR 0012](../adr/0012-agents-on-openrouter.md).
