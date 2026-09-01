import { describe, expect, it } from 'vitest'
import type { BoardEdit } from './history.ts'
import { emptyHistory, HISTORY_LIMIT, push, redo, undo } from './history-stack.ts'

const edit = (id: string): BoardEdit => ({
  kind: 'creation',
  nodes: [{ id, assetId: 'x', x: 0, y: 0, width: 1, height: 1 }],
})

describe('the history stack', () => {
  it('has nothing to undo when nothing has happened', () => {
    expect(undo(emptyHistory())).toBeNull()
    expect(redo(emptyHistory())).toBeNull()
  })

  it('hands back the last thing first', () => {
    const history = push(push(emptyHistory(), edit('a')), edit('b'))
    expect(undo(history)?.edit).toEqual(edit('b'))
  })

  it('redoes what was just undone', () => {
    const undone = undo(push(emptyHistory(), edit('a')))
    expect(undone).not.toBeNull()
    expect(redo(undone?.history ?? emptyHistory())?.edit).toEqual(edit('a'))
  })

  /*
   * Once the board has diverged, the recorded future no longer describes it, so
   * offering to redo into it would apply an edit to nodes that have moved on.
   */
  it('throws the redo away as soon as something new happens', () => {
    const undone = undo(push(emptyHistory(), edit('a')))
    const after = push(undone?.history ?? emptyHistory(), edit('b'))
    expect(redo(after)).toBeNull()
  })

  it('forgets the oldest rather than growing without end', () => {
    let history = emptyHistory()
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) history = push(history, edit(`n${i}`))

    expect(history.past).toHaveLength(HISTORY_LIMIT)
    expect(history.past[0]).toEqual(edit('n10'))
  })
})
