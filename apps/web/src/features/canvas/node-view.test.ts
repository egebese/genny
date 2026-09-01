import type { NodeRecord } from '@genny/db/repositories/canvas-nodes.ts'
import { describe, expect, it } from 'vitest'
import { toNodeView } from './node-view.ts'

function node(overrides: Partial<NodeRecord> = {}): NodeRecord {
  return {
    id: 'n1',
    x: 0,
    y: 0,
    width: 320,
    height: 320,
    jobId: 'j1',
    outputIndex: 0,
    assetId: null,
    createdAt: new Date('2026-01-01'),
    kind: null,
    label: null,
    storageKey: null,
    durationMs: null,
    status: 'queued',
    error: null,
    endpointId: 'fal-ai/flux/schnell',
    ...overrides,
  }
}

/** A node with its asset joined on, which is the only shape that is `ready`. */
function withMedia(overrides: Partial<NodeRecord> = {}): NodeRecord {
  return node({
    assetId: 'a1',
    kind: 'image',
    label: 'a-cat',
    storageKey: 'u/o/a1.png',
    status: 'completed',
    ...overrides,
  })
}

describe('toNodeView', () => {
  it('is ready once the media is joined on', () => {
    expect(toNodeView(withMedia()).status).toBe('ready')
    expect(toNodeView(withMedia()).url).toContain('a1')
  })

  it('is pending only while the job could still produce something', () => {
    expect(toNodeView(node({ status: 'queued' })).status).toBe('pending')
    expect(toNodeView(node({ status: 'running' })).status).toBe('pending')
  })

  it('carries a failure and its reason', () => {
    const view = toNodeView(node({ status: 'failed', error: 'content policy' }))
    expect(view.status).toBe('failed')
    expect(view.error).toBe('content policy')
  })

  /*
   * The three shapes that used to be an unstoppable spinner. Each one is a node
   * that will never get media, reported as one that was about to.
   */
  it('is missing when the job finished and the media did not arrive', () => {
    expect(toNodeView(node({ status: 'completed' })).status).toBe('missing')
  })

  it('is missing when the asset it names has been deleted', () => {
    // assetId survives on the node; the join finds no label or storage key.
    expect(toNodeView(node({ assetId: 'a1', status: null })).status).toBe('missing')
  })

  it('is missing when there is no job to wait for at all', () => {
    expect(toNodeView(node({ jobId: null, status: null })).status).toBe('missing')
  })
})
