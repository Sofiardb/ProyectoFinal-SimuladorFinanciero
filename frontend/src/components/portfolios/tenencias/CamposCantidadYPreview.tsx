import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import TextFormField from '@/components/forms/TextFormField'
import { formatMoneda } from '@/lib/format'
import { montoConvertidoField, type CampoPreview } from '@/lib/tenenciaDisplay'

interface Props<TFieldValues extends FieldValues & { cantidad: string }> {
  control: Control<TFieldValues>
  previewFields: CampoPreview[]
  precioActual?: number
  cantidadNum: number
  cantidadLabel: string
  cantidadTooltip?: string
  montoInvertidoTooltip?: string
  moneda: 'ARS' | 'USD'
  monedaBase: string
  tipoCambio?: number
}

export default function CamposCantidadYPreview<TFieldValues extends FieldValues & { cantidad: string }>({
  control,
  previewFields,
  precioActual,
  cantidadNum,
  cantidadLabel,
  cantidadTooltip,
  montoInvertidoTooltip,
  moneda,
  monedaBase,
  tipoCambio,
}: Props<TFieldValues>) {
  const montoInvertido = precioActual != null ? cantidadNum * precioActual : undefined
  const convertido =
    montoInvertido != null ? montoConvertidoField(montoInvertido, moneda, monedaBase, tipoCambio) : null
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
      {montoInvertido != null && cantidadNum > 0 && (
        <div>
          <span className="field-label inline-flex items-center gap-1">
            Monto invertido
            {montoInvertidoTooltip && <InfoTooltip term="Monto invertido" definition={montoInvertidoTooltip} />}
          </span>
          <div className="readonly-chip">{formatMoneda(montoInvertido, moneda)}</div>
        </div>
      )}
      {convertido && cantidadNum > 0 && (
        <div>
          <span className="field-label inline-flex items-center gap-1">
            {convertido.label}
            {convertido.tooltip && <InfoTooltip term={convertido.label} definition={convertido.tooltip} />}
          </span>
          <div className="readonly-chip">{convertido.value}</div>
        </div>
      )}
    </div>
  )
}
