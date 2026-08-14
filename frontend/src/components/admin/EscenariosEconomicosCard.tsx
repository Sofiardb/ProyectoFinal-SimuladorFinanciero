import { useEffect, useState } from 'react'
import { useActualizarEscenariosEconomicos, useEscenariosEconomicos } from '@/api/hooks'
import { FormattedErrorMessage } from '@/lib/formatErrorMessage'
import AdminCardHeader from './AdminCardHeader'

interface FilaEdit {
  min:    string
  max:    string
  minUsd: string
  maxUsd: string
}

function aPorcentaje(decimal: number): string {
  return parseFloat((decimal * 100).toFixed(4)).toString()
}

function aDecimal(porcentaje: string): number {
  return Number(porcentaje) / 100
}

function FilaRangoPorcentaje({
  moneda,
  min,
  max,
  onChangeMin,
  onChangeMax,
}: {
  moneda: string
  min: string
  max: string
  onChangeMin: (valor: string) => void
  onChangeMax: (valor: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 text-[11.5px] text-ink-soft">{moneda}</span>
      <input
        type="number"
        step="0.01"
        className="field-input w-20"
        value={min}
        onChange={(ev) => onChangeMin(ev.target.value)}
      />
      <span className="text-ink-soft">–</span>
      <input
        type="number"
        step="0.01"
        className="field-input w-20"
        value={max}
        onChange={(ev) => onChangeMax(ev.target.value)}
      />
      <span className="text-[11.5px] text-ink-soft">%</span>
    </div>
  )
}

export default function EscenariosEconomicosCard() {
  const { data: escenarios, isLoading } = useEscenariosEconomicos()
  const actualizar = useActualizarEscenariosEconomicos()
  const [filas, setFilas] = useState<Record<number, FilaEdit>>({})
  const [inicializado, setInicializado] = useState(false)

  useEffect(() => {
    if (!escenarios || inicializado) return
    const iniciales: Record<number, FilaEdit> = {}
    for (const e of escenarios) {
      iniciales[e.idTipoEscenario] = {
        min:    aPorcentaje(e.inflacionMensualMin),
        max:    aPorcentaje(e.inflacionMensualMax),
        minUsd: aPorcentaje(e.inflacionMensualMinUsd),
        maxUsd: aPorcentaje(e.inflacionMensualMaxUsd),
      }
    }
    setFilas(iniciales)
    setInicializado(true)
  }, [escenarios, inicializado])

  function actualizarCampo(idTipoEscenario: number, campo: keyof FilaEdit, valor: string) {
    setFilas((prev) => ({ ...prev, [idTipoEscenario]: { ...prev[idTipoEscenario], [campo]: valor } }))
  }

  function handleSubmit() {
    if (!escenarios) return
    const payload = escenarios.map((e) => {
      const fila = filas[e.idTipoEscenario]
      return {
        idTipoEscenario:        e.idTipoEscenario,
        inflacionMensualMin:    aDecimal(fila.min),
        inflacionMensualMax:    aDecimal(fila.max),
        inflacionMensualMinUsd: aDecimal(fila.minUsd),
        inflacionMensualMaxUsd: aDecimal(fila.maxUsd),
      }
    })
    actualizar.mutate(payload)
  }

  return (
    <div className="card">
      <AdminCardHeader
        titulo="Rangos de inflación"
        descripcion="Rangos de inflación mensual vigentes por escenario económico. Al guardar se cierra el rango vigente y se abre uno nuevo desde hoy — no afecta simulaciones ya corridas."
      />

      {isLoading || !escenarios ? (
        <p className="text-[12.5px] text-ink-soft">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {escenarios.map((e) => {
            const fila = filas[e.idTipoEscenario]
            if (!fila) return null
            return (
              <div
                key={e.idTipoEscenario}
                className="grid grid-cols-1 gap-2 border-t border-line pt-3 first:border-0 first:pt-0 sm:grid-cols-[110px_1fr_1fr]"
              >
                <span className="field-label self-center">{e.nombreEscenario}</span>
                <FilaRangoPorcentaje
                  moneda="ARS"
                  min={fila.min}
                  max={fila.max}
                  onChangeMin={(valor) => actualizarCampo(e.idTipoEscenario, 'min', valor)}
                  onChangeMax={(valor) => actualizarCampo(e.idTipoEscenario, 'max', valor)}
                />
                <FilaRangoPorcentaje
                  moneda="USD"
                  min={fila.minUsd}
                  max={fila.maxUsd}
                  onChangeMin={(valor) => actualizarCampo(e.idTipoEscenario, 'minUsd', valor)}
                  onChangeMax={(valor) => actualizarCampo(e.idTipoEscenario, 'maxUsd', valor)}
                />
              </div>
            )
          })}

          <div className="flex flex-col gap-2">
            <button type="button" onClick={handleSubmit} disabled={actualizar.isPending} className="btn-primary w-fit">
              {actualizar.isPending ? 'Guardando…' : 'Guardar rangos'}
            </button>
            {actualizar.error && (
              <div className="banner-danger">
                <FormattedErrorMessage text={actualizar.error.message} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
