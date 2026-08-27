import { SparkleField } from '@genny/ui/sparkle-field.tsx'
import { ToastProvider } from '@genny/ui/toast.tsx'
import { ToastRegion } from '@genny/ui/toast-region.tsx'
import { Topbar } from '@genny/ui/topbar.tsx'
import { Wordmark } from '@genny/ui/wordmark.tsx'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AccountMenu } from '@/features/auth/ui/account-menu.tsx'
import { CreditMeter } from '@/features/billing/ui/credit-meter.tsx'
import { CanvasNav } from '@/features/canvas/ui/canvas-nav.tsx'

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-dvh flex-col">
        <SparkleField />
        <ToastRegion />
        <Topbar
          brand={
            <Link href="/" aria-label="genny">
              <Wordmark />
            </Link>
          }
          nav={<CanvasNav />}
          actions={
            <>
              <CreditMeter />
              <AccountMenu />
            </>
          }
        />
        {/* The board sizes itself to what is left rather than to the document, so
            the page never scrolls behind an infinite canvas. Routes that do
            scroll get it from this container. */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </ToastProvider>
  )
}
