import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`
        glass rounded-2xl p-6
        transition-all duration-300 ease-out
        hover:shadow-[0_0_30px_rgba(212,175,55,0.06)]
        ${onClick ? 'cursor-pointer hover:border-gold/30 hover:bg-white/[0.06] active:scale-[0.985]' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {children}
    </div>
  )
}
