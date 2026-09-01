/**
 * One node's writes, in the order they were made.
 *
 * Every board mutation is optimistic and fires its server action unawaited, so
 * two writes to the same row race and the later one can land first. That is a
 * bug today, reachable by dragging something twice quickly: the board shows one
 * position and a reload shows the other. Undo makes it a single keystroke, since
 * undoing a move issues the opposite write microseconds after the original.
 *
 * Per node rather than one global chain: two different nodes have no ordering to
 * preserve, and serialising them would turn a twelve-node drag into twelve round
 * trips end to end.
 *
 * Every write resolves, never rejects. The callers are optimistic and have
 * already drawn the result; an unhandled rejection here would be noise with
 * nowhere to go.
 */
const chains = new Map<string, Promise<void>>()

export function enqueue(key: string, run: () => Promise<unknown>): Promise<void> {
  const next = (chains.get(key) ?? Promise.resolve()).then(() => run().then(noop, noop))
  chains.set(key, next)

  // Leaving the settled promise behind would grow the map by one entry per node
  // for the life of the tab, and a resolved link adds nothing to the chain.
  void next.then(() => {
    if (chains.get(key) === next) chains.delete(key)
  })
  return next
}

/** How many chains are still in flight. Exists for the test. */
export function pendingWrites(): number {
  return chains.size
}

function noop() {}
