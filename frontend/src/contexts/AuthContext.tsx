import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getExpiresAt, getToken, setExpiresAt, setSessionExpiredHandler, setToken as persistToken } from '@/api/client'
import type { AuthResponse, Usuario } from '@/types'

interface AuthContextValue {
  usuario: Usuario | null
  isAuthenticated: boolean
  login: (auth: AuthResponse) => void
  logout: () => void
  updateUsuario: (usuario: Usuario) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const USER_KEY = 'investlab_usuario'


function sesionVencida(): boolean {
  const expiresAt = getExpiresAt()
  return expiresAt !== null && Date.now() >= expiresAt
}

function limpiarSesionStorage(): void {
  persistToken(null)
  setExpiresAt(null)
  localStorage.removeItem(USER_KEY)
}

function loadStoredUsuario(): Usuario | null {
  if (!getToken()) return null
  if (sesionVencida()) {
    limpiarSesionStorage()
    return null
  }
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Usuario
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(loadStoredUsuario)
  const queryClient = useQueryClient()

  const login = useCallback(
    (auth: AuthResponse) => {
      const nextUsuario: Usuario = {
        email:    auth.email ?? '',
        username: auth.username ?? '',
        nombre:   auth.nombre,
        apellido: auth.apellido,
        esAdmin:  auth.esAdmin,
      }

      queryClient.clear()
      persistToken(auth.token)
      setExpiresAt(auth.expiresAt)
      localStorage.setItem(USER_KEY, JSON.stringify(nextUsuario))
      setUsuario(nextUsuario)
    },
    [queryClient],
  )

  const logout = useCallback(() => {
    queryClient.clear()
    limpiarSesionStorage()
    setUsuario(null)
  }, [queryClient])

  const updateUsuario = useCallback((nextUsuario: Usuario) => {
    localStorage.setItem(USER_KEY, JSON.stringify(nextUsuario))
    setUsuario(nextUsuario)
  }, [])

 
  useEffect(() => {
    setSessionExpiredHandler(logout)

    function chequearVencimiento() {
      if (sesionVencida()) logout()
    }

    document.addEventListener('visibilitychange', chequearVencimiento)
    const intervalo = window.setInterval(chequearVencimiento, 60_000)

    return () => {
      setSessionExpiredHandler(null)
      document.removeEventListener('visibilitychange', chequearVencimiento)
      window.clearInterval(intervalo)
    }
  }, [logout])

  const value = useMemo(
    () => ({ usuario, isAuthenticated: usuario !== null, login, logout, updateUsuario }),
    [usuario, login, logout, updateUsuario],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
