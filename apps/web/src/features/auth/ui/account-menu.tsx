import { Button } from '@genny/ui/button.tsx'
import Link from 'next/link'
import { auth, signInAvailable } from '../config.ts'
import { signOutToHome } from '../server/actions.ts'

/**
 * Sign-in lives in the topbar and nowhere else. A server component, so the
 * session is read once during render rather than fetched by the browser.
 */
export async function AccountMenu() {
  if (!signInAvailable()) return null

  const session = await auth()
  if (!session?.user) {
    return (
      <Link
        href="/signin"
        className="rounded-(--radius-control) px-2 py-1 text-ink-muted text-sm hover:bg-surface hover:text-ink"
      >
        Sign in
      </Link>
    )
  }

  const who = session.user.name ?? session.user.email ?? 'your account'

  return (
    <div className="flex items-center gap-2">
      {/* The way into /settings. It is the only account affordance in the app,
          so a settings route with nothing pointing at it would be a page you
          could only reach by typing its address. */}
      <Link
        href="/settings"
        aria-label={`Settings for ${who}`}
        className="flex items-center gap-2 rounded-(--radius-control) px-2 py-1 text-ink-muted text-sm hover:bg-surface hover:text-ink"
      >
        {/*
          The avatar is null for anyone who signed up with a password, and the
          name is hidden below `sm`, so without a fallback this link is an empty
          box on a phone: no accessible name and nothing to aim a thumb at.
        */}
        {session.user.image ? (
          <img src={session.user.image} alt="" className="size-7 rounded-full" />
        ) : (
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface font-medium text-ink-muted text-xs uppercase"
          >
            {who.slice(0, 1)}
          </span>
        )}
        <span className="hidden max-w-32 truncate sm:block">{who}</span>
      </Link>
      <form action={signOutToHome}>
        <Button type="submit" tone="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  )
}
