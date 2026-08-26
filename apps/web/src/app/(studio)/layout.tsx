import { Topbar } from '@genny/ui/topbar.tsx'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AccountMenu } from '@/features/auth/ui/account-menu.tsx'
import { CreditMeter } from '@/features/billing/ui/credit-meter.tsx'
import { StudioNav } from '@/features/studio/ui/studio-nav.tsx'

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Topbar
        brand={
          <Link href="/" className="hover:text-accent">
            genny
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
      {children}
    </div>
  )
}
