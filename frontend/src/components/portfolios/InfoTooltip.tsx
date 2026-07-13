import { useState } from 'react'

export default function InfoTooltip({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-tooltip-chip text-[10.5px] font-bold text-tooltip-chip-text"
        aria-label="Más información"
      >
        i
      </span>

      {open && (
        <span className="absolute bottom-[22px] left-1/2 z-40 w-60 -translate-x-1/2 rounded-[9px] bg-navy-950 px-3.5 py-3 text-xs leading-[1.55] text-white shadow-[0_8px_20px_rgba(15,39,64,0.25)]">
          <span className="mb-1 block font-display font-bold text-green-brand">{term}</span>
          <span className="block text-tooltip-text">{definition}</span>
          <span className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-navy-950" />
        </span>
      )}
    </span>
  )
}
