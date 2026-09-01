import { describe, expect, it } from 'vitest'
import { type BoardEdit, invert, resolvable, restorableOf, translated } from './history.ts'

const rect = (x: number, y: number) => ({ x, y, width: 100, height: 100 })

describe('invert', () => {
  it('swaps the two halves of a move', () => {
    const edit: BoardEdit = {
      kind: 'geometry',
      nodes: [{ id: 'a', from: rect(0, 0), to: rect(50, 50) }],
    }
    expect(invert(edit)).toEqual({
      kind: 'geometry',
      nodes: [{ id: 'a', from: rect(50, 50), to: rect(0, 0) }],
    })
  })

  it('makes a paste a delete, and back again', () => {
    const nodes = [{ ...rect(0, 0), id: 'a', assetId: 'x' }]
    const created: BoardEdit = { kind: 'creation', nodes }
    expect(invert(created).kind).toBe('removal')
    expect(invert(invert(created))).toEqual(created)
  })
})

describe('translated', () => {
  it('moves a lone node to exactly where it was put', () => {
    const anchors = new Map([['a', { x: 0, y: 0 }]])
    expect(translated(anchors, 'a', { x: 40, y: 10 })).toEqual(new Map([['a', { x: 40, y: 10 }]]))
  })

  /*
   * A selection is a shape. Everything follows the same delta as the node under
   * the pointer rather than being placed independently, or a multi-node drag
   * would pull the arrangement apart on the way.
   */
  it('carries the rest of the selection by the same delta', () => {
    const anchors = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 200, y: 100 }],
    ])
    expect(translated(anchors, 'a', { x: 10, y: -5 })).toEqual(
      new Map([
        ['a', { x: 10, y: -5 }],
        ['b', { x: 210, y: 95 }],
      ]),
    )
  })

  it('ignores anchors it was never given, rather than guessing', () => {
    expect(translated(new Map(), 'a', { x: 3, y: 4 })).toEqual(new Map([['a', { x: 3, y: 4 }]]))
  })
})

describe('resolvable', () => {
  const nodes = [
    { ...rect(0, 0), id: 'a', assetId: 'x' },
    { ...rect(0, 0), id: 'b', assetId: 'y' },
  ]

  it('drops the half of a move whose node is gone', () => {
    const edit: BoardEdit = {
      kind: 'geometry',
      nodes: [
        { id: 'a', from: rect(0, 0), to: rect(1, 1) },
        { id: 'gone', from: rect(0, 0), to: rect(1, 1) },
      ],
    }
    const kept = resolvable(edit, new Set(['a']))
    expect(kept?.kind === 'geometry' && kept.nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('gives up on an edit with nothing left to act on', () => {
    const edit: BoardEdit = {
      kind: 'geometry',
      nodes: [{ id: 'x', from: rect(0, 0), to: rect(1, 1) }],
    }
    expect(resolvable(edit, new Set())).toBeNull()
  })

  /* A creation puts nodes on the board, so the ones already there are the ones
   * it must not touch; a removal is the exact opposite. */
  it('only creates what is absent, and only removes what is present', () => {
    const creation = resolvable({ kind: 'creation', nodes }, new Set(['a']))
    expect(creation?.nodes.map((n) => n.id)).toEqual(['b'])

    const removal = resolvable({ kind: 'removal', nodes }, new Set(['a']))
    expect(removal?.nodes.map((n) => n.id)).toEqual(['a'])
  })
})

describe('restorableOf', () => {
  it('carries a finished node', () => {
    expect(restorableOf({ ...rect(4, 5), id: 'a', assetId: 'x' })).toEqual({
      ...rect(4, 5),
      id: 'a',
      assetId: 'x',
    })
  })

  /*
   * A pending node's identity is (job_id, output_index) on a job belonging to
   * this board, and that pair is unique, so a restored copy would either
   * collide or quietly claim the original generation's result.
   */
  it('refuses a node still waiting on its generation', () => {
    expect(restorableOf({ ...rect(0, 0), id: 'a', assetId: null })).toBeNull()
  })

  it('refuses a rectangle that is not a row yet', () => {
    expect(restorableOf({ ...rect(0, 0), id: 'reserved-3', assetId: 'x' })).toBeNull()
  })
})
