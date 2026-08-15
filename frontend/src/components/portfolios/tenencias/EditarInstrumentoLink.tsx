import { Link } from 'react-router-dom'
import { instrumentoRefKey, type InstrumentoRef } from '@/lib/instrumentoRef'
import { cn } from '@/lib/utils'

export default function EditarInstrumentoLink({
  idPortfolio,
  instrumento,
  className,
}: {
  idPortfolio: number
  instrumento: InstrumentoRef
  className?: string
}) {
  return (
    <Link to={`/portfolios/${idPortfolio}?editar=${instrumentoRefKey(instrumento)}`} className={cn('tenencia-row-action', className)}>
      Editar →
    </Link>
  )
}
