import { cn } from '@/lib/utils'

interface PerfilEstilo {
  badge:  string
  iconBg: string
  dotBg:  string
}

const ESTILOS_POR_PERFIL: Record<string, PerfilEstilo> = {
  conservador: {
    badge: 'bg-riesgo-conservador-bg text-riesgo-conservador-badge',
    iconBg: 'bg-riesgo-conservador-bg',
    dotBg: 'bg-riesgo-conservador',
  },
  moderado: {
    badge: 'bg-riesgo-moderado-bg text-riesgo-moderado-badge',
    iconBg: 'bg-riesgo-moderado-bg',
    dotBg: 'bg-riesgo-moderado',
  },
  agresivo: {
    badge: 'bg-riesgo-agresivo-bg text-riesgo-agresivo-badge',
    iconBg: 'bg-riesgo-agresivo-bg',
    dotBg: 'bg-riesgo-agresivo',
  },
}

const ESTILO_DEFAULT: PerfilEstilo = {
  badge: 'bg-muted text-muted-foreground',
  iconBg: 'bg-muted',
  dotBg: 'bg-muted-foreground',
}

export function getPerfilEstilo(nombre: string): PerfilEstilo {
  return ESTILOS_POR_PERFIL[nombre.toLowerCase()] ?? ESTILO_DEFAULT
}

export default function PerfilBadge({ nombre }: { nombre: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-[10px] py-1 text-[11.5px] font-bold',
        getPerfilEstilo(nombre).badge,
      )}
    >
      {nombre}
    </span>
  )
}
