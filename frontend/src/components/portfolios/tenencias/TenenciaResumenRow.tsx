import InfoTooltip from '@/components/portfolios/InfoTooltip'
import TruncatedText from '@/components/portfolios/TruncatedText'
import EditarInstrumentoLink from '@/components/portfolios/tenencias/EditarInstrumentoLink'
import type { CampoPreview } from '@/lib/tenenciaDisplay'
import type { InstrumentoRef } from '@/lib/instrumentoRef'

export default function TenenciaResumenRow({
  titulo,
  subtitulo,
  campos,
  idPortfolio,
  instrumento,
}: {
  titulo: string
  subtitulo: string
  campos: CampoPreview[]
  idPortfolio: number
  instrumento: InstrumentoRef
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
      <EditarInstrumentoLink idPortfolio={idPortfolio} instrumento={instrumento} className="ml-auto" />
    </div>
  )
}
