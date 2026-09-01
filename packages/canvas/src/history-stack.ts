import type { BoardEdit } from './history.ts'

export type History = { past: BoardEdit[]; future: BoardEdit[] }

/** Long enough that nobody reaches the end of it, short enough to stay small. */
export const HISTORY_LIMIT = 100

export function emptyHistory(): History {
  return { past: [], future: [] }
}

/**
 * Records something the user did.
 *
 * Doing anything new throws the redo away, which is the rule every editor
 * follows: once the board has diverged, the future that was recorded no longer
 * describes it, and offering to redo into it would apply an edit to nodes that
 * have moved on.
 */
export function push(history: History, edit: BoardEdit): History {
  return { past: [...history.past, edit].slice(-HISTORY_LIMIT), future: [] }
}

/**
 * Takes the last thing off, without deciding what to do with it.
 *
 * The caller applies it and may find it no longer resolves against the board,
 * in which case it drops it and asks again, so the stack cannot know whether an
 * entry was really used. Returning the pair keeps that decision outside.
 */
export function undo(history: History): { edit: BoardEdit; history: History } | null {
  const edit = history.past[history.past.length - 1]
  if (!edit) return null
  return {
    edit,
    history: { past: history.past.slice(0, -1), future: [...history.future, edit] },
  }
}

export function redo(history: History): { edit: BoardEdit; history: History } | null {
  const edit = history.future[history.future.length - 1]
  if (!edit) return null
  return {
    edit,
    history: { past: [...history.past, edit], future: history.future.slice(0, -1) },
  }
}
