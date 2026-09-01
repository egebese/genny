/**
 * Runs a reconciliation, and runs it again when the network comes back.
 *
 * The job stream reports a generation as failed the moment its connection
 * closes for good. On a phone that changed networks that means the job is
 * perfectly fine and the browser is not, and the server action that would fetch
 * the truth cannot reach the server either. Before this it threw into nothing
 * and the node span forever, because nothing ever asked a second time.
 *
 * Never throws, by design: the caller is an effect reacting to a settled job,
 * and there is no useful thing for it to do with a network error.
 */
export async function reconcile(run: () => Promise<void>): Promise<void> {
  try {
    await run()
  } catch {
    if (typeof window === 'undefined') return
    window.addEventListener('online', () => void reconcile(run), { once: true })
  }
}
