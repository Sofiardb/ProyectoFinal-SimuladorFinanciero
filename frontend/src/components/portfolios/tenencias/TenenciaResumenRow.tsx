import { Link } from 'react-router-dom'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import TruncatedText from '@/components/portfolios/TruncatedText'
import type { CampoPreview } from '@/lib/tenenciaDisplay'

export default function TenenciaResumenRow({
  titulo,
  subtitulo,
  campos,
  editHref,
}: {
  titulo: string
  subtitulo: string
  campos: CampoPreview[]
  editHref: string
}) {
  return (
    <div className="tenencia-row">
      <div className="min-w-0 flex-1 basis-32">
        <TruncatedText text={titulo} className="tenencia-row-title" />
        <p className="tenencia-row-subtitle">{subtitulo}</p>
      </div>
      <div className="tenencia-row-stats">
        {campos.map((f) => (
          <div key={f.label} className="text-right">
            <p className="stat-label flex items-center justify-end gap-1">
              {f.label}
              {f.tooltip && <InfoTooltip term={f.label} definition={f.tooltip} />}
            </p>
            <p className="mt-0.5 stat-value">{f.value}</p>
          </div>
        ))}
      </div>
      <Link
        to={editHref}
        className="ml-auto shrink-0 text-[12px] font-semibold whitespace-nowrap text-navy-950 hover:underline"
      >
        Editar →
      </Link>
    </div>
  )
}
