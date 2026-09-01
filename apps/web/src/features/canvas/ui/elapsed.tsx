'use client'

import { useEffect, useState } from 'react'

/**
 * How long this generation has been going, ticking.
 *
 * A spinner answers "is something happening" and nothing else. The question
 * somebody actually has thirty seconds in is whether it is stuck, and the only
 * thing that answers that is a number that keeps moving. Video models routinely
 * take two minutes, which is indistinguishable from broken without this.
 *
 * Client-side arithmetic over a timestamp the node already carries, so it costs
 * no request and no plumbing through the board.
 */
export function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return <span className="tabular-nums">{clock(Math.max(0, now - since))}</span>
}

export function clock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}
