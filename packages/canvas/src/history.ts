export type Rect = { x: number; y: number; width: number; height: number }

/** Everything needed to put a node back as itself. */
export type Restorable = Rect & { id: string; assetId: string }

/**
 * One thing the user did to the board, and enough to undo it.
 *
 * Three kinds rather than one per action: a move and a resize are both geometry
 * and invert the same way, and a paste and a delete are each other's inverse, so
 * the whole of undo is one function that swaps the two halves.
 */
export type BoardEdit =
  | { kind: 'geometry'; nodes: { id: string; from: Rect; to: Rect }[] }
  | { kind: 'creation'; nodes: Restorable[] }
  | { kind: 'removal'; nodes: Restorable[] }

export function invert(edit: BoardEdit): BoardEdit {
  if (edit.kind === 'geometry') {
    return {
      kind: 'geometry',
      nodes: edit.nodes.map((node) => ({ id: node.id, from: node.to, to: node.from })),
    }
  }
  return { kind: edit.kind === 'creation' ? 'removal' : 'creation', nodes: edit.nodes }
}

/**
 * Everything moved together, by the same delta as the one under the pointer.
 *
 * The same rule `useBoardNodes` applies while dragging, so history and the board
 * agree about where a multi-node drag ended. A selection is a shape: snapping
 * each member to whatever it happened to pass would pull it apart.
 */
export function translated(
  anchors: ReadonlyMap<string, { x: number; y: number }>,
  id: string,
  to: { x: number; y: number },
): Map<string, { x: number; y: number }> {
  const from = anchors.get(id)
  if (!from || anchors.size < 2) return new Map([[id, to]])

  const delta = { x: to.x - from.x, y: to.y - from.y }
  return new Map(
    [...anchors].map(([nodeId, start]) => [nodeId, { x: start.x + delta.x, y: start.y + delta.y }]),
  )
}

/**
 * The edit with anything it cannot act on taken out, or null if that is all of
 * it.
 *
 * Takes the edit as it is about to be applied, so the rule is uniform: a
 * `creation` puts nodes on the board and needs them absent, while `removal` and
 * `geometry` act on nodes that have to be there.
 *
 * Necessary because an entry outlives the board it described. A generation
 * settles and replaces every row, a second tab deletes something, an earlier
 * undo already put things back. Applying an entry that names a stranger would
 * either do nothing or, for geometry, write coordinates onto a row that has
 * moved on since.
 */
export function resolvable(edit: BoardEdit, live: ReadonlySet<string>): BoardEdit | null {
  const mustBePresent = edit.kind !== 'creation'

  if (edit.kind === 'geometry') {
    const nodes = edit.nodes.filter((node) => live.has(node.id))
    return nodes.length > 0 ? { kind: 'geometry', nodes } : null
  }

  const nodes = edit.nodes.filter((node) => live.has(node.id) === mustBePresent)
  return nodes.length > 0 ? { kind: edit.kind, nodes } : null
}

/**
 * Which nodes an edit can actually carry.
 *
 * Only a node with an asset can be restored: a pending generation's identity is
 * `(job_id, output_index)` on a job belonging to the original board, and the
 * unique on that pair means a restored copy would either collide or quietly
 * claim somebody's result. Reserved rectangles are not rows at all yet.
 */
export function restorableOf(node: {
  id: string
  assetId: string | null
  x: number
  y: number
  width: number
  height: number
}): Restorable | null {
  if (!node.assetId || node.id.startsWith('reserved-')) return null
  const { id, assetId, x, y, width, height } = node
  return { id, assetId, x, y, width, height }
}
