export default function AccionesComparacionMercado({
  isPending,
  onMantener,
  onActualizarSinSimular,
  onActualizarYSimular,
}: {
  isPending:              boolean
  onMantener:             () => void
  onActualizarSinSimular: () => void
  onActualizarYSimular:   () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[920px] flex-col gap-3">
        <p className="text-[12.5px] text-ink-soft">
          Podés mantener el portfolio tal como está, actualizarlo sin simular todavía, o actualizarlo y continuar
          hacia una nueva simulación con los datos de hoy.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={onMantener} className="btn-secondary flex-1">
            Mantener como snapshot
          </button>
          <button onClick={onActualizarSinSimular} disabled={isPending} className="btn-secondary flex-1">
            Actualizar pero sin simular
          </button>
          <button onClick={onActualizarYSimular} disabled={isPending} className="btn-primary flex-[1.4]">
            Actualizar y continuar a simular
          </button>
        </div>
      </div>
    </div>
  )
}
