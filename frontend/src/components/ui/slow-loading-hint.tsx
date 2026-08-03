import { useSlowLoading } from '@/hooks/useSlowLoading'

function SlowLoadingHint({ isLoading }: { isLoading: boolean }) {
  const esLenta = useSlowLoading(isLoading)

  if (!esLenta) return null

  return (
    <p className="mt-4 text-center text-xs text-muted-foreground">
      Esto está tardando más de lo habitual — el servidor puede estar reactivándose tras un
      período de inactividad.
    </p>
  )
}

export { SlowLoadingHint }
