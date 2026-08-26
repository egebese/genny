# PRD: identity

## Two kinds of actor

**Anonymous.** The BYOK demo has no sign-up, but assets and jobs still need an
owner so RLS has something to isolate on. An anonymous actor is a uuid in a
signed cookie. Signed, not encrypted: the id is not secret, it just must not be
forgeable. Without the signature a visitor could type someone else's uuid and
read their gallery.

**Registered.** Auth.js v5 with the Drizzle adapter. Google first; email link
later. Phase 2.

## A session buys, it does not gate

The plan originally said saas mode requires a session for any generation. It does
not, and the change is deliberate.

An anonymous visitor gets the trial grant and can spend it. When it runs out, or
when they want more, they sign in and buy. Promotion is what makes that safe:
signing in keeps the same `users` row, so nothing they made is lost and there is
no reason to demand an account before they have seen the thing work.

Gating generation behind sign-up would also make the trial grant pointless, since
nobody would ever reach it.

## Promotion, not migration

Signing in promotes the existing anonymous row to `registered` and attaches an
account. It does not create a second user and copy rows across. Someone who
generated ten images before signing up keeps them, which is the difference
between signing up and starting over.

## Why the auth tables have no app access

`accounts`, `sessions` and `verification_tokens` have RLS enabled and no policy
granted to `genny_app`, so the application role can read nothing there. Sign-in
has to look up an account *before* any actor context exists, so the Auth.js
adapter uses its own owner-role connection. The application never queries them.

## Requirements

| # | Requirement |
|---|---|
| I1 | An anonymous actor is issued on first visit and survives a reload |
| I2 | A forged or re-signed actor cookie is rejected |
| I3 | Signing in preserves everything the anonymous actor created |
| I4 | The app role can read nothing from the auth tables |
| I5 | A session is required to *buy*, not to generate |
| I6 | Sign-out clears the session and issues a fresh anonymous actor |
| I7 | Admin role is checked server-side on every admin route |

## Out of scope

Teams, organisations, SSO, 2FA, magic links in phase 2.
