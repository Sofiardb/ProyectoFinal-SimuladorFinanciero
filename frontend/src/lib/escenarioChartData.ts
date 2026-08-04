export interface SerieEscenario {
  key:     string
  label:   string
  color:   string
  media:   number[]
  p25?:    number[]
  p75?:    number[]
  minimo?: number[]
  maximo?: number[]
  mediaSecundaria?: number[]
  labelSecundaria?: string
  colorSecundaria?: string
  p25Secundaria?: number[]
  p75Secundaria?: number[]
}

export interface VencimientoMarcador {
  mes:   number
  label: string
}

export interface BreakevenMarcador {
  valor: number
}

export type FilaChart = { mes: number } & Record<string, number | [number, number]>

/** Aplana las series a filas por mes, en el formato que espera `recharts` (una columna por
 * `${key}_media`/`_banda`/etc., no un array anidado por serie). */
export function buildChartData(series: SerieEscenario[], mostrarBanda: boolean, mostrarMinMax: boolean): FilaChart[] {
  const T = series[0]?.media.length ?? 0
  return Array.from({ length: T }, (_, mes) => {
    const fila: FilaChart = { mes }
    for (const s of series) {
      fila[`${s.key}_media`] = s.media[mes]
      if (s.mediaSecundaria != null) fila[`${s.key}_secundaria`] = s.mediaSecundaria[mes]
      if (mostrarBanda && s.p25 != null && s.p75 != null) {
        fila[`${s.key}_banda`] = [s.p25[mes], s.p75[mes]]
      }
      if (mostrarBanda && s.p25Secundaria != null && s.p75Secundaria != null) {
        fila[`${s.key}_bandaSecundaria`] = [s.p25Secundaria[mes], s.p75Secundaria[mes]]
      }
      if (mostrarMinMax && s.minimo != null) fila[`${s.key}_minimo`] = s.minimo[mes]
      if (mostrarMinMax && s.maximo != null) fila[`${s.key}_maximo`] = s.maximo[mes]
    }
    return fila
  })
}

export const FILAS_ETIQUETA = 3
const ALTO_ETIQUETA = 11

export function ordenarVencimientos(vencimientos: VencimientoMarcador[] | undefined): VencimientoMarcador[] {
  return [...(vencimientos ?? [])].sort((a, b) => a.mes - b.mes)
}

export function computeMarginTop(cantidadVencimientos: number): number {
  return cantidadVencimientos > 0 ? 8 + FILAS_ETIQUETA * ALTO_ETIQUETA : 8
}

export function computeZonasVencidas(
  vencimientosOrdenados: VencimientoMarcador[],
  T: number,
): { desde: number; hasta: number }[] {
  return vencimientosOrdenados.map((v, i) => ({
    desde: v.mes,
    hasta: vencimientosOrdenados[i + 1]?.mes ?? T - 1,
  }))
}
