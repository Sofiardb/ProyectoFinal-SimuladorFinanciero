import { cn } from '@/lib/utils'

export default function TrendSparkline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 460 140"
      className={cn('w-full opacity-95', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-green-brand)" stopOpacity=".35" />
          <stop offset="100%" stopColor="var(--color-green-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points="0,110 60,95 120,100 180,70 240,80 300,45 360,55 420,20 460,28"
        fill="none"
        stroke="var(--color-green-brand)"
        strokeWidth="3"
      />
      <polygon
        points="0,110 60,95 120,100 180,70 240,80 300,45 360,55 420,20 460,28 460,140 0,140"
        fill="url(#trend-fill)"
      />
      <polyline
        points="0,120 60,118 120,122 180,110 240,116 300,100 360,105 420,90 460,95"
        fill="none"
        stroke="#3a5f8f"
        strokeWidth="2"
        strokeDasharray="3 4"
      />
    </svg>
  )
}
