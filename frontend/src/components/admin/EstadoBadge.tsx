import type { EstadoConexion } from '@/api/hooks'
import { cn } from '@/lib/utils'

export default function EstadoBadge({ label, estado }: { label: string; estado: EstadoConexion }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          'mt-[5px] size-2 shrink-0 rounded-full',
          estado.ok ? 'bg-favorable' : 'bg-desfavorable',
        )}
      />
      <p className="text-[12.5px] leading-normal">
        <span className="font-semibold text-navy-950">{label}: </span>
        <span className={estado.ok ? 'text-favorable' : 'text-desfavorable'}>{estado.detalle}</span>
      </p>
    </div>
  )
}
