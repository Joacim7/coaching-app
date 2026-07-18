'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { forwardRef, useState, type ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2d8653] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'text-white',
        secondary:   'bg-gray-100 text-gray-900 hover:bg-gray-200',
        outline:     'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
        ghost:       'text-gray-700 hover:bg-gray-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        success:     'text-white',
      },
      size: {
        sm:      'h-8 px-3 text-xs',
        default: 'h-10 px-4',
        lg:      'h-11 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, style, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const [hovered, setHovered] = useState(false)

    const isGreen = !variant || variant === 'default' || variant === 'success'
    const brandStyle: React.CSSProperties = isGreen
      ? { background: hovered ? '#1a5c3a' : 'linear-gradient(to right, #1a5c3a, #6ecfb0)', ...style }
      : (style ?? {})

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        style={brandStyle}
        onMouseEnter={e => { setHovered(true); onMouseEnter?.(e) }}
        onMouseLeave={e => { setHovered(false); onMouseLeave?.(e) }}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
