import { Button } from '@genny/ui/button.tsx'
import { auth, signIn, signInAvailable, signOut } from '../config.ts'

/**
 * Sign-in lives in the topbar and nowhere else. A server component, so the
 * session is read once during render rather than fetched by the browser.
 *
 * Renders nothing when the deployment has no OAuth credentials, which is the
 * byok demo's situation: there is nothing to sign into.
 */
export async function AccountMenu() {
  if (!signInAvailable()) return null

  const session = await auth()
  if (!session?.user) {
    return (
      <form
        action={async () => {
          'use server'
          await signIn('google')
        }}
      >
        <Button type="submit" tone="neutral" size="sm">
          Sign in
        </Button>
      </form>
    )
  }

  return (
    <form
      className="flex items-center gap-2"
      action={async () => {
        'use server'
        await signOut()
      }}
    >
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
