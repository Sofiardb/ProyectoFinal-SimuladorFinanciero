import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import TextFormField from '@/components/forms/TextFormField'
import { formatMoneda } from '@/lib/format'
import type { CampoPreview } from '@/lib/tenenciaDisplay'

interface Props<TFieldValues extends FieldValues & { cantidad: string }> {
  control: Control<TFieldValues>
  previewFields: CampoPreview[]
  precioActual?: number
  cantidadNum: number
  cantidadLabel: string
  cantidadTooltip?: string
  montoInvertidoTooltip?: string
}

/** Grilla de campos readonly del catálogo + el input editable de cantidad + el monto invertido
 * derivado — compartida entre alta y edición de una tenencia de catálogo (acción/bono/letra). */
export default function CamposCantidadYPreview<TFieldValues extends FieldValues & { cantidad: string }>({
  control,
  previewFields,
  precioActual,
  cantidadNum,
  cantidadLabel,
  cantidadTooltip,
  montoInvertidoTooltip,
}: Props<TFieldValues>) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {previewFields.map((f) => (
        <div key={f.label}>
          <span className="field-label inline-flex items-center gap-1">
            {f.label}
            {f.tooltip && <InfoTooltip term={f.label} definition={f.tooltip} />}
          </span>
          <div className="readonly-chip">{f.value}</div>
        </div>
      ))}
      <TextFormField
        control={control}
        name={'cantidad' as FieldPath<TFieldValues>}
        label={
          <span className="inline-flex items-center gap-1">
            {cantidadLabel}
            {cantidadTooltip && <InfoTooltip term={cantidadLabel} definition={cantidadTooltip} />}
          </span>
        }
        inputProps={{ type: 'number', step: '1', placeholder: '0' }}
      />
      {precioActual != null && cantidadNum > 0 && (
        <div>
          <span className="field-label inline-flex items-center gap-1">
            Monto invertido
            {montoInvertidoTooltip && <InfoTooltip term="Monto invertido" definition={montoInvertidoTooltip} />}
          </span>
          <div className="readonly-chip">{formatMoneda(cantidadNum * precioActual, 'ARS')}</div>
        </div>
      )}
    </div>
  )
}
