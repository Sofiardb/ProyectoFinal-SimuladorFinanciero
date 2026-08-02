import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GuiaSeccion } from '@/lib/guiaResultados'

export interface GuiaPaso {
  term: string
  texto: string
  selector?: string
  slot: string
}

function aplanar(secciones: GuiaSeccion[]): GuiaPaso[] {
  return secciones.flatMap((seccion) => seccion.items.map(({ term, texto, selector, slot }) => ({ term, texto, selector, slot })))
}

const OFFSET_NAV = 80

function scrollearAmbos(elemento: Element, banner: Element | null) {
  const elRect = elemento.getBoundingClientRect()
  const vh = window.innerHeight

  if (!banner) {
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const bannerRect = banner.getBoundingClientRect()
  const bloqueAlto = bannerRect.bottom - elRect.top
  const espacioDisponible = vh - OFFSET_NAV - 16

  const delta =
    bloqueAlto <= espacioDisponible
      ? elRect.top - OFFSET_NAV - Math.max(0, (espacioDisponible - bloqueAlto) / 2)
      : elRect.top - OFFSET_NAV

  window.scrollBy({ top: delta, behavior: 'smooth' })
}

export function useGuiaResultados(secciones: GuiaSeccion[]) {
  const pasos = useMemo(() => aplanar(secciones), [secciones])
  const [pasoActual, setPasoActual] = useState<number | null>(null)
  const [acotadoASlot, setAcotadoASlot] = useState<string | null>(null)

  const rango = useMemo(() => {
    if (!acotadoASlot) return { min: 0, max: pasos.length - 1 }
    const indices = pasos.reduce<number[]>((acc, p, i) => (p.slot === acotadoASlot ? [...acc, i] : acc), [])
    return indices.length > 0 ? { min: indices[0], max: indices[indices.length - 1] } : { min: 0, max: pasos.length - 1 }
  }, [acotadoASlot, pasos])

  const iniciar = useCallback(() => {
    setAcotadoASlot(null)
    setPasoActual(0)
  }, [])

  const iniciarEnSlot = useCallback(
    (slot: string, indiceRelativo = 0) => {
      const indices = pasos.reduce<number[]>((acc, p, i) => (p.slot === slot ? [...acc, i] : acc), [])
      if (indices.length === 0) return
      setAcotadoASlot(slot)
      setPasoActual(indices[Math.min(Math.max(indiceRelativo, 0), indices.length - 1)])
    },
    [pasos],
  )

  const cerrar = useCallback(() => {
    setPasoActual(null)
    setAcotadoASlot(null)
  }, [])

  const ir = useCallback(
    (indice: number) => {
      if (indice < rango.min || indice > rango.max) return
      setPasoActual(indice)
    },
    [rango],
  )

  useEffect(() => {
    if (pasoActual === null) return
    const selector = pasos[pasoActual]?.selector
    const elemento = selector ? document.querySelector(selector) : null
    if (!elemento) return
    elemento.classList.add('guia-resaltado')
    const banner = document.getElementById('guia-banner-activo')
    scrollearAmbos(elemento, banner)
    return () => elemento.classList.remove('guia-resaltado')
  }, [pasoActual, pasos])

  return {
    pasos,
    pasoActual,
    rango,
    activo: pasoActual !== null,
    pasoActualItem: pasoActual !== null ? pasos[pasoActual] : undefined,
    iniciar,
    iniciarEnSlot,
    cerrar,
    ir,
  }
}

export type GuiaResultados = ReturnType<typeof useGuiaResultados>
