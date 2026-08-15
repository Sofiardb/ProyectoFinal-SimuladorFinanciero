export type Lado = 'a' | 'b'

export const LADO_INFO: Record<Lado, { texto: string; color: string; bg: string }> = {
  a: { texto: 'Simulación A', color: 'var(--color-compara-a)', bg: 'var(--color-compara-a-bg)' },
  b: { texto: 'Simulación B', color: 'var(--color-compara-b)', bg: 'var(--color-compara-b-bg)' },
}

export function PuntoLado({ lado }: { lado: Lado }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: LADO_INFO[lado].color }} />
}

export function EtiquetaLado({ lado, texto, className = '' }: { lado: Lado; texto?: string; className?: string }) {
  const info = LADO_INFO[lado]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 text-[11px] font-semibold ${className}`}
      style={{ color: info.color, backgroundColor: info.bg }}
    >
      <PuntoLado lado={lado} />
      {texto ?? info.texto}
    </span>
  )
}
