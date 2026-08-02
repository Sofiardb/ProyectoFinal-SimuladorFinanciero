import { CircleHelp } from 'lucide-react'


export default function GuiaResultadosTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex size-4 shrink-0 items-center justify-center text-ink-soft hover:text-navy-950"
      aria-label="Ver guía de esta sección"
    >
      <CircleHelp className="size-full" />
    </button>
  )
}
