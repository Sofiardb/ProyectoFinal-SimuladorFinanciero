import { formatFecha, formatMoneda, formatPorcentaje } from '@/lib/format'
import type { CampoPreview, CardDisplay } from '@/lib/tenenciaDisplay/tipos'
import type { PortfolioPlazoFijo } from '@/types'

export function plazoFijoPreview(pf: PortfolioPlazoFijo): CampoPreview[] {
  const tasaLabel = pf.nombreTipoPlazoFijo === 'Plazo fijo UVA' ? 'Tasa real' : 'TNA'
  return [
    { label: 'Monto', value: formatMoneda(pf.montoInvertido, pf.codigoMoneda) },
    { label: tasaLabel, value: formatPorcentaje(pf.tnaPactada * 100) },
    { label: 'Plazo', value: `${pf.duracionDias} días` },
    { label: 'Inicio', value: formatFecha(pf.fechaInicio) },
    { label: 'Reinversión', value: pf.reinvertirAlVencimiento ? 'Sí' : 'No' },
  ]
}

export function plazoFijoCardDisplay(pf: PortfolioPlazoFijo): CardDisplay {
  const esUva = pf.nombreTipoPlazoFijo.toUpperCase().includes('UVA')
  return {
    id: `pf_${pf.idPortfolioPlazoFijo}`,
    title: pf.entidadFinanciera,
    subtitle: `${pf.codigoMoneda} · ${pf.nombreTipoPlazoFijo}`,
    stat: `${formatPorcentaje(pf.tnaPactada * 100)} ${esUva ? 'real' : 'TNA'}`,
  }
}
