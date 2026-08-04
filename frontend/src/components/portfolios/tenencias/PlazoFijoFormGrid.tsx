import { useWatch, type Control } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import SelectFormField from '@/components/forms/SelectFormField'
import { hoyISO } from '@/lib/format'
import { tasaLabelPara } from '@/lib/plazoFijo'
import type { PlazoFijoValues } from '@/components/portfolios/tenencias/plazoFijoForm'
import type { TipoPlazoFijo } from '@/types'

interface Props {
  moneda: string
  tipos: TipoPlazoFijo[]
  control: Control<PlazoFijoValues>
}

export default function PlazoFijoFormGrid({ moneda, tipos, control }: Props) {
  const idTipoPlazoFijo = useWatch({ control, name: 'idTipoPlazoFijo' })
  const tipoSeleccionado = tipos.find((t) => String(t.idTipoPlazoFijo) === idTipoPlazoFijo) ?? tipos[0]
  const tasaLabel = tasaLabelPara(tipoSeleccionado?.codigo)

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
          inputProps={{ type: 'number', placeholder: '0' }}
        />
        <TextFormField
          control={control}
          name="tnaPactada"
          label={`${tasaLabel} (ej: 0.42)`}
          inputProps={{ type: 'number', placeholder: '0' }}
        />
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
            <FormItem className="flex flex-row items-center gap-1.5 space-y-0 pb-1">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="text-[11px] font-normal text-ink-muted">
                Reinvertir al vencimiento
              </FormLabel>
            </FormItem>
          )}
        />
      </div>
    </>
  )
}
