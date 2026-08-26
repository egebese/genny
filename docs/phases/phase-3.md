# Phase 3: video and audio

**Milestone:** M3

The job: the same skeleton carries two harder modalities. If phase 1 was designed
right, this is mostly catalog entries.

## Scope

- `/video` and `/audio` routes on the phase 1 shell
- Duration-based cost estimation, and settlement when real duration differs
- Long jobs: progress, cancellation, resumption after a refresh
- First-frame and last-frame reference mapping
- Video and audio references in mentions
- Video thumbnails and audio waveforms during ingestion
- Player controls that work on a phone

## Exit criteria

| # | Criterion |
|---|---|
| 3.1 | A video generation runs to completion and settles its cost exactly |
| 3.2 | Cancelling mid-flight refunds the unspent hold |
| 3.3 | A first-frame reference reaches the correct field for each model that takes one |
| 3.4 | Ingestion produces a usable poster frame and waveform |
| 3.5 | A ten-minute job survives a refresh, a tab close and a reconnect |
| 3.6 | Audio playback works on iOS Safari, where autoplay rules are strictest |

## Out of scope

Timeline editing, multi-shot stitching, lip sync as a distinct surface.
