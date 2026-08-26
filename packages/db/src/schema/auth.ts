import { sql } from 'drizzle-orm'
import {
  boolean,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { currentActor } from '../rls.ts'
import { appRole } from '../roles.ts'

export const actorKind = pgEnum('actor_kind', ['anonymous', 'registered'])
export const userRole = pgEnum('user_role', ['user', 'admin'])

/**
 * One row per actor, anonymous or signed in. BYOK demo visitors get an
 * anonymous row so their assets and jobs still have a real owner and RLS still
 * applies. Promoting an anonymous actor to a registered one is an update, not a
 * migration of every child row.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: actorKind('kind').notNull().default('anonymous'),
    role: userRole('role').notNull().default('user'),
    name: text('name'),
    email: text('email').unique(),
    emailVerified: timestamp('email_verified', { withTimezone: true }),
    image: text('image'),
    /**
     * The plan this actor pays for, or null for anonymous and free actors. Set
     * by the Stripe webhook and cleared when the subscription ends; the only
     * thing that reads it is the rate limiter, which is why a stale value costs
     * a generous limit rather than free credits.
     */
    planId: text('plan_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('users_self_read', {
      as: 'permissive',
      for: 'select',
      to: appRole,
      using: sql`id = ${currentActor}`,
    }),
  ],
).enableRLS()

/**
 * Auth.js adapter tables. RLS is enabled with no policy granted to genny_app,
 * so the application role can read exactly nothing here. The adapter uses its
 * own owner-role connection (see client.ts authDb) because sign-in has to look
 * up an account before any actor context exists.
 */
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
).enableRLS()

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}).enableRLS()

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
    consumed: boolean('consumed').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
).enableRLS()
