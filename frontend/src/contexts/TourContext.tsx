import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

/**
 * Recorrido guiado multi-página: crear un portfolio, agregarle un instrumento y (opcionalmente)
 * simularlo. Cada paso "visible" se muestra con una instancia de driver.js de un solo paso — el
 * avance entre pasos lo maneja este contexto, no driver.js, porque hay pasos que dependen de
 * navegación real (redirect al crear portfolio) o de una mutación async (agregar instrumento,
 * lanzar simulación) en vez de un simple "Siguiente".
 */
type PasoId =
  | 'bienvenida'
  | 'ir-portfolios'
  | 'elegir-perfil'
  | 'crear-portfolio'
  | 'crear-portfolio-form'
  | 'agregar-instrumento'
  | 'agregar-instrumento-form'
  | 'simular-opcional'
  | 'simulacion-form'
  | 'ver-resultados'
  | 'resultados-guardados'
  | 'ir-historial'
  | 'comparar'

const SIGUIENTE: Record<PasoId, PasoId | null> = {
  bienvenida: 'ir-portfolios',
  'ir-portfolios': 'elegir-perfil',
  'elegir-perfil': 'crear-portfolio',
  'crear-portfolio': 'crear-portfolio-form',
  'crear-portfolio-form': 'agregar-instrumento',
  'agregar-instrumento': 'agregar-instrumento-form',
  'agregar-instrumento-form': 'simular-opcional',
  'simular-opcional': 'simulacion-form',
  'simulacion-form': 'ver-resultados',
  'ver-resultados': 'resultados-guardados',
  'resultados-guardados': 'ir-historial',
  'ir-historial': 'comparar',
  comparar: null,
}

interface PasoConfig {
  selector?: string | (() => Element)
  title: string
  description: string
  mostrarBoton?: boolean
  doneBtnText?: string
  saltarA?: PasoId
  avanzarAlClickReal?: boolean
  ruta?: string
}

const PASOS: Partial<Record<PasoId, PasoConfig>> = {
  bienvenida: {
    title: '¡Empecemos!',
    description:
      'Te mostramos paso a paso cómo armar tu primer portfolio, agregarle un instrumento y simularlo. Podés salir cuando quieras con la X.',
    mostrarBoton: true,
    doneBtnText: 'Comenzar',
  },
  'ir-portfolios': {
    selector: '[data-tour="tour-portfolios"]',
    title: 'Tus portfolios',
    description: 'Hacé clic acá para ir a Mis portfolios.',
  },
  'elegir-perfil': {
    selector: '[data-tour="tour-perfil-tabs"]',
    title: 'Elegí un perfil de riesgo',
    description: 'Acá vas a poder seleccionar el perfil de riesgo que querés gestionar y crear un portfolio.',
    mostrarBoton: true,
    doneBtnText: 'Siguiente',
  },
  'crear-portfolio': {
    selector: '[data-tour="tour-crear-portfolio"]',
    title: 'Creá tu primer portfolio',
    description: 'Hacé clic acá para crear un portfolio con el perfil elegido.',
  },
  'agregar-instrumento': {
    selector: '[data-tour="tour-agregar-instrumento"]',
    title: 'Agregá un instrumento',
    description:
      'Sumá al menos un instrumento a tu portfolio — por ejemplo, un plazo fijo. Hacé clic acá para agregarlo.',
  },
  'simular-opcional': {
    selector: '[data-tour="tour-simular"]',
    title: '¿Simulamos?',
    description:
      'Si querés, corré una simulación Monte Carlo para proyectar este portfolio. Si preferís hacerlo más tarde, salteá este paso.',
    mostrarBoton: true,
    doneBtnText: 'Saltar',
    saltarA: 'comparar',
  },
  'simulacion-form': {
    selector: '[data-tour="tour-lanzar-simulacion"]',
    title: 'Lanzá la simulación',
    description:
      'Hacé clic en "Lanzar simulación" para correr el modelo Monte Carlo. Puede tardar unos segundos.',
    avanzarAlClickReal: false,
  },
  'ver-resultados': {
    selector: '[data-tour="tour-ver-resultados"]',
    title: '¡Simulación lista!',
    description: 'Hacé clic para ver los resultados en detalle.',
  },
  'resultados-guardados': {
    title: 'Resultado guardado',
    description:
      'Este resultado ya quedó guardado. Podés volver a verlo cuando quieras desde Historial, sin tener que re-simularlo.',
    mostrarBoton: true,
    doneBtnText: 'Entendido',
  },
  'ir-historial': {
    selector: () => {
      const candidatos = Array.from(document.querySelectorAll<HTMLElement>('[data-tour="tour-historial-nav"]'))
      return (candidatos.find((el) => el.offsetParent !== null) ?? null) as unknown as Element
    },
    title: 'Historial',
    description: 'Hacé clic acá para ver todas tus simulaciones pasadas.',
  },
  comparar: {
    selector: '[data-tour="tour-comparar"]',
    ruta: '/simulaciones',
    title: 'Comparar simulaciones',
    description:
      'Cuando tengas dos simulaciones, marcálas en la lista y compará cómo evolucionan lado a lado.',
    mostrarBoton: true,
    doneBtnText: 'Listo',
  },
}

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
