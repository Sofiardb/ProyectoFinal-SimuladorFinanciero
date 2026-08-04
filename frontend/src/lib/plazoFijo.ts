import { hoyISO } from '@/lib/format'
import type { PortfolioPlazoFijo } from '@/types'

function partesISO(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return [y, m, d]
}

export function mesesEntre(desdeISO: string, hastaISO: string): number {
  const [ay, am] = partesISO(desdeISO)
  const [by, bm] = partesISO(hastaISO)
  return (by - ay) * 12 + (bm - am)
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = partesISO(iso)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return dt.toISOString().slice(0, 10)
}

export function fechaVencimiento(pf: Pick<PortfolioPlazoFijo, 'fechaInicio' | 'duracionDias'>): string {
  return sumarDias(pf.fechaInicio, pf.duracionDias)
}

export function esVencido(
  pf: Pick<PortfolioPlazoFijo, 'fechaInicio' | 'duracionDias' | 'reinvertirAlVencimiento'>,
): boolean {
  return !pf.reinvertirAlVencimiento && fechaVencimiento(pf) <= hoyISO()
}

export function capitalDevengado(montoInvertido: number, tnaPactada: number, meses: number): number {
  const rm = tnaPactada / 12
  return montoInvertido * Math.pow(1 + rm, Math.max(0, meses))
}

export function capitalHoy(pf: Pick<PortfolioPlazoFijo, 'fechaInicio' | 'montoInvertido' | 'tnaPactada'>): number {
  return capitalDevengado(pf.montoInvertido, pf.tnaPactada, mesesEntre(pf.fechaInicio, hoyISO()))
}

export function capitalAlVencimiento(
  pf: Pick<PortfolioPlazoFijo, 'fechaInicio' | 'duracionDias' | 'montoInvertido' | 'tnaPactada'>,
): number {
  const meses = mesesEntre(pf.fechaInicio, fechaVencimiento(pf))
  return capitalDevengado(pf.montoInvertido, pf.tnaPactada, meses)
}

/** UVA muestra "Tasa real" (ajusta por inflación aparte); el resto de los tipos usa TNA nominal. */
export function tasaLabelPara(codigoTipo: string | undefined): string {
  return codigoTipo === 'UVA' ? 'Tasa real' : 'TNA'
}
