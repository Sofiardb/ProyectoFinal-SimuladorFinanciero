import { Alert, AlertDescription } from '@/components/ui/alert'

/** Alerta de error de una mutación react-query: no renderiza nada si no hay error. */
export default function MutationErrorAlert({ error }: { error: { message: string } | null }) {
  if (!error) return null

  return (
    <Alert variant="destructive">
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}
