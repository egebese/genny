import { redact } from './redact.ts'

/**
 * One line of JSON per event, on the console.
 *
 * Here rather than behind a logging library because the only thing a deployment
 * needs is for its host to be able to parse the line, and every host parses
 * JSON on stdout. A library would add a dependency, a transport to configure and
 * a second place for secrets to escape from.
 *
 * Everything goes through `redact` on the way out. The BYOK fal key is someone
 * else's money and a log line is the easiest place to leave it lying around, so
 * the redaction is not optional and not the caller's job to remember.
 */
export type LogFields = Record<string, unknown>

export type Logger = {
  info: (event: string, fields?: LogFields) => void
  warn: (event: string, fields?: LogFields) => void
  error: (event: string, fields?: LogFields) => void
}

/**
 * `scope` names the subsystem, so a line can be found without guessing which
 * package wrote it: `fal`, `jobs`, `billing`, `webhook`.
 */
export function logger(scope: string): Logger {
  return {
    info: (event, fields) => write('info', scope, event, fields),
    warn: (event, fields) => write('warn', scope, event, fields),
    error: (event, fields) => write('error', scope, event, fields),
  }
}

function write(level: 'info' | 'warn' | 'error', scope: string, event: string, fields?: LogFields) {
  const line = JSON.stringify({
    level,
    scope,
    event,
    at: new Date().toISOString(),
    ...(fields ? (redact(fields) as LogFields) : {}),
  })
  // console.error for warn and error so they land on stderr, which is where a
  // host looks first and what most alerting is wired to.
  if (level === 'info') console.warn(line)
  else console.error(line)
}

/**
 * The message of an error, never the stack.
 *
 * A stack in a structured line is a multi-line string that breaks the one line
 * per event promise, and the message is what identifies the failure anyway.
 */
export function reason(error: unknown): string {
  if (error instanceof Error) return error.message.split('\n')[0]?.slice(0, 200) ?? 'unknown error'
  return 'unknown error'
}
