import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn.ts'
import { Spinner } from './spinner.tsx'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      tone: {
        // White, and the only white fill on the page, so the eye lands on it
        // without the furniture having to be colourful.
        primary: 'bg-primary text-primary-ink shadow-xs hover:bg-primary/90',
        neutral: 'bg-control text-ink shadow-xs hover:bg-surface-hover',
        outline: 'border border-line bg-transparent text-ink hover:bg-control',
        ghost: 'text-ink-muted hover:bg-control hover:text-ink',
        danger: 'bg-danger text-ink shadow-xs hover:bg-danger/90',
      },
      size: {
        // Never below --size-touch: this is the primary action on a phone.
        md: 'h-(--size-touch) px-4 text-sm',
        sm: 'h-9 px-3 text-sm',
        icon: 'h-(--size-touch) w-(--size-touch)',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    children?: ReactNode
    /**
     * An async action in flight. Disables and announces itself, so no caller has
     * to remember both halves. Six forms were doing this by hand.
     */
    pending?: boolean
  }

export function Button({
  className,
  tone,
  size,
  pending,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(button({ tone, size }), className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  )
}
