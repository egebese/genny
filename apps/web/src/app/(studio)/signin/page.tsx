import type { Metadata } from 'next'
import { signInAction } from '@/features/auth/server/actions.ts'
import { CredentialsForm } from '@/features/auth/ui/credentials-form.tsx'

export const metadata: Metadata = { title: 'Sign in' }

export default function SignInPage() {
  return (
    <main className="flex-1 px-4">
      <CredentialsForm
        action={signInAction}
        mode="signin"
        heading="Sign in"
        blurb="Your generations, assets and credits follow the account, not the browser."
        submitLabel="Sign in"
        alternative={{ href: '/signup', prompt: 'No account yet?', label: 'Create one' }}
      />
    </main>
  )
}
