# 0012: agents run on the router, and are not catalog models

**Status:** accepted (2026-08-28)

## Context

The studio makes media well and knows nothing about what it is making. Every
canvas starts from nothing, every asset is named after a file, and the only
record of what a project is about lives in the prompts, unread.

Closing that means asking a language model things: what four variants of this
shot would be, what this asset actually is, what someone's last fifty prompts
say about what they are trying to make. All of it is text in and structured
text out, which is a different animal from everything the product does today.

`docs/prd/00-overview.md` listed agents among the v1 non-goals. That line is
amended by this decision rather than quietly ignored.

## Decision

### `openrouter/router`, not `fal-ai/any-llm`

Both are fal endpoints that run language models. `any-llm` keeps a closed enum
of model names and does not contain the one we want; the router takes the name
as a string and passes it through. There is a `openrouter/router/vision`
sibling taking `image_urls`, which is what asset cataloguing needs.

The model is `google/gemini-3.1-flash-lite`, chosen by measurement rather than
by reputation:

| | latency | cost | notes |
|---|---|---|---|
| text | 1.76 s | $0.000265 | answered with bare JSON |
| vision | 2.87 s | $0.00052 | an image costs about 1100 prompt tokens |

Fast enough to sit in front of somebody waiting, which is the binding
constraint. Cost is not: at these numbers the whole cataloguing of a library is
worth less than one video.

### A flat price, held before and captured after

`usage.cost` comes back **with the answer**, not before it. Tokens cannot be
counted in advance, and in this codebase the estimate *is* the hold: `settle`
captures `held × produced ÷ expected` and never more, so there is no honest
number to meter against up front.

So an agent call costs a flat price, set above the worst measured cost:
$0.001 for text, $0.002 with an image, roughly four times what was observed.
The real cost is recorded on every run in `agent_runs.cost_usd`, which is how
anyone later checks whether the flat number is still right.

A malformed answer is still charged. The tokens were spent, and refunding them
would make a badly written system prompt free for us to keep.

### The first synchronous fal call

Everything else goes through the queue, because an image takes seconds and a
video takes minutes. A language model answers in about two, so queueing one
would mean a webhook, a settlement claim and a stream for something the caller
could have awaited. `packages/fal/src/text.ts` is the only place in the repo
that calls fal and gets an answer back in the same function.

It uses `fetch` rather than `@fal-ai/client`, alone among the calls in that
package. The client types each endpoint's input from a generated union and a
passthrough endpoint does not fit one; making it fit needs an `as`, which this
repo does not allow outside tests. The wire format is four fields.

### Agents are not catalog entries

A catalog entry describes something that makes media: it has a modality, an
aspect ratio, reference slots and a place in the picker. An agent has none of
those. Putting one in the catalog would mean a fourth modality nobody can
generate, a pricing unit measured in tokens, and a row in the model picker
offering to think at you.

`packages/agents` holds them instead, with its own registry. The one thing it
deliberately shares is the money path: an agent definition satisfies
`ChargedModel`, so `creditsFor` prices a call with no changes at all.

### An agent never submits to fal itself

Agents write prompts. The ordinary generation path runs them. Variants go
through `createGeneration` like anything else, so they reserve their rectangles
before submitting, cost what the dock would have said, and appear in the ledger
next to everything a person typed by hand.

The alternative was one agent that could both decide and spend. That is a
second way to spend money, with its own bugs, and it would have been the only
path where a generation appears without a rectangle waiting for it.

## Consequences

**No structured output.** The endpoint has no JSON mode, so "reply with only
JSON" is a request. Measured: gemini-3.1-flash-lite obeyed, gemini-2.5-flash-lite
wrapped the same object in a code fence. `parseAgentOutput` strips a fence,
tolerates a sentence of preamble, then validates with zod. The model name is a
string in a config file that anyone can change, so the parser assumes nothing.

**Prompts are a measurement, not a design.** The variant agent was told in
prose to write edit instructions and answered with rewritten versions of the
whole scene, twice in three runs, varying per run. A worked example and a rule
("every instruction begins with a verb in the imperative") fixed it; the
temperature came down from 0.9 to 0.6 because the spread wanted is in what
changes, not in how the sentence is phrased. None of that was predictable from
reading the endpoint's documentation, and the next agent will need the same
loop.

**A new rate limit.** Agent calls are cheap, but an agent that can ask for
generations plus a loop is a way to spend real money at machine speed. Two
hundred an hour, which is far more thinking than anyone does by hand.

**Every call leaves a row.** A generation leaves a job, an asset and a
rectangle, so it is obvious what happened. An agent leaves a slightly better
sentence somewhere. `agent_runs` records what was asked, what came back, what
it cost and whether it parsed, and shares its id with the ledger entry.
