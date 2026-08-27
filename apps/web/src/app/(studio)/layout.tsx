import { SparkleField } from '@genny/ui/sparkle-field.tsx'
import { Topbar } from '@genny/ui/topbar.tsx'
import { Wordmark } from '@genny/ui/wordmark.tsx'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AccountMenu } from '@/features/auth/ui/account-menu.tsx'
import { CreditMeter } from '@/features/billing/ui/credit-meter.tsx'
import { StudioNav } from '@/features/studio/ui/studio-nav.tsx'

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SparkleField />
      <Topbar
        brand={
          <Link href="/" aria-label="genny">
            <Wordmark />
          </Link>
        }
        nav={<StudioNav />}
        actions={
          <>
            <CreditMeter />
            <AccountMenu />
          </>
        }
      />
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  )
}
