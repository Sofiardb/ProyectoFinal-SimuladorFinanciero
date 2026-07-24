import type { PortfolioDetalle } from '@/types'

export interface MontoInvertido {
  totalArs:    number
  totalUsd:    number
  /** Convertido a la moneda base del portfolio — mismo criterio que ValidarPresupuestoAsync en el backend. */
  totalEnBase: number
}

/**
 * Monto ya invertido en el portfolio, agrupado por moneda y convertido a la moneda base. Replica
 * ValidarPresupuestoAsync/ConvertirAMonedaBaseAsync (PortfolioService.cs) del lado del cliente para
 * poder mostrarlo de forma reactiva a medida que se agregan/editan/eliminan tenencias, sin depender de
 * un endpoint nuevo — se recalcula a partir de `detalle` (ya se refresca solo con cada mutación).
 */
export function calcularMontoInvertido(detalle: PortfolioDetalle, tipoCambio: number | undefined): MontoInvertido {
  const totalUsd =
    detalle.acciones.reduce((acc, a) => acc + a.cantidad * a.precioCompra, 0) +
    detalle.plazosFijos
      .filter((pf) => pf.codigoMoneda === 'USD')
      .reduce((acc, pf) => acc + pf.montoInvertido, 0)

  const totalArs =
    detalle.bonos.reduce((acc, b) => acc + b.cantidad * b.precioCompra, 0) +
    detalle.letras.reduce((acc, l) => acc + l.cantidad * l.precioCompra, 0) +
    detalle.plazosFijos
      .filter((pf) => pf.codigoMoneda === 'ARS')
      .reduce((acc, pf) => acc + pf.montoInvertido, 0)

  let totalEnBase: number
  if (detalle.codigoMonedaBase === 'USD') {
    totalEnBase = totalArs === 0 || tipoCambio == null ? totalUsd : totalUsd + totalArs / tipoCambio
  } else {
    totalEnBase = totalUsd === 0 || tipoCambio == null ? totalArs : totalArs + totalUsd * tipoCambio
  }

  return { totalArs, totalUsd, totalEnBase }
}
