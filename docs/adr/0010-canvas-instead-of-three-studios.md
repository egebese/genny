# 0010: one canvas instead of three studios

**Status:** accepted (2026-08-27)

## Context

The product was three routes, `/image`, `/video` and `/audio`, each a prompt dock
over a reverse-chronological feed of its own results, plus `/history` for all of
them. That shape has two problems, and they are the same problem twice.

The first is that the work does not divide by modality. Making a clip means a
still, then the clip animated from that still, then a voiceover over it. In three
studios those three things live on three pages, and the only way to point the
second at the first is to remember a handle and retype it somewhere else.

The second is that a feed forgets. Results are ordered by when they happened,
which is never the order they belong in, and the tenth generation pushes the
reference image you are still working against off the screen.

## Decision

One infinite canvas, one prompt dock over it, no modality routes.

- `/c` lists boards, `/c/[projectId]` is one. A board is a workspace you reopen,
  not a deliverable: swap a prompt, regenerate the two things that changed.
- A generation reserves its rectangle before it is submitted, at the aspect the
  output will have, in the middle of what is on screen. It fills in place.
- The dock offers the whole catalog. The chosen model decides what the box asks
  for and which controls appear.
- Selecting a node opens a panel anchored to it, holding the prompt, the payload
  that was actually sent, the ids, the seed and the cost, all copyable.

## Consequences

- Cross-modality work is one surface. `@mention` already addressed assets by
  handle, so pointing a video prompt at a still needs no new mechanism.
- Position is meaning. The board is the storyboard, and it is the user's to
  arrange; nothing reflows underneath them.
- Coordinates are state, so `projects` and `canvas_nodes` are real tables with
  the same RLS every other tenant table has.
- History as a route is gone. The board is the history, and `/assets` is still
  the flat list. Nothing was lost that had a reader.
- The credit ledger, the fal adapter, the job settlement claim and the model
  catalog were untouched. The pivot is two tables and a front end.

## Not an exception to 0007

The node panel is not a modal. It has no `aria-modal`, it traps no focus, it
makes nothing inert, and the board stays live behind it: you can pan, zoom and
select something else while it is open. Escape closes it because that is what
people press, not because it is a dialog.

It is positioned in screen space rather than on the board on purpose. Hung on the
canvas it would shrink with the zoom, and a payload nobody can read at 30% is not
a detail view.

## Rejected

**A detail route with an intercepting overlay.** The planned answer before the
pivot, and correct for a feed: a shareable url, honest back button. On a board it
is wrong. The thing you are inspecting is the thing you are about to compare
against or reuse, and taking the board away to show its own contents is the worse
trade. A shareable link to one result is a real want; it is not this surface.

**Keeping the three studios and adding a canvas.** Two ways to do the same thing,
one of which would rot.

**A WebGL or konva renderer.** Nodes are DOM because video and audio nodes need
real media elements to play in place. One CSS transform on the wrapper moves the
whole board, so panning costs nothing per node. Revisit at the point a board
holds hundreds.
