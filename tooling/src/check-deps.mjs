#!/usr/bin/env node
/**
 * The architecture rules that matter, enforced instead of documented. A rule that
 * only lives in a markdown file is a rule that gets broken in the third month by
 * someone who never read it.
 *
 * Run by `pnpm check` and by CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** Who each package may depend on. Anything else is a layering violation. */
const ALLOWED = {
  '@genny/env': [],
  '@genny/models': [],
  '@genny/ui': [],
  '@genny/canvas': [],
  '@genny/tsconfig': [],
  '@genny/db': ['@genny/env'],
  '@genny/fal': ['@genny/env', '@genny/models'],
  '@genny/auth': ['@genny/db', '@genny/env'],
  '@genny/ratelimit': ['@genny/db', '@genny/env'],
  '@genny/assets': ['@genny/db', '@genny/env'],
  '@genny/billing': ['@genny/db', '@genny/env', '@genny/models'],
  '@genny/jobs': [
    '@genny/db',
    '@genny/env',
    '@genny/fal',
    '@genny/models',
    '@genny/assets',
    '@genny/billing',
  ],
}

const MAX_FILE_LINES = 200

const errors = []

function fail(message) {
  errors.push(message)
}

// ---------------------------------------------------------------------------
// 1. Dependency direction
// ---------------------------------------------------------------------------
for (const dir of listDirs(join(repoRoot, 'packages'))) {
  const manifestPath = join(dir, 'package.json')
  const manifest = readJson(manifestPath)
  if (!manifest) continue
  const allowed = ALLOWED[manifest.name]
  if (!allowed) {
    fail(
      `${manifest.name} is not listed in tooling/src/check-deps.mjs ALLOWED. Add it with its allowed dependencies.`,
    )
    continue
  }
  const deps = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }).filter((d) =>
    d.startsWith('@genny/'),
  )
  for (const dep of deps) {
    if (!allowed.includes(dep)) {
      fail(`${manifest.name} must not depend on ${dep} (allowed: ${allowed.join(', ') || 'none'})`)
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Boundaries that protect the app from reaching past its layer
// ---------------------------------------------------------------------------
const BOUNDARIES = [
  {
    // The app asks a repository function for data; it does not write queries.
    where: (path) => path.startsWith('apps/'),
    forbid: /from ['"]drizzle-orm/,
    message: 'SQL belongs to @genny/db. Add a function there and call it.',
  },
  {
    // One place knows how to talk to fal, so credentials and retries have one home.
    where: (path) =>
      path.startsWith('apps/') ||
      (path.startsWith('packages/') && !path.startsWith('packages/fal/')),
    forbid: /from ['"]@fal-ai\//,
    message: 'fal calls belong to @genny/fal.',
  },
  {
    // The design system takes props. A UI package that imports the domain cannot
    // be reused, previewed or tested on its own.
    where: (path) => path.startsWith('packages/ui/'),
    forbid: /from ['"]@genny\/(db|fal|jobs|billing|assets|auth|env|models)/,
    message: '@genny/ui must not import domain packages. Pass data in as props.',
  },
  {
    // No modals, no drawers. Every surface is a route, a panel or a popover.
    where: (path) => path.startsWith('apps/') || path.startsWith('packages/ui/'),
    forbid: /\b(Dialog|DialogTrigger|Sheet|SheetContent|Drawer|DrawerContent|Modal)\b/,
    message:
      'This product has no modals, dialogs, sheets or drawers. Use a route, an inline panel or a non-modal popover.',
  },
  {
    // Framework config is evaluated before the app exists, so it cannot import a
    // validated env. Everything else in the app reads configuration through
    // @genny/env, which fails loudly at boot instead of quietly at runtime.
    where: (path) =>
      path.startsWith('apps/') && !path.includes('/api/') && !path.endsWith('next.config.ts'),
    forbid: /process\.env\./,
    message: 'Read configuration through @genny/env, which validates it.',
  },
]

for (const file of sourceFiles()) {
  const relPath = relative(repoRoot, file).replaceAll('\\', '/')
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n').length

  if (lines > MAX_FILE_LINES && !isExempt(relPath)) {
    fail(`${relPath} is ${lines} lines (limit ${MAX_FILE_LINES}). Split it.`)
  }

  for (const rule of BOUNDARIES) {
    if (!rule.where(relPath)) continue
    if (rule.forbid.test(content)) fail(`${relPath}: ${rule.message}`)
  }
}

// ---------------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`\n${errors.length} architecture violation(s):\n`)
  for (const error of errors) console.error(`  - ${error}`)
  console.error('')
  process.exit(1)
}
console.warn('architecture rules: ok')

// ---------------------------------------------------------------------------
function isExempt(relPath) {
  return (
    relPath.includes('.test.') ||
    relPath.includes('/migrations/') ||
    relPath.endsWith('.d.ts') ||
    relPath.startsWith('e2e/')
  )
}

function listDirs(root) {
  try {
    return readdirSync(root)
      .map((name) => join(root, name))
      .filter((p) => statSync(p).isDirectory())
  } catch {
    return []
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function* sourceFiles(dir = repoRoot) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '.next', '.turbo', 'dist', 'coverage'].includes(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      yield* sourceFiles(path)
    } else if (/\.(ts|tsx|mjs)$/.test(name)) {
      yield path
    }
  }
}
