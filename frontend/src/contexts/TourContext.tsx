import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { PASOS, SIGUIENTE, type PasoConfig, type PasoId } from '@/lib/tourSteps'

function resolverElemento(selector: PasoConfig['selector']): Element | null {
  if (!selector) return null
  if (typeof selector === 'string') return document.querySelector(selector)
  return selector() ?? null
}

interface TourContextValue {
  activo: boolean
  pasoActual: PasoId | null
  iniciarTour: () => void
  avanzarSiEsperando: (paso: PasoId) => void
}

const TourContext = createContext<TourContextValue | undefined>(undefined)

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [pasoActual, setPasoActual] = useState<PasoId | null>(null)
  const pasoActualRef = useRef<PasoId | null>(null)
  const driverRef = useRef<Driver | null>(null)
  const transicionRef = useRef(false)

  useEffect(() => {
    pasoActualRef.current = pasoActual
  }, [pasoActual])

  const destruirInstancia = useCallback(() => {
    transicionRef.current = true
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  const finalizarManual = useCallback(() => {
    destruirInstancia()
    setPasoActual(null)
  }, [destruirInstancia])

  const avanzarSiEsperando = useCallback(
    (paso: PasoId) => {
      if (pasoActualRef.current !== paso) return
      destruirInstancia()
      setPasoActual(SIGUIENTE[paso])
    },
    [destruirInstancia],
  )

  const irAPaso = useCallback(
    (paso: PasoId) => {
      destruirInstancia()
      const ruta = PASOS[paso]?.ruta
      if (ruta) navigate(ruta)
      setPasoActual(paso)
    },
    [destruirInstancia, navigate],
  )

  const iniciarTour = useCallback(() => {
    irAPaso('bienvenida')
  }, [irAPaso])

  useEffect(() => {
    if (!pasoActual) return
    const cfg = PASOS[pasoActual]
    if (!cfg) return

    const abortListener = new AbortController()

    const instancia = driver({
      allowClose: true,
      showButtons: cfg.mostrarBoton ? ['next', 'close'] : ['close'],
      doneBtnText: cfg.doneBtnText ?? 'Siguiente',
      onDestroyStarted: () => {
        if (transicionRef.current) {
          transicionRef.current = false
          return
        }
        driverRef.current = null
        setPasoActual(null)
      },
      steps: [
        {
          element: cfg.selector,
          waitForElement: cfg.selector ? 2000 : undefined,
          skipMissingElement: true,
          onHighlightStarted: (el) => {
            if (el) {
              const reintentarScroll = () => {
                const elemento = resolverElemento(cfg.selector) ?? el
                elemento.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' })
                requestAnimationFrame(() => requestAnimationFrame(() => driverRef.current?.refresh()))
              }
              reintentarScroll()
              const reintentos = [300, 800, 1500].map((ms) => setTimeout(reintentarScroll, ms))
              abortListener.signal.addEventListener('abort', () => reintentos.forEach(clearTimeout))

              if (cfg.avanzarAlClickReal !== false) {
                el.addEventListener('click', () => avanzarSiEsperando(pasoActual), {
                  once: true,
                  signal: abortListener.signal,
                })
              }
            }
          },
          popover: {
            title: cfg.title,
            description: cfg.description,
            onNextClick: cfg.mostrarBoton
              ? () => (cfg.saltarA ? irAPaso(cfg.saltarA) : avanzarSiEsperando(pasoActual))
              : undefined,
            onCloseClick: finalizarManual,
          },
        },
      ],
    })

    driverRef.current = instancia
    instancia.drive()

    return () => {
      abortListener.abort()
      transicionRef.current = true
      driverRef.current?.destroy()
      driverRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasoActual])

  const value: TourContextValue = {
    activo: pasoActual !== null,
    pasoActual,
    iniciarTour,
    avanzarSiEsperando,
  }

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within TourProvider')
  return ctx
}
