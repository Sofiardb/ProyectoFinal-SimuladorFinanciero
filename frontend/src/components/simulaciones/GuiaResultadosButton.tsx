import { CircleHelp } from 'lucide-react'
import type { GuiaResultados } from '@/hooks/useGuiaResultados'

export default function GuiaResultadosButton({ guia }: { guia: GuiaResultados }) {
  return (
    <button onClick={guia.iniciar} className="btn-secondary inline-flex items-center gap-1.5">
      <CircleHelp className="size-4" />
      Guía
    </button>
  )
}
