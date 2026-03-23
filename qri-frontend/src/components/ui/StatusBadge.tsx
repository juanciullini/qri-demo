import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  colorFn: (status: string) => string
  label?: string
  className?: string
}

export default function StatusBadge({
  status,
  colorFn,
  label,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        colorFn(status),
        className,
      )}
    >
      {label ?? status}
    </span>
  )
}
