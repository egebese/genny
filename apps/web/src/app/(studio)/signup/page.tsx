import type { Metadata } from 'next'
import { signUpAction } from '@/features/auth/server/actions.ts'
import { CredentialsForm } from '@/features/auth/ui/credentials-form.tsx'

export const metadata: Metadata = { title: 'Create an account' }

export default function SignUpPage() {
  return (
    <main className="flex-1 px-4">
      <CredentialsForm
        action={signUpAction}
        mode="signup"
        heading="Create an account"
        blurb="Anything you have already generated in this browser comes with you."
        submitLabel="Create account"
        alternative={{ href: '/signin', prompt: 'Already have one?', label: 'Sign in' }}
      />
    </main>
  )
}
