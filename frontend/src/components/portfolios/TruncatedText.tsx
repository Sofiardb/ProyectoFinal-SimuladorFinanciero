import { useState } from 'react'

/**
 * Envuelve un texto que puede truncarse (clase con `truncate`) con un tooltip propio al hacer hover,
 * mostrando el texto completo. El atributo `title` nativo del navegador no es confiable en todos los
 * entornos (ej. webviews embebidos) — se usa el mismo patrón hover-state que InfoTooltip, que sí funciona.
 */
export default function TruncatedText({ text, className }: { text: string; className: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative block min-w-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <p className={className}>{text}</p>

      {open && (
        <span className="absolute bottom-[calc(100%+6px)] left-0 z-40 w-max max-w-[280px] rounded-[9px] bg-navy-950 px-3 py-2 text-xs leading-snug text-white shadow-[0_8px_20px_rgba(15,39,64,0.25)]">
          {text}
        </span>
      )}
    </span>
  )
}
