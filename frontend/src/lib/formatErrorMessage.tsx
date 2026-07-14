import { Fragment } from 'react'

/** Renderiza un mensaje de error del backend: `\n` como líneas separadas y `**texto**` como negrita. */
export function FormattedErrorMessage({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={i > 0 ? 'mt-1' : undefined}>
          {renderBoldSegments(line)}
        </p>
      ))}
    </>
  )
}

function renderBoldSegments(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Fragment key={i}>
          <strong className="font-semibold">{part.slice(2, -2)}</strong>
        </Fragment>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
