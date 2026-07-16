import { cn } from '@/lib/utils'
import type { CardDisplay } from '@/lib/tenenciaDisplay'

export default function GrupoMonedaList({
  titulo,
  tituloClassName,
  items,
}: {
  titulo: string
  tituloClassName: string
  items: CardDisplay[]
}) {
  return (
    <div>
      <p className={cn('mb-2 text-[11px] font-bold tracking-[0.4px]', tituloClassName)}>{titulo}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2.5 rounded-lg bg-chip px-3 py-[9px]"
          >
            <div className="min-w-0">
              <p className="truncate text-[12.5px] leading-tight font-semibold text-navy-950">{item.title}</p>
              <p className="mt-0.5 truncate text-[10.5px] leading-tight text-ink-soft">{item.subtitle}</p>
            </div>
            <span className="shrink-0 text-[11.5px] font-semibold whitespace-nowrap text-navy-950">
              {item.stat}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
