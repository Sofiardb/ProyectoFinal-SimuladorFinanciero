/**
 * Recorrido guiado multi-página: crear un portfolio, agregarle un instrumento y (opcionalmente)
 * simularlo. Cada paso "visible" se muestra con una instancia de driver.js de un solo paso — el
 * avance entre pasos lo maneja TourContext, no driver.js, porque hay pasos que dependen de
 * navegación real (redirect al crear portfolio) o de una mutación async (agregar instrumento,
 * lanzar simulación) en vez de un simple "Siguiente".
 */
export type PasoId =
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

export const SIGUIENTE: Record<PasoId, PasoId | null> = {
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

export interface PasoConfig {
  selector?: string | (() => Element)
  title: string
  description: string
  mostrarBoton?: boolean
  doneBtnText?: string
  saltarA?: PasoId
  avanzarAlClickReal?: boolean
  ruta?: string
}

export const PASOS: Partial<Record<PasoId, PasoConfig>> = {
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
