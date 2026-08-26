import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/*
 * scrypt from the standard library rather than argon2 or bcrypt from npm. It is
 * memory-hard, it is what node ships, and a password hash is not the place to
 * take on a native dependency that has to compile on every deploy target.
 *
 * N=2^15 costs roughly 100ms here. Raise it, never lower it: the cost is baked
 * into each stored hash, so old hashes keep verifying at the cost they were
 * written with and only get upgraded when someone changes their password.
 */
const COST = 2 ** 15
const BLOCK_SIZE = 8
const PARALLELISM = 1
const KEY_BYTES = 32
const SALT_BYTES = 16

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await derive(password, salt, COST)
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$')
}

/**
 * Never throws and never explains. A malformed hash, a missing one and a wrong
 * password are the same answer, because the difference is only ever useful to
 * someone who should not have it.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false

  const [scheme, cost, , , salt, expected] = stored.split('$')
  if (scheme !== 'scrypt' || !cost || !salt || !expected) return false

  const parsedCost = Number(cost)
  if (!Number.isInteger(parsedCost) || parsedCost < 2 ** 12 || parsedCost > 2 ** 20) return false

  try {
    const actual = await derive(password, Buffer.from(salt, 'base64'), parsedCost)
    const target = Buffer.from(expected, 'base64')
    return actual.length === target.length && timingSafeEqual(actual, target)
  } catch {
    return false
  }
}

// promisify loses scrypt's options overload, so this wraps it by hand.
function derive(password: string, salt: Buffer, cost: number): Promise<Buffer> {
  const options = {
    N: cost,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    // node's default limit is below what N=2^15 needs, and the failure is a
    // thrown error rather than a slower hash.
    maxmem: 256 * cost * BLOCK_SIZE,
  }
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_BYTES, options, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}
