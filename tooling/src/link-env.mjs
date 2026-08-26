#!/usr/bin/env node
/**
 * The repo keeps one .env at its root so every package, script and container
 * reads the same file. Next only loads .env from the app directory, and mutating
 * process.env from next.config does not reach the dev server's workers, so the
 * app needs its own entry pointing at the root file.
 *
 * A symlink keeps it a single file. Where symlinks are not permitted (Windows
 * without developer mode) it falls back to a copy and says so, because a silent
 * copy that drifts from the original is worse than a warning.
 */
import { copyFileSync, existsSync, lstatSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const source = join(repoRoot, '.env')
const target = join(repoRoot, 'apps/web/.env')

if (!existsSync(source)) {
  console.warn('[link-env] no .env at the repo root yet. Copy .env.example to .env, then rerun.')
  process.exit(0)
}

const expected = relative(dirname(target), source)

if (existsSync(target) || isBrokenLink(target)) {
  if (isSymlink(target) && readlinkSync(target) === expected) process.exit(0)
  rmSync(target, { force: true })
}

try {
  symlinkSync(expected, target)
  console.warn(`[link-env] linked apps/web/.env -> ${expected}`)
} catch {
  copyFileSync(source, target)
  console.warn('[link-env] symlinks unavailable, copied .env into apps/web instead.')
  console.warn('[link-env] rerun `pnpm env:link` after editing the root .env.')
}

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

function isBrokenLink(path) {
  return isSymlink(path) && !existsSync(path)
}
