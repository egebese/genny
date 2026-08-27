import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn.ts'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      tone: {
        primary: 'bg-primary text-primary-ink hover:brightness-95',
        // The only fill in the product that carries the gradient: the button
        // that spends money, so it is the thing the eye lands on.
        chrome: 'bg-(image:--gradient-chrome) text-primary-ink hover:brightness-105 font-semibold',
        neutral: 'bg-surface text-ink hover:bg-surface-hover',
        ghost: 'text-ink-muted hover:bg-surface hover:text-ink',
        danger: 'bg-danger text-ink hover:brightness-110',
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
  VariantProps<typeof button> & { children?: ReactNode }

export function Button({ className, tone, size, ...props }: ButtonProps) {
  return <button className={cn(button({ tone, size }), className)} {...props} />
}
