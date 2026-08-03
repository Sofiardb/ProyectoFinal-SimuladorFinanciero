import { Alert, AlertDescription } from '@/components/ui/alert'

export default function MutationErrorAlert({ error }: { error: { message: string } | null }) {
  if (!error) return null

  return (
    <Alert variant="destructive">
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}
