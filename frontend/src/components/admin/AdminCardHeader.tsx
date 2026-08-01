export default function AdminCardHeader({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="mb-3.5">
      <h3 className="font-display text-sm font-semibold text-navy-950">{titulo}</h3>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">{descripcion}</p>
    </div>
  )
}
