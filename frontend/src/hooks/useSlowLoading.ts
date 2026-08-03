import { useEffect, useState } from 'react'

const UMBRAL_MS = 4000

export function useSlowLoading(isLoading: boolean) {
  const [esLenta, setEsLenta] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setEsLenta(false)
      return
    }

    const timer = setTimeout(() => setEsLenta(true), UMBRAL_MS)
    return () => clearTimeout(timer)
  }, [isLoading])

  return esLenta
}
