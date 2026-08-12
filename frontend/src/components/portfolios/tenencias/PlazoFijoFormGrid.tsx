import { useWatch, type Control } from 'react-hook-form'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import SelectFormField from '@/components/forms/SelectFormField'
import { hoyISO } from '@/lib/format'
import { tasaLabelPara } from '@/lib/plazoFijo'
import { montoConvertidoField } from '@/lib/tenenciaDisplay'
import { cn } from '@/lib/utils'
import type { PlazoFijoValues } from '@/components/portfolios/tenencias/plazoFijoForm'
import type { TipoPlazoFijo } from '@/types'

interface Props {
  moneda: string
  tipos: TipoPlazoFijo[]
  control: Control<PlazoFijoValues>
  monedaBase: string
  tipoCambio?: number
}

export default function PlazoFijoFormGrid({ moneda, tipos, control, monedaBase, tipoCambio }: Props) {
  const idTipoPlazoFijo = useWatch({ control, name: 'idTipoPlazoFijo' })
  const montoInvertidoStr = useWatch({ control, name: 'montoInvertido' })
  const tipoSeleccionado = tipos.find((t) => String(t.idTipoPlazoFijo) === idTipoPlazoFijo) ?? tipos[0]
  const tasaLabel = tasaLabelPara(tipoSeleccionado?.codigo)
  const montoInvertido = Number(montoInvertidoStr) || 0
  const convertido =
    montoInvertido > 0
      ? montoConvertidoField(montoInvertido, moneda === 'USD' ? 'USD' : 'ARS', monedaBase, tipoCambio)
      : null

  return (
    <>
      <TextFormField
        control={control}
        name="entidadFinanciera"
        label="Alias"
        inputProps={{ placeholder: 'Ej: Banco Galicia' }}
      />
      <div className="grid grid-cols-2 gap-2">
        {tipos.length <= 1 ? (
          <div>
            <span className="field-label">Tipo</span>
            <div className="readonly-chip">{tipos[0]?.nombre ?? '—'}</div>
          </div>
        ) : (
          <SelectFormField
            control={control}
            name="idTipoPlazoFijo"
            label="Tipo"
            options={tipos.map((t) => ({ value: String(t.idTipoPlazoFijo), label: t.nombre }))}
          />
        )}
        <TextFormField
          control={control}
          name="montoInvertido"
          label={`Monto (${moneda})`}
          inputProps={{ type: 'number', min: 0, placeholder: '0' }}
        />
        <TextFormField
          control={control}
          name="tnaPactada"
          label={`${tasaLabel} (%)`}
          inputProps={{ type: 'number', min: 0, max: 100, step: 'any', placeholder: 'Ej: 42' }}
        />
        {convertido && (
          <div>
            <span className="field-label inline-flex items-center gap-1">
              {convertido.label}
              {convertido.tooltip && <InfoTooltip term={convertido.label} definition={convertido.tooltip} />}
            </span>
            <div className="readonly-chip">{convertido.value}</div>
          </div>
        )}
        <TextFormField
          control={control}
          name="duracionDias"
          label="Plazo (días)"
          inputProps={{ type: 'number', min: 1, placeholder: '180' }}
        />
        <TextFormField
          control={control}
          name="fechaInicio"
          label="Fecha de inicio"
          inputProps={{ type: 'date', min: hoyISO() }}
        />
        <FormField
          control={control}
          name="reinvertirAlVencimiento"
          render={({ field }) => (
            <FormItem
              className={cn(
                'flex flex-row items-center gap-1.5 space-y-0 self-end',
                convertido && 'col-start-2 justify-self-end',
              )}
            >
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="text-[13px] font-medium text-navy-950'">
                Reinvertir al vencimiento
              </FormLabel>
            </FormItem>
          )}
        />
      </div>
    </>
  )
}
