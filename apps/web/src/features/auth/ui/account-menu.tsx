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

  return (
    <form className="flex items-center gap-2" action={signOutToHome}>
      {session.user.image ? (
        <img src={session.user.image} alt="" className="size-7 rounded-full" />
      ) : null}
      <span className="hidden max-w-32 truncate text-ink-muted text-sm sm:block">
        {session.user.name ?? session.user.email}
      </span>
      <Button type="submit" tone="ghost" size="sm">
        Sign out
      </Button>
    </form>
  )
}
