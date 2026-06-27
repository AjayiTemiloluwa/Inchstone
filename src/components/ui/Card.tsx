import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      className={`bg-surface rounded-xl border border-mist shadow-sm p-6 ${onClick ? 'cursor-pointer text-left w-full hover:border-gold transition-colors' : ''} ${className}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Component>
  )
}
