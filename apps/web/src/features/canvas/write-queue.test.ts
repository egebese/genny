import { describe, expect, it } from 'vitest'
import { enqueue, pendingWrites } from './ui/write-queue.ts'

function deferred() {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('the write queue', () => {
  /*
   * The whole point. Board writes are optimistic and unawaited, so a slow first
   * write and a fast second one to the same row used to settle in the wrong
   * order and the database kept the older position. Undo makes that reachable
   * with one keystroke, because undoing a move is the opposite write issued
   * microseconds after the original.
   */
  it('runs one node writes in the order they were made, however slow', async () => {
    const order: string[] = []
    const slow = deferred()

    const first = enqueue('node-1', async () => {
      await slow.promise
      order.push('first')
    })
    const second = enqueue('node-1', async () => {
      order.push('second')
    })

    // The second is ready to go and deliberately does not.
    await Promise.resolve()
    expect(order).toEqual([])

    slow.release()
    await Promise.all([first, second])
    expect(order).toEqual(['first', 'second'])
  })

  it('does not make two different nodes wait for each other', async () => {
    const order: string[] = []
    const blocked = deferred()

    const slow = enqueue('node-1', async () => {
      await blocked.promise
      order.push('slow')
    })
    await enqueue('node-2', async () => {
      order.push('fast')
    })

    expect(order).toEqual(['fast'])
    blocked.release()
    await slow
  })

  it('keeps going after one write fails, rather than wedging the node', async () => {
    const order: string[] = []
    await enqueue('node-3', () => Promise.reject(new Error('offline')))
    await enqueue('node-3', async () => {
      order.push('after')
    })
    expect(order).toEqual(['after'])
  })

  it('forgets a node once its writes are done', async () => {
    await enqueue('node-4', async () => {})
    // One more tick: the cleanup is itself a then on the settled chain.
    await Promise.resolve()
    expect(pendingWrites()).toBe(0)
  })
})
